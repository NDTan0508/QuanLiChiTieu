import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Bitcoin,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Database,
  Download,
  FileText,
  History,
  KeyRound,
  Pencil,
  Landmark,
  LineChart,
  ListFilter,
  Lock,
  PiggyBank,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  Trash2,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import {
  DataStatus,
  AdminAccountProfile,
  cloudAccountIdForKey,
  deleteAdminAccountProfile,
  deleteCloudState,
  deleteCloudPayloadRow,
  isCloudSyncConfigured,
  listAdminAccounts,
  loadDataStatus,
  loadAdminPasswordHash,
  loadCloudPayloadRows,
  loadCloudSnapshot,
  loadCloudState,
  saveCloudState,
  upsertAdminAccountProfile,
  upsertCloudPayloadRow,
} from "./cloudSync";
import { AppNav, type AppNavPage } from "./components/AppNav";
import { BreakdownPie } from "./components/BreakdownPie";
import { MetricCard } from "./components/MetricCard";
import { MonthPicker } from "./components/MonthPicker";
import { SourceTraceModal } from "./components/SourceTraceModal";
import { AdminPage, type AdminActionResult } from "./pages/AdminPage";
import { PinGate } from "./pages/PinGate";
import {
  DEFAULT_ALLOCATION_STRATEGIES,
  DEFAULT_FINANCIAL_ACCOUNTS,
  FINANCIAL_SCHEMA_VERSION,
  normalizeFinancialMetadata,
  stableEventId,
} from "./domain/financialTypes";
import type {
  AllocationPlan,
  AdjustmentTransaction,
  AllocationStrategy,
  CorporateAction,
  FinancialAccount,
  HealthIssue,
  MoneyFlowEdge,
  ReconciliationSession,
  TransactionMeta,
} from "./domain/financialTypes";
import { buildFinancialIndex } from "./domain/financialIndex";
import { runHealthChecks } from "./domain/healthCheck";
import {
  MBB_SETTLEMENT_INCOME_CATEGORY_ID,
  MBB_SETTLEMENT_INCOME_SCHEMA_VERSION,
  appendMbbSettlementIncome,
  isIncomeGeneratingMbbSettlement,
  mbbSettlementIncomeCategory,
  mbbSettlementIncomeId,
  migrateMbbSettlementIncome,
} from "./domain/bankDepositSettlement";
import { buildCryptoLedger, buildSolLedger, findSolDerivedTopupCostEventIndex } from "./domain/cryptoLedger";
import { realizedStockSalePnl, stockOpenPositionSnapshot } from "./domain/stockPnl";

type Page = AppNavPage;

type IncomeCategory = {
  id: string;
  name: string;
  kind: "fixed" | "variable";
};

type IncomeTransaction = {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  month: string;
  note: string;
  meta?: TransactionMeta;
};

type ExpenseCategory = {
  id: string;
  name: string;
  kind: "fixed" | "variable";
  defaultAmount: number;
  accumulationGoalId: string;
};

type MonthlyExpense = {
  id: string;
  categoryId: string;
  month: string;
  startAmount: number;
  endAmount: number;
  amount: number;
  checked: boolean;
  meta?: TransactionMeta;
};

type AccumulationStatus = "active" | "ended" | "deleted";

type AccumulationGoal = {
  id: string;
  name: string;
  targetAmount: number;
  startMonth: string;
  dueDate?: string;
  months: number;
  monthlyAmount: number;
  categoryId: string;
  status: AccumulationStatus;
  endedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  meta?: TransactionMeta;
};

type ExpenseEntry = {
  id: string;
  categoryId: string;
  month: string;
  amount: number;
  date: string;
  note: string;
  meta?: TransactionMeta;
};

type Allocation = {
  month: string;
  btcPercent: number;
  stockPercent: number;
  savingPercent: number;
  emergencyPercent: number;
  confirmedAt?: string;
  btcAmount?: number;
  stockAmount?: number;
  savingAmount?: number;
  emergencyAmount?: number;
  lockedFunds?: AllocationFundKey[];
  baseBtcPercent?: number;
  baseStockPercent?: number;
  baseSavingPercent?: number;
  baseEmergencyPercent?: number;
  totalSavingAtConfirm?: number;
  savingDepositRequestedAt?: string;
  emergencyDepositRequestedAt?: string;
  savingDepositCreatedAt?: string;
  emergencyDepositCreatedAt?: string;
  meta?: TransactionMeta;
};

type FundKey = "btc" | "stock";
type InvestmentTab = "crypto" | "stock" | "mbb";
type MbbDepositView = "active" | "settled";
type TransferDepositFund = "saving" | "emergency";
type DepositFund = TransferDepositFund | "accumulation";
type DepositFilter = "all" | DepositFund;
type SolDestination = FundKey | TransferDepositFund | "cash" | "btc-direct";
type StockCashWithdrawDestination = Exclude<SolDestination, "stock" | "btc-direct">;
type ReportChartKey = "current-assets" | "net-accumulation" | FundKey | TransferDepositFund;

type ReportMonthlySnapshot = {
  month: string;
  btc: number;
  stock: number;
  sol: number;
  sourceHash: string;
  createdAt: string;
  updatedAt: string;
};

type StockPurchaseLine = {
  symbol: string;
  shares: number;
  buyPrice: number;
};

type StockPurchase = {
  id: string;
  date: string;
  month: string;
  note: string;
  lines: StockPurchaseLine[];
  createdAt?: string;
  meta?: TransactionMeta;
};

type StockSale = {
  id: string;
  symbol: string;
  shares: number;
  sellPrice: number;
  vndAmount: number;
  fee?: number;
  tax?: number;
  netVndAmount?: number;
  destination: SolDestination;
  date: string;
  note: string;
  createdAt?: string;
  meta?: TransactionMeta;
};

type StockMarketPrice = {
  symbol: string;
  price: number;
  updatedAt: string;
  source: string;
};

type StockLookupSuggestion = {
  symbol: string;
  name: string;
  exchange?: string;
  price?: number;
  source: string;
};

type StockBuyRow = {
  id: string;
  symbol: string;
  percent: string;
  shares: string;
  buyPrice: string;
  buyPriceTouched?: boolean;
  sharesTouched?: boolean;
};

type FundTransaction = {
  id: string;
  fund: FundKey;
  type: "deposit" | "withdraw";
  amount: number;
  date: string;
  month: string;
  note: string;
  meta?: TransactionMeta;
};

type DepositStatus =
  | "active"
  | "rolled-principal"
  | "rolled-all"
  | "settled"
  | "early-settled";

type DepositProduct = "term-deposit" | "certificate";

type BankDeposit = {
  id: string;
  code: string;
  fund: DepositFund;
  product?: DepositProduct;
  accumulationGoalId: string;
  mbLast4: string;
  principal: number;
  certificatePurchaseAmount?: number;
  certificateMaturityValue?: number;
  rate: number;
  termMonths: number;
  startDate: string;
  maturityDate: string;
  status: DepositStatus;
  parentId?: string;
  childId?: string;
  createdFromMonth?: string;
  createdFromSolWithdrawalId?: string;
  settledAt?: string;
  settledAmount?: number;
  note: string;
  meta?: TransactionMeta;
};

type AllocationAmounts = {
  btc: number;
  stock: number;
  saving: number;
  emergency: number;
  savingRemainder: number;
  emergencyRemainder: number;
};

type AllocationFundKey = "btc" | "stock" | "saving" | "emergency";
type AllocationPercentKey = "btcPercent" | "stockPercent" | "savingPercent" | "emergencyPercent";
type AllocationAmountKey = "btcAmount" | "stockAmount" | "savingAmount" | "emergencyAmount";
type AllocationBasePercentKey = "baseBtcPercent" | "baseStockPercent" | "baseSavingPercent" | "baseEmergencyPercent";

const ALLOCATION_FUND_KEYS: AllocationFundKey[] = ["btc", "stock", "saving", "emergency"];
const ALLOCATION_AMOUNT_KEYS: Record<AllocationFundKey, AllocationAmountKey> = {
  btc: "btcAmount",
  stock: "stockAmount",
  saving: "savingAmount",
  emergency: "emergencyAmount",
};

type IncomeSummaryRow = {
  id: string;
  name: string;
  value: number;
  transactions: IncomeTransaction[];
};

type ExpenseSummaryRow = {
  id: string;
  name: string;
  value: number;
  transactions: ExpenseEntry[];
  kind: ExpenseCategory['kind'];
};

type SolBuyTransaction = {
  id: string;
  type?: "buy";
  solAmount: number;
  buyPrice: number;
  costVnd?: number;
  date: string;
  occurredAt?: string;
  note: string;
  meta?: TransactionMeta;
};

type SolWithdrawTransaction = {
  id: string;
  type: "withdraw";
  solAmount: number;
  sellPrice: number;
  usdtAmount?: number;
  vndAmount: number;
  destination: SolDestination;
  date: string;
  occurredAt?: string;
  closesPosition?: boolean;
  note: string;
  meta?: TransactionMeta;
};

type SolTransaction = SolBuyTransaction | SolWithdrawTransaction;

type BtcUsdtTopup = {
  id: string;
  vndAmount: number;
  usdtAmount: number;
  date: string;
  occurredAt?: string;
  sourceSolWithdrawalId?: string;
  note: string;
  meta?: TransactionMeta;
};

type BtcDcaFrequency = "daily" | "weekly" | "monthly";
type BtcDcaStatus = "active" | "paused" | "insufficient-usdt";

type BtcDcaPlan = {
  id: string;
  amountUsdt: number;
  frequency: BtcDcaFrequency;
  time: string;
  startDate: string;
  nextRunAt: string;
  isActive: boolean;
  status: BtcDcaStatus;
  statusNote?: string;
  lastRunAt?: string;
  btcAmountOverride?: number;
  averagePriceUsdtOverride?: number;
  note: string;
  meta?: TransactionMeta;
};

type BtcTradeType = "dca" | "manual-buy";

type BtcTrade = {
  id: string;
  type: BtcTradeType;
  usdtAmount: number;
  btcAmount: number;
  btcPriceUsdt: number;
  costVnd?: number;
  executedAt: string;
  planId?: string;
  note: string;
  meta?: TransactionMeta;
};

type BtcTransferDestination = "stock" | TransferDepositFund | "cash";
type BtcTransferTarget = BtcTransferDestination | "btc" | "usdt";

type BtcTransfer = {
  id: string;
  asset: "btc" | "usdt";
  btcAmount: number;
  usdtAmount: number;
  btcPriceUsdt: number;
  vndAmount: number;
  destination: BtcTransferTarget;
  date: string;
  occurredAt?: string;
  closesPosition?: boolean;
  note: string;
  meta?: TransactionMeta;
};

type BtcCloudLedger = {
  topups: BtcUsdtTopup[];
  dcaPlans: BtcDcaPlan[];
  trades: BtcTrade[];
  transfers: BtcTransfer[];
};

type Market = {
  solUsd: number;
  btcUsdt: number;
  usdtVnd: number;
  usdVnd: number;
  updatedAt: string;
  btcSource?: string;
  solSource?: string;
  usdtSource?: string;
  isFallback?: boolean;
  lastError?: string;
};

type SettingsState = {
  pin: string;
  hasPin: boolean;
  autoLockEnabled: boolean;
  pinLoginDisabledUntil?: string | "manual";
  dismissedCryptoAllocationIds: string[];
  dismissedStockAllocationIds: string[];
};

type AuditEntityType =
  | "income"
  | "income-category"
  | "expense"
  | "expense-category"
  | "allocation"
  | "accumulation"
  | "financial-account"
  | "health"
  | "reconciliation"
  | "adjustment"
  | "corporate-action"
  | "allocation-plan"
  | "btc-topup"
  | "btc-dca"
  | "btc-trade"
  | "btc-transfer"
  | "stock-purchase"
  | "stock-sale"
  | "sol"
  | "deposit"
  | "backup"
  | "restore"
  | "trash"
  | "general";

type AuditAction = "create" | "update" | "delete" | "restore" | "backup" | "undo" | "sync";

type AuditLog = {
  id: string;
  label: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  createdAt: string;
  beforeSummary?: string;
  afterSummary?: string;
};

type TrashItem = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  label: string;
  deletedAt: string;
  expiresAt: string;
  payload: unknown;
  relatedPayloads?: Record<string, unknown>;
};

type BackupMeta = {
  lastExportAt?: string;
  lastRestoreAt?: string;
};

type AppState = {
  schemaVersion: number;
  incomeCategories: IncomeCategory[];
  incomeTransactions: IncomeTransaction[];
  expenseCategories: ExpenseCategory[];
  monthlyExpenses: MonthlyExpense[];
  accumulationGoals: AccumulationGoal[];
  expenseEntries: ExpenseEntry[];
  allocations: Allocation[];
  fundTransactions: FundTransaction[];
  stockPurchases: StockPurchase[];
  stockSales: StockSale[];
  stockMarketPrices: StockMarketPrice[];
  btcUsdtTopups: BtcUsdtTopup[];
  btcDcaPlans: BtcDcaPlan[];
  btcTrades: BtcTrade[];
  btcTransfers: BtcTransfer[];
  bankDeposits: BankDeposit[];
  solTransactions: SolTransaction[];
  market: Market;
  settings: SettingsState;
  auditLogs: AuditLog[];
  trashItems: TrashItem[];
  backupMeta?: BackupMeta;
  financialAccounts: FinancialAccount[];
  moneyFlowEdges: MoneyFlowEdge[];
  healthIssues: HealthIssue[];
  reconciliationSessions: ReconciliationSession[];
  adjustmentTransactions: AdjustmentTransaction[];
  corporateActions: CorporateAction[];
  allocationStrategies: AllocationStrategy[];
  allocationPlans: AllocationPlan[];
  reportMonthlySnapshots: ReportMonthlySnapshot[];
};

type UndoEntry = {
  id: string;
  label: string;
  state: AppState;
  createdAt: string;
};
type CommitMeta = {
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  beforeSummary?: string;
  afterSummary?: string;
};
type CommitWithUndo = (label: string, updater: React.SetStateAction<AppState>, meta?: CommitMeta) => void;
type InvestmentActionKind = "btc-topup" | "stock-purchase" | "mbb-deposit";
type PlanActionLink = {
  allocationPlanId: string;
  planItemId: string;
};
type InvestmentActionIntent = {
  id: string;
  tab: InvestmentTab;
  action: InvestmentActionKind;
  planLink?: PlanActionLink;
  amountVnd?: number;
  targetFund?: string;
};

type MbbDepositIntent = {
  id: string;
  fund: DepositFund;
  accumulationGoalId: string;
};

const STORAGE_KEY = "quan-li-chi-tieu-state-v3-account-pin-reset";
const CLOUD_ACCOUNT_NAMESPACE = "quan-li-chi-tieu-account-pin-reset-v1";
const BACKUP_VERSION = 2;
const AUTO_RESTORE_BACKUP_KEY = `${STORAGE_KEY}-pre-restore-backup`;
const AUTO_MIGRATION_BACKUP_KEY = `${STORAGE_KEY}-pre-migration-backup`;
const DEFAULT_ADMIN_PASSWORD_HASH = "83e9887aca4b4c1d7b8688d6392c5f20c77a1dc405c3d5406918c46c68da6063";
const AUTO_LOCK_MS = 5 * 60_000;
const DEFAULT_START_MONTH = "2026-06";
const FINANCIAL_RULE_START_MONTH = "2026-07";
const FINANCIAL_RULE_MIN_MONTHLY_EXPENSE = 10_000_000;
const CERTIFICATE_LOT = 100_000;
const DEFAULT_DEPOSIT_TERM_MONTHS = 6;
const STOCK_PRICE_UNIT = 1_000;
const STOCK_PAR_VALUE = 10_000;
const STOCK_LOT = 100;
const MARKET_PRICE_REFRESH_MS = 60 * 1000;
const COLORS = ["#f97316", "#14b8a6", "#eab308", "#60a5fa", "#f43f5e", "#a78bfa"];

const dateValueFromDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dateValueFromDateTime = (value: string) => dateValueFromDate(new Date(value));

const today = () => dateValueFromDate(new Date());
const uid = () => Math.random().toString(36).slice(2, 10);

const addDaysIso = (iso: string, days: number) => {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const isVietnamStockTradingSession = (date = new Date()) => {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return (minutes >= 9 * 60 && minutes <= 11 * 60 + 30) || (minutes >= 13 * 60 && minutes <= 15 * 60);
};

const monthFromDate = (value: string) => value.slice(0, 7);

const monthIndex = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
};

const monthsBetweenInclusive = (startMonth: string, endMonth: string) =>
  Math.max(monthIndex(endMonth) - monthIndex(startMonth) + 1, 1);

const monthRange = (startMonth: string, months: number) =>
  Array.from({ length: Math.max(months, 0) }, (_, index) => shiftMonth(startMonth, index));

const addMonths = (dateValue: string, months: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return dateValueFromDate(date);
};

const DAY_IN_MS = 86_400_000;

const daysUntil = (dateValue: string) => {
  const now = new Date(`${today()}T00:00:00`).getTime();
  const target = new Date(`${dateValue}T00:00:00`).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(target)) return 0;
  return Math.ceil((target - now) / DAY_IN_MS);
};

const dateOnlyTime = (dateValue: string) => new Date(`${dateValue}T00:00:00`).getTime();

const occurredAtForDate = (dateValue: string) => {
  const now = new Date();
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
};

const closesCryptoPosition = (amount: number, balance: number) =>
  balance > 0 && Math.max(balance - amount, 0) <= Math.max(balance * 0.0001, 0.00000001);

const daysBetween = (startDate: string, endDate: string) => {
  const start = dateOnlyTime(startDate);
  const end = dateOnlyTime(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(Math.ceil((end - start) / DAY_IN_MS), 0);
};

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateValueFromDate(date);
};

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const formatShortDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

const formatMonth = (value: string) => {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
};

const shiftMonth = (value: string, delta: number) => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const lastDayOfMonth = (monthValue: string) => {
  const [year, month] = monthValue.split("-").map(Number);
  return dateValueFromDate(new Date(year, month, 0));
};

const isAllocationReminderDue = (monthValue: string) => today() >= lastDayOfMonth(monthValue);

const formatVnd = (value: number) =>
  `${Math.round(value).toLocaleString("vi-VN")}đ`;

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

const formatCompactPercent = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

const formatSignedCompactPercent = (value: number) => {
  if (Math.abs(value) < 0.05) return "0%";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatCompactPercent(Math.abs(value))}`;
};

const monthlyChangePercent = (current: number, previous: number) => {
  if (previous > 0) return ((current - previous) / previous) * 100;
  if (current > 0) return 100;
  return 0;
};

const depositRateForTerm = (termMonths: number) => {
  if (termMonths < 1) return "4";
  if (termMonths === 1) return "6,5";
  if (termMonths === 2) return "6,7";
  if (termMonths <= 5) return "7";
  return "7,1";
};

const ASSET_MILESTONES = [
  50_000_000,
  100_000_000,
  200_000_000,
  500_000_000,
  1_000_000_000,
  2_000_000_000,
  5_000_000_000,
  10_000_000_000,
];

const nextAssetMilestone = (value: number) => {
  const normalized = Math.max(value, 0);
  const preset = ASSET_MILESTONES.find((milestone) => normalized <= milestone);
  if (preset) return preset;

  const multipliers = [2, 5, 10];
  let unit = 10_000_000_000;
  let index = 0;
  let milestone = unit * multipliers[index];

  while (normalized > milestone) {
    index += 1;
    if (index >= multipliers.length) {
      index = 0;
      unit *= 10;
    }
    milestone = unit * multipliers[index];
  }

  return milestone;
};

const formatUsd = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} USDT`;

const formatUsdt = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} USDT`;

const formatSignedVnd = (value: number) => `${value > 0 ? "+" : ""}${formatVnd(value)}`;
const formatSignedUsdt = (value: number) => `${value > 0 ? "+" : ""}${formatUsdt(value)}`;

const formatBtc = (value: number) =>
  `${value.toLocaleString("vi-VN", { minimumFractionDigits: 8, maximumFractionDigits: 8 })} BTC`;

const formatSolAmount = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 8 })} SOL`;

const formatStockPrice = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const formatStockAveragePrice = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

const formatMoneyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};

const formatDecimalInput = (value: string) => {
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (!cleaned) return "";
  const decimalSeparator = (() => {
    const comma = cleaned?.lastIndexOf(",");
    if (comma >= 0) return comma;
    const dot = cleaned?.lastIndexOf(".");
    if (dot < 0) return -1;
    const parts = cleaned?.split(".");
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    return looksLikeThousands ? -1 : dot;
  })();
  const integerRaw = decimalSeparator >= 0 ? cleaned?.slice(0, decimalSeparator) : cleaned;
  const decimalRaw = decimalSeparator >= 0 ? cleaned?.slice(decimalSeparator + 1) : "";
  const integerDigits = integerRaw.replace(/[^\d]/g, "");
  const integerPart = integerDigits ? Number(integerDigits).toLocaleString("vi-VN") : "";
  if (decimalSeparator >= 0) return `${integerPart || "0"},${decimalRaw.replace(/[^\d]/g, "")}`;
  return integerPart;
};

const formatDecimalNumberInput = (value: number, maximumFractionDigits = 8) => {
  if (!Number.isFinite(value)) return "";
  return formatDecimalInput(value.toLocaleString("vi-VN", { useGrouping: false, maximumFractionDigits }));
};

const decimalSeparatorIndex = (value: string) => {
  const comma = value.lastIndexOf(",");
  if (comma >= 0) return comma;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return -1;
  const parts = value.split(".");
  const looksLikeThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
  return looksLikeThousands ? -1 : dot;
};

const cursorAfterDigits = (value: string, digitCount: number) => {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) seen += 1;
    if (seen >= digitCount) return index + 1;
  }
  return value.length;
};

const restoreFormattedInputCursor = (input: HTMLInputElement, nextValue: string, nextCursor: number) => {
  window.requestAnimationFrame(() => {
    if (document.activeElement !== input) return;
    const cursor = Math.min(nextCursor, nextValue.length);
    input.setSelectionRange(cursor, cursor);
  });
};

const formatMoneyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  const cursor = input.selectionStart ?? input.value.length;
  const formatted = formatMoneyInput(input.value);
  const digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, "").length;
  restoreFormattedInputCursor(input, formatted, cursorAfterDigits(formatted, digitsBeforeCursor));
  return formatted;
};

const formatDecimalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  const cursor = input.selectionStart ?? input.value.length;
  const raw = input.value;
  const formatted = formatDecimalInput(raw);
  const separator = decimalSeparatorIndex(raw);

  if (separator >= 0 && cursor > separator) {
    const decimalDigitsBeforeCursor = raw.slice(separator + 1, cursor).replace(/\D/g, "").length;
    const formattedSeparator = formatted.indexOf(",");
    const nextCursor = formattedSeparator >= 0 ? formattedSeparator + 1 + decimalDigitsBeforeCursor : formatted.length;
    restoreFormattedInputCursor(input, formatted, nextCursor);
    return formatted;
  }

  const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
  restoreFormattedInputCursor(input, formatted, cursorAfterDigits(formatted, digitsBeforeCursor));
  return formatted;
};

const formatSolInput = (value: string) => {
  const formatted = formatDecimalInput(value);
  if (!formatted.includes(",")) return formatted;
  const [integerPart, decimalPart = ""] = formatted.split(",");
  return `${integerPart},${decimalPart.slice(0, 8)}`;
};

const formatSolChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  const cursor = input.selectionStart ?? input.value.length;
  const raw = input.value;
  const formatted = formatSolInput(raw);
  const separator = decimalSeparatorIndex(raw);

  if (separator >= 0 && cursor > separator) {
    const decimalDigitsBeforeCursor = Math.min(raw.slice(separator + 1, cursor).replace(/\D/g, "").length, 8);
    const formattedSeparator = formatted.indexOf(",");
    const nextCursor = formattedSeparator >= 0 ? formattedSeparator + 1 + decimalDigitsBeforeCursor : formatted.length;
    restoreFormattedInputCursor(input, formatted, nextCursor);
    return formatted;
  }

  const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
  restoreFormattedInputCursor(input, formatted, cursorAfterDigits(formatted, digitsBeforeCursor));
  return formatted;
};

function InputWithMax({
  value,
  onChange,
  onMax,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMax: () => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="input-with-max">
      <input value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} />
      <button className="input-max-button" onClick={onMax} type="button">Max</button>
    </div>
  );
}

const parseMoney = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;
const parseDecimal = (value: string) => {
  const cleaned = value.trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  const lastComma = cleaned?.lastIndexOf(",");
  if (lastComma >= 0) {
    const integerPart = cleaned?.slice(0, lastComma).replace(/[.,]/g, "");
    const decimalPart = cleaned?.slice(lastComma + 1).replace(/[.,]/g, "");
    return Number(`${integerPart || "0"}.${decimalPart}`) || 0;
  }
  const parts = cleaned?.split(".");
  if (parts.length > 1 && parts.slice(1).every((part) => part.length === 3)) {
    return Number(parts.join("")) || 0;
  }
  const decimalIndex = cleaned?.lastIndexOf(".");
  if (decimalIndex === -1) return Number(cleaned) || 0;
  const integerPart = cleaned?.slice(0, decimalIndex).replace(/[.,]/g, "");
  const decimalPart = cleaned?.slice(decimalIndex + 1).replace(/[.,]/g, "");
  return Number(`${integerPart || "0"}.${decimalPart}`) || 0;
};

const estimateBtcFromSolInput = (solInput: string, solPriceInput: string, btcPriceUsdt: number) => {
  const usdtAmount = parseDecimal(solInput) * parseDecimal(solPriceInput);
  return usdtAmount && btcPriceUsdt ? formatDecimalInput((usdtAmount / btcPriceUsdt).toFixed(7)) : "";
};

const formatTransferReceiveInput = (
  value: number,
  unit: "BTC" | "USDT" | "VND"
) => {
  if (!Number.isFinite(value) || value <= 0) return "";

  if (unit === "BTC") {
    return value.toLocaleString("vi-VN", {
      useGrouping: true,
      maximumFractionDigits: 8,
    });
  }

  if (unit === "USDT") {
    return value.toLocaleString("vi-VN", {
      useGrouping: true,
      maximumFractionDigits: 3,
    });
  }

  return Math.round(value).toLocaleString("vi-VN");
};

const stockBuyPriceInput = (row: StockBuyRow, marketPrice: number) =>
  row.buyPrice || (!row.buyPriceTouched && marketPrice > 0 ? formatStockPrice(marketPrice) : "");
const cloudAccountKeyForPin = (pin: string) => `${CLOUD_ACCOUNT_NAMESPACE}:${pin}`;
const stateForAccountPin = (state: AppState, pin: string): AppState => ({
  ...state,
  settings: { ...state.settings, hasPin: true, pin },
});
const sha256Hex = async (value: string) => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

type DepositInterestInput = Pick<BankDeposit, "principal" | "certificatePurchaseAmount" | "certificateMaturityValue" | "rate" | "termMonths" | "startDate" | "maturityDate" | "product">;

const interestDaysFor = (deposit: DepositInterestInput) => {
  const actualDays = daysBetween(deposit.startDate, deposit.maturityDate);
  if (actualDays > 0) return actualDays;
  const termMonths = Number.isFinite(deposit.termMonths) ? deposit.termMonths : 0;
  return Math.max(Math.round((termMonths * 365) / 12), 0);
};

const interestForDays = (deposit: DepositInterestInput, dayCount: number) => {
  const principal = Number.isFinite(deposit.principal) ? deposit.principal : 0;
  const rate = Number.isFinite(deposit.rate) ? deposit.rate : 0;
  const days = Number.isFinite(dayCount) ? Math.max(dayCount, 0) : 0;
  return Math.round((principal * rate * days) / 100 / 365);
};

const estimateCertificateMaturityValue = (
  principal: number,
  rate: number,
  termMonths: number,
  startDate: string,
  maturityDate: string
) => {
  const deposit: DepositInterestInput = {
    principal,
    rate,
    termMonths,
    startDate,
    maturityDate,
    product: "certificate",
  };
  return Math.round(principal + interestForDays(deposit, interestDaysFor(deposit)));
};

const certificatePurchaseAmountFor = (deposit: DepositInterestInput) =>
  Number.isFinite(deposit.certificatePurchaseAmount) && (deposit.certificatePurchaseAmount ?? 0) > 0
    ? deposit.certificatePurchaseAmount ?? 0
    : deposit.principal;

const certificateMaturityValueFor = (deposit: DepositInterestInput) =>
  Number.isFinite(deposit.certificateMaturityValue) && (deposit.certificateMaturityValue ?? 0) > 0
    ? deposit.certificateMaturityValue ?? 0
    : deposit.principal + interestForDays(deposit, interestDaysFor(deposit));

const certificateProfitFor = (deposit: DepositInterestInput) => {
  const purchaseAmount = certificatePurchaseAmountFor(deposit);
  const maturityValue = certificateMaturityValueFor(deposit);
  return Math.round(maturityValue - purchaseAmount);
};

const interestFor = (deposit: DepositInterestInput) =>
  deposit.product === "certificate" ? certificateProfitFor(deposit) : interestForDays(deposit, interestDaysFor(deposit));

const elapsedInterestDaysFor = (deposit: BankDeposit, totalDays: number) => {
  if (deposit.status !== "active") return totalDays;
  return elapsedInterestDaysAt(deposit, totalDays, today());
};

const elapsedInterestDaysAt = (deposit: BankDeposit, totalDays: number, asOfDate: string) => {
  const start = dateOnlyTime(deposit.startDate);
  const current = dateOnlyTime(asOfDate);
  const maturity = dateOnlyTime(deposit.maturityDate);
  if (!Number.isFinite(start) || !Number.isFinite(current) || !Number.isFinite(maturity)) return 0;
  if (current < start) return 0;
  if (current >= maturity) return totalDays;
  if (deposit.product === "certificate") return Math.min(daysBetween(deposit.startDate, asOfDate), totalDays);
  return Math.min(daysBetween(deposit.startDate, asOfDate) + 1, totalDays);
};

const accruedInterestForDays = (deposit: BankDeposit, totalDays: number, elapsedDays: number) =>
  deposit.product === "certificate"
    ? Math.round((interestFor(deposit) * (totalDays > 0 ? elapsedDays / totalDays : 1)))
    : interestForDays(deposit, elapsedDays);

const accruedInterestAt = (deposit: BankDeposit, asOfDate: string) => {
  const totalDays = interestDaysFor(deposit);
  return accruedInterestForDays(deposit, totalDays, elapsedInterestDaysAt(deposit, totalDays, asOfDate));
};

function depositProgress(deposit: BankDeposit) {
  const totalDays = interestDaysFor(deposit);
  const remainingDays = deposit.status === "active" ? Math.max(daysUntil(deposit.maturityDate), 0) : 0;
  const elapsedDays = elapsedInterestDaysFor(deposit, totalDays);
  const progressPercent = totalDays > 0 ? Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100) : 100;
  return {
    totalDays,
    remainingDays,
    progressPercent,
    accruedInterest: accruedInterestForDays(deposit, totalDays, elapsedDays),
  };
}

const roundDownToCertificateLot = (amount: number) =>
  Math.floor(Math.max(amount, 0) / CERTIFICATE_LOT) * CERTIFICATE_LOT;

const allocationAmountOrDefault = (amount: number | undefined, fallback: number) =>
  typeof amount === "number" && Number.isFinite(amount) ? Math.max(amount, 0) : fallback;

const isSolWithdrawal = (transaction: SolTransaction): transaction is SolWithdrawTransaction =>
  transaction.type === "withdraw";

const solDestinationLabel = (destination: SolDestination) => {
  const labels: Record<SolDestination, string> = {
    btc: "BTC",
    "btc-direct": "BTC trực tiếp",
    stock: "CK",
    saving: "Tiết kiệm",
    emergency: "Dự phòng",
    cash: "Tiền mặt",
  };
  return labels[destination];
};

type CryptoAdjustmentAsset = "BTC" | "SOL" | "USDT";

const CRYPTO_ADJUSTMENT_ACCOUNT_ID = "binance";

const isCryptoQuantityAdjustment = (
  adjustment: AdjustmentTransaction,
  asset?: CryptoAdjustmentAsset
) =>
  adjustment.reason === "manual_adjustment" &&
  adjustment.accountId === CRYPTO_ADJUSTMENT_ACCOUNT_ID &&
  (asset ? adjustment.asset === asset : ["BTC", "SOL", "USDT"].includes(adjustment.asset)) &&
  typeof adjustment.quantity === "number" &&
  Number.isFinite(adjustment.quantity);

const cryptoQuantityAdjustment = (state: AppState, asset: CryptoAdjustmentAsset, upToMonth?: string) =>
  state.adjustmentTransactions
    .filter(
      (adjustment) =>
        isCryptoQuantityAdjustment(adjustment, asset) &&
        (!upToMonth || monthFromDate(adjustment.date) <= upToMonth)
    )
    .reduce((sum, adjustment) => sum + (adjustment.quantity ?? 0), 0);

function solPositionFromState(state: AppState, upToMonth?: string) {
  const ledger = solCostBasisLedger(state, upToMonth);
  return { balance: ledger.balance, cost: ledger.costUsdt };
}

function solToUsdtCostBasisEvents(state: AppState) {
  const releasedCosts = solCostBasisLedger(state).releasedByTransactionId;
  return state.solTransactions
    .filter((item): item is SolWithdrawTransaction => isSolWithdrawal(item) && item.destination === "btc")
    .map((item) => ({
      withdrawalId: item.id,
      date: item.date,
      usdtAmount: item.usdtAmount ?? item.solAmount * item.sellPrice,
      costVnd: releasedCosts[item.id] ?? 0,
    }));
}

function dcaRunAt(startDate: string, time: string) {
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  return new Date(`${startDate}T${safeTime}:00`);
}

function addDcaInterval(date: Date, frequency: BtcDcaFrequency) {
  const next = new Date(date);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
    return next;
  }
  const day = next.getDate();
  next.setMonth(next.getMonth() + 1);
  if (next.getDate() !== day) next.setDate(0);
  return next;
}

function shiftDcaDate(dateValue: string, frequency: BtcDcaFrequency, periods: number) {
  if (frequency === "daily") return addDays(dateValue, periods);
  if (frequency === "weekly") return addDays(dateValue, periods * 7);
  return addMonths(dateValue, periods);
}

function repairDcaTradeDates(trades: BtcTrade[], plans: BtcDcaPlan[]) {
  const nextTrades = [...trades];
  plans.forEach((plan) => {
    const related = nextTrades
      .map((trade, index) => ({ trade, index }))
      .filter(({ trade }) => trade.type === "dca" && trade.planId === plan.id)
      .sort((left, right) => left.trade.executedAt.localeCompare(right.trade.executedAt));
    if (!related?.length) return;

    const firstTradeDate = dateValueFromDateTime(related[0].trade.executedAt);
    const onePeriodBeforeStart = shiftDcaDate(plan.startDate, plan.frequency, -1);
    if (firstTradeDate !== onePeriodBeforeStart) return;

    related?.forEach(({ trade, index }, tradeIndex) => {
      nextTrades[index] = {
        ...trade,
        executedAt: localDateTimeIso(shiftDcaDate(plan.startDate, plan.frequency, tradeIndex), plan.time),
      };
    });
  });
  return nextTrades;
}

function localDateTimeIso(dateValue: string, time: string) {
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  return new Date(`${dateValue}T${safeTime}:00`).toISOString();
}

function nextDcaRunAt(plan: Pick<BtcDcaPlan, "startDate" | "time" | "frequency">, after = new Date()) {
  let runAt = dcaRunAt(plan.startDate, plan.time);
  while (runAt.getTime() <= after.getTime()) {
    runAt = addDcaInterval(runAt, plan.frequency);
  }
  return runAt.toISOString();
}

function normalizeDcaPlan(plan: BtcDcaPlan): BtcDcaPlan {
  return {
    ...plan,
    status: plan.isActive ? plan.status ?? "active" : "paused",
    nextRunAt: plan.nextRunAt || nextDcaRunAt(plan),
  };
}

function btcCloudLedgerFromState(state: AppState): BtcCloudLedger {
  return {
    topups: state.btcUsdtTopups,
    dcaPlans: state.btcDcaPlans,
    trades: state.btcTrades,
    transfers: state.btcTransfers,
  };
}

async function loadBtcCloudLedger(accountId: string): Promise<BtcCloudLedger> {
  const [topups, dcaPlans, trades, transfers] = await Promise.all([
    loadCloudPayloadRows<BtcUsdtTopup>("btc_usdt_topups", accountId),
    loadCloudPayloadRows<BtcDcaPlan>("btc_dca_plans", accountId),
    loadCloudPayloadRows<BtcTrade>("btc_trades", accountId),
    loadCloudPayloadRows<BtcTransfer>("btc_transfers", accountId),
  ]);
  return {
    topups: topups.map((item) => ({ ...item, occurredAt: item.occurredAt || item.meta?.createdAt || `${item.date}T00:00:00.000` })),
    dcaPlans: dcaPlans.map(normalizeDcaPlan),
    trades,
    transfers: transfers.map((item) => ({ ...item, occurredAt: item.occurredAt || item.meta?.createdAt || `${item.date}T00:00:00.000` })),
  };
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]) {
  const rows = new Map(local.map((item) => [item.id, item]));
  remote.forEach((item) => rows.set(item.id, item));
  return [...rows.values()];
}

function cryptoLedgerFromState(state: AppState, upToMonth?: string) {
  const solToUsdtCosts = solToUsdtCostBasisEvents(state);
  const solReleasedCosts = solCostBasisLedger(state).releasedByTransactionId;
  const trades = state.btcTrades
    .filter((item) => !upToMonth || monthFromDate(dateValueFromDateTime(item.executedAt)) <= upToMonth)
    .map((trade) => {
      if (!isSolDerivedBtcTrade(trade)) return trade;
      const withdrawal = state.solTransactions.find(
        (item) => isSolWithdrawal(item) && item.destination === "btc-direct" && trade.note.includes(solBtcTradeMarker(item.id))
      );
      return withdrawal ? { ...trade, costVnd: solReleasedCosts[withdrawal.id] ?? trade.costVnd } : trade;
    });
  const plans = state.btcDcaPlans
    .filter((item) => !upToMonth || monthFromDate(item.startDate) <= upToMonth)
    .map((plan) => {
      if (!upToMonth || !plan.btcAmountOverride) return plan;
      const allPlanTrades = state.btcTrades.filter((trade) => trade.planId === plan.id);
      if (!allPlanTrades.length) return plan;
      const totalBtc = allPlanTrades.reduce((sum, trade) => sum + trade.btcAmount, 0);
      const includedBtc = trades
        .filter((trade) => trade.planId === plan.id)
        .reduce((sum, trade) => sum + trade.btcAmount, 0);
      return {
        ...plan,
        btcAmountOverride: totalBtc > 0 ? plan.btcAmountOverride * (includedBtc / totalBtc) : 0,
      };
    });
  const topups = state.btcUsdtTopups
    .filter((item) => !upToMonth || monthFromDate(item.date) <= upToMonth)
    .map((topup) => {
      let costVnd = topup.vndAmount;
      if (topup.note.includes("USDT từ SOL")) {
        const matchIndex = findSolDerivedTopupCostEventIndex(solToUsdtCosts, topup);
        if (matchIndex >= 0) costVnd = solToUsdtCosts.splice(matchIndex, 1)[0].costVnd;
      }
      return { ...topup, costVnd };
    });

  return buildCryptoLedger({
    topups,
    trades,
    plans,
    transfers: state.btcTransfers.filter((item) => !upToMonth || monthFromDate(item.date) <= upToMonth),
    adjustments: state.adjustmentTransactions
      .filter(
        (item) =>
          (isCryptoQuantityAdjustment(item, "BTC") || isCryptoQuantityAdjustment(item, "USDT")) &&
          (!upToMonth || monthFromDate(item.date) <= upToMonth)
      )
      .map((item) => ({
        id: item.id,
        asset: item.asset as "BTC" | "USDT",
        quantity: item.quantity ?? 0,
        date: item.date,
        createdAt: item.createdAt,
      })),
    fallbackUsdtVndRate: state.market.usdtVnd || state.market.usdVnd,
  });
}

function btcPortfolioStats(state: AppState, upToMonth?: string) {
  const cryptoFundTransactions = state.fundTransactions.filter(
    (item) => item.fund === "btc" && (!upToMonth || item.month <= upToMonth)
  );
  const fundCapital = cryptoFundTransactions.reduce(
    (sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount),
    0
  );
  const fundedVnd = cryptoFundTransactions
    .filter((item) => item.type === "deposit")
    .reduce((sum, item) => sum + item.amount, 0);
  const topups = state.btcUsdtTopups.filter((item) => !upToMonth || monthFromDate(item.date) <= upToMonth);
  const trades = state.btcTrades.filter((item) => !upToMonth || monthFromDate(dateValueFromDateTime(item.executedAt)) <= upToMonth);
  const topupVnd = topups.reduce((sum, item) => sum + item.vndAmount, 0);
  const directTradeCostVnd = trades.reduce((sum, item) => sum + (item.costVnd ?? 0), 0);
  const ledger = cryptoLedgerFromState(state, upToMonth);
  const usdtBalance = ledger.usdtBalance;
  const btcBalance = ledger.btcBalance;
  const btcValueUsdt = btcBalance * state.market.btcUsdt;
  const totalValueUsdt = usdtBalance + btcValueUsdt;
  const usdtVndRate = state.market.usdtVnd || state.market.usdVnd;
  const totalValueVnd = totalValueUsdt * usdtVndRate;
  const pendingVnd = Math.max(fundedVnd - topupVnd - directTradeCostVnd, 0);
  const reportValueVnd = totalValueVnd + pendingVnd;
  const investedValueVnd = ledger.btcCostVnd + ledger.usdtCostVnd;
  const pnl = totalValueVnd - investedValueVnd;
  const pnlUsdt = usdtVndRate ? pnl / usdtVndRate : 0;

  return {
    capitalVnd: fundCapital,
    pendingVnd,
    topupVnd,
    directTradeCostVnd,
    topupUsdt: topups.reduce((sum, item) => sum + item.usdtAmount, 0),
    investedValueVnd,
    usdtBalance,
    btcBalance,
    btcCostUsdt: ledger.btcCostUsdt,
    btcValueUsdt,
    totalValueUsdt,
    totalValueVnd,
    reportValueVnd,
    averageCostUsdt: ledger.averageBtcCostUsdt,
    pnlUsdt,
    pnlVnd: pnl,
    pnlPercent: investedValueVnd ? (pnl / investedValueVnd) * 100 : 0,
    ledger,
  };
}

function btcAssetCostBasisVnd(state: AppState) {
  const ledger = cryptoLedgerFromState(state);
  return {
    btcCostVnd: ledger.btcCostVnd,
    usdtCostVnd: ledger.usdtCostVnd,
    realizedByTransferId: ledger.realizedByTransferId,
    coinSaleByTransferId: ledger.coinSaleByTransferId,
  };
}

const stockLineValue = (line: Pick<StockPurchaseLine, "shares" | "buyPrice">) =>
  Math.round(line.shares * line.buyPrice * STOCK_PRICE_UNIT);

const STOCK_BUY_BROKERAGE_FEE_RATE = 0.0008;
const STOCK_SALE_BROKERAGE_FEE_RATE = 0.0008;
const STOCK_SALE_TAX_RATE = 0.001;
const STOCK_SALE_TRANSFER_FEE_PER_SHARE = 0.3;

const estimateStockBuyFee = (grossValue: number) =>
  Math.round(Math.max(grossValue, 0) * STOCK_BUY_BROKERAGE_FEE_RATE);

const stockPurchaseLineCost = (line: Pick<StockPurchaseLine, "shares" | "buyPrice">) => {
  const grossValue = stockLineValue(line);
  return grossValue + estimateStockBuyFee(grossValue);
};

const stockPurchaseLinesWithCost = (lines: StockPurchaseLine[]) => {
  const grossValues = lines.map(stockLineValue);
  const totalGross = grossValues.reduce((sum, value) => sum + value, 0);
  const totalFee = estimateStockBuyFee(totalGross);
  let allocatedFee = 0;
  return lines.map((line, index) => {
    const grossValue = grossValues[index] ?? 0;
    const fee =
      index === lines.length - 1
        ? totalFee - allocatedFee
        : totalGross
          ? Math.round((totalFee * grossValue) / totalGross)
          : 0;
    allocatedFee += fee;
    return { line, grossValue, fee, cost: grossValue + fee };
  });
};

const stockPurchaseLinesCost = (lines: StockPurchaseLine[]) =>
  stockPurchaseLinesWithCost(lines).reduce((sum, item) => sum + item.cost, 0);

const estimateStockSaleFee = (grossValue: number, shares = 0) =>
  Math.round(Math.max(grossValue, 0) * STOCK_SALE_BROKERAGE_FEE_RATE) +
  Math.round(Math.max(grossValue, 0) * STOCK_SALE_TAX_RATE) +
  Math.round(Math.max(shares, 0) * STOCK_SALE_TRANSFER_FEE_PER_SHARE);

const stockSaleNetVndAmount = (sale: Pick<StockSale, "vndAmount" | "shares" | "fee" | "tax" | "netVndAmount">) =>
  Math.max(Math.round(sale.netVndAmount ?? sale.vndAmount - (sale.fee ?? estimateStockSaleFee(sale.vndAmount, sale.shares)) - (sale.tax ?? 0)), 0);

const STOCK_CASH_ADJUSTMENT_ASSET = "VND";
const STOCK_TOTAL_ADJUSTMENT_ASSET = "STOCK_TOTAL";

const isStockCashAdjustment = (item: AdjustmentTransaction, upToMonth?: string) =>
  item.accountId === "vps" &&
  item.asset === STOCK_CASH_ADJUSTMENT_ASSET &&
  item.reason === "manual_adjustment" &&
  typeof item.amountVnd === "number" &&
  Number.isFinite(item.amountVnd) &&
  (!upToMonth || monthFromDate(item.date) <= upToMonth);

const isStockTotalAssetAdjustment = (item: AdjustmentTransaction, upToMonth?: string) =>
  item.accountId === "vps" &&
  item.asset === STOCK_TOTAL_ADJUSTMENT_ASSET &&
  item.reason === "manual_adjustment" &&
  typeof item.amountVnd === "number" &&
  Number.isFinite(item.amountVnd) &&
  (!upToMonth || monthFromDate(item.date) <= upToMonth);

const stockCashAdjustment = (state: AppState, upToMonth?: string) =>
  state.adjustmentTransactions
    .filter((item) => isStockCashAdjustment(item, upToMonth))
    .reduce((sum, item) => sum + (item.amountVnd ?? 0), 0);

const stockTotalAssetAdjustment = (state: AppState, upToMonth?: string) =>
  state.adjustmentTransactions
    .filter((item) => isStockTotalAssetAdjustment(item, upToMonth))
    .reduce((sum, item) => sum + (item.amountVnd ?? 0), 0);

const stockSharesForBudget = (budget: number, price: number) => {
  if (!budget || !price) return "";
  const rawShares = Math.floor(budget / (price * STOCK_PRICE_UNIT * (1 + STOCK_BUY_BROKERAGE_FEE_RATE)));
  let shares = rawShares >= STOCK_LOT ? Math.floor(rawShares / STOCK_LOT) * STOCK_LOT : rawShares;
  while (shares > 0 && stockPurchaseLineCost({ shares, buyPrice: price }) > budget) {
    shares -= shares >= STOCK_LOT ? STOCK_LOT : 1;
  }
  return shares > 0 ? String(shares) : "";
};

function normalizeStockPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1_000 ? value / STOCK_PRICE_UNIT : value;
}

function stockPriceFromPayload(payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] }).data)
      ? (payload as { data: unknown[] }).data
      : [payload];
  const priceFields = ["lastPrice", "matchPrice", "matchedPrice", "close", "price", "adClose", "basicPrice", "priorClosePrice"];
  for (const row of rows) {
    const item = row as Record<string, unknown>;
    for (const field of priceFields) {
      const raw = item[field];
      const value = typeof raw === "string" ? parseDecimal(raw) : Number(raw);
      const price = normalizeStockPrice(value);
      if (price) return price;
    }
  }
  return 0;
}

const positiveNumber = (raw: unknown) => {
  const value = typeof raw === "string" ? parseDecimal(raw) : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

function binanceUsdtVndPriceFromPayload(payload: unknown): number {
  const data = (payload as { data?: unknown })?.data ?? payload;
  if (Array.isArray(data)) {
    for (const item of data) {
      const price = binanceUsdtVndPriceFromPayload(item);
      if (price) return price;
    }
    return 0;
  }
  const item = data as Record<string, unknown>;
  const directPrice = positiveNumber(item.price) || positiveNumber(item.bestPrice) || positiveNumber(item.quotation);
  if (directPrice) return directPrice;
  const p2pMethods = item.p2pPaymentMethods;
  if (Array.isArray(p2pMethods)) return binanceUsdtVndPriceFromPayload(p2pMethods);
  const paymentMethods = item.paymentMethods;
  if (Array.isArray(paymentMethods)) return binanceUsdtVndPriceFromPayload(paymentMethods);
  return 0;
}

function binanceP2pSellUsdtVndPriceFromPayload(payload: unknown): number {
  const data = (payload as { data?: unknown })?.data ?? payload;
  const rows = Array.isArray(data) ? data : [data];
  const prices = rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      const adv = (item.adv ?? item) as Record<string, unknown>;
      const tradableQuantity = positiveNumber(adv.tradableQuantity);
      const price = positiveNumber(adv.price);
      return price && (tradableQuantity || adv.tradableQuantity === undefined) ? price : 0;
    })
    .filter((price) => price > 0);
  return prices.length ? Math.max(...prices) : 0;
}

async function fetchStockQuote(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const urls = [
    { source: "VPS", url: `https://bgapidatafeed.vps.com.vn/getliststockdata/${encodeURIComponent(normalized)}` },
    { source: "VNDIRECT", url: `https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${encodeURIComponent(normalized)}&size=1&page=1` },
    { source: "VPS", url: `/market-api/vps/getliststockdata/${encodeURIComponent(normalized)}` },
    { source: "VNDIRECT", url: `/market-api/vndirect/v4/stock_prices?sort=date:desc&q=code:${encodeURIComponent(normalized)}&size=1&page=1` },
  ];
  for (const item of urls) {
    try {
      const response = await fetch(item.url, { cache: "no-store" });
      if (!response.ok) continue;
      const price = stockPriceFromPayload(await response.json());
      if (price) return { price, source: item.source };
    } catch {
      // Try the next public source when one endpoint is blocked or unavailable.
    }
  }
  throw new Error("Không lấy được giá cổ phiếu");
}

async function fetchBinanceUsdtVndQuote() {
  const p2pSearchBody = {
    asset: "USDT",
    fiat: "VND",
    tradeType: "BUY",
    page: 1,
    rows: 20,
    payTypes: [],
    countries: [],
    publisherType: null,
    transAmount: "",
  };
  const p2pSearchUrls = [
    "/market-api/binance/bapi/c2c/v2/friendly/c2c/adv/search",
    "https://www.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
  ];
  for (const url of p2pSearchUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p2pSearchBody),
      });
      if (!response.ok) continue;
      const price = binanceP2pSellUsdtVndPriceFromPayload(await response.json());
      if (price) return { price, source: "Binance P2P BUY" };
    } catch {
      // Try the next Binance P2P endpoint when CORS or the search API is unavailable.
    }
  }

  const urls = [
    {
      source: "Binance P2P BUY",
      url: "/market-api/binance/bapi/c2c/v1/public/c2c/agent/quote-price?fiat=VND&asset=USDT&tradeType=BUY",
    },
    {
      source: "Binance P2P BUY",
      url: "https://www.binance.com/bapi/c2c/v1/public/c2c/agent/quote-price?fiat=VND&asset=USDT&tradeType=BUY",
    },
    {
      source: "Binance Fiat BUY",
      url: "/market-api/binance/bapi/fiat/v1/public/fiatpayment/agent/get-price?fiatCurrency=VND&cryptoCurrency=USDT&country=VN&businessType=BUY",
    },
    {
      source: "Binance Fiat BUY",
      url: "https://www.binance.com/bapi/fiat/v1/public/fiatpayment/agent/get-price?fiatCurrency=VND&cryptoCurrency=USDT&country=VN&businessType=BUY",
    },
  ];
  for (const item of urls) {
    try {
      const response = await fetch(item.url, { cache: "no-store" });
      if (!response.ok) continue;
      const price = binanceUsdtVndPriceFromPayload(await response.json());
      if (price) return { price, source: item.source };
    } catch {
      // Try the next Binance public endpoint when CORS or the quote API is unavailable.
    }
  }
  throw new Error("Không lấy được giá USDT/VND từ Binance");
}

async function fetchSolMarket(fallback: Market) {
  const [solResponse, solBinanceResponse, rateResponse] = await Promise.allSettled([
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" }),
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", { cache: "no-store" }),
    fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }),
  ]);
  const solJson = solResponse.status === "fulfilled" && solResponse.value.ok ? await solResponse.value.json() : null;
  const solBinanceJson = solBinanceResponse.status === "fulfilled" && solBinanceResponse.value.ok ? await solBinanceResponse.value.json() : null;
  const rateJson = rateResponse.status === "fulfilled" && rateResponse.value.ok ? await rateResponse.value.json() : null;
  const solUsd = Number(solBinanceJson?.price) || Number(solJson?.solana?.usd) || fallback.solUsd;
  const usdVnd = Number(rateJson?.rates?.VND) || fallback.usdVnd;
  if (!solUsd || !usdVnd) throw new Error("Không lấy được giá SOL");
  return { solUsd, usdVnd, updatedAt: new Date().toISOString() };
}

function stockMarketPrice(state: AppState, symbol: string) {
  return state.stockMarketPrices.find((item) => item.symbol === symbol.toUpperCase()) ?? {
    symbol: symbol.toUpperCase(),
    price: 0,
    updatedAt: "",
    source: "fallback",
  };
}

async function fetchMarket(fallback: Market) {
  const [binanceUsdtResponse, cryptoResponse, btcResponse, solBinanceResponse, rateResponse] = await Promise.allSettled([
    fetchBinanceUsdtVndQuote(),
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana,tether&vs_currencies=usd,vnd", { cache: "no-store" }),
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { cache: "no-store" }),
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", { cache: "no-store" }),
    fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }),
  ]);
  const binanceUsdt = binanceUsdtResponse.status === "fulfilled" ? binanceUsdtResponse.value : null;
  const cryptoJson = cryptoResponse.status === "fulfilled" && cryptoResponse.value.ok ? await cryptoResponse.value.json() : null;
  const btcJson = btcResponse.status === "fulfilled" && btcResponse.value.ok ? await btcResponse.value.json() : null;
  const solBinanceJson = solBinanceResponse.status === "fulfilled" && solBinanceResponse.value.ok ? await solBinanceResponse.value.json() : null;
  const rateJson = rateResponse.status === "fulfilled" && rateResponse.value.ok ? await rateResponse.value.json() : null;
  const solUsd = Number(solBinanceJson?.price) || Number(cryptoJson?.solana?.usd) || fallback.solUsd;
  const btcUsdt = Number(btcJson?.price) || fallback.btcUsdt;
  const coingeckoUsdtVnd = Number(cryptoJson?.tether?.vnd) || 0;
  const usdtVnd = binanceUsdt?.price || coingeckoUsdtVnd || fallback.usdtVnd || 0;
  const usdVnd = Number(rateJson?.rates?.VND) || fallback.usdVnd || usdtVnd;
  if (!solUsd && !btcUsdt && !usdtVnd && !usdVnd) throw new Error("Không lấy được giá thị trường");
  const gotSolFromCoingecko = Boolean(cryptoJson?.solana?.usd);
  const gotSolFromBinance = Boolean(solBinanceJson?.price);
  const gotBtc = Boolean(btcJson?.price);
  const gotUsdtFromBinance = Boolean(binanceUsdt?.price);
  const gotUsdtFromCoingecko = Boolean(coingeckoUsdtVnd);
  const isFallback = (!gotSolFromCoingecko && !gotSolFromBinance) || !gotBtc || !gotUsdtFromBinance;
  return {
    solUsd,
    btcUsdt,
    usdtVnd,
    usdVnd,
    updatedAt: new Date().toISOString(),
    btcSource: gotBtc ? "Binance" : fallback.btcSource ?? "Fallback",
    solSource: gotSolFromCoingecko ? "CoinGecko" : gotSolFromBinance ? "Binance" : fallback.solSource ?? "Fallback",
    usdtSource: gotUsdtFromBinance ? binanceUsdt?.source : gotUsdtFromCoingecko ? "CoinGecko" : fallback.usdtVnd ? fallback.usdtSource ?? "Fallback" : "Fallback",
    isFallback,
    lastError: isFallback ? "Một phần giá đang dùng dữ liệu lưu gần nhất." : "",
  };
}

function corporateActionEventDate(action: Pick<CorporateAction, "receiveDate" | "paymentDate" | "recordDate" | "exDate" | "appliedAt">) {
  return action.receiveDate ?? action.paymentDate ?? action.recordDate ?? action.exDate ?? action.appliedAt?.slice(0, 10) ?? "";
}

function stockSharesAtDate(state: AppState, symbolValue: string, upToDate: string, excludeCorporateActionId?: string) {
  const targetSymbol = symbolValue.trim().toUpperCase();
  if (!targetSymbol || !upToDate) return 0;
  const holdings = new Map<string, number>();
  const events = [
    ...state.stockPurchases.flatMap((purchase, purchaseIndex) =>
      purchase.lines.map((line, lineIndex) => ({
        kind: "buy" as const,
        date: purchase.date,
        createdAt: purchase.createdAt,
        order: purchaseIndex * 100 + lineIndex,
        line,
      }))
    ),
    ...state.stockSales.map((sale, index) => ({
      kind: "sale" as const,
      date: sale.date,
      createdAt: sale.createdAt,
      order: index,
      sale,
    })),
    ...state.corporateActions
      .filter((action) => action.status === "applied" && action.id !== excludeCorporateActionId)
      .map((action, index) => ({
        kind: "corporate-action" as const,
        date: corporateActionEventDate(action),
        createdAt: action.appliedAt,
        order: index,
        action,
      })),
  ]
    .filter((event) => event.date && event.date <= upToDate)
    .sort((left, right) => {
      const dateOrder = left.date.localeCompare(right.date);
      if (dateOrder) return dateOrder;
      const leftTime = new Date(left.createdAt ?? `${left.date}T00:00:00`).getTime();
      const rightTime = new Date(right.createdAt ?? `${right.date}T00:00:00`).getTime();
      if (leftTime !== rightTime) return leftTime - rightTime;
      if (!left.createdAt && !right.createdAt && left.kind !== right.kind) return left.kind === "sale" ? -1 : 1;
      return left.kind === right.kind ? left.order - right.order : left.kind === "buy" ? -1 : 1;
    });

  events.forEach((event) => {
    if (event.kind === "buy") {
      const symbol = event.line.symbol.toUpperCase();
      holdings.set(symbol, (holdings.get(symbol) ?? 0) + event.line.shares);
      return;
    }
    if (event.kind === "sale") {
      const symbol = event.sale.symbol.toUpperCase();
      holdings.set(symbol, Math.max((holdings.get(symbol) ?? 0) - event.sale.shares, 0));
      return;
    }
    const action = event.action;
    const symbol = action.symbol.toUpperCase();
    if (action.type === "cash_dividend") return;
    const current = holdings.get(symbol) ?? 0;
    const ratioFrom = action.ratioFrom || 1;
    const ratioTo = action.ratioTo || 1;
    if (action.type === "stock_dividend" || action.type === "bonus_issue" || action.type === "rights_issue") {
      const addedShares = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
      holdings.set(symbol, current + addedShares);
      return;
    }
    if (action.type === "stock_split" || action.type === "reverse_split") {
      holdings.set(symbol, Math.floor((current * ratioTo) / ratioFrom));
      return;
    }
    if (action.type === "symbol_change" && action.newSymbol) {
      holdings.delete(symbol);
      holdings.set(action.newSymbol.toUpperCase(), current);
    }
  });

  return holdings.get(targetSymbol) ?? 0;
}

function stockPortfolioStats(state: AppState, upToMonth?: string) {
  const fundCash = state.fundTransactions
    .filter((item) => item.fund === "stock" && (!upToMonth || item.month <= upToMonth) && !item.note.startsWith("Rút từ CK"))
    .reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);
  const purchases = state.stockPurchases.filter((purchase) => !upToMonth || purchase.month <= upToMonth);
  const sales = state.stockSales.filter((sale) => !upToMonth || monthFromDate(sale.date) <= upToMonth);
  const corporateActions = state.corporateActions.filter((action) => action.status === "applied" && (!upToMonth || monthFromDate(corporateActionEventDate(action)) <= upToMonth));
  const invested = purchases.reduce((sum, purchase) => sum + stockPurchaseLinesCost(purchase.lines), 0);
  const holdings = new Map<string, { symbol: string; shares: number; cost: number; lastBuyPrice: number }>();
  let soldToCashBalance = 0;
  let corporateCashBalance = 0;
  let corporateCost = 0;
  const events = [
    ...purchases.flatMap((purchase, purchaseIndex) =>
      stockPurchaseLinesWithCost(purchase.lines).map((item, lineIndex) => ({
        kind: "buy" as const,
        date: purchase.date,
        createdAt: purchase.createdAt,
        order: purchaseIndex * 100 + lineIndex,
        line: item.line,
        cost: item.cost,
      }))
    ),
    ...sales.map((sale, index) => ({
      kind: "sale" as const,
      date: sale.date,
      createdAt: sale.createdAt,
      order: index,
      sale,
    })),
    ...corporateActions.map((action, index) => ({
      kind: "corporate-action" as const,
      date: corporateActionEventDate(action),
      createdAt: action.appliedAt,
      order: index,
      action,
    })),
  ].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder) return dateOrder;
    const leftTime = new Date(left.createdAt ?? `${left.date}T00:00:00`).getTime();
    const rightTime = new Date(right.createdAt ?? `${right.date}T00:00:00`).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    if (!left.createdAt && !right.createdAt && left.kind !== right.kind) return left.kind === "sale" ? -1 : 1;
    return left.kind === right.kind ? left.order - right.order : left.kind === "buy" ? -1 : 1;
  });

  events.forEach((event) => {
    if (event.kind === "buy") {
      const symbol = event.line.symbol.toUpperCase();
      const existing = holdings.get(symbol) ?? { symbol, shares: 0, cost: 0, lastBuyPrice: event.line.buyPrice };
      existing.shares += event.line.shares;
      existing.cost += event.cost;
      existing.lastBuyPrice = event.line.buyPrice;
      holdings.set(symbol, existing);
      return;
    }

    if (event.kind === "corporate-action") {
      const action = event.action;
      const symbol = action.symbol.toUpperCase();
      const existing = holdings.get(symbol);
      if (!existing) return;
      const ratioFrom = action.ratioFrom || 1;
      const ratioTo = action.ratioTo || 1;
      if (action.type === "cash_dividend") {
        const netCash = action.cashReceived ?? action.eligibleShares * (action.cashPerShare ?? 0) * (1 - (action.taxRate ?? 0) / 100) - (action.fee ?? 0);
        corporateCashBalance += Math.max(netCash, 0);
        return;
      }
      if (action.type === "stock_dividend" || action.type === "bonus_issue") {
        existing.shares += action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
        holdings.set(symbol, existing);
        return;
      }
      if (action.type === "stock_split" || action.type === "reverse_split") {
        existing.shares = Math.floor((existing.shares * ratioTo) / ratioFrom);
        holdings.set(symbol, existing);
        return;
      }
      if (action.type === "rights_issue") {
        const addedShares = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
        const addedCost = stockLineValue({ shares: addedShares, buyPrice: action.subscriptionPrice ?? existing.lastBuyPrice });
        existing.shares += addedShares;
        existing.cost += addedCost;
        existing.lastBuyPrice = action.subscriptionPrice ?? existing.lastBuyPrice;
        corporateCost += addedCost;
        holdings.set(symbol, existing);
        return;
      }
      if (action.type === "symbol_change" && action.newSymbol) {
        holdings.delete(symbol);
        holdings.set(action.newSymbol.toUpperCase(), { ...existing, symbol: action.newSymbol.toUpperCase() });
      }
      return;
    }

    const symbol = event.sale.symbol.toUpperCase();
    const existing = holdings.get(symbol);
    if (!existing) return;
    const soldShares = Math.min(event.sale.shares, existing.shares);
    const averageCost = existing.shares ? existing.cost / existing.shares : 0;
    if (event.sale.destination === "stock" && soldShares > 0) {
      soldToCashBalance += Math.round(stockSaleNetVndAmount(event.sale) * (soldShares / event.sale.shares));
    }
    existing.shares = Math.max(existing.shares - soldShares, 0);
    existing.cost = Math.max(existing.cost - soldShares * averageCost, 0);
    holdings.set(symbol, existing);
  });

  const rows = [...holdings.values()]
    .filter((item) => item.shares > 0)
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map((item) => {
      const averageCost = item.shares ? item.cost / item.shares / STOCK_PRICE_UNIT : 0;
      const market = stockMarketPrice(state, item.symbol);
      const marketPrice = market.price || averageCost || item.lastBuyPrice;
      const marketValue = stockLineValue({ shares: item.shares, buyPrice: marketPrice });
      const pnl = marketValue - item.cost;
      return {
        ...item,
        averageCost,
        marketPrice,
        marketValue,
        pnl,
        pnlPercent: item.cost ? (pnl / item.cost) * 100 : 0,
        updatedAt: market.updatedAt ?? "",
        source: market.source ?? "fallback",
        hasMarketPrice: Boolean(market),
      };
    });
  const stockValue = rows.reduce((sum, item) => sum + item.marketValue, 0);
  const totalCost = rows.reduce((sum, item) => sum + item.cost, 0);
  const cash = Math.max(fundCash - invested - corporateCost + soldToCashBalance + corporateCashBalance + stockCashAdjustment(state, upToMonth), 0);
  const openPosition = stockOpenPositionSnapshot({
    cashVnd: cash,
    holdingsCostVnd: totalCost,
    holdingsMarketValueVnd: stockValue,
    totalAssetAdjustmentVnd: stockTotalAssetAdjustment(state, upToMonth),
  });

  return {
    fundCash,
    investedValueVnd: openPosition.investedValueVnd,
    cash,
    invested,
    stockValue,
    totalValue: openPosition.currentValueVnd,
    totalCost,
    pnl: openPosition.pnlVnd,
    pnlPercent: openPosition.pnlPercent,
    holdings: rows,
  };
}

function stockSaleHistoryRows(state: AppState) {
  const holdings = new Map<string, { symbol: string; shares: number; cost: number; lastBuyPrice: number }>();
  const rows: Array<{
    id: string;
    date: string;
    symbol: string;
    shares: number;
    sellPrice: number;
    averageCost: number;
    grossValue: number;
    netValue: number;
    pnl: number;
    releasedCostVnd: number;
    realizedPnlVnd: number;
    note: string;
  }> = [];
  const events = [
    ...state.stockPurchases.flatMap((purchase, purchaseIndex) =>
      stockPurchaseLinesWithCost(purchase.lines).map((item, lineIndex) => ({
        kind: "buy" as const,
        date: purchase.date,
        createdAt: purchase.createdAt,
        order: purchaseIndex * 100 + lineIndex,
        line: item.line,
        cost: item.cost,
      }))
    ),
    ...state.stockSales.map((sale, index) => ({
      kind: "sale" as const,
      date: sale.date,
      createdAt: sale.createdAt,
      order: index,
      sale,
    })),
    ...state.corporateActions
      .filter((action) => action.status === "applied")
      .map((action, index) => ({
        kind: "corporate-action" as const,
        date: corporateActionEventDate(action),
        createdAt: action.appliedAt,
        order: index,
        action,
      })),
  ].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder) return dateOrder;
    const leftTime = new Date(left.createdAt ?? `${left.date}T00:00:00`).getTime();
    const rightTime = new Date(right.createdAt ?? `${right.date}T00:00:00`).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    if (!left.createdAt && !right.createdAt && left.kind !== right.kind) return left.kind === "sale" ? -1 : 1;
    return left.kind === right.kind ? left.order - right.order : left.kind === "buy" ? -1 : 1;
  });

  events.forEach((event) => {
    if (event.kind === "buy") {
      const symbol = event.line.symbol.toUpperCase();
      const existing = holdings.get(symbol) ?? { symbol, shares: 0, cost: 0, lastBuyPrice: event.line.buyPrice };
      existing.shares += event.line.shares;
      existing.cost += event.cost;
      existing.lastBuyPrice = event.line.buyPrice;
      holdings.set(symbol, existing);
      return;
    }

    if (event.kind === "corporate-action") {
      const action = event.action;
      const symbol = action.symbol.toUpperCase();
      const existing = holdings.get(symbol);
      if (!existing || action.type === "cash_dividend") return;
      const ratioFrom = action.ratioFrom || 1;
      const ratioTo = action.ratioTo || 1;
      if (action.type === "stock_dividend" || action.type === "bonus_issue") {
        existing.shares += action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
      } else if (action.type === "stock_split" || action.type === "reverse_split") {
        existing.shares = Math.floor((existing.shares * ratioTo) / ratioFrom);
      } else if (action.type === "rights_issue") {
        const addedShares = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
        existing.shares += addedShares;
        existing.cost += stockLineValue({ shares: addedShares, buyPrice: action.subscriptionPrice ?? existing.lastBuyPrice });
        existing.lastBuyPrice = action.subscriptionPrice ?? existing.lastBuyPrice;
      } else if (action.type === "symbol_change" && action.newSymbol) {
        holdings.delete(symbol);
        holdings.set(action.newSymbol.toUpperCase(), { ...existing, symbol: action.newSymbol.toUpperCase() });
        return;
      }
      holdings.set(symbol, existing);
      return;
    }

    const symbol = event.sale.symbol.toUpperCase();
    const existing = holdings.get(symbol);
    const soldShares = Math.min(event.sale.shares, existing?.shares ?? event.sale.shares);
    const averageCostVnd = existing?.shares ? existing.cost / existing.shares : event.sale.sellPrice * STOCK_PRICE_UNIT;
    const grossValue = Math.round(soldShares * event.sale.sellPrice * STOCK_PRICE_UNIT);
    const costValue = Math.round(soldShares * averageCostVnd);
    const netValue = stockSaleNetVndAmount(event.sale);
    rows.push({
      id: event.sale.id,
      date: event.sale.date,
      symbol,
      shares: event.sale.shares,
      sellPrice: event.sale.sellPrice,
      averageCost: averageCostVnd / STOCK_PRICE_UNIT,
      grossValue,
      netValue,
      pnl: grossValue - costValue,
      releasedCostVnd: costValue,
      realizedPnlVnd: realizedStockSalePnl(netValue, costValue),
      note: event.sale.note,
    });
    if (!existing) return;
    existing.shares = Math.max(existing.shares - event.sale.shares, 0);
    existing.cost = Math.max(existing.cost - soldShares * averageCostVnd, 0);
    holdings.set(symbol, existing);
  });

  return rows.sort((left, right) => right.date.localeCompare(left.date));
}

async function refreshStockMarketPrices(
  symbols: string[],
  setState: React.Dispatch<React.SetStateAction<AppState>>
) {
  const uniqueSymbols = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
  if (!uniqueSymbols.length) return { updated: 0, total: 0 };
  const results = await Promise.allSettled(
    uniqueSymbols.map(async (symbol) => ({ symbol, ...(await fetchStockQuote(symbol)) }))
  );
  const now = new Date().toISOString();
  const updates = results
    .filter((result): result is PromiseFulfilledResult<{ symbol: string; price: number; source: string }> => result.status === "fulfilled")
    .map((result) => ({ symbol: result.value.symbol, price: result.value.price, updatedAt: now, source: result.value.source }));
  if (updates.length) {
    setState((prev) => ({
      ...prev,
      stockMarketPrices: [
        ...prev.stockMarketPrices.filter((item) => !updates.some((update) => update.symbol === item.symbol)),
        ...updates,
      ],
    }));
  }
  return { updated: updates.length, total: uniqueSymbols.length };
}

function pendingSolDepositTotal(state: AppState, fund: TransferDepositFund) {
  return state.solTransactions
    .filter(
      (transaction) =>
        isSolWithdrawal(transaction) &&
        transaction.destination === fund &&
        !state.bankDeposits.some((deposit) => deposit.createdFromSolWithdrawalId === transaction.id)
    )
    .reduce((sum, transaction) => sum + (isSolWithdrawal(transaction) ? transaction.vndAmount : 0), 0);
}

const stockSaleDepositMarker = (saleId: string) => `[stock-sale:${saleId}]`;
const btcTransferDepositMarker = (transferId: string) => `[btc-transfer:${transferId}]`;
const solBtcTradeMarker = (withdrawalId: string) => `[sol-btc:${withdrawalId}]`;
const stockCashWithdrawalMarker = (withdrawalId: string, fund: TransferDepositFund, amount: number) => `[stock-cash:${withdrawalId}:${fund}:${amount}]`;
const stockCashWithdrawalMarkerPattern = /\[stock-cash:([^:\]]+):(saving|emergency):(\d+)\]/;
const parseStockCashWithdrawalMarker = (note: string) => {
  const match = note.match(stockCashWithdrawalMarkerPattern);
  return match ? { id: match[1], fund: match[2] as TransferDepositFund, amount: Number(match[3]) || 0, marker: match[0] } : null;
};
const stockSaleTransferNote = (sale: Pick<StockSale, "symbol" | "note">) =>
  sale.note.trim() ? `Rút từ CK ${sale.symbol} · ${sale.note.trim()}` : `Rút từ CK ${sale.symbol}`;

function pendingStockSaleDepositTotal(state: AppState, fund: TransferDepositFund) {
  return state.stockSales
    .filter(
      (sale) =>
        sale.destination === fund &&
        !state.bankDeposits.some((deposit) => deposit.note.includes(stockSaleDepositMarker(sale.id)))
    )
    .reduce((sum, sale) => sum + stockSaleNetVndAmount(sale), 0);
}

function pendingBtcTransferDepositTotal(state: AppState, fund: TransferDepositFund) {
  return state.btcTransfers
    .filter(
      (transfer) =>
        transfer.destination === fund &&
        !state.bankDeposits.some((deposit) => deposit.note.includes(btcTransferDepositMarker(transfer.id)))
    )
    .reduce((sum, transfer) => sum + transfer.vndAmount, 0);
}

function pendingStockCashFromTransfer(state: AppState, source: "SOL" | "BTC", maxCash: number) {
  const sourceTotal = state.fundTransactions
    .filter((item) => item.fund === "stock" && item.type === "deposit" && item.note.includes(`Rút từ ${source}`))
    .reduce((sum, item) => sum + item.amount, 0);
  return Math.min(Math.max(maxCash, 0), sourceTotal);
}

function accumulationProgress(state: AppState, goal: AccumulationGoal) {
  const paid = state.monthlyExpenses
    .filter((item) => item.categoryId === goal.categoryId && item.checked)
    .reduce((sum, item) => sum + item.amount, 0);
  return Math.min(paid, goal.targetAmount);
}

function accumulationPaidMonths(state: AppState, goal: AccumulationGoal) {
  return state.monthlyExpenses.filter((item) => item.categoryId === goal.categoryId && item.checked).length;
}

function accumulationUnpaidMonths(state: AppState, goal: AccumulationGoal) {
  return Math.max(goal.months - accumulationPaidMonths(state, goal), 0);
}

function accumulationScheduleAmounts(total: number, months: number, monthlyAmount: number) {
  const count = Math.max(Math.ceil(months), 0);
  if (!total || !count) return [];
  const base = Math.max(Math.round(monthlyAmount), 1);
  return Array.from({ length: count }, (_, index) => {
    const alreadyAssigned = base * index;
    if (index === count - 1) return Math.max(total - alreadyAssigned, 0);
    return Math.min(base, Math.max(total - alreadyAssigned, 0));
  }).filter((amount) => amount > 0);
}

function buildAccumulationMonthlyExpenses(goal: AccumulationGoal, remainingAmount: number, blockedMonths = new Set<string>()) {
  const amounts = accumulationScheduleAmounts(remainingAmount, goal.months, goal.monthlyAmount);
  let cursor = goal.startMonth;
  return amounts.map((amount) => {
    while (blockedMonths.has(cursor)) cursor = shiftMonth(cursor, 1);
    const month = cursor;
    cursor = shiftMonth(cursor, 1);
    return {
      id: uid(),
      categoryId: goal.categoryId,
      month,
      startAmount: 0,
      endAmount: 0,
      amount,
      checked: false,
    };
  });
}

function rescheduleAccumulationGoal(state: AppState, goal: AccumulationGoal, preservedUnpaid: MonthlyExpense[] = []): MonthlyExpense[] {
  const checked = state.monthlyExpenses.filter((item) => item.categoryId === goal.categoryId && item.checked);
  const preservedIds = new Set(preservedUnpaid?.map((item) => item.id));
  const preservedMonths = new Set(preservedUnpaid?.map((item) => item.month));
  const other = state.monthlyExpenses.filter((item) => item.categoryId !== goal.categoryId);
  const progress = checked?.reduce((sum, item) => sum + item.amount, 0);
  const preservedTotal = preservedUnpaid?.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(goal.targetAmount - progress - preservedTotal, 0);
  if (goal.status !== "active" || remaining <= 0) return [...other, ...checked, ...preservedUnpaid];
  const blockedMonths = new Set([...checked?.map((item) => item.month), ...preservedMonths]);
  const remainingMonths = Math.max(goal.months - checked?.length - preservedUnpaid?.length, 0);
  if (remainingMonths <= 0) return [...other, ...checked, ...preservedUnpaid];
  const nextGoal = { ...goal, months: remainingMonths };
  return [
    ...other,
    ...checked,
    ...preservedUnpaid,
    ...buildAccumulationMonthlyExpenses(nextGoal, remaining, blockedMonths).filter((item) => !preservedIds.has(item.id)),
  ];
}

function accumulationGoalForCategory(state: AppState, categoryId: string) {
  return state.accumulationGoals.find((goal) => goal.categoryId === categoryId);
}

function isFixedCategoryVisibleInMonth(state: AppState, category: ExpenseCategory, month: string) {
  if (category.kind !== "fixed") return false;
  const goal = accumulationGoalForCategory(state, category.id);
  if (!goal) return true;
  const record = state.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
  if (!record) return false;
  if (record?.checked) return true;
  if (goal.status === "deleted") return false;
  if (goal.status === "ended") return goal.endedAt ? month <= monthFromDate(goal.endedAt) : false;
  return accumulationProgress(state, goal) < goal.targetAmount;
}

function stateCountSummary(state: AppState) {
  return [
    `${state.incomeTransactions.length} thu`,
    `${state.expenseEntries.length} chi`,
    `${state.btcUsdtTopups.length + state.btcTrades.length + state.btcTransfers.length} BTC`,
    `${state.stockPurchases.length + state.stockSales.length} CK`,
    `${state.solTransactions.length} SOL`,
    `${state.bankDeposits.length} sổ`,
  ].join(" · ");
}

function inferAuditAction(label: string): AuditAction {
  const lower = label.toLowerCase();
  if (lower.includes("xóa")) return "delete";
  if (lower.includes("backup") || lower.includes("export")) return "backup";
  if (lower.includes("khôi phục")) return "restore";
  if (lower.includes("sửa") || lower.includes("đổi") || lower.includes("lưu điều chỉnh") || lower.includes("tạm dừng") || lower.includes("bật lại")) return "update";
  return "create";
}

function makeAuditLog(label: string, before: AppState, after: AppState, meta: CommitMeta = {}): AuditLog {
  return {
    id: uid(),
    label,
    action: meta.action ?? inferAuditAction(label),
    entityType: meta.entityType ?? "general",
    entityId: meta.entityId ?? "",
    createdAt: new Date().toISOString(),
    beforeSummary: meta.beforeSummary ?? stateCountSummary(before),
    afterSummary: meta.afterSummary ?? stateCountSummary(after),
  };
}

function withAuditLog(state: AppState, log: AuditLog) {
  return {
    ...state,
    auditLogs: [log, ...(state.auditLogs ?? [])].slice(0, 500),
  };
}

function makeTrashItem(entityType: AuditEntityType, entityId: string, label: string, payload: unknown, relatedPayloads?: Record<string, unknown>): TrashItem {
  const deletedAt = new Date().toISOString();
  return {
    id: uid(),
    entityType,
    entityId,
    label,
    deletedAt,
    expiresAt: addDaysIso(deletedAt, 30),
    payload,
    relatedPayloads,
  };
}

function withTrashItem(state: AppState, trashItem: TrashItem) {
  return {
    ...state,
    trashItems: [trashItem, ...(state.trashItems ?? [])].slice(0, 300),
  };
}

function restoreTrashPayload(state: AppState, trashItem: TrashItem): AppState {
  const addUnique = <T extends { id: string }>(rows: T[], item: T) =>
    rows.some((row) => row.id === item.id) ? rows.map((row) => (row.id === item.id ? item : row)) : [item, ...rows];
  const related = trashItem.relatedPayloads ?? {};
  const relatedList = <T,>(key: string) => (Array.isArray(related[key]) ? (related[key] as T[]) : []);
  let next = { ...state, trashItems: state.trashItems.filter((item) => item.id !== trashItem.id) };

  if (trashItem.entityType === "income") next = { ...next, incomeTransactions: addUnique(next.incomeTransactions, trashItem.payload as IncomeTransaction) };
  else if (trashItem.entityType === "income-category") {
    next = {
      ...next,
      incomeCategories: addUnique(next.incomeCategories, trashItem.payload as IncomeCategory),
      incomeTransactions: [...relatedList<IncomeTransaction>("incomeTransactions"), ...next.incomeTransactions.filter((item) => !relatedList<IncomeTransaction>("incomeTransactions").some((row) => row.id === item.id))],
    };
  }
  else if (trashItem.entityType === "expense") next = { ...next, expenseEntries: addUnique(next.expenseEntries, trashItem.payload as ExpenseEntry) };
  else if (trashItem.entityType === "expense-category") {
    next = {
      ...next,
      expenseCategories: addUnique(next.expenseCategories, trashItem.payload as ExpenseCategory),
      monthlyExpenses: [...relatedList<MonthlyExpense>("monthlyExpenses"), ...next.monthlyExpenses.filter((item) => !relatedList<MonthlyExpense>("monthlyExpenses").some((row) => row.id === item.id))],
      expenseEntries: [...relatedList<ExpenseEntry>("expenseEntries"), ...next.expenseEntries.filter((item) => !relatedList<ExpenseEntry>("expenseEntries").some((row) => row.id === item.id))],
    };
  } else if (trashItem.entityType === "accumulation") {
    next = {
      ...next,
      accumulationGoals: addUnique(next.accumulationGoals, trashItem.payload as AccumulationGoal),
      expenseCategories: [...relatedList<ExpenseCategory>("expenseCategories"), ...next.expenseCategories.filter((item) => !relatedList<ExpenseCategory>("expenseCategories").some((row) => row.id === item.id))],
      monthlyExpenses: [...relatedList<MonthlyExpense>("monthlyExpenses"), ...next.monthlyExpenses.filter((item) => !relatedList<MonthlyExpense>("monthlyExpenses").some((row) => row.id === item.id))],
    };
  } else if (trashItem.entityType === "btc-topup") next = { ...next, btcUsdtTopups: addUnique(next.btcUsdtTopups, trashItem.payload as BtcUsdtTopup) };
  else if (trashItem.entityType === "btc-dca") {
    next = {
      ...next,
      btcDcaPlans: addUnique(next.btcDcaPlans, normalizeDcaPlan(trashItem.payload as BtcDcaPlan)),
      btcTrades: [...relatedList<BtcTrade>("btcTrades"), ...next.btcTrades.filter((item) => !relatedList<BtcTrade>("btcTrades").some((row) => row.id === item.id))],
    };
  }
  else if (trashItem.entityType === "btc-trade") next = { ...next, btcTrades: addUnique(next.btcTrades, trashItem.payload as BtcTrade) };
  else if (trashItem.entityType === "btc-transfer") {
    next = {
      ...next,
      btcTransfers: addUnique(next.btcTransfers, trashItem.payload as BtcTransfer),
      fundTransactions: [...relatedList<FundTransaction>("fundTransactions"), ...next.fundTransactions.filter((item) => !relatedList<FundTransaction>("fundTransactions").some((row) => row.id === item.id))],
      incomeTransactions: [...relatedList<IncomeTransaction>("incomeTransactions"), ...next.incomeTransactions.filter((item) => !relatedList<IncomeTransaction>("incomeTransactions").some((row) => row.id === item.id))],
    };
  } else if (trashItem.entityType === "adjustment") {
    const adjustments = relatedList<AdjustmentTransaction>("adjustmentTransactions");
    next = {
      ...next,
      adjustmentTransactions: [
        ...(adjustments.length ? adjustments : [trashItem.payload as AdjustmentTransaction]),
        ...next.adjustmentTransactions.filter((item) => !(adjustments.length ? adjustments : [trashItem.payload as AdjustmentTransaction]).some((row) => row.id === item.id)),
      ],
    };
  }
  else if (trashItem.entityType === "stock-purchase") next = { ...next, stockPurchases: addUnique(next.stockPurchases, trashItem.payload as StockPurchase) };
  else if (trashItem.entityType === "stock-sale") {
    next = {
      ...next,
      stockSales: addUnique(next.stockSales, trashItem.payload as StockSale),
      fundTransactions: [...relatedList<FundTransaction>("fundTransactions"), ...next.fundTransactions.filter((item) => !relatedList<FundTransaction>("fundTransactions").some((row) => row.id === item.id))],
      incomeTransactions: [...relatedList<IncomeTransaction>("incomeTransactions"), ...next.incomeTransactions.filter((item) => !relatedList<IncomeTransaction>("incomeTransactions").some((row) => row.id === item.id))],
    };
  } else if (trashItem.entityType === "sol") {
    next = {
      ...next,
      solTransactions: addUnique(next.solTransactions, trashItem.payload as SolTransaction),
      btcUsdtTopups: [...relatedList<BtcUsdtTopup>("btcUsdtTopups"), ...next.btcUsdtTopups.filter((item) => !relatedList<BtcUsdtTopup>("btcUsdtTopups").some((row) => row.id === item.id))],
      btcTrades: [...relatedList<BtcTrade>("btcTrades"), ...next.btcTrades.filter((item) => !relatedList<BtcTrade>("btcTrades").some((row) => row.id === item.id))],
      fundTransactions: [...relatedList<FundTransaction>("fundTransactions"), ...next.fundTransactions.filter((item) => !relatedList<FundTransaction>("fundTransactions").some((row) => row.id === item.id))],
      incomeTransactions: [...relatedList<IncomeTransaction>("incomeTransactions"), ...next.incomeTransactions.filter((item) => !relatedList<IncomeTransaction>("incomeTransactions").some((row) => row.id === item.id))],
    };
  } else if (trashItem.entityType === "deposit") {
    next = {
      ...next,
      bankDeposits: addUnique(next.bankDeposits, trashItem.payload as BankDeposit),
      allocations: [...relatedList<Allocation>("allocations"), ...next.allocations.filter((item) => !relatedList<Allocation>("allocations").some((row) => row.month === item.month))],
      incomeTransactions: [...relatedList<IncomeTransaction>("incomeTransactions"), ...next.incomeTransactions.filter((item) => !relatedList<IncomeTransaction>("incomeTransactions").some((row) => row.id === item.id))],
    };
  }

  const log = makeAuditLog(`Đã khôi phục ${trashItem.label}.`, state, next, {
    action: "restore",
    entityType: trashItem.entityType,
    entityId: trashItem.entityId,
  });
  return withAuditLog(next, log);
}

function backupPayload(state: AppState) {
  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: "quan-li-chi-tieu",
    summary: stateCountSummary(state),
    state,
  };
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsvBundle(state: AppState) {
  type CsvRow = Array<unknown>;
  const rows: CsvRow[] = [];
  const incomeCategoryByIdd = new Map(state.incomeCategories.map((item) => [item.id, item]));
  const expenseCategoryByIdd = new Map(state.expenseCategories.map((item) => [item.id, item]));
  const btcStats = btcPortfolioStats(state);
  const stockStats = stockPortfolioStats(state);
  const stockSaleHistoryById = new Map(stockSaleHistoryRows(state).map((item) => [item.id, item]));
  const sol = solPositionFromState(state);
  const crypto = cryptoAssetPnlSnapshot(state);
  const financialIndex = buildFinancialIndex(state);
  const solValueVnd = sol.balance * state.market.solUsd * (state.market.usdtVnd || state.market.usdVnd);
  const cryptoValueVnd = crypto.current;
  const cryptoPrincipalVnd = crypto.principal;
  const cryptoPnlVnd = crypto.pnl;
  const cryptoPnlPercent = crypto.pnlPercent;
  const now = new Date().toISOString();
  const current = currentMonth();
  const summary = monthlySummary(state, current);
  const percentText = (value: number) => `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
  const safeDate = (value?: string) => (value ? formatDate(value.slice(0, 10)) : "");
  const safeDateTime = (value?: string) => (value ? formatDateTime(value) : "");
  const moneyPair = (value: number) => [Math.round(value), formatVnd(value)];
  const usdtPair = (value: number) => [Number(value.toFixed(6)), formatUsdt(value)];
  const btcPair = (value: number) => [Number(value.toFixed(8)), formatBtc(value)];
  const solPair = (value: number) => [Number(value.toFixed(8)), formatSolAmount(value)];
  const jsonCell = (value: unknown) => (value === undefined ? "" : JSON.stringify(value));
  const depositFundLabel = (fund: DepositFund) => {
    const labels: Record<DepositFund, string> = {
      saving: "Tiết kiệm",
      emergency: "Dự phòng",
      accumulation: "Tích lũy",
    };
    return labels[fund];
  };
  const dcaFrequencyLabel: Record<BtcDcaFrequency, string> = { daily: "Hàng ngày", weekly: "Hàng tuần", monthly: "Hàng tháng" };
  const dcaStatusLabel: Record<BtcDcaStatus, string> = {
    active: "Đang chạy",
    paused: "Tạm dừng",
    "insufficient-usdt": "Thiếu USDT",
  };
  const btcTargetLabel = (target: BtcTransferTarget) => {
    const labels: Record<BtcTransferTarget, string> = {
      btc: "BTC",
      usdt: "USDT",
      stock: "CK",
      saving: "Tiết kiệm",
      emergency: "Dự phòng",
      cash: "Tiền mặt",
    };
    return labels[target];
  };
  const section = (title: string, headers: string[], body: CsvRow[]) => {
    rows.push([], [title], headers, ...body);
  };
  const sortedByDate = <T extends { date: string }>(items: T[]) => [...items].sort((a, b) => a.date.localeCompare(b.date));
  const dcaPlanStatsForExport = (plan: BtcDcaPlan) => {
    const trades = state.btcTrades.filter((trade) => trade.type === "dca" && trade.planId === plan.id);
    const investedUsdt = trades.reduce((sum, trade) => sum + trade.usdtAmount, 0);
    const tradeBtcAmount = trades.reduce((sum, trade) => sum + trade.btcAmount, 0);
    const tradeAveragePriceUsdt = tradeBtcAmount ? investedUsdt / tradeBtcAmount : 0;
    const btcAmount = plan.btcAmountOverride && plan.btcAmountOverride > 0 ? plan.btcAmountOverride : tradeBtcAmount;
    const averagePriceUsdt =
      plan.averagePriceUsdtOverride && plan.averagePriceUsdtOverride > 0 ? plan.averagePriceUsdtOverride : tradeAveragePriceUsdt;
    const currentValueUsdt = btcAmount * state.market.btcUsdt;
    const pnlUsdt = currentValueUsdt - investedUsdt;
    const latestTrade = [...trades].sort((a, b) => b.executedAt.localeCompare(a.executedAt))[0];
    return {
      investedUsdt,
      btcAmount,
      averagePriceUsdt,
      currentValueUsdt,
      pnlUsdt,
      pnlPercent: investedUsdt ? (pnlUsdt / investedUsdt) * 100 : 0,
      latestPriceUsdt: latestTrade.btcPriceUsdt ?? 0,
      latestTradeAt: latestTrade.executedAt ?? "",
      tradeCount: trades.length,
    };
  };

  rows.push(
    ["Báo cáo dữ liệu Quản lý chi tiêu"],
    ["Tạo lúc", safeDateTime(now)],
    ["Tóm tắt", stateCountSummary(state)],
    ["Tháng hiện tại", formatMonth(current)],
    ["Giá BTC/USDT", formatUsdt(state.market.btcUsdt), "Giá SOL/USDT", formatUsdt(state.market.solUsd), "USDT/VND", formatVnd(state.market.usdtVnd)],
    ["Giá cập nhật lúc", safeDateTime(state.market.updatedAt), "Nguồn BTC", state.market.btcSource ?? "", "Nguồn SOL", state.market.solSource ?? "", "Nguồn USDT", state.market.usdtSource ?? ""]
  );

  section("Tổng quan tháng hiện tại", ["Chỉ tiêu", "Giá trị", "Hiển thị"], [
    ["Tổng thu", ...moneyPair(summary.income)],
    ["Tổng chi", ...moneyPair(summary.expense)],
    ["Tiết kiệm trong tháng", ...moneyPair(summary.saving)],
    ["Đã chia quỹ", summary.allocation.confirmedAt ? "Có" : "Chưa"],
    ["Tài sản Crypto", ...moneyPair(cryptoValueVnd)],
    ["Tài sản CK", ...moneyPair(stockStats.totalValue)],
  ]);

  section("Lãi/lỗ theo gốc", ["Quỹ", "Vốn đang đầu tư", "Vốn hiển thị", "Giá trị hiện tại", "Giá trị hiện thị", "Lãi/lỗ", "Lãi/lỗ hiển thị", "%"], assetPnlRows(state).map((item) => [
    item.label,
    ...moneyPair(item.principal),
    ...moneyPair(item.current),
    ...moneyPair(item.pnl),
    percentText(item.pnlPercent),
  ]));

  section("Danh mục thu nhập", ["ID", "Tên danh mục", "Loại"], state.incomeCategories.map((item) => [item.id, item.name, item.kind === "fixed" ? "Cố định" : "Phát sinh"]));

  section("Thu nhập", ["ID", "Ngày", "Tháng", "Danh mục", "Loại", "Số tiền", "Hiển thị", "Ghi chú"], sortedByDate(state.incomeTransactions).map((item) => {
    const category = incomeCategoryByIdd.get(item.categoryId);
    return [item.id, safeDate(item.date), formatMonth(item.month), category?.name ?? item.categoryId, category?.kind === "fixed" ? "Cố định" : "Phát sinh", ...moneyPair(item.amount), item.note];
  }));

  section("Danh mục chi tiêu", ["ID", "Tên danh mục", "Loại", "Mặc định", "Mặc định hiển thị", "Tích lũy liên kết"], state.expenseCategories.map((item) => {
    const goal = item.accumulationGoalId ? state.accumulationGoals.find((goalItem) => goalItem.id === item.accumulationGoalId) : undefined;
    return [item.id, item.name, item.kind === "fixed" ? "Cố định" : "Phát sinh", ...moneyPair(item.defaultAmount), goal?.name ?? ""];
  }));

  section("Chi tiêu phát sinh", ["ID", "Ngày", "Tháng", "Danh mục", "Loại", "Số tiền", "Hiển thị", "Ghi chú"], sortedByDate(state.expenseEntries).map((item) => {
    const category = expenseCategoryByIdd.get(item.categoryId);
    return [item.id, safeDate(item.date), formatMonth(item.month), category?.name ?? item.categoryId, category?.kind === "fixed" ? "Cố định" : "Phát sinh", ...moneyPair(item.amount), item.note];
  }));

  section("Checklist khoản cố định", ["ID", "Tháng", "Danh mục", "Loại", "Đầu kỳ", "Đầu kỳ hiển thị", "Số tiền tick", "Số tiền hiển thị", "Cuối kỳ", "Cuối kỳ hiển thị", "Trạng thái", "Tích lũy liên kết"], state.monthlyExpenses.map((item) => {
    const category = expenseCategoryByIdd.get(item.categoryId);
    const goal = category?.accumulationGoalId ? state.accumulationGoals.find((goalItem) => goalItem.id === category.accumulationGoalId) : undefined;
    return [
      item.id,
      formatMonth(item.month),
      category?.name ?? item.categoryId,
      category?.kind === "fixed" ? "Cố định" : "Phát sinh",
      ...moneyPair(item.startAmount),
      ...moneyPair(item.amount),
      ...moneyPair(item.endAmount),
      item.checked ? "Đã tick" : "Chưa tick",
      goal?.name ?? "",
    ];
  }));

  section("Chia quỹ", ["Tháng", "Xác nhận lúc", "Tiết kiệm tại thời điểm chia", "Tiết kiệm hiển thị", "% Crypto", "Crypto", "Crypto hiển thị", "% CK", "CK", "CK hiển thị", "% Tiết kiệm", "Tiết kiệm", "Tiết kiệm hiển thị", "% Dự phòng", "Dự phòng", "Dự phòng hiển thị", "Yêu cầu tự do số tiết kiệm", "Đã tự do số tiết kiệm", "Yêu cầu tự do sẽ dự phòng", "Đã tự do sẽ dự phòng"], state.allocations.map((item) => [
    formatMonth(item.month),
    safeDateTime(item.confirmedAt),
    ...moneyPair(item.totalSavingAtConfirm ?? 0),
    percentText(item.btcPercent),
    ...moneyPair(item.btcAmount ?? 0),
    percentText(item.stockPercent),
    ...moneyPair(item.stockAmount ?? 0),
    percentText(item.savingPercent),
    ...moneyPair(item.savingAmount ?? 0),
    percentText(item.emergencyPercent),
    ...moneyPair(item.emergencyAmount ?? 0),
    safeDateTime(item.savingDepositRequestedAt),
    safeDateTime(item.savingDepositCreatedAt),
    safeDateTime(item.emergencyDepositRequestedAt),
    safeDateTime(item.emergencyDepositCreatedAt),
  ]));

  section("Giao dịch quỹ", ["ID", "Ngày", "Tháng", "Quỹ", "Loại", "Số tiền", "Hiển thị", "Ghi chú"], sortedByDate(state.fundTransactions).map((item) => [
    item.id,
    safeDate(item.date),
    formatMonth(item.month),
    item.fund === "btc" ? "Crypto" : "CK",
    item.type === "deposit" ? "Nạp vốn" : "Rút vốn",
    ...moneyPair(item.amount),
    item.note,
  ]));

  section("Crypto - Tổng quan", ["Chỉ tiêu", "Giá trị", "Hiển thị"], [
    ["Vốn đang đầu tư Crypto", ...moneyPair(cryptoPrincipalVnd)],
    ["VND dư", ...moneyPair(btcStats.pendingVnd)],
    ["VND dã mua USDT/mua BTC", ...moneyPair(btcStats.investedValueVnd)],
    ["Số dư USDT", ...usdtPair(btcStats.usdtBalance)],
    ["BTC đang giữ", ...btcPair(btcStats.btcBalance)],
    ["Giá trị BTC theo USDT", ...usdtPair(btcStats.btcValueUsdt)],
    ["SOL đang giữ", ...solPair(sol.balance)],
    ["Giá trị SOL theo USDT", ...usdtPair(sol.balance * state.market.solUsd)],
    ["Tổng tài sản Crypto", ...moneyPair(cryptoValueVnd)],
    ["Giá vốn TB BTC", ...usdtPair(btcStats.averageCostUsdt)],
    ["Giá vốn TB SOL", ...usdtPair(sol.balance ? sol.cost / sol.balance : 0)],
    ["Lãi/lỗ Crypto", ...moneyPair(cryptoPnlVnd)],
    ["Lãi/lỗ Crypto %", percentText(cryptoPnlPercent)],
  ]);

  section("Crypto - Mua USDT", ["ID", "Ngày", "VND dùng mua", "VND hiển thị", "USDT thực nhận", "USDT hiển thị", "Giá USDT/VND lúc mua", "Ghi chú"], sortedByDate(state.btcUsdtTopups).map((item) => [
    item.id,
    safeDate(item.date),
    ...moneyPair(item.vndAmount),
    ...usdtPair(item.usdtAmount),
    item.usdtAmount ? Math.round(item.vndAmount / item.usdtAmount) : 0,
    item.note,
  ]));

  section("Crypto - Kế hoạch DCA BTC", ["ID", "Trạng thái", "Tần suất", "Giờ chạy", "Ngày bắt đầu", "Giao dịch tiếp theo", "Lần chạy cuối", "USDT mỗi kỳ", "USDT mỗi kỳ hiển thị", "Đã đầu tư USDT", "Đã đầu tư hiển thị", "Giá trị hiện tại USDT", "Giá trị hiện tại hiển thị", "Lãi/lỗ USDT", "Lãi/lỗ hiển thị", "%", "BTC tích lũy", "BTC hiển thị", "Giá gần nhất", "Giá gần nhất hiển thị", "Giá trung bình", "Giá trung bình hiển thị", "Số lệnh", "Ghi chú trạng thái", "Ghi chú"], state.btcDcaPlans.map((plan) => {
    const planStats = dcaPlanStatsForExport(plan);
    return [
      plan.id,
      dcaStatusLabel[plan.status],
      dcaFrequencyLabel[plan.frequency],
      plan.time,
      safeDate(plan.startDate),
      safeDateTime(plan.nextRunAt),
      safeDateTime(plan.lastRunAt),
      ...usdtPair(plan.amountUsdt),
      ...usdtPair(planStats.investedUsdt),
      ...usdtPair(planStats.currentValueUsdt),
      ...usdtPair(planStats.pnlUsdt),
      percentText(planStats.pnlPercent),
      ...btcPair(planStats.btcAmount),
      ...usdtPair(planStats.latestPriceUsdt),
      ...usdtPair(planStats.averagePriceUsdt),
      planStats.tradeCount,
      plan.statusNote ?? "",
      plan.note,
    ];
  }));

  section("Crypto - Lệnh mua BTC", ["ID", "Loại", "Kế hoạch DCA", "Thời điểm", "USDT dùng mua", "USDT hiển thị", "BTC nhận", "BTC hiển thị", "Giá BTC/USDT", "Giá hiển thị", "Chi phí VND nếu mua trước tiếp", "Chi phí hiển thị", "Ghi chú"], state.btcTrades.map((item) => [
    item.id,
    item.type === "dca" ? "DCA" : "Mua thêm",
    item.planId ?? "",
    safeDateTime(item.executedAt),
    ...usdtPair(item.usdtAmount),
    ...btcPair(item.btcAmount),
    ...usdtPair(item.btcPriceUsdt),
    ...moneyPair(item.costVnd ?? 0),
    item.note,
  ]));

  section("Crypto - Rút / chuyển BTC-USDT", ["ID", "Ngày", "Tài sản nguồn", "Nơi nhận", "BTC", "BTC hiển thị", "USDT", "USDT hiển thị", "Giá BTC/USDT", "Giá hiển thị", "Giá trị VND", "VND hiển thị", "Giá vốn USDT giải phóng", "Giá vốn USDT hiển thị", "Lãi/lỗ đã chốt USDT", "Lãi/lỗ USDT hiển thị", "Giá vốn VND giải phóng", "Giá vốn VND hiển thị", "Lãi/lỗ đã chốt VND", "Lãi/lỗ VND hiển thị", "Ghi chú"], sortedByDate(state.btcTransfers).map((item) => {
    const realized = crypto.btcCostBasis.coinSaleByTransferId[item.id];
    return [
      item.id,
      safeDate(item.date),
      item.asset.toUpperCase(),
      btcTargetLabel(item.destination),
      ...btcPair(item.btcAmount),
      ...usdtPair(item.usdtAmount),
      ...usdtPair(item.btcPriceUsdt),
      ...moneyPair(item.vndAmount),
      ...usdtPair(realized?.releasedCostUsdt ?? 0),
      ...usdtPair(realized?.pnlUsdt ?? 0),
      ...moneyPair(realized?.releasedCostVnd ?? 0),
      ...moneyPair(realized?.pnlVnd ?? 0),
      item.note,
    ];
  }));

  section("CK - Tổng quan", ["Chỉ tiêu", "Giá trị", "Hiển thị"], [
    ["Vốn đang đầu tư CK", ...moneyPair(stockStats.investedValueVnd)],
    ["Tiền dư CK", ...moneyPair(stockStats.cash)],
    ["Giá trị cổ phiếu", ...moneyPair(stockStats.stockValue)],
    ["Tổng tài sản CK", ...moneyPair(stockStats.totalValue)],
    ["Giá vốn cổ phiếu", ...moneyPair(stockStats.totalCost)],
    ["Lãi/lỗ cổ phiếu", ...moneyPair(stockStats.pnl)],
    ["Lãi/lỗ %", percentText(stockStats.pnlPercent)],
  ]);

  section("CK - Danh mục hiện tại", ["Mã", "Số cổ", "Giá vốn TB", "Giá thị trường", "Vốn", "Vốn hiển thị", "Giá trị thị trường", "Giá trị hiển thị", "Lãi/lỗ", "Lãi/lỗ hiển thị", "%", "Nguồn giá", "Cập nhật lúc"], stockStats.holdings.map((item) => [
    item.symbol,
    item.shares,
    item.averageCost,
    item.marketPrice,
    ...moneyPair(item.cost),
    ...moneyPair(item.marketValue),
    ...moneyPair(item.pnl),
    percentText(item.pnlPercent),
    item.source,
    safeDateTime(item.updatedAt),
  ]));

  section("CK - Lịch sử mua", ["ID", "Ngày", "Tháng", "Mã", "Số cổ", "Giá mua", "Giá trị gồm phí", "Giá trị gồm phí hiển thị", "Ghi chú", "Tạo lúc"], state.stockPurchases.flatMap((purchase) =>
    stockPurchaseLinesWithCost(purchase.lines).map((item) => [
      purchase.id,
      safeDate(purchase.date),
      formatMonth(purchase.month),
      item.line.symbol,
      item.line.shares,
      item.line.buyPrice,
      ...moneyPair(item.cost),
      purchase.note,
      safeDateTime(purchase.createdAt),
    ])
  ));

  section("CK - Lịch sử rút / bán", ["ID", "Ngày", "Mã", "Số cổ", "Giá bán", "Giá trị khớp", "Giá trị khớp hiển thị", "Phí/thuế", "Phí/thuế hiển thị", "Thực nhận", "Thực nhận hiển thị", "Giá vốn giải phóng", "Giá vốn hiển thị", "Lãi/lỗ đã chốt", "Lãi/lỗ hiển thị", "Nơi nhận", "Ghi chú", "Tạo lúc"], sortedByDate(state.stockSales).map((item) => {
    const realized = stockSaleHistoryById.get(item.id);
    return [
      item.id,
      safeDate(item.date),
      item.symbol,
      item.shares,
      item.sellPrice,
      ...moneyPair(item.vndAmount),
      ...moneyPair((item.fee ?? 0) + (item.tax ?? 0)),
      ...moneyPair(stockSaleNetVndAmount(item)),
      ...moneyPair(realized?.releasedCostVnd ?? 0),
      ...moneyPair(realized?.realizedPnlVnd ?? 0),
      solDestinationLabel(item.destination),
      item.note,
      safeDateTime(item.createdAt),
    ];
  }));

  section("CK - Giá thị trường", ["Mã", "Giá", "Nguồn", "Cập nhật lúc"], state.stockMarketPrices.map((item) => [
    item.symbol,
    item.price,
    item.source,
    safeDateTime(item.updatedAt),
  ]));

  section("Crypto - Giao dịch SOL", ["ID", "Loại", "Ngày", "SOL", "SOL hiển thị", "Giá SOL", "Giá hiển thị", "Giá trị USDT", "USDT hiển thị", "Giá trị VND", "VND hiển thị", "Giá vốn USDT giải phóng", "Giá vốn USDT hiển thị", "Lãi/lỗ đã chốt USDT", "Lãi/lỗ USDT hiển thị", "Giá vốn VND giải phóng", "Giá vốn VND hiển thị", "Lãi/lỗ đã chốt VND", "Lãi/lỗ VND hiển thị", "Nơi nhận", "Ghi chú"], sortedByDate(state.solTransactions).map((item) => {
    const price = isSolWithdrawal(item) ? item.sellPrice : item.buyPrice;
    const vndAmount = isSolWithdrawal(item) ? item.vndAmount : item.solAmount * price * (state.market.usdtVnd || state.market.usdVnd);
    const realized = isSolWithdrawal(item) ? crypto.solCoinSaleByTransactionId[item.id] : undefined;
    return [
      item.id,
      isSolWithdrawal(item) ? "Rút/chuyển" : "Mua",
      safeDate(item.date),
      ...solPair(item.solAmount),
      ...usdtPair(price),
      ...usdtPair(item.solAmount * price),
      ...moneyPair(vndAmount),
      ...usdtPair(realized?.releasedCostUsdt ?? 0),
      ...usdtPair(realized?.pnlUsdt ?? 0),
      ...moneyPair(realized?.releasedCostVnd ?? 0),
      ...moneyPair(realized?.pnlVnd ?? 0),
      isSolWithdrawal(item) ? solDestinationLabel(item.destination) : "",
      item.note,
    ];
  }));

  section("Sổ MBB", ["ID", "Mã số", "Quỹ", "Sản phẩm", "Mục tích lũy", "4 số MB", "Gốc", "Gốc hiển thị", "CCTG đã thanh toán", "CCTG đã thanh toán hiển thị", "CCTG giá trĐ cuối kỳ", "CCTG giá trĐ cuối kỳ hiển thị", "Lãi suất %/năm", "Kỳ hạn tháng", "Ngày gửi", "Ngày đáo hạn", "Trạng thái", "Lãi dự kiến", "Lãi dự kiến hiển thị", "Ngày tất toán", "Số tiền tất toán", "Tất toán hiển thị", "Số cha", "Số con", "Từ tháng chia quỹ", "Tỷ lệnh SOL", "Ghi chú"], state.bankDeposits.map((item) => [
    item.id,
    item.code,
    depositFundLabel(item.fund),
    item.product === "certificate" ? "CCTG" : "Tiền gửi",
    item.accumulationGoalId ? state.accumulationGoals.find((goal) => goal.id === item.accumulationGoalId)?.name ?? item.accumulationGoalId : "",
    item.mbLast4,
    ...moneyPair(item.principal),
    ...moneyPair(item.certificatePurchaseAmount ?? 0),
    ...moneyPair(item.certificateMaturityValue ?? 0),
    item.rate,
    item.termMonths,
    safeDate(item.startDate),
    safeDate(item.maturityDate),
    item.status,
    ...moneyPair(interestFor(item)),
    safeDate(item.settledAt),
    ...moneyPair(item.settledAmount ?? 0),
    item.parentId ?? "",
    item.childId ?? "",
    item.createdFromMonth ? formatMonth(item.createdFromMonth) : "",
    item.createdFromSolWithdrawalId ?? "",
    item.note,
  ]));

  section("Tích lũy", ["ID", "Tên", "Mục tiêu", "Mục tiêu hiển thị", "Đã đạt", "Đã đạt hiển thị", "Còn lại", "Còn lại hiển thị", "Tháng bắt đầu", "Ngày cần dùng", "Số tháng", "Số tiền/tháng", "Số tiền/tháng hiển thị", "Số tháng đã đạt", "Trạng thái", "Ngày kết thúc", "Ngày tạo", "Cập nhật lúc"], state.accumulationGoals.map((item) => {
    const progress = accumulationProgress(state, item);
    return [
      item.id,
      item.name,
      ...moneyPair(item.targetAmount),
      ...moneyPair(progress),
      ...moneyPair(Math.max(item.targetAmount - progress, 0)),
      formatMonth(item.startMonth),
      safeDate(item.dueDate),
      item.months,
      ...moneyPair(item.monthlyAmount),
      accumulationPaidMonths(state, item),
      item.status,
      safeDate(item.endedAt),
      safeDateTime(item.createdAt),
      safeDateTime(item.updatedAt),
    ];
  }));

  section("Corporate actions", ["ID", "Mã", "Loại", "Ngày nhận", "Tỷ lệ từ", "Tỷ lệ đến", "Tiền/cp", "Giá quyền mua", "Thuế", "Số cổ đủ quyền", "Số cổ nhận/mua", "Tiền thực nhận", "Số tiền mua quyền", "Trạng thái", "Đã áp dụng lúc"], state.corporateActions.map((item) => [
    item.id,
    item.symbol,
    item.type,
    safeDate(item.paymentDate ?? item.receiveDate),
    item.ratioFrom ?? "",
    item.ratioTo ?? "",
    item.cashPerShare ?? "",
    item.subscriptionPrice ?? "",
    item.taxRate ?? "",
    item.eligibleShares,
    item.resultingShares ?? "",
    item.cashReceived ?? "",
    item.type === "rights_issue" ? corporateActionRightsIssueCost(item) : "",
    item.status,
    safeDateTime(item.appliedAt),
  ]));

  section("Thùng rác 30 ngày", ["ID", "Loại dữ liệu", "ID gốc", "Nhãn", "Xóa lúc", "Hết hạn lúc", "Dữ liệu liên quan"], state.trashItems.map((item) => [
    item.id,
    item.entityType,
    item.entityId,
    item.label,
    safeDateTime(item.deletedAt),
    safeDateTime(item.expiresAt),
    item.relatedPayloads ? Object.keys(item.relatedPayloads).join(", ") : "",
  ]));

  section("Lịch sử thao tác", ["ID", "Thời điểm", "Hành động", "Loại dữ liệu", "ID dữ liệu", "Nội dung", "Trước", "Sau"], state.auditLogs.map((item) => [
    item.id,
    safeDateTime(item.createdAt),
    item.action,
    item.entityType,
    item.entityId ?? "",
    item.label,
    item.beforeSummary ?? "",
    item.afterSummary ?? "",
  ]));

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

const arrayOr = <T,>(value: T[] | null | undefined, fallback: T[] = []) =>
  Array.isArray(value) ? value : fallback;

function normalizeState(state: AppState): AppState {
  const incomingSchema = Number(state.schemaVersion ?? 1);
  const settings = { ...initialState.settings, ...(state.settings ?? {}) };
  const market = { ...initialState.market, ...(state.market ?? {}) };
  const expenseCategoriesMapped = arrayOr<ExpenseCategory & { kind: string }>(state.expenseCategories as Array<ExpenseCategory & { kind: string }> | null | undefined).map((category) => {
    const migratedKind: ExpenseCategory["kind"] = category.kind === "variable" ? "variable" : "fixed";
    if (category.id === "chi-tieu") {
      return { ...category, kind: "fixed" as const, defaultAmount: category.defaultAmount || 3_000_000 };
    }
    if (category.id === "phat-sinh") {
      return { ...category, kind: "variable" as const, defaultAmount: 0 };
    }
    return { ...category, kind: migratedKind, defaultAmount: category.defaultAmount ?? 0 };
  });
  const expenseCategories = expenseCategoriesMapped.length ? expenseCategoriesMapped : initialState.expenseCategories;
  const rawIncomeCategories = arrayOr(state.incomeCategories);
  let incomeCategories = rawIncomeCategories.length ? rawIncomeCategories : initialState.incomeCategories;
  let incomeTransactions = arrayOr(state.incomeTransactions);
  if (!incomeCategories.some((category) => category.id === MBB_SETTLEMENT_INCOME_CATEGORY_ID)) {
    incomeCategories = [...incomeCategories, mbbSettlementIncomeCategory()];
  }

  const bankDeposits = arrayOr<BankDeposit & { fund: string; product?: string }>(state.bankDeposits as Array<BankDeposit & { fund: string; product?: string }> | null | undefined).map((deposit) => {
    const fund: DepositFund = deposit.fund === "emergency" || deposit.fund === "accumulation" ? deposit.fund : "saving";
    const product: DepositProduct = deposit.product === "certificate" ? "certificate" : "term-deposit";
    return {
      ...deposit,
      fund,
      product,
      accumulationGoalId: deposit.accumulationGoalId ?? undefined,
      certificatePurchaseAmount: Number.isFinite(deposit.certificatePurchaseAmount) ? deposit.certificatePurchaseAmount : undefined,
      certificateMaturityValue: Number.isFinite(deposit.certificateMaturityValue) ? deposit.certificateMaturityValue : undefined,
      rate: Number.isFinite(deposit.rate) ? deposit.rate : parseDecimal(String(deposit.rate ?? "")),
      termMonths: Number.isFinite(deposit.termMonths) ? deposit.termMonths : Number(deposit.termMonths) || 0,
      mbLast4: deposit.mbLast4 ?? "",
    };
  });

  if (incomingSchema < MBB_SETTLEMENT_INCOME_SCHEMA_VERSION) {
    const migratedSettlementIncome = migrateMbbSettlementIncome(incomeCategories, incomeTransactions, bankDeposits);
    incomeCategories = migratedSettlementIncome.incomeCategories;
    incomeTransactions = migratedSettlementIncome.incomeTransactions;
  }

  const solTransactions = arrayOr(state.solTransactions).map((transaction) =>
    isSolWithdrawal(transaction)
      ? {
          ...transaction,
          sellPrice: transaction.sellPrice ?? market.solUsd ?? 0,
          vndAmount: transaction.vndAmount ?? 0,
          destination: transaction.destination ?? "cash",
        }
      : {
          ...transaction,
          type: "buy" as const,
        }
  );
  const btcDcaPlans = arrayOr(state.btcDcaPlans).map(normalizeDcaPlan);
  const repairedBtcTrades = repairDcaTradeDates(arrayOr(state.btcTrades), btcDcaPlans);
  const btcTrades = incomingSchema < 4
    ? repairedBtcTrades.map((trade) =>
        trade.type === "manual-buy"
          ? { ...trade, executedAt: `${dateValueFromDateTime(trade.executedAt)}T00:00:00.000` }
          : trade
      )
    : repairedBtcTrades;
  const unlinkedSolWithdrawals = solTransactions
    .filter((item): item is SolWithdrawTransaction => isSolWithdrawal(item) && item.destination === "btc")
    .map((item) => ({
      withdrawalId: item.id,
      date: item.date,
      usdtAmount: item.usdtAmount ?? item.solAmount * item.sellPrice,
      costVnd: 0,
    }));
  const btcUsdtTopups = arrayOr(state.btcUsdtTopups).map((topup) => {
    const normalizedTopup = {
      ...topup,
      occurredAt: topup.occurredAt || (incomingSchema >= 4 ? topup.meta?.createdAt : undefined) || `${topup.date}T00:00:00.000`,
    };
    if (!isSolDerivedUsdtTopup(normalizedTopup) || normalizedTopup.sourceSolWithdrawalId) return normalizedTopup;
    const matchIndex = findSolDerivedTopupCostEventIndex(unlinkedSolWithdrawals, normalizedTopup);
    if (matchIndex < 0) return normalizedTopup;
    const sourceSolWithdrawalId = unlinkedSolWithdrawals.splice(matchIndex, 1)[0].withdrawalId;
    return { ...normalizedTopup, sourceSolWithdrawalId };
  });
  const btcTransfers = arrayOr(state.btcTransfers).map((transfer) => ({
    ...transfer,
    occurredAt: transfer.occurredAt || (incomingSchema >= 4 ? transfer.meta?.createdAt : undefined) || `${transfer.date}T00:00:00.000`,
  }));

  const normalizedUsdtVnd = market.usdtSource === "ExchangeRate" ? 0 : market.usdtVnd ?? 0;

  const normalized: AppState = {
    ...state,
    schemaVersion: state.schemaVersion ?? 1,
    settings: {
      ...settings,
      autoLockEnabled: settings.autoLockEnabled ?? true,
      pinLoginDisabledUntil: settings.pinLoginDisabledUntil,
      dismissedCryptoAllocationIds: settings.dismissedCryptoAllocationIds ?? [],
      dismissedStockAllocationIds: settings.dismissedStockAllocationIds ?? [],
    },
    incomeCategories,
    incomeTransactions,
    expenseCategories,
    monthlyExpenses: arrayOr(state.monthlyExpenses),
    accumulationGoals: arrayOr(state.accumulationGoals),
    expenseEntries: arrayOr(state.expenseEntries),
    allocations: arrayOr(state.allocations, initialState.allocations),
    fundTransactions: arrayOr(state.fundTransactions),
    bankDeposits,
    solTransactions,
    stockPurchases: arrayOr(state.stockPurchases),
    stockSales: arrayOr(state.stockSales),
    stockMarketPrices: arrayOr(state.stockMarketPrices),
    btcUsdtTopups,
    btcDcaPlans,
    btcTrades,
    btcTransfers,
    auditLogs: arrayOr(state.auditLogs),
    trashItems: arrayOr(state.trashItems).filter((item) => new Date(item.expiresAt).getTime() > Date.now()),
    backupMeta: state.backupMeta ?? {},
    financialAccounts: arrayOr(state.financialAccounts),
    moneyFlowEdges: arrayOr(state.moneyFlowEdges),
    healthIssues: arrayOr(state.healthIssues),
    reconciliationSessions: arrayOr(state.reconciliationSessions),
    adjustmentTransactions: arrayOr(state.adjustmentTransactions),
    corporateActions: arrayOr(state.corporateActions),
    allocationStrategies: arrayOr(state.allocationStrategies, initialState.allocationStrategies),
    allocationPlans: arrayOr(state.allocationPlans),
    reportMonthlySnapshots: arrayOr(state.reportMonthlySnapshots),
    market: {
      ...market,
      btcUsdt: market.btcUsdt ?? 0,
      usdtVnd: normalizedUsdtVnd,
      usdVnd: market.usdVnd ?? normalizedUsdtVnd ?? 0,
    },
  };

  if (incomingSchema < 4) {
    const closedTransferIds = new Set(cryptoLedgerFromState(normalized).closedTransferIds);
    normalized.btcTransfers = normalized.btcTransfers.map((transfer) =>
      closedTransferIds.has(transfer.id) ? { ...transfer, closesPosition: true } : transfer
    );
  }

  return normalizeFinancialMetadata(normalized);
}

function assetTotalForMigrationCheck(state: AppState) {
  const total = assetPnlRows(state).find((row) => row.id === "total")?.current ?? 0;
  return Number.isFinite(total) ? Math.round(total) : 0;
}

function normalizeStateWithMigrationSafety(input: AppState, options: { backupBeforeMigration?: boolean } = {}) {
  const incomingSchema = Number(input.schemaVersion ?? 1);
  const needsMigration = incomingSchema < FINANCIAL_SCHEMA_VERSION;
  const migrationBaseline = incomingSchema < 4
    ? {
        ...input,
        btcTrades: arrayOr(input.btcTrades).map((trade) =>
          trade.type === "manual-buy"
            ? { ...trade, executedAt: `${dateValueFromDateTime(trade.executedAt)}T00:00:00.000` }
            : trade
        ),
      }
    : input;
  const beforeTotal = needsMigration ? assetTotalForMigrationCheck(migrationBaseline) : 0;

  if (needsMigration && options.backupBeforeMigration) {
    localStorage.setItem(AUTO_MIGRATION_BACKUP_KEY, JSON.stringify(backupPayload(input)));
  }

  const normalized = normalizeState(input);
  if (needsMigration) {
    const afterTotal = assetTotalForMigrationCheck(normalized);
    if (Math.abs(afterTotal - beforeTotal) > 1) {
      throw new Error(`Migration bị chặn vì tổng tài sản đổi từ ${formatVnd(beforeTotal)} sang ${formatVnd(afterTotal)}.`);
    }
    return {
      ...normalized,
      healthIssues: runHealthChecks(normalized, buildFinancialIndex(normalized)),
    };
  }

  return normalized;
}

function calculateAllocationAmounts(totalSaving: number, allocation: Allocation): AllocationAmounts {
  const total = Math.max(totalSaving, 0);
  const lockedFunds = new Set(allocation.lockedFunds ?? []);
  const lockedTotal = ALLOCATION_FUND_KEYS.reduce((sum, fund) => {
    if (!lockedFunds.has(fund)) return sum;
    return sum + allocationAmountOrDefault(allocation[ALLOCATION_AMOUNT_KEYS[fund]], 0);
  }, 0);
  const unlockedTotal = lockedFunds.size ? Math.max(total - lockedTotal, 0) : total;
  const allocationTotal = lockedFunds.size ? unlockedTotal : total;
  const rawBtc = lockedFunds.has("btc") ? 0 : (allocationTotal * allocation.btcPercent) / 100;
  const rawStock = lockedFunds.has("stock") ? 0 : (allocationTotal * allocation.stockPercent) / 100;
  const rawSaving = lockedFunds.has("saving") ? 0 : (allocationTotal * allocation.savingPercent) / 100;
  const rawEmergency = lockedFunds.has("emergency") ? 0 : (allocationTotal * allocation.emergencyPercent) / 100;
  const saving = roundDownToCertificateLot(rawSaving);
  const emergency = roundDownToCertificateLot(rawEmergency);
  const savingRemainder = rawSaving - saving;
  const emergencyRemainder = rawEmergency - emergency;
  const remainderTarget = lockedFunds.has("btc") ? (lockedFunds.has("stock") ? null : "stock") : "btc";
  const btcRemainder = remainderTarget === "btc" ? savingRemainder + emergencyRemainder : 0;
  const stockRemainder = remainderTarget === "stock" ? savingRemainder + emergencyRemainder : 0;

  return {
    btc: allocationAmountOrDefault(allocation.btcAmount, rawBtc + btcRemainder),
    stock: allocationAmountOrDefault(allocation.stockAmount, rawStock + stockRemainder),
    saving: allocationAmountOrDefault(allocation.savingAmount, saving),
    emergency: allocationAmountOrDefault(allocation.emergencyAmount, emergency),
    savingRemainder,
    emergencyRemainder,
  };
}

function allocationPercents(allocation: Allocation): Record<AllocationFundKey, number> {
  return {
    btc: allocation.btcPercent,
    stock: allocation.stockPercent,
    saving: allocation.savingPercent,
    emergency: allocation.emergencyPercent,
  };
}

function allocationBasePercents(allocation: Allocation): Record<AllocationFundKey, number> {
  return {
    btc: allocation.baseBtcPercent ?? allocation.btcPercent,
    stock: allocation.baseStockPercent ?? allocation.stockPercent,
    saving: allocation.baseSavingPercent ?? allocation.savingPercent,
    emergency: allocation.baseEmergencyPercent ?? allocation.emergencyPercent,
  };
}

function allocationPercentPatch(percents: Record<AllocationFundKey, number>): Partial<Allocation> {
  return {
    btcPercent: percents.btc,
    stockPercent: percents.stock,
    savingPercent: percents.saving,
    emergencyPercent: percents.emergency,
  };
}

function allocationBasePercentPatch(percents: Record<AllocationFundKey, number>): Partial<Allocation> {
  return {
    baseBtcPercent: percents.btc,
    baseStockPercent: percents.stock,
    baseSavingPercent: percents.saving,
    baseEmergencyPercent: percents.emergency,
  };
}

function clearAllocationBasePercentPatch(): Partial<Allocation> {
  return {
    baseBtcPercent: undefined,
    baseStockPercent: undefined,
    baseSavingPercent: undefined,
    baseEmergencyPercent: undefined,
  };
}

function redistributeAllocationPercents(base: Record<AllocationFundKey, number>, lockedFunds: AllocationFundKey[]) {
  const locked = new Set(lockedFunds);
  const unlocked = ALLOCATION_FUND_KEYS.filter((fund) => !locked.has(fund));
  if (unlocked.length === 0) return base;

  const lockedPercent = ALLOCATION_FUND_KEYS.reduce((sum, fund) => sum + (locked.has(fund) ? base[fund] : 0), 0);
  const share = lockedPercent / unlocked.length;
  const next = ALLOCATION_FUND_KEYS.reduce((result, fund) => {
    result[fund] = locked.has(fund) ? 0 : Math.round((base[fund] + share) * 100) / 100;
    return result;
  }, {} as Record<AllocationFundKey, number>);
  const assignedExceptLast = unlocked.slice(0, -1).reduce((sum, fund) => sum + next[fund], 0);
  next[unlocked[unlocked.length - 1]] = Math.round((100 - assignedExceptLast) * 100) / 100;
  return next;
}

const initialState: AppState = {
  schemaVersion: FINANCIAL_SCHEMA_VERSION,
  incomeCategories: [
    { id: "pt-valley", name: "PT Valley", kind: "fixed" },
    { id: "fishing", name: "Fishing", kind: "variable" },
    { id: "other-income", name: "Thu nhập khác", kind: "variable" },
    mbbSettlementIncomeCategory(),
  ],
  incomeTransactions: [],
  expenseCategories: [
    { id: "chi-tieu", name: "Chi tiêu", kind: "fixed", defaultAmount: 3000000, accumulationGoalId: "" },
    { id: "phat-sinh", name: "Phát sinh", kind: "variable", defaultAmount: 0, accumulationGoalId: "" },
    { id: "me", name: "Mẹ", kind: "fixed", defaultAmount: 3000000, accumulationGoalId: "" },
    { id: "du-lich", name: "Du lịch", kind: "fixed", defaultAmount: 1500000, accumulationGoalId: "" },
    { id: "hoc-phi", name: "Học phí", kind: "fixed", defaultAmount: 2000000, accumulationGoalId: "" },
  ],
  monthlyExpenses: [],
  accumulationGoals: [],
  expenseEntries: [],
  allocations: [
    {
      month: DEFAULT_START_MONTH,
      btcPercent: 20,
      stockPercent: 20,
      savingPercent: 40,
      emergencyPercent: 20,
    },
  ],
  fundTransactions: [],
  stockPurchases: [],
  stockSales: [],
  stockMarketPrices: [],
  btcUsdtTopups: [],
  btcDcaPlans: [],
  btcTrades: [],
  btcTransfers: [],
  bankDeposits: [],
  solTransactions: [],
  market: {
    solUsd: 0,
    btcUsdt: 0,
    usdtVnd: 0,
    usdVnd: 0,
    updatedAt: "",
  },
  settings: {
    pin: "",
    hasPin: false,
    autoLockEnabled: true,
    pinLoginDisabledUntil: undefined,
    dismissedCryptoAllocationIds: [],
    dismissedStockAllocationIds: [],
  },
  auditLogs: [],
  trashItems: [],
  backupMeta: {},
  financialAccounts: DEFAULT_FINANCIAL_ACCOUNTS,
  moneyFlowEdges: [],
  healthIssues: [],
  reconciliationSessions: [],
  adjustmentTransactions: [],
  corporateActions: [],
  allocationStrategies: DEFAULT_ALLOCATION_STRATEGIES,
  allocationPlans: [],
  reportMonthlySnapshots: [],
};

const preferredMoneyRowId = (rows: Array<{ id: string; value: number }>) =>
  [...rows].filter((row) => row.value > 0).sort((a, b) => b.value - a.value)[0]?.id ?? rows[0]?.id ?? null;

const defaultIncomeCategoryId = (categories: IncomeCategory[] = []) =>
  categories.find((category) => category.id === "other-income")?.id ?? categories[0]?.id ?? "";

const defaultExpenseCategoryId = (categories: ExpenseCategory[] = []) =>
  categories.find((category) => category.id === "phat-sinh")?.id ?? categories[0]?.id ?? "";

function useStoredState() {
  const [state, setState] = useState<AppState>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    try {
      return normalizeStateWithMigrationSafety({ ...initialState, ...JSON.parse(raw) }, { backupBeforeMigration: true });
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState] as const;
}

function getAllocation(state: AppState, month: string): Allocation {
  return (
    state.allocations.find((item) => item.month === month) ?? {
      month,
      btcPercent: 20,
      stockPercent: 20,
      savingPercent: 40,
      emergencyPercent: 20,
    }
  );
}

function getMonthlyExpense(state: AppState, category: ExpenseCategory, month: string): MonthlyExpense {
  return (
    state.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month) ?? {
      id: uid(),
      categoryId: category.id,
      month,
      startAmount: 0,
      endAmount: 0,
      amount: category.defaultAmount,
      checked: false,
    }
  );
}

function monthlySummary(state: AppState, month: string) {
  const incomeRows: IncomeSummaryRow[] = state.incomeCategories.map((category) => {
    const transactions = state.incomeTransactions
      .filter((item) => item.month === month && item.categoryId === category.id)
      .sort((left, right) => right.date.localeCompare(left.date));
    const total = transactions.reduce((sum, item) => sum + item.amount, 0);
    return { id: category.id, name: category.name, value: total, transactions };
  });

  const expenseRows: ExpenseSummaryRow[] = state.expenseCategories.map((category) => {
    const record = getMonthlyExpense(state, category, month);
    const transactions = state.expenseEntries
      .filter((item) => item.month === month && item.categoryId === category.id)
      .sort((left, right) => right.date.localeCompare(left.date));
    const entries = transactions.reduce((sum, item) => sum + item.amount, 0);
    const base = category.kind === "fixed" && record?.checked ? record?.amount : 0;
    return {
      id: category.id,
      name: category.name,
      value: base + entries,
      transactions,
      kind: category.kind,
    };
  });

  const income = incomeRows.reduce((sum, item) => sum + item.value, 0);
  const expense = expenseRows.reduce((sum, item) => sum + item.value, 0);
  const saving = income - expense;
  const allocation = getAllocation(state, month);
  const allocationAmounts = calculateAllocationAmounts(saving, allocation);

  return { incomeRows, expenseRows, income, expense, saving, allocation, allocationAmounts };
}

function averageMonthlyExpenseSince(state: AppState, startMonth = FINANCIAL_RULE_START_MONTH) {
  const months = new Set<string>();
  state.expenseEntries.forEach((item) => {
    if (item.month >= startMonth) months.add(item.month);
  });
  state.monthlyExpenses.forEach((item) => {
    if (item.month >= startMonth && item.checked) months.add(item.month);
  });
  if (currentMonth() >= startMonth) months.add(currentMonth());

  const expenses = [...months]
    .sort()
    .map((month) => monthlySummary(state, month).expense)
    .filter((expense) => expense > 0);

  const averageExpense = expenses.length ? expenses.reduce((sum, expense) => sum + expense, 0) / expenses.length : 0;
  return Math.max(averageExpense, FINANCIAL_RULE_MIN_MONTHLY_EXPENSE);
}

function activePrincipal(deposit: BankDeposit) {
  if (deposit.status === "active") return deposit.principal;
  return 0;
}

type AssetPnlRow = {
  id: string;
  label: string;
  principal: number;
  current: number;
  pnl: number;
  pnlPercent: number;
};

function originalDepositPrincipal(deposit: BankDeposit, deposits: BankDeposit[]) {
  let cursor = deposit;
  const visited = new Set<string>();
  while (cursor.parentId && !visited?.has(cursor.id)) {
    visited?.add(cursor.id);
    const parent = deposits.find((item) => item.id === cursor.parentId);
    if (!parent) break;
    cursor = parent;
  }
  return cursor.principal;
}

function depositFundPnl(state: AppState, fund: TransferDepositFund) {
  const activeDeposits = state.bankDeposits.filter((item) => item.status === "active" && (!fund || item.fund === fund));
  const pending =
    fund
      ? pendingSolDepositTotal(state, fund) + pendingStockSaleDepositTotal(state, fund) + pendingBtcTransferDepositTotal(state, fund)
      : 0;
  const principal = activeDeposits.reduce((sum, item) => sum + originalDepositPrincipal(item, state.bankDeposits), 0) + pending;
  const current = activeDeposits.reduce((sum, item) => sum + item.principal + depositProgress(item).accruedInterest, 0) + pending;
  return { principal, current };
}

function makeAssetPnlRow(id: string, label: string, principal: number, current: number): AssetPnlRow {
  const pnl = current - principal;
  return {
    id,
    label,
    principal,
    current,
    pnl,
    pnlPercent: principal ? (pnl / principal) * 100 : 0,
  };
}

const isSolDerivedUsdtTopup = (topup: BtcUsdtTopup) => topup.note.includes("USDT từ SOL");
const isSolDerivedBtcTrade = (trade: BtcTrade) => trade.note.includes("[sol-btc:");

function isTopupLinkedToSolWithdrawal(
  topup: BtcUsdtTopup,
  withdrawal: SolWithdrawTransaction,
  expectedNote: string
) {
  if (topup.sourceSolWithdrawalId) return topup.sourceSolWithdrawalId === withdrawal.id;
  const withdrawalUsdt = withdrawal.usdtAmount ?? withdrawal.solAmount * withdrawal.sellPrice;
  const tolerance = Math.max(0.01, Math.abs(withdrawalUsdt) * 0.000001);
  return (
    topup.date === withdrawal.date &&
    topup.note === expectedNote &&
    Math.abs(topup.vndAmount - withdrawal.vndAmount) <= 1 &&
    Math.abs(topup.usdtAmount - withdrawalUsdt) <= tolerance
  );
}

function fallbackSolBuyUsdtVndRate(state: AppState, date: string) {
  const directTopups = state.btcUsdtTopups.filter((topup) => !isSolDerivedUsdtTopup(topup) && topup.date <= date);
  const totalUsdt = directTopups.reduce((sum, topup) => sum + topup.usdtAmount, 0);
  const totalVnd = directTopups.reduce((sum, topup) => sum + topup.vndAmount, 0);
  return totalUsdt > 0 ? totalVnd / totalUsdt : state.market.usdtVnd || state.market.usdVnd;
}

function solBuyCostVnd(state: AppState, transaction: SolBuyTransaction) {
  if (transaction.costVnd && transaction.costVnd > 0) return transaction.costVnd;
  return transaction.solAmount * transaction.buyPrice * fallbackSolBuyUsdtVndRate(state, transaction.date);
}

function solCostBasisLedger(state: AppState, upToMonth?: string) {
  return buildSolLedger({
    transactions: state.solTransactions
      .filter((item) => !upToMonth || monthFromDate(item.date) <= upToMonth)
      .map((item) =>
        isSolWithdrawal(item)
          ? {
              id: item.id,
              type: "withdraw" as const,
              solAmount: item.solAmount,
              proceedsUsdt: item.usdtAmount ?? item.solAmount * item.sellPrice,
              proceedsVnd: item.vndAmount,
              destination: item.destination,
              date: item.date,
              occurredAt: item.occurredAt || (item.meta?.createdAt?.includes("T") ? item.meta.createdAt : undefined),
              closesPosition: item.closesPosition,
            }
          : {
              id: item.id,
              type: "buy" as const,
              solAmount: item.solAmount,
              priceUsdt: item.buyPrice,
              costVnd: solBuyCostVnd(state, item),
              date: item.date,
              occurredAt: item.occurredAt || (item.meta?.createdAt?.includes("T") ? item.meta.createdAt : undefined),
            }
      ),
    adjustments: state.adjustmentTransactions
      .filter(
        (item) => isCryptoQuantityAdjustment(item, "SOL") && (!upToMonth || monthFromDate(item.date) <= upToMonth)
      )
      .map((item) => ({
        id: item.id,
        quantity: item.quantity ?? 0,
        date: item.date,
        createdAt: item.createdAt,
      })),
  });
}

function solHoldingCostBasisVnd(state: AppState) {
  return solCostBasisLedger(state).costVnd;
}

function cryptoAssetPnlSnapshot(state: AppState) {
  const btcStats = btcPortfolioStats(state);
  const sol = solPositionFromState(state);
  const btcCostBasis = btcAssetCostBasisVnd(state);
  const usdtVndRate = state.market.usdtVnd || state.market.usdVnd;
  const solValueVnd = sol.balance * state.market.solUsd * usdtVndRate;
  const solHoldingCostVnd = solHoldingCostBasisVnd(state);
  const solLedger = solCostBasisLedger(state);
  const solRealizedByTransactionId = solLedger.realizedByTransactionId;
  const solCostVnd = solHoldingCostVnd;
  const principal = btcCostBasis.btcCostVnd + btcCostBasis.usdtCostVnd + solHoldingCostVnd + btcStats.pendingVnd;
  const current = btcStats.reportValueVnd + solValueVnd;
  const pnl = current - principal;

  return {
    btcStats,
    sol,
    btcCostBasis,
    solValueVnd,
    solCostVnd,
    solHoldingCostVnd,
    solRealizedByTransactionId,
    solCoinSaleByTransactionId: solLedger.coinSaleByTransactionId,
    principal,
    current,
    pnl,
    pnlPercent: principal ? (pnl / principal) * 100 : 0,
  };
}

function assetPnlRows(state: AppState) {
  const stockStats = stockPortfolioStats(state);
  const crypto = cryptoAssetPnlSnapshot(state);
  const saving = depositFundPnl(state, "saving");
  const emergency = depositFundPnl(state, "emergency");
  const rows = [
    makeAssetPnlRow("btc", "Crypto", crypto.principal, crypto.current),
    makeAssetPnlRow("stock", "CK", stockStats.investedValueVnd, stockStats.totalValue),
    makeAssetPnlRow("saving", "Tiết kiệm", saving.principal, saving.current),
    makeAssetPnlRow("emergency", "Dự phòng", emergency.principal, emergency.current),
  ];
  const totalPrincipal = rows.reduce((sum, item) => sum + item.principal, 0);
  const totalCurrent = rows.reduce((sum, item) => sum + item.current, 0);
  return [makeAssetPnlRow("total", "Tổng tài sản", totalPrincipal, totalCurrent), ...rows];
}

type DashboardTask = {
  id: string;
  title: string;
  detail: string;
  action: string;
  badge: string;
  tone?: "warning" | "danger";
  page?: Page;
  tab?: InvestmentTab;
  investmentAction?: InvestmentActionKind;
};

function dashboardTasks(state: AppState, month: string): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  const btcStats = btcPortfolioStats(state);
  const stockStats = stockPortfolioStats(state);
  const summary = monthlySummary(state, month);

  if (summary.saving > 0 && !summary.allocation.confirmedAt && isAllocationReminderDue(month)) {
    tasks.push({ id: "allocation", title: "Tháng này chưa chia quỹ", detail: `Có thể chia ${formatVnd(summary.saving)}`, action: "Chia quỹ", badge: "Chia quỹ", page: "dashboard" });
  }

  const pendingAllocationDeposits = state.allocations
    .filter((allocation) => allocation.confirmedAt)
    .flatMap((allocation) =>
      (["saving", "emergency"] as TransferDepositFund[]).map((fund) => ({
        fund,
        month: allocation.month,
        amount: fund === "saving" ? allocation.savingAmount ?? 0 : allocation.emergencyAmount ?? 0,
        requestedAt: allocation[depositRequestedField(fund)],
        createdAt: allocation[depositCreatedField(fund)],
      }))
    )
    .filter(
      (item) =>
        item.amount > 0 &&
        item.requestedAt &&
        !item.createdAt &&
        !state.bankDeposits.some((deposit) => deposit.fund === item.fund && deposit.createdFromMonth === item.month)
    );
  const pendingAllocationDepositTotal = pendingAllocationDeposits.reduce((sum, item) => sum + item.amount, 0);
  if (pendingAllocationDepositTotal > 0) {
    tasks.push({ id: "allocation-deposit-pending", title: "Tiền chia quỹ chưa tạo sổ", detail: formatVnd(pendingAllocationDepositTotal), action: "Tạo sổ", badge: "MBB", page: "investment", tab: "mbb", investmentAction: "mbb-deposit" });
  }

  const pendingSolDeposits = pendingSolDepositTotal(state, "saving") + pendingSolDepositTotal(state, "emergency");
  if (pendingSolDeposits > 0) {
    tasks.push({ id: "sol-deposit-pending", title: "Tiền SOL chuyển về chưa tạo sổ", detail: formatVnd(pendingSolDeposits), action: "Tạo sổ", badge: "SOL", page: "investment", tab: "mbb", investmentAction: "mbb-deposit" });
  }

  const pendingStockDeposits = pendingStockSaleDepositTotal(state, "saving") + pendingStockSaleDepositTotal(state, "emergency");
  if (pendingStockDeposits > 0) {
    tasks.push({ id: "stock-deposit-pending", title: "Tiền CK chuyển về chưa tạo sổ", detail: formatVnd(pendingStockDeposits), action: "Tạo sổ", badge: "CK", page: "investment", tab: "mbb", investmentAction: "mbb-deposit" });
  }

  const pendingBtcDeposits = pendingBtcTransferDepositTotal(state, "saving") + pendingBtcTransferDepositTotal(state, "emergency");
  if (pendingBtcDeposits > 0) {
    tasks.push({ id: "btc-deposit-pending", title: "Tiền BTC chuyển về chưa tạo sổ", detail: formatVnd(pendingBtcDeposits), action: "Tạo sổ", badge: "BTC", page: "investment", tab: "mbb", investmentAction: "mbb-deposit" });
  }

  const dueDeposit = state.bankDeposits
    .filter((item) => item.status === "active")
    .map((item) => ({ ...item, dueDays: daysUntil(item.maturityDate) }))
    .filter((item) => item.dueDays <= 3)
    .sort((a, b) => a.dueDays - b.dueDays)[0];
  if (dueDeposit) {
    tasks.push({
      id: "deposit-due",
      title: dueDeposit.dueDays <= 0 ? "Sổ MBB: đã đáo hạn" : "Sổ MBB: sắp đáo hạn",
      detail: `${formatVnd(dueDeposit.principal)} · ${dueDeposit.dueDays <= 0 ? "cần xử lý" : `${dueDeposit.dueDays} ngày nữa`}`,
      action: "Xem sổ",
      badge: "MBB",
      tone: "warning",
      page: "investment",
      tab: "mbb",
    });
  }

  if (btcStats.pendingVnd > 0) {
    tasks.push({ id: "btc-pending", title: "Có VND dư trong Crypto", detail: `Còn ${formatVnd(btcStats.pendingVnd)} chưa dùng`, action: "Mua USDT", badge: "BTC", page: "investment", tab: "crypto", investmentAction: "btc-topup" });
  }

  const pendingSolStockCash = pendingStockCashFromTransfer(state, "SOL", stockStats.cash);
  if (pendingSolStockCash > 0) {
    tasks.push({ id: "sol-stock-cash", title: "Tiền từ SOL chuyển về chưa mua cổ", detail: `Còn ${formatVnd(pendingSolStockCash)} trong số dư CK`, action: "Mua CK", badge: "SOL", page: "investment", tab: "stock", investmentAction: "stock-purchase" });
  }

  const pendingBtcStockCash = pendingStockCashFromTransfer(state, "BTC", stockStats.cash - pendingSolStockCash);
  if (pendingBtcStockCash > 0) {
    tasks.push({ id: "btc-stock-cash", title: "Tiền từ BTC/USDT chuyển về chưa mua cổ", detail: `Còn ${formatVnd(pendingBtcStockCash)} trong số dư CK`, action: "Mua CK", badge: "BTC", page: "investment", tab: "stock", investmentAction: "stock-purchase" });
  }

  const pendingAllocationStockCash = Math.max(stockStats.cash - pendingSolStockCash - pendingBtcStockCash, 0);
  if (pendingAllocationStockCash >= 100_000) {
    tasks.push({ id: "stock-cash", title: "Tiền chia quỹ chưa mua cổ", detail: `Còn ${formatVnd(pendingAllocationStockCash)} trong số dư CK`, action: "Mua CK", badge: "CK", page: "investment", tab: "stock", investmentAction: "stock-purchase" });
  }

  const activePlans = state.btcDcaPlans.filter((plan) => plan.isActive);
  const dailyNeed = activePlans.reduce((sum, plan) => sum + (plan.frequency === "daily" ? plan.amountUsdt : 0), 0);
  if (dailyNeed > 0) {
    const daysLeft = Math.floor(btcStats.usdtBalance / dailyNeed);
    if (daysLeft < 5) tasks.push({ id: "usdt-days", title: "USDT chỉ còn ?? DCA được 5 ngày", detail: `Còn được khoảng ${daysLeft} ngày với lịch hiện tại`, action: "Mua USDT", badge: "BTC", tone: daysLeft <= 2 ? "danger" : "warning", page: "investment", tab: "crypto", investmentAction: "btc-topup" });
  }

  return tasks.slice(0, 12);
}

const depositCreatedField = (fund: TransferDepositFund) =>
  fund === "saving" ? "savingDepositCreatedAt" : "emergencyDepositCreatedAt";
const depositRequestedField = (fund: TransferDepositFund) =>
  fund === "saving" ? "savingDepositRequestedAt" : "emergencyDepositRequestedAt";

function DashboardPage({
  state,
  month,
  setMonth,
  setPage,
  setAssetTab,
}: {
  state: AppState;
  month: string;
  setMonth: (month: string) => void;
  setPage: (page: Page) => void;
  setAssetTab: (tab: InvestmentTab) => void;
}) {
  const summary = monthlySummary(state, month);
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(() => preferredMoneyRowId(summary.incomeRows));
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(() => preferredMoneyRowId(summary.expenseRows));
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const dueSoon = state.bankDeposits
    .filter((item) => item.status === "active")
    .map((item) => ({ ...item, dueDays: daysUntil(item.maturityDate) }))
    .filter((item) => item.dueDays <= 3)
    .sort((a, b) => a.dueDays - b.dueDays)
    .slice(0, 3);

  useEffect(() => {
    setSelectedIncomeId((current) => {
      if (current && summary.incomeRows.some((row) => row.id === current)) return current;
      return preferredMoneyRowId(summary.incomeRows);
    });
    setSelectedExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return preferredMoneyRowId(summary.expenseRows);
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const selectedIncome = summary.incomeRows.find((row) => row.id === selectedIncomeId) ?? null;
  const selectedExpense = summary.expenseRows.find((row) => row.id === selectedExpenseId) ?? null;
  const openMoneyTrace = (entityType: "income" | "expense", item: { id: string; meta?: TransactionMeta }) => {
    setTraceEventIds([item.meta?.eventId ?? stableEventId(entityType, item.id)]);
  };

  return (
    <div className="page">
      <header className="page-header dashboard-page-header">
        <div>
          <p className="dashboard-month-title">Tháng {formatMonth(month)}</p>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="metrics-grid">
        <MetricCard label="Thu nhập" value={formatVnd(summary.income)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Chi tiêu" value={formatVnd(summary.expense)} icon={<ArrowDownCircle size={20} />} />
        <MetricCard label="Tiết kiệm tháng" value={formatVnd(summary.saving)} icon={<PiggyBank size={20} />} tone="highlight" />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-title">
            <h2>Thu nhập</h2>
            <strong>{formatVnd(summary.income)}</strong>
          </div>
          <BreakdownPie data={summary.incomeRows} />
          <DetailList rows={summary.incomeRows} selectedId={selectedIncomeId} onSelect={setSelectedIncomeId} />
          <CategoryHistoryPanel
            title={selectedIncome?.name ?? "Thu nhập"}
            rows={selectedIncome?.transactions ?? []}
            emptyText="Chưa có khoản thu nào trong tháng này."
            itemTone="income"
            onTrace={(item) => openMoneyTrace("income", item)}
          />
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>Chi tiêu</h2>
            <strong>{formatVnd(summary.expense)}</strong>
          </div>
          <BreakdownPie data={summary.expenseRows} />
          <DetailList rows={summary.expenseRows} selectedId={selectedExpenseId} onSelect={setSelectedExpenseId} />
          <CategoryHistoryPanel
            title={selectedExpense?.name ?? "Chi tiêu"}
            rows={selectedExpense?.transactions ?? []}
            emptyText="Chưa có khoản phát sinh nào trong tháng này."
            itemTone="expense"
            onTrace={(item) => openMoneyTrace("expense", item)}
          />
        </article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Tiền được chia</h2>
          <button className="ghost" onClick={() => setPage("dashboard")}>
            Chỉnh
          </button>
        </div>
        <div className="allocation-grid">
          <FundChip label="BTC" value={summary.allocationAmounts.btc} percent={summary.allocation.btcPercent} />
          <FundChip label="CK" value={summary.allocationAmounts.stock} percent={summary.allocation.stockPercent} />
          <FundChip label="Quỹ tiết kiệm" value={summary.allocationAmounts.saving} percent={summary.allocation.savingPercent} />
          <FundChip label="Dự phòng" value={summary.allocationAmounts.emergency} percent={summary.allocation.emergencyPercent} />
        </div>
      </section>

      <section className="stock-trade-section">
        <article className="panel">
          <div className="panel-title">
            <h2>Checklist</h2>
            <small>Tick mới tính vào chi tiêu</small>
          </div>
          <div className="check-list">
            {state.expenseCategories
              .filter((category) => category.kind === "fixed")
              .map((category) => {
                const record = getMonthlyExpense(state, category, month);
                return (
                  <div key={category.id} className={record?.checked ? "done" : ""}>
                    <CheckCircle2 size={18} />
                    <span>Chuyển {category.name}</span>
                    <strong>{formatVnd(record?.amount)}</strong>
                  </div>
                );
              })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Sắp đáo hạn</h2>
            <button className="ghost" onClick={() => {
              setAssetTab("mbb");
              setPage("investment");
            }}>
              Xem
            </button>
          </div>
          {dueSoon.length === 0 ? (
            <p className="muted">Chưa có sổ nào cần xử lý trong 3 ngày tới.</p>
          ) : (
            <div className="deposit-mini-list">
              {dueSoon.map((item) => (
                <div className={item.dueDays <= 7 ? "danger" : "warning"} key={item.id}>
                  <CalendarClock size={18} />
                  <span>{item.fund === "saving" ? "Quỹ tiết kiệm" : "Quỹ dự phòng"}</span>
                  <strong>{formatVnd(item.principal)}</strong>
                  <small>{item.dueDays <= 0 ? "Đã đáo hạn" : `${item.dueDays} ngày nữa`}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

type NewExpenseKind = Exclude<ExpenseCategory["kind"], "envelope">;

function UnifiedDashboardPage({
  state,
  setState,
  commitWithUndo,
  month,
  setMonth,
  setPage,
  setAssetTab,
  setInvestmentAction,
  onRefreshMarket,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  month: string;
  setMonth: (month: string) => void;
  setPage: (page: Page) => void;
  setAssetTab: (tab: InvestmentTab) => void;
  setInvestmentAction: (action: InvestmentActionIntent | null) => void;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
}) {
  const summary = monthlySummary(state, month);
  const previousSummary = monthlySummary(state, shiftMonth(month, -1));
  const metricTrend = (current: number, previous: number, favorable: "up" | "down") => {
    const change = monthlyChangePercent(current, previous);
    const tone: "success" | "danger" | "neutral" =
      Math.abs(change) < 0.05 ? "neutral" : favorable === "up" ? (change > 0 ? "success" : "danger") : change < 0 ? "success" : "danger";
    return {
      label: formatSignedCompactPercent(change),
      tone,
    };
  };
  const incomeSharePercent = (value: number) => (summary.income > 0 ? (value / summary.income) * 100 : 0);
  const incomeTrend = metricTrend(summary.income, previousSummary.income, "up");
  const expenseTrend = metricTrend(summary.expense, previousSummary.expense, "down");
  const savingTrend = metricTrend(summary.saving, previousSummary.saving, "up");
  const expenseIncomeShare = incomeSharePercent(summary.expense);
  const savingIncomeShare = incomeSharePercent(summary.saving);
  const preferredMoneyRowId = (rows: Array<{ id: string; value: number }>) =>
    [...rows].filter((row) => row.value > 0).sort((a, b) => b.value - a.value)[0]?.id ?? rows[0]?.id ?? null;
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(() => preferredMoneyRowId(summary.incomeRows));
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(() => preferredMoneyRowId(summary.expenseRows));
  const [entryModal, setEntryModal] = useState<"income" | "expense" | null>(null);
  const [showNewIncomeCategory, setShowNewIncomeCategory] = useState(false);
  const [showNewExpenseCategory, setShowNewExpenseCategory] = useState(false);
  const [allocationEditing, setAllocationEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moneyDetail, setMoneyDetail] = useState<"income" | "expense" | null>(null);
  const [allocationAmountInputs, setAllocationAmountInputs] = useState<Partial<Record<AllocationAmountKey, string>>>({});
  const [editingFixed, setEditingFixed] = useState<{ categoryId: string; amount: string } | null>(null);
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<
    | { kind: "income"; id: string; categoryId: string; amount: string; date: string; note: string }
    | { kind: "expense"; id: string; categoryId: string; amount: string; date: string; note: string }
    | null
  >(null);
  const [incomeForm, setIncomeForm] = useState({
    categoryId: state.incomeCategories.find((category) => category.id === "other-income")?.id ?? state.incomeCategories[0]?.id ?? "",
    amount: "",
    date: today(),
    note: "",
  });
  const [expenseEntry, setExpenseEntry] = useState({
    categoryId: state.expenseCategories.find((category) => category.id === "phat-sinh")?.id ?? state.expenseCategories[0]?.id ?? "",
    amount: "",
    date: today(),
    note: "",
  });
  const [newIncome, setNewIncome] = useState({ name: "", kind: "variable" as IncomeCategory["kind"] });
  const [newExpense, setNewExpense] = useState({ name: "", kind: "variable" as NewExpenseKind, amount: "" });
  const [depositForm, setDepositForm] = useState({ month });

  useEffect(() => {
    setDepositForm((prev) => (prev.month === month ? prev : { ...prev, month }));
    setAllocationAmountInputs({});
  }, [month]);

  useEffect(() => {
    setSelectedIncomeId((current) => {
      if (current && summary.incomeRows.some((row) => row.id === current)) return current;
      return preferredMoneyRowId(summary.incomeRows);
    });
    setSelectedExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return preferredMoneyRowId(summary.expenseRows);
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const selectedIncome = summary.incomeRows.find((row) => row.id === selectedIncomeId) ?? null;
  const selectedExpense = summary.expenseRows.find((row) => row.id === selectedExpenseId) ?? null;
  const fixedCategories = state.expenseCategories
    .filter((category) => isFixedCategoryVisibleInMonth(state, category, month))
    .sort((left, right) => {
      const leftIsAccumulation = Boolean(accumulationGoalForCategory(state, left.id));
      const rightIsAccumulation = Boolean(accumulationGoalForCategory(state, right.id));
      if (leftIsAccumulation !== rightIsAccumulation) return leftIsAccumulation ? 1 : -1;
      const leftAmount = getMonthlyExpense(state, left, month).amount;
      const rightAmount = getMonthlyExpense(state, right, month).amount;
      return rightAmount - leftAmount || left.name.localeCompare(right.name, "vi");
    });
  const expenseEntryCategories = state.expenseCategories.filter((category) => !accumulationGoalForCategory(state, category.id));
  const selectedFixedExpenseCategory = fixedCategories.find((category) => category.id === selectedExpense?.id) ?? null;
  const selectedFixedExpenseRecord = selectedFixedExpenseCategory ? getMonthlyExpense(state, selectedFixedExpenseCategory, month) : null;
  const openMoneyTrace = (entityType: "income" | "expense", item: { id: string; meta?: TransactionMeta }) => {
    setTraceEventIds([item.meta?.eventId ?? stableEventId(entityType, item.id)]);
  };
  const selectedFixedExpenseCanDelete = selectedFixedExpenseCategory ? !accumulationGoalForCategory(state, selectedFixedExpenseCategory.id) : false;
  const percentTotal =
    summary.allocation.btcPercent +
    summary.allocation.stockPercent +
    summary.allocation.savingPercent +
    summary.allocation.emergencyPercent;
  const percentTotalOk = Math.abs(percentTotal - 100) <= 0.01;
  const lockedAllocationFunds = new Set(summary.allocation.lockedFunds ?? []);
  const allocationAmountRows: Array<{ fund: AllocationFundKey; percentKey: AllocationPercentKey; amountKey: AllocationAmountKey; label: string; amount: number; locked: boolean }> = [
    { fund: "btc", percentKey: "btcPercent", amountKey: "btcAmount", label: "BTC", amount: summary.allocationAmounts.btc, locked: lockedAllocationFunds.has("btc") },
    { fund: "stock", percentKey: "stockPercent", amountKey: "stockAmount", label: "CK", amount: summary.allocationAmounts.stock, locked: lockedAllocationFunds.has("stock") },
    { fund: "saving", percentKey: "savingPercent", amountKey: "savingAmount", label: "Quỹ tiết kiệm", amount: summary.allocationAmounts.saving, locked: lockedAllocationFunds.has("saving") },
    { fund: "emergency", percentKey: "emergencyPercent", amountKey: "emergencyAmount", label: "Dự phòng", amount: summary.allocationAmounts.emergency, locked: lockedAllocationFunds.has("emergency") },
  ];
  const allocationAmountTotal = allocationAmountRows.reduce((sum, item) => sum + Math.round(item.amount), 0);
  const availableAllocationAmount = Math.round(Math.max(summary.saving, 0));
  const amountTotalMatchesSaving = Math.abs(allocationAmountTotal - availableAllocationAmount) <= 1;
  const hasCustomAllocationAmounts = allocationAmountRows.some((item) => typeof summary.allocation[item.amountKey] === "number");
  const monthAlreadyConfirmed = Boolean(summary.allocation.confirmedAt);
  const tasks = dashboardTasks(state, month);

  const suggestExpenseAmount = (categoryId: string) => {
    const category = state.expenseCategories.find((item) => item.id === categoryId);
    if (!category) return "";
    const record = getMonthlyExpense(state, category, month);
    const amount = category.kind === "fixed" ? record.amount || category.defaultAmount : category.defaultAmount;
    return amount > 0 ? amount.toLocaleString("vi-VN") : "";
  };

  const openIncomeEntry = () => {
    setIncomeForm((prev) => ({
      ...prev,
      categoryId: selectedIncomeId ?? prev.categoryId,
      date: today(),
    }));
    setEntryModal("income");
  };

  const openExpenseEntry = () => {
    const preferredCategoryId = selectedExpenseId ?? expenseEntry.categoryId;
    const categoryId = expenseEntryCategories.some((category) => category.id === preferredCategoryId)
      ? preferredCategoryId
      : expenseEntryCategories.find((category) => category.id === "phat-sinh")?.id ?? expenseEntryCategories[0]?.id ?? "";
    setExpenseEntry((prev) => ({
      ...prev,
      categoryId,
      date: today(),
      amount: suggestExpenseAmount(categoryId),
    }));
    setEntryModal("expense");
  };

  useEffect(() => {
    setSelectedIncomeId(preferredMoneyRowId(summary.incomeRows));
    setSelectedExpenseId(preferredMoneyRowId(summary.expenseRows));
  }, []);

  const openTask = (task: DashboardTask) => {
    if (task.id === "market-stale") {
      void onRefreshMarket();
      return;
    }
    if (task.id === "allocation") {
      setAllocationEditing(true);
      setPage("dashboard");
      return;
    }
    if (task.tab) setAssetTab(task.tab);
    if (task.tab && task.investmentAction) setInvestmentAction({ id: uid(), tab: task.tab, action: task.investmentAction, amountVnd: 0, targetFund: "saving" });
    if (task.page) setPage(task.page);
  };

  const taskPanel = (className = "") => (
    <article className={`panel dashboard-task-panel ${className}`}>
      <div className="panel-title">
        <h2>Hôm nay cần làm gì</h2>
        <small>{tasks.length} việc</small>
      </div>
      {tasks.length === 0 ? (
        <p className="muted">Không có việc cần xử lý ngay.</p>
      ) : (
        <div className="action-task-list">
          {tasks.map((task) => (
            <button className={task.tone ?? ""} key={task.id} onClick={() => openTask(task)} type="button">
              <div>
                <strong><span className={`status-badge task-badge ${task.tone ?? "neutral"}`}>{task.badge}</span>{task.title}</strong>
                <small>{task.detail}</small>
              </div>
              <span>{task.action}</span>
            </button>
          ))}
        </div>
      )}
    </article>
  );

  const openMoneyDetail = (kind: "income" | "expense", rowId: string) => {
    if (kind === "income" && rowId) setSelectedIncomeId(rowId);
    if (kind === "expense" && rowId) setSelectedExpenseId(rowId);
    setMoneyDetail(kind);
  };

  const updateMonthlyExpense = (category: ExpenseCategory, patch: Partial<MonthlyExpense>) => {
    commitWithUndo("Đã cập nhật chi cố định.", (prev) => {
      const existing = prev.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
      const next = existing ? { ...existing, ...patch } : { ...getMonthlyExpense(prev, category, month), ...patch };
      return {
        ...prev,
        monthlyExpenses: existing ? prev.monthlyExpenses.map((item) => (item.id === existing.id ? next : item)) : [...prev.monthlyExpenses, next],
      };
    }, { action: "update", entityType: "expense", entityId: category.id });
  };

  const updateAllocation = (patch: Partial<Allocation>) => {
    setState((prev) => {
      const existing = prev.allocations.find((item) => item.month === month);
      const next = { ...getAllocation(prev, month), ...patch };
      return {
        ...prev,
        allocations: existing ? prev.allocations.map((item) => (item.month === month ? next : item)) : [...prev.allocations, next],
      };
    });
  };

  const resetAllocationAmounts = () => {
    const lockedFunds = new Set(summary.allocation.lockedFunds ?? []);
    setAllocationAmountInputs((prev) => {
      const next = { ...prev };
      ALLOCATION_FUND_KEYS.forEach((fund) => {
        if (!lockedFunds.has(fund)) delete next[ALLOCATION_AMOUNT_KEYS[fund]];
      });
      return next;
    });
    updateAllocation(ALLOCATION_FUND_KEYS.reduce((patch, fund) => {
      if (!lockedFunds.has(fund)) patch[ALLOCATION_AMOUNT_KEYS[fund]] = undefined;
      return patch;
    }, {} as Partial<Record<AllocationAmountKey, undefined>>) as Partial<Allocation>);
  };

  const updateAllocationAmount = (key: AllocationAmountKey, value: string) => {
    const formattedValue = formatMoneyInput(value);
    setAllocationAmountInputs((prev) => ({ ...prev, [key]: formattedValue }));
    updateAllocation({ [key]: formattedValue ? parseMoney(formattedValue) : undefined } as Partial<Allocation>);
  };

  const commitAllocationAmount = (key: AllocationAmountKey) => {
    setAllocationAmountInputs((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      const value = next[key] ?? "";
      if (value.trim() === "") delete next[key];
      else next[key] = parseMoney(value).toLocaleString("vi-VN");
      return next;
    });
  };

  const toggleAllocationLock = (fund: AllocationFundKey) => {
    const allocation = summary.allocation;
    const amountKey = ALLOCATION_AMOUNT_KEYS[fund];
    const currentLocked = allocation.lockedFunds ?? [];
    const nextLocked = currentLocked.includes(fund)
      ? currentLocked.filter((item) => item !== fund)
      : [...currentLocked, fund];
    const isLocking = !currentLocked.includes(fund);
    const basePercents = currentLocked.length ? allocationBasePercents(allocation) : allocationPercents(allocation);
    const nextPercents = nextLocked.length ? redistributeAllocationPercents(basePercents, nextLocked) : basePercents;
    const patch: Partial<Allocation> = {
      ...allocationPercentPatch(nextPercents),
      ...(currentLocked.length ? {} : allocationBasePercentPatch(basePercents)),
      lockedFunds: nextLocked.length ? nextLocked : undefined,
    };
    const nextLockedSet = new Set(nextLocked);

    ALLOCATION_FUND_KEYS.forEach((item) => {
      if (!nextLockedSet.has(item)) patch[ALLOCATION_AMOUNT_KEYS[item]] = undefined;
    });

    if (isLocking) {
      patch[amountKey] = parseMoney(allocationAmountInputs[amountKey] ?? Math.round(summary.allocationAmounts[fund]).toLocaleString("vi-VN"));
    } else {
      patch[amountKey] = undefined;
      if (!nextLocked.length) Object.assign(patch, clearAllocationBasePercentPatch());
    }

    setAllocationAmountInputs((prev) => {
      const next = { ...prev };
      ALLOCATION_FUND_KEYS.forEach((item) => {
        if (!nextLockedSet.has(item)) delete next[ALLOCATION_AMOUNT_KEYS[item]];
      });
      return next;
    });
    updateAllocation(patch);
  };

  const addIncome = () => {
    const amount = parseMoney(incomeForm.amount);
    if (!amount || !incomeForm.categoryId || !incomeForm.date) return;
    commitWithUndo("Đã thêm thu nhập.", (prev) => ({
      ...prev,
      incomeTransactions: [...prev.incomeTransactions, { id: uid(), categoryId: incomeForm.categoryId, amount, date: incomeForm.date, month: monthFromDate(incomeForm.date), note: incomeForm.note }],
    }));
    setSelectedIncomeId(incomeForm.categoryId);
    setIncomeForm((prev) => ({ ...prev, amount: "", note: "" }));
    setEntryModal(null);
  };

  const addExpenseEntry = () => {
    const amount = parseMoney(expenseEntry.amount);
    if (!amount || !expenseEntry.categoryId || !expenseEntry.date) return;
    commitWithUndo("Đã thêm khoản chi.", (prev) => ({
      ...prev,
      expenseEntries: [...prev.expenseEntries, { id: uid(), categoryId: expenseEntry.categoryId, amount, date: expenseEntry.date, month: monthFromDate(expenseEntry.date), note: expenseEntry.note }],
    }));
    setSelectedExpenseId(expenseEntry.categoryId);
    setExpenseEntry((prev) => ({ ...prev, amount: "", note: "" }));
    setEntryModal(null);
  };

  const addIncomeCategory = () => {
    if (!newIncome.name.trim()) return;
    const category = { id: uid(), name: newIncome.name.trim(), kind: newIncome.kind };
    setState((prev) => ({ ...prev, incomeCategories: [...prev.incomeCategories, category] }));
    setIncomeForm((prev) => ({ ...prev, categoryId: category.id }));
    setNewIncome({ name: "", kind: "variable" });
    setShowNewIncomeCategory(false);
  };

  const addExpenseCategory = () => {
    if (!newExpense.name.trim()) return;
    const category: ExpenseCategory = { id: uid(), name: newExpense.name.trim(), kind: newExpense.kind, defaultAmount: newExpense.kind === "fixed" ? parseMoney(newExpense.amount) : 0, accumulationGoalId: "" };
    setState((prev) => ({ ...prev, expenseCategories: [...prev.expenseCategories, category] }));
    setExpenseEntry((prev) => ({ ...prev, categoryId: category.id }));
    setSelectedExpenseId(category.id);
    setNewExpense({ name: "", kind: "variable", amount: "" });
    setShowNewExpenseCategory(false);
  };

  const openIncomeEdit = (transaction: IncomeTransaction) => {
    setEditingTransaction({ kind: "income", id: transaction.id, categoryId: transaction.categoryId, amount: transaction.amount.toLocaleString("vi-VN"), date: transaction.date, note: transaction.note });
  };

  const openExpenseEdit = (transaction: ExpenseEntry) => {
    setEditingTransaction({ kind: "expense", id: transaction.id, categoryId: transaction.categoryId, amount: transaction.amount.toLocaleString("vi-VN"), date: transaction.date, note: transaction.note });
  };

  const saveEditingTransaction = () => {
    if (!editingTransaction) return;
    const amount = parseMoney(editingTransaction.amount);
    if (!amount || !editingTransaction.date) return;
    commitWithUndo("Đã lưu điều chỉnh giao dịch.", (prev) => {
      if (editingTransaction.kind === "income") {
        return {
          ...prev,
          incomeTransactions: prev.incomeTransactions.map((item) => item.id === editingTransaction.id ? { ...item, categoryId: editingTransaction.categoryId, amount, date: editingTransaction.date, month: monthFromDate(editingTransaction.date), note: editingTransaction.note } : item),
        };
      }
      return {
        ...prev,
        expenseEntries: prev.expenseEntries.map((item) => item.id === editingTransaction.id ? { ...item, categoryId: editingTransaction.categoryId, amount, date: editingTransaction.date, month: monthFromDate(editingTransaction.date), note: editingTransaction.note } : item),
      };
    });
    setEditingTransaction(null);
  };

  const deleteIncomeTransaction = (transaction: { id: string }) => {
    if (!window.confirm("Xóa khoản thu này?")) return;
    commitWithUndo("Đã xóa khoản thu.", (prev) => {
      const item = prev.incomeTransactions.find((row) => row.id === transaction.id);
      if (!item) return prev;
      return withTrashItem(
        { ...prev, incomeTransactions: prev.incomeTransactions.filter((row) => row.id !== transaction.id) },
        makeTrashItem("income", item.id, `khoản thu ${formatVnd(item.amount)}`, item)
      );
    }, { action: "delete", entityType: "income", entityId: transaction.id });
  };

  const deleteIncomeCategory = (category: IncomeCategory) => {
    if (category.id === MBB_SETTLEMENT_INCOME_CATEGORY_ID) return;
    if (!window.confirm(`Xóa mục ${category.name}?`)) return;
    commitWithUndo("Đã xóa mục thu.", (prev) => {
      const relatedPayloads = {
        incomeTransactions: prev.incomeTransactions.filter((item) => item.categoryId === category.id),
      };
      return withTrashItem(
        {
          ...prev,
          incomeCategories: prev.incomeCategories.filter((item) => item.id !== category.id),
          incomeTransactions: prev.incomeTransactions.filter((item) => item.categoryId !== category.id),
        },
        makeTrashItem("income-category", category.id, `mục thu ${category.name}`, category, relatedPayloads)
      );
    }, { action: "delete", entityType: "income-category", entityId: category.id });
    const nextCategoryId = state.incomeCategories.find((item) => item.id !== category.id)?.id ?? "";
    setIncomeForm((prev) => ({ ...prev, categoryId: nextCategoryId }));
    if (selectedIncomeId === category.id) setSelectedIncomeId(nextCategoryId || null);
  };

  const deleteExpenseTransaction = (transaction: { id: string }) => {
    if (!window.confirm("Xóa khoản chi này?")) return;
    commitWithUndo("Đã xóa khoản chi.", (prev) => {
      const item = prev.expenseEntries.find((row) => row.id === transaction.id);
      if (!item) return prev;
      return withTrashItem(
        { ...prev, expenseEntries: prev.expenseEntries.filter((row) => row.id !== transaction.id) },
        makeTrashItem("expense", item.id, `khoản chi ${formatVnd(item.amount)}`, item)
      );
    }, { action: "delete", entityType: "expense", entityId: transaction.id });
  };

  const deleteExpenseCategory = (category: ExpenseCategory) => {
    if (!window.confirm(`Xóa mục ${category.name}?`)) return;
    commitWithUndo("Đã xóa mục chi.", (prev) => {
      const relatedPayloads = {
        monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId === category.id),
        expenseEntries: prev.expenseEntries.filter((item) => item.categoryId === category.id),
      };
      return withTrashItem(
        {
          ...prev,
          expenseCategories: prev.expenseCategories.filter((item) => item.id !== category.id),
          monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId !== category.id),
          expenseEntries: prev.expenseEntries.filter((item) => item.categoryId !== category.id),
        },
        makeTrashItem("expense-category", category.id, `mục chi ${category.name}`, category, relatedPayloads)
      );
    }, { action: "delete", entityType: "expense-category", entityId: category.id });
    if (selectedExpenseId === category.id) setSelectedExpenseId(null);
  };

  const deleteSelectedExpenseEntryCategory = () => {
    const category = expenseEntryCategories.find((item) => item.id === expenseEntry.categoryId);
    if (!category) return;
    deleteExpenseCategory(category);
    const nextCategoryId = expenseEntryCategories.find((item) => item.id !== category.id)?.id ?? "";
    setExpenseEntry((prev) => ({ ...prev, categoryId: nextCategoryId, amount: suggestExpenseAmount(nextCategoryId) }));
  };

  const saveFixedAmount = () => {
    if (!editingFixed) return;
    const category = state.expenseCategories.find((item) => item.id === editingFixed?.categoryId);
    if (!category) return;
    const amount = parseMoney(editingFixed?.amount);
    const goal = accumulationGoalForCategory(state, category.id);
    if (goal) {
      setState((prev) => {
        const currentGoal = accumulationGoalForCategory(prev, category.id);
        if (!currentGoal) return prev;
        const existing = prev.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
        const edited = existing ? { ...existing, amount } : { ...getMonthlyExpense(prev, category, month), amount };
        const withoutFutureUnpaid = prev.monthlyExpenses.filter((item) => item.categoryId !== category.id || item.checked || item.id === edited?.id);
        const withEdited = {
          ...prev,
          monthlyExpenses: withoutFutureUnpaid?.some((item) => item.id === edited?.id)
            ? withoutFutureUnpaid?.map((item) => (item.id === edited?.id ? edited : item))
            : [...withoutFutureUnpaid, edited],
        };
        const preservedUnpaid = edited?.checked ? [] : [edited];
        const checked = withEdited?.monthlyExpenses.filter((item) => item.categoryId === category.id && item.checked);
        const checkedTotal = checked?.reduce((sum, item) => sum + item.amount, 0);
        const preservedTotal = preservedUnpaid?.reduce((sum, item) => sum + item.amount, 0);
        const remainingMonths = Math.max(currentGoal.months - checked?.length - preservedUnpaid?.length, 0);
        const remainingAmount = Math.max(currentGoal.targetAmount - checkedTotal - preservedTotal, 0);
        const nextMonthlyAmount = remainingMonths > 0 && remainingAmount > 0 ? Math.ceil(remainingAmount / remainingMonths) : currentGoal.monthlyAmount;
        const nextGoal = { ...currentGoal, monthlyAmount: nextMonthlyAmount, updatedAt: new Date().toISOString() };
        const withGoal = {
          ...withEdited,
          accumulationGoals: withEdited?.accumulationGoals.map((item) => (item.id === nextGoal.id ? nextGoal : item)),
          expenseCategories: withEdited?.expenseCategories.map((item) =>
            item.id === category.id ? { ...item, defaultAmount: nextMonthlyAmount } : item
          ),
        };
        return {
          ...withGoal,
          monthlyExpenses: rescheduleAccumulationGoal(withGoal, nextGoal, preservedUnpaid),
        };
      });
    } else {
      updateMonthlyExpense(category, { amount });
    }
    setEditingFixed(null);
  };

  const confirmAllocation = () => {
    const existingAllocation = state.allocations.find((item) => item.month === month);
    if (existingAllocation?.confirmedAt || !percentTotalOk || !amountTotalMatchesSaving || summary.saving <= 0) return;
    const confirmedAllocation: Allocation = {
      ...summary.allocation,
      confirmedAt: new Date().toISOString(),
      btcAmount: Math.round(summary.allocationAmounts.btc),
      stockAmount: Math.round(summary.allocationAmounts.stock),
      savingAmount: Math.round(summary.allocationAmounts.saving),
      emergencyAmount: Math.round(summary.allocationAmounts.emergency),
      totalSavingAtConfirm: Math.round(summary.saving),
    };
    if ((confirmedAllocation.savingAmount ?? 0) > 0) confirmedAllocation.savingDepositRequestedAt = confirmedAllocation.confirmedAt;
    if ((confirmedAllocation.emergencyAmount ?? 0) > 0) confirmedAllocation.emergencyDepositRequestedAt = confirmedAllocation.confirmedAt;
    commitWithUndo("Đã chia quỹ.", (prev) => ({
      ...prev,
      allocations: prev.allocations.some((item) => item.month === month) ? prev.allocations.map((item) => (item.month === month ? confirmedAllocation : item)) : [...prev.allocations, confirmedAllocation],
      fundTransactions: [
        ...prev.fundTransactions,
        { id: uid(), fund: "btc", type: "deposit", amount: confirmedAllocation.btcAmount ?? 0, date: `${depositForm.month}-01`, month, note: "Chia quỹ cuối tháng" },
        { id: uid(), fund: "stock", type: "deposit", amount: confirmedAllocation.stockAmount ?? 0, date: `${depositForm.month}-01`, month, note: "Chia quỹ cuối tháng" },
      ],
    }));
    setConfirmOpen(false);
  };

  return (
    <div className="page">
      <header className="page-header dashboard-page-header">
        <div>
          <p className="dashboard-month-title">Tháng {formatMonth(month)}</p>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="metrics-grid dashboard-metrics-grid">
        <MetricCard label="Thu nhập" value={formatVnd(summary.income)} trend={incomeTrend} icon={<BadgeDollarSign size={20} />} />
        <MetricCard
          label="Chi tiêu"
          value={formatVnd(summary.expense)}
          trend={expenseTrend}
          progress={{
            percent: clampPercent(expenseIncomeShare),
            label: formatCompactPercent(expenseIncomeShare),
            ariaLabel: `Chi tiêu bằng ${formatCompactPercent(expenseIncomeShare)} thu nhập`,
          }}
          icon={<ArrowDownCircle size={20} />}
        />
        <MetricCard
          label="Tiết kiệm"
          value={formatVnd(summary.saving)}
          trend={savingTrend}
          progress={{
            percent: clampPercent(savingIncomeShare),
            label: formatCompactPercent(savingIncomeShare),
            ariaLabel: `Tiết kiệm bằng ${formatCompactPercent(savingIncomeShare)} thu nhập`,
          }}
          icon={<PiggyBank size={20} />}
          tone="highlight"
        />
      </section>

      {taskPanel("dashboard-task-mobile")}

      <section className="dashboard-money-grid">
        <DashboardMoneyCard
          title="Thu nhập"
          tone="income"
          total={summary.income}
          rows={summary.incomeRows}
          selectedId={selectedIncomeId}
          onAdd={openIncomeEntry}
          onDetail={() => openMoneyDetail("income", selectedIncomeId ?? summary.incomeRows[0]?.id ?? "")}
          onSelect={(id) => openMoneyDetail("income", id)}
        />
        <DashboardMoneyCard
          title="Chi tiêu"
          tone="expense"
          total={summary.expense}
          rows={summary.expenseRows}
          selectedId={selectedExpenseId}
          onAdd={openExpenseEntry}
          onDetail={() => openMoneyDetail("expense", selectedExpenseId ?? summary.expenseRows[0]?.id ?? "")}
          onSelect={(id) => openMoneyDetail("expense", id)}
        />
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Tiền được chia</h2>
          <div className="panel-title-actions">
            <button className="icon-button" title="Chia lại theo tỉ lệ %" onClick={resetAllocationAmounts} disabled={monthAlreadyConfirmed}>
              <RefreshCw size={17} />
            </button>
            <button className="icon-button" title="Chỉnh chia quỹ" onClick={() => setAllocationEditing((current) => !current)}>
              <Pencil size={17} />
            </button>
          </div>
        </div>
        <div className="allocation-grid">
          <FundChip label="BTC" value={summary.allocationAmounts.btc} percent={summary.allocation.btcPercent} />
          <FundChip label="CK" value={summary.allocationAmounts.stock} percent={summary.allocation.stockPercent} />
          <FundChip label="Quỹ tiết kiệm" value={summary.allocationAmounts.saving} percent={summary.allocation.savingPercent} />
          <FundChip label="Dự phòng" value={summary.allocationAmounts.emergency} percent={summary.allocation.emergencyPercent} />
        </div>
        {allocationEditing && (
          <div className="allocation-inline">
            <div className="panel-title compact-title">
              <h3>Chỉnh chia quỹ</h3>
              <div className="allocation-title-meta">
                <small className={percentTotalOk ? "ok" : "bad"}>Tỉ lệ: {formatCompactPercent(percentTotal)}</small>
                <small className={amountTotalMatchesSaving ? "ok" : "bad"}>Tổng tiền: {formatVnd(allocationAmountTotal)} / {formatVnd(availableAllocationAmount)}</small>
              </div>
            </div>
            <div className="allocation-editor">
              {allocationAmountRows.map((item) => (
                <div className={item.locked ? "allocation-field locked" : "allocation-field"} key={item.percentKey}>
                  <span>{item.label}</span>
                  <input type="number" min="0" max="100" value={summary.allocation[item.percentKey]} onChange={(event) => updateAllocation({ [item.percentKey]: Number(event.target.value) } as Partial<Allocation>)} aria-label={`${item.label} tỉ lệ phần trăm`} placeholder="%" disabled={item.locked} />
                  <div className="allocation-amount-lock">
                    <input className="amount-input" inputMode="numeric" value={allocationAmountInputs[item.amountKey] ?? Math.round(item.amount).toLocaleString("vi-VN")} onChange={(event) => updateAllocationAmount(item.amountKey, formatMoneyChange(event))} onBlur={() => commitAllocationAmount(item.amountKey)} aria-label={`${item.label} số tiền`} placeholder="Số tiền" disabled={item.locked || monthAlreadyConfirmed} />
                    <button className={item.locked ? "allocation-lock-button active" : "allocation-lock-button"} type="button" title={item.locked ? `Mở khóa ${item.label}` : `Khóa số tiền ${item.label}`} onClick={() => toggleAllocationLock(item.fund)} disabled={monthAlreadyConfirmed}>
                      {item.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="deposit-confirm allocation-confirm-row">
              <label>
                Tháng chia quỹ
                <input type="month" value={depositForm.month} onChange={(event) => setDepositForm({ ...depositForm, month: event.target.value })} />
              </label>
              <button className="primary" onClick={() => setConfirmOpen(true)} disabled={!percentTotalOk || !amountTotalMatchesSaving || summary.saving <= 0 || monthAlreadyConfirmed}>
                <CheckCircle2 size={17} /> Chia quỹ
              </button>
              {monthAlreadyConfirmed && <small className="ok">Tháng này đã xác nhận chia quỹ.</small>}
            </div>
          </div>
        )}
      </section>

      <section className="two-column compact dashboard-lower-grid">
        <article className="panel">
          <div className="panel-title">
            <h2>Khoản cố định</h2>
          </div>
          <div className="check-list">
            {fixedCategories.map((category) => {
              const record = getMonthlyExpense(state, category, month);
              const accumulationGoal = accumulationGoalForCategory(state, category.id);
              return (
                <div key={category.id} className={record?.checked ? "done fixed-check-row" : "fixed-check-row"}>
                  <button className={record?.checked ? "check-icon checked" : "check-icon"} title={record?.checked ? "Bỏ tick khoản cố định" : "Tick khoản cố định"} onClick={() => updateMonthlyExpense(category, { checked: !record?.checked })} type="button">
                    {record?.checked && <Check size={16} />}
                  </button>
                  <span className="fixed-check-name">{category.name}</span>
                  <div className="fixed-check-right">
                    <strong>{formatVnd(record?.amount)}</strong>
                    <div className="fixed-check-actions">
                      <button className="row-icon-button" title="Sửa số tiền tháng này" onClick={() => setEditingFixed({ categoryId: category.id, amount: record?.amount.toLocaleString("vi-VN") })} type="button">
                        <Pencil size={15} />
                      </button>
                      {!accumulationGoal ? (
                        <button className="row-icon-button danger-text" title="Xóa mục" onClick={() => deleteExpenseCategory(category)} type="button">
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span className="row-icon-placeholder" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        {taskPanel("dashboard-task-desktop")}
      </section>

      {moneyDetail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="money-detail-title">
          <section className={`modal-card dashboard-money-modal ${moneyDetail}`}>
            <div className="panel-title">
              <h2 id="money-detail-title">{moneyDetail === "income" ? "Chi tiết thu nhập" : "Chi tiết chi tiêu"}</h2>
              <button className="icon-button" title="Đóng" onClick={() => setMoneyDetail(null)}><X size={17} /></button>
            </div>
            <div className="dashboard-money-modal-grid">
              <DetailList
                rows={moneyDetail === "income" ? summary.incomeRows : summary.expenseRows}
                selectedId={moneyDetail === "income" ? selectedIncomeId : selectedExpenseId}
                onSelect={moneyDetail === "income" ? setSelectedIncomeId : setSelectedExpenseId}
              />
              <CategoryHistoryPanel
                title={moneyDetail === "income" ? selectedIncome?.name ?? "Thu nhập" : selectedExpense?.name ?? "Chi tiêu"}
                rows={moneyDetail === "income" ? selectedIncome?.transactions ?? [] : selectedExpense?.transactions ?? []}
                emptyText={moneyDetail === "income" ? "Chưa có khoản thu nào trong tháng này." : "Chưa có khoản phát sinh nào trong tháng này."}
                itemTone={moneyDetail}
                onEdit={(item) => moneyDetail === "income" ? openIncomeEdit(item as IncomeTransaction) : openExpenseEdit(item as ExpenseEntry)}
                onDelete={(item) => moneyDetail === "income" ? deleteIncomeTransaction(item) : deleteExpenseTransaction(item)}
                onTrace={(item) => openMoneyTrace(moneyDetail, item)}
                fixedItem={
                  moneyDetail === "expense" && selectedFixedExpenseCategory && selectedFixedExpenseRecord?.checked
                    ? {
                        amount: selectedFixedExpenseRecord?.amount,
                        note: "Khoản cố định",
                        dateLabel: formatMonth(month),
                        canDelete: selectedFixedExpenseCanDelete,
                        onEdit: () => setEditingFixed({ categoryId: selectedFixedExpenseCategory.id, amount: selectedFixedExpenseRecord?.amount.toLocaleString("vi-VN") ?? "" }),
                        onDelete: () => deleteExpenseCategory(selectedFixedExpenseCategory),
                        onTrace: () => selectedFixedExpenseRecord && setTraceEventIds([selectedFixedExpenseRecord.meta?.eventId ?? stableEventId("monthly-expense", selectedFixedExpenseRecord.id)]),
                      }
                    : undefined
                }
              />
            </div>
          </section>
        </div>
      )}

      {entryModal === "income" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="income-modal-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="income-modal-title">Thêm thu nhập</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEntryModal(null)}><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label>Mục thu<select value={incomeForm.categoryId} onChange={(event) => setIncomeForm({ ...incomeForm, categoryId: event.target.value })}>{state.incomeCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={incomeForm.amount} onChange={(event) => setIncomeForm({ ...incomeForm, amount: formatMoneyChange(event) })} placeholder="9.000.000" /></label>
              <label>Ngày<input type="date" value={incomeForm.date} onChange={(event) => setIncomeForm({ ...incomeForm, date: event.target.value })} /></label>
              <label>Ghi chú<input value={incomeForm.note} onChange={(event) => setIncomeForm({ ...incomeForm, note: event.target.value })} placeholder="Fishing, job..." /></label>
            </div>
            <button className="primary full" onClick={addIncome}><Plus size={17} /> Thêm thu nhập</button>
            {!showNewIncomeCategory ? (
              <div className="modal-category-actions">
                <button className="ghost" onClick={() => setShowNewIncomeCategory(true)}><Plus size={17} /> Thêm mục mới</button>
                <button className="ghost danger-action" onClick={() => {
                  const category = state.incomeCategories.find((item) => item.id === incomeForm.categoryId);
                  if (category) deleteIncomeCategory(category);
                }} disabled={!incomeForm.categoryId || incomeForm.categoryId === MBB_SETTLEMENT_INCOME_CATEGORY_ID}><Trash2 size={17} /> Xóa mục</button>
              </div>
            ) : (
              <div className="inline-add modal-inline-add">
                <input value={newIncome.name} onChange={(event) => setNewIncome({ ...newIncome, name: event.target.value })} placeholder="Mục thu nhập mới" />
                <select value={newIncome.kind} onChange={(event) => setNewIncome({ ...newIncome, kind: event.target.value as IncomeCategory["kind"] })}><option value="variable">Phát sinh</option><option value="fixed">Cố định</option></select>
                <button onClick={addIncomeCategory} title="Thêm mục"><Plus size={17} /></button>
              </div>
            )}
          </section>
        </div>
      )}

      {entryModal === "expense" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="expense-modal-title">Thêm khoản chi</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEntryModal(null)}><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label>Mục chi<select value={expenseEntry.categoryId} onChange={(event) => {
                const categoryId = event.target.value;
                setExpenseEntry({ ...expenseEntry, categoryId, amount: suggestExpenseAmount(categoryId) });
              }}>{expenseEntryCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={expenseEntry.amount} onChange={(event) => setExpenseEntry({ ...expenseEntry, amount: formatMoneyChange(event) })} placeholder="500.000" /></label>
              <label>Ngày<input type="date" value={expenseEntry.date} onChange={(event) => setExpenseEntry({ ...expenseEntry, date: event.target.value })} /></label>
              <label>Ghi chú<input value={expenseEntry.note} onChange={(event) => setExpenseEntry({ ...expenseEntry, note: event.target.value })} placeholder="Sửa xe, mua được..." /></label>
            </div>
            <button className="primary full" onClick={addExpenseEntry}><Plus size={17} /> Thêm khoản chi</button>
            {!showNewExpenseCategory ? (
              <div className="modal-category-actions">
                <button className="ghost" onClick={() => setShowNewExpenseCategory(true)}><Plus size={17} /> Thêm mục mới</button>
                <button className="ghost danger-action" onClick={deleteSelectedExpenseEntryCategory} disabled={!expenseEntry.categoryId}><Trash2 size={17} /> Xóa mục</button>
              </div>
            ) : (
              <div className="inline-add modal-inline-add">
                <input value={newExpense.name} onChange={(event) => setNewExpense({ ...newExpense, name: event.target.value })} placeholder="Mục chi mới" />
                {newExpense.kind === "fixed" && <input value={newExpense.amount} onChange={(event) => setNewExpense({ ...newExpense, amount: formatMoneyChange(event) })} placeholder="Số tiền mặc định" />}
                <select value={newExpense.kind} onChange={(event) => setNewExpense({ ...newExpense, kind: event.target.value as NewExpenseKind })}><option value="variable">Phát sinh</option><option value="fixed">Cố định</option></select>
                <button onClick={addExpenseCategory} title="Thêm mục"><Plus size={17} /></button>
              </div>
            )}
          </section>
        </div>
      )}

      {editingFixed && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="fixed-edit-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="fixed-edit-title">Sửa khoản cố định</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEditingFixed(null)}><X size={17} /></button>
            </div>
            <label>Số tiền tháng này<input value={editingFixed?.amount} onChange={(event) => setEditingFixed({ ...editingFixed, amount: formatMoneyChange(event) })} /></label>
            <div className="modal-actions fixed-edit-actions">
              <button className="ghost icon-only" onClick={() => setEditingFixed(null)} title="Hủy" aria-label="Hủy"><X size={17} /></button>
              <button className="primary" onClick={saveFixedAmount}><Save size={17} /> Lưu</button>
            </div>
          </section>
        </div>
      )}

      {editingTransaction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="edit-transaction-title">Điều chỉnh {editingTransaction.kind === "income" ? "thu nhập" : "chi tiêu"}</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEditingTransaction(null)}><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label>Mục<select value={editingTransaction.categoryId} onChange={(event) => setEditingTransaction({ ...editingTransaction, categoryId: event.target.value })}>{(editingTransaction.kind === "income" ? state.incomeCategories : state.expenseCategories).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={editingTransaction.amount} onChange={(event) => setEditingTransaction({ ...editingTransaction, amount: formatMoneyChange(event) })} /></label>
              <label>Ngày<input type="date" value={editingTransaction.date} onChange={(event) => setEditingTransaction({ ...editingTransaction, date: event.target.value })} /></label>
              <label>Ghi chú<input value={editingTransaction.note} onChange={(event) => setEditingTransaction({ ...editingTransaction, note: event.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="ghost icon-only" onClick={() => setEditingTransaction(null)} title="Hủy" aria-label="Hủy"><X size={17} /></button>
              <button className="primary" onClick={saveEditingTransaction}><Save size={17} /> Lưu điều chỉnh</button>
            </div>
          </section>
        </div>
      )}

      {confirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="allocation-confirm-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="allocation-confirm-title">Xác nhận chia quỹ</h2>
              <small>Tháng {formatMonth(month)}</small>
            </div>

            {!hasCustomAllocationAmounts && (summary.allocationAmounts.savingRemainder > 0 || summary.allocationAmounts.emergencyRemainder > 0) && <p className="muted"></p>}
            <div className="confirm-summary">
              <div><span>BTC</span><strong>{formatVnd(summary.allocationAmounts.btc)}</strong></div>
              <div><span>CK</span><strong>{formatVnd(summary.allocationAmounts.stock)}</strong></div>
              <div><span>Quỹ tiết kiệm</span><strong>{formatVnd(summary.allocationAmounts.saving)}</strong></div>
              <div><span>dự phòng</span><strong>{formatVnd(summary.allocationAmounts.emergency)}</strong></div>
            </div>
            <div className="modal-actions">
              <button className="ghost icon-only" onClick={() => setConfirmOpen(false)} title="Hủy" aria-label="Hủy"><X size={17} /></button>
              <button className="primary" onClick={confirmAllocation} disabled={percentTotal !== 100 || !amountTotalMatchesSaving || summary.saving <= 0 || monthAlreadyConfirmed}><CheckCircle2 size={17} /> Đồng ý chia quỹ</button>
            </div>
          </section>
        </div>
      )}
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền Dashboard"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </div>
  );
}

function DashboardMoneyCard({
  title,
  tone,
  total,
  rows,
  selectedId,
  onAdd,
  onDetail,
  onSelect,
}: {
  title: string;
  tone: "income" | "expense";
  total: number;
  rows: Array<{ id: string; name: string; value: number; transactions: Array<{ id: string }> }>;
  selectedId: string | null;
  onAdd: () => void;
  onDetail: () => void;
  onSelect: (id: string) => void;
}) {
  const activeRows = rows.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);

  return (
    <article className={`panel dashboard-money-card ${tone}`}>
      <div className="panel-title dashboard-money-card-title">
        <div>
          <h2>{title}</h2>
        </div>
        <div className="dashboard-money-actions">
          <button className="ghost action-button-sm" onClick={onDetail} type="button">Chi tiết</button>
          <button className="icon-button" title={`Thêm ${title.toLowerCase()}`} onClick={onAdd} type="button">
            <Plus size={18} />
          </button>
        </div>
      </div>
      {activeRows.length === 0 ? (
        <p className="muted dashboard-money-empty">Chưa có dữ liệu trong tháng này.</p>
      ) : (
        <div className="dashboard-money-list">
          {activeRows.map((item, index) => {
            const share = total ? Math.min((item.value / total) * 100, 100) : 0;
            return (
              <div
                className={selectedId === item.id ? "selected" : ""}
                key={item.id}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                role="button"
                style={{ "--dot": COLORS[index % COLORS.length] } as React.CSSProperties}
                tabIndex={0}
              >
                <span>{item.name}</span>
                <strong>{formatVnd(item.value)}</strong>
                <small>{share.toFixed(1)}%</small>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function DetailList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Array<{ id: string; name: string; value: number; transactions: Array<{ id: string }> }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="detail-list">
      {rows
        .filter((item) => item.value > 0)
        .map((item, index) => {
          const percent = total ? (item.value / total) * 100 : 0;
          return (
            <div className={selectedId === item.id ? "selected detail-row" : "detail-row"} key={item.id}>
              <button className="detail-row-main" onClick={() => onSelect(item.id)} type="button">
                <span style={{ "--dot": COLORS[index % COLORS.length] } as React.CSSProperties}>{item.name}</span>
                <strong>{formatVnd(item.value)}</strong>
                <small>{percent.toFixed(1)}%</small>
              </button>
            </div>
          );
        })}
    </div>
  );
}

function CategoryHistoryPanel({
  title,
  rows,
  emptyText,
  itemTone,
  onEdit,
  onDelete,
  onTrace,
  fixedItem,
}: {
  title: string;
  rows: Array<{ id: string; categoryId: string; amount: number; date: string; note: string; meta?: TransactionMeta }>;
  emptyText: string;
  itemTone: "income" | "expense";
  onEdit?: (item: { id: string; categoryId: string; amount: number; date: string; note: string; meta?: TransactionMeta }) => void;
  onDelete?: (item: { id: string; categoryId: string; amount: number; date: string; note: string; meta?: TransactionMeta }) => void;
  onTrace?: (item: { id: string; categoryId: string; amount: number; date: string; note: string; meta?: TransactionMeta }) => void;
  fixedItem?: { amount: number; dateLabel: string; note: string; canDelete: boolean; onEdit: () => void; onDelete: () => void; onTrace?: () => void };
}) {
  const totalRows = rows.length + (fixedItem ? 1 : 0);
  return (
    <div className="category-history">
      <div className="panel-title compact-title">
        <h3>{title}</h3>
        <small>{totalRows} giao dịch</small>
      </div>
      {totalRows === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <div className="timeline history-timeline">
          {fixedItem && (
            <div className={itemTone}>
              <span className={itemTone}>{itemTone === "income" ? "+" : "-"}</span>
              <div className="history-row-body">
                <div>
                  <strong>{formatVnd(fixedItem.amount)}</strong>
                  <small>{fixedItem.dateLabel} · {fixedItem.note}</small>
                </div>
                <button className="row-icon-button history-edit-button" onClick={fixedItem.onEdit} title="Sửa khoản cố định" type="button">
                  <Pencil size={15} />
                </button>
                {fixedItem.canDelete && (
                  <button className="row-icon-button history-delete-button danger-text" onClick={fixedItem.onDelete} title="Xóa mục" type="button">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
          {rows.map((item) => (
            <div key={item.id} className={itemTone}>
              <span className={itemTone}>{itemTone === "income" ? "+" : "-"}</span>
              <div className="history-row-body">
                <div>
                  <strong>{formatVnd(item.amount)}</strong>
                  <small>
                    {formatDate(item.date)} · {item.note || "Không ghi chú"}
                  </small>
                </div>
                {onEdit && (
                  <button className="row-icon-button history-edit-button" onClick={() => onEdit(item)} title="Sửa giao dịch" type="button">
                    <Pencil size={15} />
                  </button>
                )}
                {onDelete && (
                  <button className="row-icon-button history-delete-button danger-text" onClick={() => onDelete(item)} title="Xóa giao dịch" type="button">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FundChip({
  label,
  value,
  percent,
  tone,
  onClick,
  onOpen,
}: {
  label: string;
  value: number;
  percent: number;
  tone?: string;
  onClick?: () => void;
  onOpen?: () => void;
}) {
  return (
    <div
      className={`fund-chip ${tone ?? ""} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="fund-chip-copy">
        <small>
          {label} <b>{percent}%</b>
        </small>
        <strong>{formatVnd(value)}</strong>
      </div>
      {onOpen && (
        <button
          className="fund-chip-open"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          type="button"
          title={`Mở trang ${label}`}
          aria-label={`Mở trang ${label}`}
        >
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

function AccumulationPage({
  state,
  setState,
  commitWithUndo,
  onOpenMbbDeposits,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  onOpenMbbDeposits: (accumulationGoalId: string) => void;
}) {
  const emptyForm = () => ({
    name: "",
    target: "",
    startMonth: currentMonth(),
    dueDate: "",
    months: "",
    monthlyAmount: "",
  });
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [planBasis, setPlanBasis] = useState<"months" | "monthlyAmount">("months");
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const editingGoal = editingId ? state.accumulationGoals.find((goal) => goal.id === editingId) ?? null : null;

  useEffect(() => {
    setState((prev) => {
      let next = prev;
      let changed = false;

      prev.accumulationGoals
        .filter((goal) => goal.status === "active")
        .forEach((goal) => {
          const paidMonths = accumulationPaidMonths(next, goal);
          const remainingMonths = Math.max(goal.months - paidMonths, 0);
          const unpaid = next.monthlyExpenses.filter((item) => item.categoryId === goal.categoryId && !item.checked);
          if (unpaid?.length <= remainingMonths) return;

          const progress = accumulationProgress(next, goal);
          const remainingAmount = Math.max(goal.targetAmount - progress, 0);
          const monthlyAmount = remainingMonths > 0 && remainingAmount > 0 ? Math.ceil(remainingAmount / remainingMonths) : goal.monthlyAmount;
          const repairedGoal = { ...goal, monthlyAmount, updatedAt: new Date().toISOString() };
          const withGoal = {
            ...next,
            accumulationGoals: next.accumulationGoals.map((item) => (item.id === goal.id ? repairedGoal : item)),
            expenseCategories: next.expenseCategories.map((item) =>
              item.id === goal.categoryId ? { ...item, defaultAmount: monthlyAmount } : item
            ),
          };
          next = {
            ...withGoal,
            monthlyExpenses: rescheduleAccumulationGoal(withGoal, repairedGoal),
          };
          changed = true;
        });

      return changed ? next : prev;
    });
  }, [setState, state.accumulationGoals, state.monthlyExpenses]);

  const derivePlan = () => {
    const targetAmount = parseMoney(form.target);
    const progress = editingGoal ? accumulationProgress(state, editingGoal) : 0;
    const paidMonths = editingGoal ? accumulationPaidMonths(state, editingGoal) : 0;
    const remaining = Math.max(targetAmount - progress, 0);
    const startMonth = form.startMonth || currentMonth();
    let months = Number(form.months) || 0;
    let monthlyAmount = parseMoney(form.monthlyAmount);

    if (form.dueDate) {
      months = Math.max(monthsBetweenInclusive(startMonth, monthFromDate(form.dueDate)) - paidMonths, 0);
      monthlyAmount = months ? Math.ceil(remaining / months) : 0;
    } else if (planBasis === "monthlyAmount" && monthlyAmount) {
      months = Math.ceil(remaining / monthlyAmount);
    } else if (months) {
      monthlyAmount = months ? Math.ceil(remaining / months) : 0;
    } else if (monthlyAmount) {
      months = Math.ceil(remaining / monthlyAmount);
    }

    return {
      targetAmount,
      progress,
      remaining,
      startMonth,
      dueDate: form.dueDate || undefined,
      months,
      monthlyAmount,
      valid: Boolean(form.name.trim() && targetAmount > 0 && (remaining === 0 || (months > 0 && monthlyAmount > 0))),
    };
  };

  const plan = derivePlan();

  const remainingForForm = (nextForm: ReturnType<typeof emptyForm>) => {
    const targetAmount = parseMoney(nextForm.target);
    const progress = editingGoal ? accumulationProgress(state, editingGoal) : 0;
    return Math.max(targetAmount - progress, 0);
  };

  const syncDueDatePlan = (nextForm: ReturnType<typeof emptyForm>) => {
    if (!nextForm.dueDate) return syncManualPlan(nextForm, planBasis);
    const totalMonths = monthsBetweenInclusive(nextForm.startMonth || currentMonth(), monthFromDate(nextForm.dueDate));
    const paidMonths = editingGoal ? accumulationPaidMonths(state, editingGoal) : 0;
    const months = Math.max(totalMonths - paidMonths, 0);
    const remaining = remainingForForm(nextForm);
    return {
      ...nextForm,
      months: months ? String(months) : "",
      monthlyAmount: months && remaining ? Math.ceil(remaining / months).toLocaleString("vi-VN") : "",
    };
  };

  const syncManualPlan = (nextForm: ReturnType<typeof emptyForm>, basis: "months" | "monthlyAmount") => {
    if (nextForm.dueDate) return nextForm;
    const remaining = remainingForForm(nextForm);
    const months = Number(nextForm.months) || 0;
    const monthlyAmount = parseMoney(nextForm.monthlyAmount);
    if (basis === "months") {
      return {
        ...nextForm,
        monthlyAmount: months && remaining ? Math.ceil(remaining / months).toLocaleString("vi-VN") : "",
      };
    }
    return {
      ...nextForm,
      months: monthlyAmount && remaining ? String(Math.ceil(remaining / monthlyAmount)) : "",
    };
  };

  const updateAccumulationTarget = (target: string) => {
    setForm((current) => syncDueDatePlan({ ...current, target }));
  };

  const updateAccumulationStartMonth = (startMonth: string) => {
    setForm((current) => syncDueDatePlan({ ...current, startMonth }));
  };

  const updateAccumulationDueDate = (dueDate: string) => {
    setForm((current) => {
      const next = { ...current, dueDate };
      return dueDate ? syncDueDatePlan(next) : syncManualPlan(next, planBasis);
    });
  };

  const updateAccumulationMonths = (months: string) => {
    setPlanBasis("months");
    setForm((current) => syncManualPlan({ ...current, months }, "months"));
  };

  const updateAccumulationMonthlyAmount = (monthlyAmount: string) => {
    setPlanBasis("monthlyAmount");
    setForm((current) => syncManualPlan({ ...current, monthlyAmount }, "monthlyAmount"));
  };

  const resetForm = () => {
    setForm(emptyForm());
    setPlanBasis("months");
    setEditingId(null);
    setFormOpen(false);
    setFormError("");
  };

  const openEdit = (goal: AccumulationGoal) => {
    const progress = accumulationProgress(state, goal);
    const remaining = Math.max(goal.targetAmount - progress, 0);
    const unpaidMonths = accumulationUnpaidMonths(state, goal);
    setEditingId(goal.id);
    setFormOpen(true);
    setForm({
      name: goal.name,
      target: goal.targetAmount.toLocaleString("vi-VN"),
      startMonth: goal.startMonth,
      dueDate: goal.dueDate ?? "",
      months: String(unpaidMonths || ""),
      monthlyAmount: unpaidMonths && remaining ? Math.ceil(remaining / unpaidMonths).toLocaleString("vi-VN") : "",
    });
    setPlanBasis("months");
    setFormError("");
  };

  const saveGoal = () => {
    const nextPlan = derivePlan();
    if (!nextPlan.valid) {
      setFormError("Nhập tên, tổng tiền và ngày cần dùng hoặc số tháng/số tiền mỗi tháng.");
      return;
    }

    commitWithUndo(editingId ? "Đã sửa mục tích lũy." : "Đã tạo mục tích lũy.", (prev) => {
      const now = new Date().toISOString();
      const existing = editingId ? prev.accumulationGoals.find((goal) => goal.id === editingId) : null;
      const goalId = existing?.id ?? uid();
      const categoryId = existing?.categoryId ?? uid();
      const paidMonths = existing ? accumulationPaidMonths(prev, existing) : 0;
      const nextGoal: AccumulationGoal = {
        id: goalId,
        name: form.name.trim(),
        targetAmount: nextPlan.targetAmount,
        startMonth: nextPlan.startMonth,
        dueDate: nextPlan.dueDate,
        months: existing ? paidMonths + nextPlan.months : nextPlan.months,
        monthlyAmount: nextPlan.monthlyAmount,
        categoryId,
        status: "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const category: ExpenseCategory = {
        id: categoryId,
        name: nextGoal.name,
        kind: "fixed",
        defaultAmount: nextGoal.monthlyAmount,
        accumulationGoalId: goalId,
      };
      const withGoal: AppState = {
        ...prev,
        accumulationGoals: existing
          ? prev.accumulationGoals.map((goal) => (goal.id === existing.id ? nextGoal : goal))
          : [...prev.accumulationGoals, nextGoal],
        expenseCategories: prev.expenseCategories.some((item) => item.id === categoryId)
          ? prev.expenseCategories.map((item) => (item.id === categoryId ? { ...item, ...category } : item))
          : [...prev.expenseCategories, category],
      };
      return {
        ...withGoal,
        monthlyExpenses: rescheduleAccumulationGoal(withGoal, nextGoal),
      };
    }, { action: editingId ? "update" : "create", entityType: "accumulation", entityId: editingId ?? "" });
    resetForm();
  };

  const endGoal = (goal: AccumulationGoal) => {
    if (!window.confirm(`Kết thúc mục ${goal.name}? Checklist từ tháng sau sẽ không còn hiển thị mục này.`)) return;
    commitWithUndo("Đã kết thúc mục tích lũy.", (prev) => ({
      ...prev,
      accumulationGoals: prev.accumulationGoals.map((item) =>
        item.id === goal.id ? { ...item, status: "ended", endedAt: today(), updatedAt: new Date().toISOString() } : item
      ),
      monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId !== goal.categoryId || item.checked || item.month <= currentMonth()),
    }), { action: "update", entityType: "accumulation", entityId: goal.id });
    if (editingId === goal.id) resetForm();
  };

  const deleteGoal = (goal: AccumulationGoal) => {
    if (!window.confirm(`Xóa mục ${goal.name}? Các tháng đã tick vốn được giữ trong báo cáo cũ.`)) return;
    commitWithUndo("Đã xóa mục tích lũy.", (prev) => {
      const relatedPayloads = {
        expenseCategories: prev.expenseCategories.filter((item) => item.id === goal.categoryId),
        monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId === goal.categoryId && !item.checked),
      };
      return withTrashItem(
        {
          ...prev,
          accumulationGoals: prev.accumulationGoals.filter((item) => item.id !== goal.id),
          expenseCategories: prev.expenseCategories.filter((item) => item.id !== goal.categoryId),
          monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId !== goal.categoryId || item.checked),
        },
        makeTrashItem("accumulation", goal.id, `mục tích lũy ${goal.name}`, goal, relatedPayloads)
      );
    }, { action: "delete", entityType: "accumulation", entityId: goal.id });
    if (editingId === goal.id) resetForm();
  };

  const goals = state.accumulationGoals.filter((goal) => goal.status === "active");
  const accumulationMetrics = goals.reduce(
    (totals, goal) => {
      const progress = accumulationProgress(state, goal);
      return {
        progress: totals.progress + progress,
        remaining: totals.remaining + Math.max(goal.targetAmount - progress, 0),
        monthly: totals.monthly + goal.monthlyAmount,
      };
    },
    { progress: 0, remaining: 0, monthly: 0 }
  );
  const historyGoals = state.accumulationGoals
    .filter((goal) => goal.status === "ended")
    .sort((a, b) => {
      const aTime = Date.parse(a.endedAt ?? a.updatedAt ?? a.createdAt ?? `${a.startMonth}-01`) || 0;
      const bTime = Date.parse(b.endedAt ?? b.updatedAt ?? b.createdAt ?? `${b.startMonth}-01`) || 0;
      return bTime - aTime;
    });
  const openSourceTrace = (goal: AccumulationGoal) => {
    setTraceEventIds([goal.meta?.eventId ?? stableEventId("accumulation", goal.id)]);
  };

  return (
    <div className="page">
      <header className="page-header accumulation-page-header">
        <div>
          <p className="eyebrow">Kế hoạch chi cố định</p>
          <h1>Tích lũy</h1>
        </div>
        <div className="page-header-actions accumulation-header-actions">
          {!formOpen && (
            <button className="primary accumulation-header-add-button" onClick={() => setFormOpen(true)}>
              <Plus size={17} /> Thêm
            </button>
          )}
        </div>
      </header>

      {formOpen && (
        <section className="panel">
          <div className="panel-title">
            <h2>{editingGoal ? "Sửa mục tích lũy" : "Tạo mục tích lũy"}</h2>
            <button className="icon-button" onClick={resetForm} title="Hủy" aria-label="Hủy" type="button"><X size={17} /></button>
          </div>
          <div className="deposit-confirm accumulation-form">
            <label>
              Tên mục
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Du lịch" />
            </label>
            <label>
              Tổng tiền cần
              <input value={form.target} onChange={(event) => updateAccumulationTarget(formatMoneyChange(event))} placeholder="9.000.000" />
            </label>
            <label>
              Tháng bắt đầu
              <input type="month" value={form.startMonth} onChange={(event) => updateAccumulationStartMonth(event.target.value)} />
            </label>
            <label>
              Ngày cần dùng
              <input type="date" value={form.dueDate} onChange={(event) => updateAccumulationDueDate(event.target.value)} />
            </label>
            <label>
              Số tháng
              <input value={form.months || (plan.months ? String(plan.months) : "")} onChange={(event) => updateAccumulationMonths(event.target.value.replace(/\D/g, ""))} placeholder={plan.months ? String(plan.months) : "6"} />
            </label>
            <label>
              Tiền mới tháng
              <input value={form.monthlyAmount || (plan.monthlyAmount ? plan.monthlyAmount.toLocaleString("vi-VN") : "")} onChange={(event) => updateAccumulationMonthlyAmount(formatMoneyChange(event))} placeholder={plan.monthlyAmount ? plan.monthlyAmount.toLocaleString("vi-VN") : "1.500.000"} />
            </label>
            <button className="primary" onClick={saveGoal}>
              <Save size={17} /> {editingGoal ? "Lưu thay đổi" : "Tạo quỹ"}
            </button>
            <small className="computed accumulation-computed">
              Còn cần đến {formatVnd(plan.remaining)} · {plan.months || 0} tháng · khoảng {formatVnd(plan.monthlyAmount || 0)}/tháng
            </small>
            {formError && <span className="form-error accumulation-form-error">{formError}</span>}
          </div>
        </section>
      )}

      <section className="accumulation-metrics-grid" aria-label="Tổng quan mục tích lũy">
        <article>
          <small>Hoạt động</small>
          <strong>{goals.length} mục tiêu</strong>
        </article>
        <article>
          <small>Đã tích lũy</small>
          <strong>{formatVnd(accumulationMetrics.progress)}</strong>
        </article>
        <article>
          <small>Cần thêm</small>
          <strong>{formatVnd(accumulationMetrics.remaining)}</strong>
        </article>
        <article>
          <small>Mỗi tháng</small>
          <strong>{formatVnd(accumulationMetrics.monthly)}</strong>
        </article>
      </section>

      <section className="accumulation-grid">
        {goals.length === 0 ? (
          <article className="panel empty-state">Chưa có mục tích lũy nào.</article>
        ) : (
          goals.map((goal) => {
            const progress = accumulationProgress(state, goal);
            const percent = goal.targetAmount ? Math.min((progress / goal.targetAmount) * 100, 100) : 0;
            const remainingAmount = Math.max(goal.targetAmount - progress, 0);
            const paidMonths = state.monthlyExpenses.filter((item) => item.categoryId === goal.categoryId && item.checked).length;
            const unpaidMonths = accumulationUnpaidMonths(state, goal);
            return (
              <article className={`accumulation-card accumulation-goal-card ${goal.status}`} key={goal.id}>
                <PiggyBank className="accumulation-card-bg-icon" size={86} />
                <button className="accumulation-trace-button" onClick={() => openSourceTrace(goal)} title={`Xem nguồn tiền ${goal.name}`} type="button" aria-label={`Xem nguồn tiền ${goal.name}`}>
                  <History size={16} />
                </button>
                <button className="accumulation-delete-button" onClick={() => deleteGoal(goal)} title={`Xóa ${goal.name}`} type="button" aria-label={`Xóa ${goal.name}`}>
                  <X size={16} />
                </button>
                <div className="accumulation-goal-head">
                  <div className="accumulation-goal-title">
                    <span className="accumulation-goal-icon"><PiggyBank size={25} /></span>
                    <div>
                      <h2>{goal.name}</h2>
                      <small>{goal.status === "ended" ? "Đã kết thúc" : goal.dueDate ? `Dự kiến: ${formatDate(goal.dueDate)}` : `Bắt đầu: ${formatMonth(goal.startMonth)}`}</small>
                    </div>
                  </div>
                  <span className="accumulation-percent-badge">{percent.toFixed(0)}%</span>
                </div>
                <div className="accumulation-progress-block">
                  <div>
                    <span>Tiền đạt</span>
                    <strong>{formatVnd(progress)} / {formatVnd(goal.targetAmount)}</strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <div className="accumulation-stat-grid">
                  <div>
                    <small>Cần thêm</small>
                    <strong>{formatVnd(remainingAmount)}</strong>
                  </div>
                  <div>
                    <small>Còn</small>
                    <strong>{unpaidMonths > 0 ? `${unpaidMonths} tháng` : "hoàn tất"}</strong>
                  </div>
                  <div>
                    <small>Mỗi tháng</small>
                    <strong>{formatVnd(goal.monthlyAmount)}</strong>
                  </div>
                </div>
                <div className="card-actions accumulation-actions">
                  {goal.status === "active" && <button className="primary accumulation-end-button" onClick={() => endGoal(goal)}>Kết thúc</button>}
                  {goal.status === "active" && <button className="ghost accumulation-view-deposits-button" onClick={() => onOpenMbbDeposits(goal.id)} type="button">Xem sổ</button>}
                  {goal.status === "active" && <button className="ghost accumulation-edit-button" onClick={() => openEdit(goal)} title={`Sửa ${goal.name}`} type="button"><Pencil size={17} /></button>}
                </div>
              </article>
            );
          })
        )}
        </section>

      <section className="panel accumulation-history-panel">
        <div className="panel-title accumulation-history-title">
          <h2>Lịch sử mục tiêu đã hoàn thành</h2>
        </div>
        {historyGoals.length === 0 ? (
          <div className="accumulation-history-empty">
            <span><Check size={24} /></span>
            <strong>Chưa có mục tiêu nào hoàn thành</strong>
          </div>
        ) : (
          <div className="accumulation-history-list">
            {historyGoals.map((goal) => {
              const progress = accumulationProgress(state, goal);
              const percent = goal.targetAmount ? Math.min((progress / goal.targetAmount) * 100, 100) : 0;
              return (
                <article className="accumulation-history-row" key={goal.id}>
                  <div className="accumulation-history-main">
                    <strong>{goal.name}</strong>
                    <small>{goal.endedAt ? `Hoàn thành ${formatDate(goal.endedAt)}` : "Đã hoàn thành"}</small>
                  </div>
                  <div className="accumulation-history-money">
                    <strong>{formatVnd(progress)} / {formatVnd(goal.targetAmount)}</strong>
                    <span>{percent.toFixed(0)}%</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền tích lũy"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </div>
  );
}

function MoneyPage({
  state,
  setState,
  month,
  setMonth,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  month: string;
  setMonth: (month: string) => void;
}) {
  const summary = monthlySummary(state, month);
  const suggestExpenseAmount = (categoryId: string) => {
    const category = state.expenseCategories.find((item) => item.id === categoryId);
    if (!category) return "";
    const record = getMonthlyExpense(state, category, month);
    const amount = category.kind === "fixed" ? record.amount || category.defaultAmount : category.defaultAmount;
    return amount > 0 ? amount.toLocaleString("vi-VN") : "";
  };
  const [historyIncomeId, setHistoryIncomeId] = useState<string | null>(null);
  const [historyExpenseId, setHistoryExpenseId] = useState<string | null>(null);
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<
    | {
        kind: "income";
        id: string;
        categoryId: string;
        amount: string;
        date: string;
        note: string;
      }
    | {
        kind: "expense";
        id: string;
        categoryId: string;
        amount: string;
        date: string;
        note: string;
      }
    | null
  >(null);
  const [incomeForm, setIncomeForm] = useState({
    categoryId: state.incomeCategories.find((category) => category.id === "other-income")?.id ?? state.incomeCategories[0]?.id ?? "",
    amount: "",
    date: today(),
    note: "",
  });
  const [expenseEntry, setExpenseEntry] = useState({
    categoryId: "phat-sinh",
    amount: "",
    date: today(),
    note: "",
  });
  const [newIncome, setNewIncome] = useState({ name: "", kind: "variable" as IncomeCategory["kind"] });
  const [newExpense, setNewExpense] = useState({ name: "", kind: "fixed" as ExpenseCategory["kind"], amount: "" });
  const [depositForm, setDepositForm] = useState({
    month,
    note: "Chia quỹ cuối tháng",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allocationAmountInputs, setAllocationAmountInputs] = useState<Partial<Record<AllocationAmountKey, string>>>({});

  useEffect(() => {
    setDepositForm((prev) => (prev.month === month ? prev : { ...prev, month }));
    setAllocationAmountInputs({});
  }, [month]);

  useEffect(() => {
    setHistoryIncomeId((current) => {
      if (current && summary.incomeRows.some((row) => row.id === current)) return current;
      return summary.incomeRows.find((row) => row.id === "other-income" && row.value > 0)?.id ?? summary.incomeRows.find((row) => row.value > 0)?.id ?? summary.incomeRows[0]?.id ?? null;
    });
    setHistoryExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return summary.expenseRows.find((row) => row.value > 0)?.id ?? summary.expenseRows[0]?.id ?? null;
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const historyIncome = summary.incomeRows.find((row) => row.id === historyIncomeId) ?? null;
  const historyExpense = summary.expenseRows.find((row) => row.id === historyExpenseId) ?? null;

  const openIncomeEdit = (transaction: IncomeTransaction) => {
    setEditingTransaction({
      kind: "income",
      id: transaction.id,
      categoryId: transaction.categoryId,
      amount: transaction.amount.toLocaleString("vi-VN"),
      date: transaction.date,
      note: transaction.note,
    });
  };

  const openExpenseEdit = (transaction: ExpenseEntry) => {
    setEditingTransaction({
      kind: "expense",
      id: transaction.id,
      categoryId: transaction.categoryId,
      amount: transaction.amount.toLocaleString("vi-VN"),
      date: transaction.date,
      note: transaction.note,
    });
  };

  const saveEditingTransaction = () => {
    if (!editingTransaction) return;
    const amount = parseMoney(editingTransaction.amount);
    if (!amount || !editingTransaction.date) return;

    setState((prev) => {
      if (editingTransaction.kind === "income") {
        return {
          ...prev,
          incomeTransactions: prev.incomeTransactions.map((item) =>
            item.id === editingTransaction.id
              ? {
                  ...item,
                  categoryId: editingTransaction.categoryId,
                  amount,
                  date: editingTransaction.date,
                  month: monthFromDate(editingTransaction.date),
                  note: editingTransaction.note,
                }
              : item
          ),
        };
      }

      return {
        ...prev,
        expenseEntries: prev.expenseEntries.map((item) =>
          item.id === editingTransaction.id
            ? {
                ...item,
                categoryId: editingTransaction.categoryId,
                amount,
                date: editingTransaction.date,
                month: monthFromDate(editingTransaction.date),
                note: editingTransaction.note,
              }
            : item
        ),
      };
    });
    setEditingTransaction(null);
  };

  const deleteIncomeTransaction = (transaction: { id: string; amount: number; date: string; note: string }) => {
    if (!window.confirm("Xóa khoản thu này?")) return;
    setState((prev) => ({
      ...prev,
      incomeTransactions: prev.incomeTransactions.filter((item) => item.id !== transaction.id),
    }));
  };

  const deleteExpenseTransaction = (transaction: { id: string; amount: number; date: string; note: string }) => {
    if (!window.confirm("Xóa khoản chi này?")) return;
    setState((prev) => ({
      ...prev,
      expenseEntries: prev.expenseEntries.filter((item) => item.id !== transaction.id),
    }));
  };

  const updateMonthlyExpense = (category: ExpenseCategory, patch: Partial<MonthlyExpense>) => {
    setState((prev) => {
      const existing = prev.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
      const next = existing ? { ...existing, ...patch } : { ...getMonthlyExpense(prev, category, month), ...patch };
      return {
        ...prev,
        monthlyExpenses: existing
          ? prev.monthlyExpenses.map((item) => (item.id === existing.id ? next : item))
          : [...prev.monthlyExpenses, next],
      };
    });
  };

  const updateAllocation = (patch: Partial<Allocation>) => {
    setState((prev) => {
      const existing = prev.allocations.find((item) => item.month === month);
      const next = { ...getAllocation(prev, month), ...patch };
      return {
        ...prev,
        allocations: existing ? prev.allocations.map((item) => (item.month === month ? next : item)) : [...prev.allocations, next],
      };
    });
  };

  const resetAllocationAmounts = () => {
    setAllocationAmountInputs({});
    updateAllocation({
      btcAmount: undefined,
      stockAmount: undefined,
      savingAmount: undefined,
      emergencyAmount: undefined,
    });
  };

  const updateAllocationAmount = (key: AllocationAmountKey, value: string) => {
    const formattedValue = formatMoneyInput(value);
    setAllocationAmountInputs((prev) => ({ ...prev, [key]: formattedValue }));
    updateAllocation({ [key]: formattedValue ? parseMoney(formattedValue) : undefined } as Partial<Allocation>);
  };

  const commitAllocationAmount = (key: AllocationAmountKey) => {
    setAllocationAmountInputs((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      const value = next[key] ?? "";
      if (value.trim() === "") {
        delete next[key];
      } else {
        next[key] = parseMoney(value).toLocaleString("vi-VN");
      }
      return next;
    });
  };

  const addIncome = () => {
    const amount = parseMoney(incomeForm.amount);
    if (!amount || !incomeForm.categoryId) return;
    setState((prev) => ({
      ...prev,
      incomeTransactions: [
        ...prev.incomeTransactions,
        {
          id: uid(),
          categoryId: incomeForm.categoryId,
          amount,
          date: incomeForm.date,
          month: monthFromDate(incomeForm.date),
          note: incomeForm.note,
        },
      ],
    }));
    setIncomeForm((prev) => ({ ...prev, amount: "", note: "" }));
  };

  const addExpenseEntry = () => {
    const amount = parseMoney(expenseEntry.amount);
    if (!amount || !expenseEntry.categoryId) return;
    setState((prev) => ({
      ...prev,
      expenseEntries: [
        ...prev.expenseEntries,
        {
          id: uid(),
          categoryId: expenseEntry.categoryId,
          amount,
          date: expenseEntry.date,
          month: monthFromDate(expenseEntry.date),
          note: expenseEntry.note,
        },
      ],
    }));
    setExpenseEntry((prev) => ({ ...prev, amount: "", note: "" }));
  };

  const addIncomeCategory = () => {
    if (!newIncome.name.trim()) return;
    const category = { id: uid(), name: newIncome.name.trim(), kind: newIncome.kind };
    setState((prev) => ({ ...prev, incomeCategories: [...prev.incomeCategories, category] }));
    setIncomeForm((prev) => ({ ...prev, categoryId: category.id }));
    setNewIncome({ name: "", kind: "variable" });
  };

  const addExpenseCategory = () => {
    if (!newExpense.name.trim()) return;
    const category: ExpenseCategory = {
      id: uid(),
      name: newExpense.name.trim(),
      kind: newExpense.kind,
      defaultAmount: parseMoney(newExpense.amount),
      accumulationGoalId: "",
    };
    setState((prev) => ({ ...prev, expenseCategories: [...prev.expenseCategories, category] }));
    setNewExpense({ name: "", kind: "fixed", amount: "" });
  };

  const confirmAllocation = () => {
    const existingAllocation = state.allocations.find((item) => item.month === month);
    if (existingAllocation?.confirmedAt) return;

    const totalPercent =
      summary.allocation.btcPercent +
      summary.allocation.stockPercent +
      summary.allocation.savingPercent +
      summary.allocation.emergencyPercent;
    if (totalPercent !== 100 || !amountTotalMatchesSaving || summary.saving <= 0) return;

    const confirmedAllocation: Allocation = {
      ...summary.allocation,
      confirmedAt: new Date().toISOString(),
      btcAmount: Math.round(summary.allocationAmounts.btc),
      stockAmount: Math.round(summary.allocationAmounts.stock),
      savingAmount: Math.round(summary.allocationAmounts.saving),
      emergencyAmount: Math.round(summary.allocationAmounts.emergency),
      totalSavingAtConfirm: Math.round(summary.saving),
    };
    if ((confirmedAllocation.savingAmount ?? 0) > 0) confirmedAllocation.savingDepositRequestedAt = confirmedAllocation.confirmedAt;
    if ((confirmedAllocation.emergencyAmount ?? 0) > 0) confirmedAllocation.emergencyDepositRequestedAt = confirmedAllocation.confirmedAt;

    setState((prev) => ({
      ...prev,
      allocations: prev.allocations.some((item) => item.month === month)
        ? prev.allocations.map((item) => (item.month === month ? confirmedAllocation : item))
        : [...prev.allocations, confirmedAllocation],
      fundTransactions: [
        ...prev.fundTransactions,
        {
          id: uid(),
          fund: "btc",
          type: "deposit",
          amount: confirmedAllocation.btcAmount ?? 0,
          date: `${depositForm.month}-01`,
          month,
          note: "Chia quỹ cuối tháng",
        },
        {
          id: uid(),
          fund: "stock",
          type: "deposit",
          amount: confirmedAllocation.stockAmount ?? 0,
          date: `${depositForm.month}-01`,
          month,
          note: "Chia quỹ cuối tháng",
        },
      ],
    }));
    setConfirmOpen(false);
  };

  const monthAlreadyConfirmed = Boolean(summary.allocation.confirmedAt);

  const percentTotal =
    summary.allocation.btcPercent +
    summary.allocation.stockPercent +
    summary.allocation.savingPercent +
    summary.allocation.emergencyPercent;
  const allocationAmountRows: Array<{
    percentKey: AllocationPercentKey;
    amountKey: AllocationAmountKey;
    label: string;
    amount: number;
  }> = [
    { percentKey: "btcPercent", amountKey: "btcAmount", label: "BTC", amount: summary.allocationAmounts.btc },
    { percentKey: "stockPercent", amountKey: "stockAmount", label: "CK", amount: summary.allocationAmounts.stock },
    { percentKey: "savingPercent", amountKey: "savingAmount", label: "Quỹ tiết kiệm", amount: summary.allocationAmounts.saving },
    { percentKey: "emergencyPercent", amountKey: "emergencyAmount", label: "Dự phòng", amount: summary.allocationAmounts.emergency },
  ];
  const allocationAmountTotal = allocationAmountRows.reduce((sum, item) => sum + Math.round(item.amount), 0);
  const availableAllocationAmount = Math.round(Math.max(summary.saving, 0));
  const amountTotalMatchesSaving = Math.abs(allocationAmountTotal - availableAllocationAmount) <= 1;
  const hasCustomAllocationAmounts = allocationAmountRows.some(
    (item) => typeof summary.allocation[item.amountKey] === "number"
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Thu nhập, chi tiêu, chia quỹ</p>
          <h1>Quản lý tháng {formatMonth(month)}</h1>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="metrics-grid">
        <MetricCard label="Thu nhập" value={formatVnd(summary.income)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Chi tiêu" value={formatVnd(summary.expense)} icon={<ArrowDownCircle size={20} />} />
        <MetricCard label="Có thể chia quỹ" value={formatVnd(summary.saving)} icon={<PiggyBank size={20} />} tone="highlight" />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-title">
            <h2>Thêm thu nhập</h2>
            <button className="icon-button" title="Lưu thu nhập" onClick={addIncome}>
              <Save size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Mục
              <select value={incomeForm.categoryId} onChange={(event) => setIncomeForm({ ...incomeForm, categoryId: event.target.value })}>
                {state.incomeCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Số tiền
              <input value={incomeForm.amount} onChange={(event) => setIncomeForm({ ...incomeForm, amount: formatMoneyChange(event) })} placeholder="9.000.000" />
            </label>
            <label>
              Ngày
              <input type="date" value={incomeForm.date} onChange={(event) => setIncomeForm({ ...incomeForm, date: event.target.value })} />
            </label>
            <label>
              Ghi chú
              <input value={incomeForm.note} onChange={(event) => setIncomeForm({ ...incomeForm, note: event.target.value })} placeholder="Fishing, job..." />
            </label>
          </div>
          <button className="primary" onClick={addIncome}>
            <Plus size={17} /> Thêm thu nhập
          </button>

          <div className="inline-add">
            <input value={newIncome.name} onChange={(event) => setNewIncome({ ...newIncome, name: event.target.value })} placeholder="Mục thu nhập mới" />
            <select value={newIncome.kind} onChange={(event) => setNewIncome({ ...newIncome, kind: event.target.value as IncomeCategory["kind"] })}>
              <option value="variable">Phát sinh</option>
              <option value="fixed">Cố định</option>
            </select>
            <button onClick={addIncomeCategory} title="Thêm mục">
              <Plus size={17} />
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Khoản phát sinh</h2>
            <button className="icon-button" title="Lưu khoản chi" onClick={addExpenseEntry}>
              <Save size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Mục
              <select value={expenseEntry.categoryId} onChange={(event) => {
                const categoryId = event.target.value;
                setExpenseEntry({ ...expenseEntry, categoryId, amount: suggestExpenseAmount(categoryId) });
              }}>
                {state.expenseCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Số tiền
              <input value={expenseEntry.amount} onChange={(event) => setExpenseEntry({ ...expenseEntry, amount: formatMoneyChange(event) })} placeholder="500.000" />
            </label>
            <label>
              Ngày
              <input type="date" value={expenseEntry.date} onChange={(event) => setExpenseEntry({ ...expenseEntry, date: event.target.value })} />
            </label>
            <label>
              Note
              <input value={expenseEntry.note} onChange={(event) => setExpenseEntry({ ...expenseEntry, note: event.target.value })} placeholder="Sửa xe, mua được..." />
            </label>
          </div>
          <button className="primary" onClick={addExpenseEntry}>
            <Plus size={17} /> Thêm khoản chi
          </button>

          <div className="inline-add">
            <input value={newExpense.name} onChange={(event) => setNewExpense({ ...newExpense, name: event.target.value })} placeholder="Mục chi mới" />
            <input value={newExpense.amount} onChange={(event) => setNewExpense({ ...newExpense, amount: formatMoneyChange(event) })} placeholder="Số tiền" />
            <select value={newExpense.kind} onChange={(event) => setNewExpense({ ...newExpense, kind: event.target.value as ExpenseCategory["kind"] })}>
              <option value="fixed">Cố định</option>
              <option value="variable">Một lần</option>
            </select>
            <button onClick={addExpenseCategory} title="Thêm mục">
              <Plus size={17} />
            </button>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Chi tiêu tháng</h2>
          <small>Khoản cố định chỉ tính khi tick đã chuyển</small>
        </div>
        <div className="expense-editor">
          {state.expenseCategories.map((category) => {
            const record = getMonthlyExpense(state, category, month);
            const row = summary.expenseRows.find((item) => item.id === category.id);
            return (
              <div className="expense-row" key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <small>{category.kind === "fixed" ? "Cố định" : "Phát sinh 1 lần"}</small>
                </div>
                {category.kind === "fixed" ? (
                  <>
                    <label>
                      Số tiền
                      <input value={record?.amount.toLocaleString("vi-VN")} onChange={(event) => updateMonthlyExpense(category, { amount: parseMoney(formatMoneyChange(event)) })} />
                    </label>
                    <button className={record?.checked ? "toggle checked" : "toggle"} onClick={() => updateMonthlyExpense(category, { checked: !record?.checked })}>
                      <CheckCircle2 size={17} />
                      {record?.checked ? "Đã chuyển" : "Chưa chuyển"}
                    </button>
                  </>
                ) : (
                  <div className="variable-summary">
                    <strong>{formatVnd(row?.value ?? 0)}</strong>
                    <small>{row?.transactions?.length ?? 0} khoản phát sinh đã lưu</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="two-column compact history-grid">
        <article className="panel">
          <div className="panel-title">
            <h2>Lịch sử thu nhập</h2>
            <small>Bấm vào "Thu nhập khác" được xem chi tiết</small>
          </div>
          <DetailList rows={summary.incomeRows} selectedId={historyIncomeId} onSelect={setHistoryIncomeId} />
          <CategoryHistoryPanel
            title={historyIncome?.name ?? "Thu nhập"}
            rows={historyIncome?.transactions ?? []}
            emptyText="Chưa có khoản thu nào trong tháng này."
            itemTone="income"
            onEdit={(item) => openIncomeEdit(item as IncomeTransaction)}
            onDelete={deleteIncomeTransaction}
            onTrace={(item) => setTraceEventIds([item.meta?.eventId ?? stableEventId("income", item.id)])}
          />
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Lịch sử phát sinh</h2>
            <small>Bấm vào "Phát sinh" được xem tổng khoản</small>
          </div>
          <DetailList rows={summary.expenseRows} selectedId={historyExpenseId} onSelect={setHistoryExpenseId} />
          <CategoryHistoryPanel
            title={historyExpense?.name ?? "Phát sinh"}
            rows={historyExpense?.transactions ?? []}
            emptyText="Chưa có khoản phát sinh nào trong tháng này."
            itemTone="expense"
            onEdit={(item) => openExpenseEdit(item as ExpenseEntry)}
            onDelete={deleteExpenseTransaction}
            onTrace={(item) => setTraceEventIds([item.meta?.eventId ?? stableEventId("expense", item.id)])}
          />
        </article>
      </section>

      {editingTransaction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="edit-transaction-title">Điều chỉnh {editingTransaction.kind === "income" ? "thu nhập" : "chi tiêu"}</h2>
              <small>{editingTransaction.kind === "income" ? "Cập nhật giao dịch thu" : "Cập nhật giao dịch chi"}</small>
            </div>
            <div className="form-grid">
              <label>
                Mục
                <select
                  value={editingTransaction.categoryId}
                  onChange={(event) => setEditingTransaction({ ...editingTransaction, categoryId: event.target.value })}
                >
                  {(editingTransaction.kind === "income" ? state.incomeCategories : state.expenseCategories).map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số tiền
                <input
                  value={editingTransaction.amount}
                  onChange={(event) => setEditingTransaction({ ...editingTransaction, amount: formatMoneyChange(event) })}
                  placeholder="9.000.000"
                />
              </label>
              <label>
                Ngày
                <input type="date" value={editingTransaction.date} onChange={(event) => setEditingTransaction({ ...editingTransaction, date: event.target.value })} />
              </label>
              <label>
                Ghi chú
                <input value={editingTransaction.note} onChange={(event) => setEditingTransaction({ ...editingTransaction, note: event.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost icon-only" onClick={() => setEditingTransaction(null)} title="Hủy" aria-label="Hủy">
                <X size={17} />
              </button>
              <button className="primary" onClick={saveEditingTransaction}>
                <Save size={17} /> Lưu điều chỉnh
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>Chia quỹ cuối tháng</h2>
          <div className="panel-title-actions allocation-panel-actions">
            <div className="allocation-title-meta">
              <small className={percentTotal === 100 ? "ok" : "bad"}>Tổng tỷ lệ {percentTotal}%</small>
              <small className={amountTotalMatchesSaving ? "ok" : "bad"}>
                Tổng tiền {formatVnd(allocationAmountTotal)} / {formatVnd(availableAllocationAmount)}
              </small>
            </div>
            <button className="icon-button" title="Chia lại theo tỷ lệ %" onClick={resetAllocationAmounts} disabled={monthAlreadyConfirmed}>
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
        <div className="allocation-editor">
          {allocationAmountRows.map((item) => (
            <div className="allocation-field" key={item.percentKey}>
              <span>{item.label}</span>
              <input
                type="number"
                min="0"
                max="100"
                value={summary.allocation[item.percentKey]}
                onChange={(event) => updateAllocation({ [item.percentKey]: Number(event.target.value) } as Partial<Allocation>)}
                aria-label={`${item.label} tỷ lệ phần trăm`}
                placeholder="%"
              />
              <input
                className="amount-input"
                inputMode="numeric"
                value={allocationAmountInputs[item.amountKey] ?? Math.round(item.amount).toLocaleString("vi-VN")}
                onChange={(event) => updateAllocationAmount(item.amountKey, formatMoneyChange(event))}
                onBlur={() => commitAllocationAmount(item.amountKey)}
                aria-label={`${item.label} số tiền`}
                placeholder="Số tiền"
              />
            </div>
          ))}
        </div>
        <div className="deposit-confirm allocation-confirm-row">
          <label>
              Tháng chia quỹ
              <input type="month" value={depositForm.month} onChange={(event) => setDepositForm({ ...depositForm, month: event.target.value })} />
          </label>
          <button
            className="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={percentTotal !== 100 || !amountTotalMatchesSaving || summary.saving <= 0 || monthAlreadyConfirmed}
          >
            <CheckCircle2 size={17} /> Chia quỹ
          </button>
          {monthAlreadyConfirmed && <small className="ok">Tháng này đã xác nhận chia quỹ.</small>}
        </div>
      </section>
      {confirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="allocation-confirm-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="allocation-confirm-title">Xác nhận chia quỹ</h2>
              <small>Tháng {formatMonth(month)}</small>
            </div>
            <p className="muted">
              App sẽ ghi giao dịch vào BTC/CK. Quỹ tiết kiệm và dự phòng sẽ được đánh dấu chỉ tạo sổ ở trang riêng.
            </p>
            {!hasCustomAllocationAmounts && (summary.allocationAmounts.savingRemainder > 0 || summary.allocationAmounts.emergencyRemainder > 0) && (
              <p className="muted">
                Số lẻ sau khi làm tròn bởi số {formatVnd(CERTIFICATE_LOT)} được cộng vào BTC.
              </p>
            )}
            <div className="confirm-summary">
              <div>
                <span>BTC</span>
                <strong>{formatVnd(summary.allocationAmounts.btc)}</strong>
              </div>
              <div>
                <span>CK</span>
                <strong>{formatVnd(summary.allocationAmounts.stock)}</strong>
              </div>
              <div>
                <span>Quỹ tiết kiệm</span>
                <strong>{formatVnd(summary.allocationAmounts.saving)}</strong>
              </div>
              <div>
                <span>dự phòng</span>
                <strong>{formatVnd(summary.allocationAmounts.emergency)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost icon-only" onClick={() => setConfirmOpen(false)} title="Hủy" aria-label="Hủy">
                <X size={17} />
              </button>
              <button className="primary" onClick={confirmAllocation} disabled={percentTotal !== 100 || !amountTotalMatchesSaving || summary.saving <= 0 || monthAlreadyConfirmed}>
                <CheckCircle2 size={17} /> Đồng ý chia quỹ
              </button>
            </div>
          </section>
        </div>
      )}
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền thu chi"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </div>
  );
}

function nextDepositCode(deposits: BankDeposit[], fund: DepositFund) {
  const prefix = fund === "saving" ? "TK" : fund === "emergency" ? "DP" : "TL";
  const max = deposits
    .filter((deposit) => deposit.fund === fund && deposit.code.startsWith(`${prefix}-`))
    .map((deposit) => Number(deposit.code.replace(`${prefix}-`, "")))
    .filter(Number.isFinite)
    .reduce((highest, value) => Math.max(highest, value), 0);
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}

function makeDeposit(
  existingDeposits: BankDeposit[],
  fund: DepositFund,
  product: DepositProduct,
  amount: number,
  certificatePurchaseAmount: number,
  certificateMaturityValue: number,
  rate: number,
  termMonths: number,
  startDate: string,
  maturityDate: string,
  month: string,
  note: string,
  parentId: string,
  createdFromSolWithdrawalId: string,
  accumulationGoalId: string
): BankDeposit {
  const id = uid();
  return {
    id,
    code: nextDepositCode(existingDeposits, fund),
    fund,
    product,
    accumulationGoalId,
    mbLast4: "",
    principal: Math.round(amount),
    certificatePurchaseAmount: product === "certificate" && certificatePurchaseAmount ? Math.round(certificatePurchaseAmount) : undefined,
    certificateMaturityValue: product === "certificate" && certificateMaturityValue ? Math.round(certificateMaturityValue) : undefined,
    rate,
    termMonths,
    startDate,
    maturityDate,
    status: "active",
    parentId,
    createdFromMonth: month,
    createdFromSolWithdrawalId,
    note,
  };
}

const btcTransferDestinationLabel = (destination: BtcTransferTarget) => {
  const labels: Record<BtcTransferTarget, string> = {
    btc: "BTC",
    usdt: "USDT",
    stock: "CK",
    saving: "Tiết kiệm",
    emergency: "Dự phòng",
    cash: "Tiền mặt",
  };
  return labels[destination];
};

function BtcPage({
  state,
  setState,
  commitWithUndo,
  onRefreshMarket,
  marketStatus,
  btcCloudAccountId,
  actionIntent,
  onActionHandled,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  marketStatus: string;
  btcCloudAccountId: string;
  actionIntent?: InvestmentActionIntent | null;
  onActionHandled: () => void;
  embedded: boolean;
}) {
  const stats = btcPortfolioStats(state);
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const [topupForm, setTopupForm] = useState({ vnd: "", usdt: "", date: today(), note: "" });
  const [planForm, setPlanForm] = useState({
    amountUsdt: "2",
    frequency: "daily" as BtcDcaFrequency,
    time: "12:00",
    startDate: today(),
    note: "",
  });
  const [legacyDcaForm, setLegacyDcaForm] = useState({
    amountUsdt: "2",
    frequency: "daily" as BtcDcaFrequency,
    time: "12:00",
    startDate: "2026-07-13",
    nextDate: "2026-07-30",
    activeRuns: "14",
    btcAmount: "0,00043251",
    latestPriceUsdt: "64.337,674905",
    averagePriceUsdt: "64.565,25594748",
    note: "DCA Binance",
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({
    asset: "btc" as "btc" | "usdt",
    btc: "",
    usdt: "",
    price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "",
    vnd: "",
    destination: "usdt" as BtcTransferTarget,
    date: today(),
    note: "",
  });
  const [btcError, setBtcError] = useState("");
  const [expandedDcaPlanIds, setExpandedDcaPlanIds] = useState<string[]>([]);
  const [historyDcaPlanIds, setHistoryDcaPlanIds] = useState<string[]>([]);
  const [editingDcaAssetPlanId, setEditingDcaAssetPlanId] = useState<string | null>(null);
  const [dcaAssetForm, setDcaAssetForm] = useState({ btcAmount: "", averagePriceUsdt: "" });
  const [topupFormOpen, setTopupFormOpen] = useState(false);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [legacyDcaFormOpen, setLegacyDcaFormOpen] = useState(false);
  const [transferFormOpen, setTransferFormOpen] = useState(false);

  function transferPriceFor(asset: "btc" | "usdt", destination: BtcTransferTarget) {
    if (asset === "usdt" && destination !== "btc") return state.market.usdtVnd || state.market.usdVnd;
    return state.market.btcUsdt;
  }

  const estimateUsdtFromVnd = (vndInput: string) => {
    const vndAmount = parseMoney(vndInput);
    const rate = state.market.usdtVnd || state.market.usdVnd;
    return vndAmount && rate ? formatDecimalNumberInput(vndAmount / rate, 3) : "";
  };

  const updateTopupVnd = (value: string) => {
    const vnd = formatMoneyInput(value);
    setTopupForm((prev) => ({ ...prev, vnd, usdt: vnd ? estimateUsdtFromVnd(vnd) || prev.usdt : "" }));
  };

  useEffect(() => {
    const price = transferPriceFor(transferForm.asset, transferForm.destination);
    if (!price) return;
    setTransferForm((prev) => ({ ...prev, price: formatDecimalInput(String(price)) }));
  }, [state.market.btcUsdt, state.market.usdtVnd, state.market.usdVnd, transferForm.asset, transferForm.destination]);

  useEffect(() => {
    if (!actionIntent || actionIntent.tab !== "crypto" || actionIntent.action !== "btc-topup") return;
    setTopupFormOpen(true);
    onActionHandled?.();
  }, [actionIntent?.id]);

  useEffect(() => {
    if (!topupFormOpen || !topupForm.vnd || topupForm.usdt) return;
    const estimatedUsdt = estimateUsdtFromVnd(topupForm.vnd);
    if (estimatedUsdt) setTopupForm((prev) => ({ ...prev, usdt: estimatedUsdt }));
  }, [state.market.usdtVnd, state.market.usdVnd, topupFormOpen]);

  const syncBtcRow = (table: string, id: string, payload: unknown, columns: Record<string, unknown> = {}) => {
    if (!btcCloudAccountId) return;
    void upsertCloudPayloadRow(table, btcCloudAccountId, id, payload, columns).catch(() => {
      // Local state remains the offline cache when cloud sync is unavailable.
    });
  };

  const saveTopup = () => {
    const vndAmount = parseMoney(topupForm.vnd);
    const usdtAmount = parseDecimal(topupForm.usdt);
    if (!vndAmount || !usdtAmount) {
      setBtcError("Nhập VND và USDT thực nhận hợp lệ.");
      return;
    }
    if (vndAmount > stats.pendingVnd) {
      setBtcError("Số VND mua USDT đang lớn hơn vốn BTC chưa đổi.");
      return;
    }
    const topup: BtcUsdtTopup = { id: uid(), vndAmount, usdtAmount, date: topupForm.date, occurredAt: occurredAtForDate(topupForm.date), note: topupForm.note.trim() };
    commitWithUndo("Đã thêm mua USDT.", (prev) => ({ ...prev, btcUsdtTopups: [...prev.btcUsdtTopups, topup] }));
    syncBtcRow("btc_usdt_topups", topup.id, topup);
    setTopupForm({ vnd: "", usdt: "", date: today(), note: "" });
    setTopupFormOpen(false);
    setBtcError("");
  };

  const savePlan = () => {
    const amountUsdt = parseDecimal(planForm.amountUsdt);
    if (!amountUsdt) {
      setBtcError("Nhập số USDT mỗi kỳ hợp lệ.");
      return;
    }
    const existingPlan = state.btcDcaPlans.find((item) => item.id === editingPlanId);
    const plan: BtcDcaPlan = normalizeDcaPlan({
      id: editingPlanId ?? uid(),
      amountUsdt,
      frequency: planForm.frequency,
      time: planForm.time,
      startDate: planForm.startDate,
      nextRunAt: nextDcaRunAt(planForm),
      isActive: true,
      status: "active",
      btcAmountOverride: existingPlan?.btcAmountOverride,
      averagePriceUsdtOverride: existingPlan?.averagePriceUsdtOverride,
      note: planForm.note.trim(),
    });
    commitWithUndo(editingPlanId ? "Đã sửa kế hoạch DCA." : "Đã tạo kế hoạch DCA.", (prev) => ({
      ...prev,
      btcDcaPlans: editingPlanId ? prev.btcDcaPlans.map((item) => (item.id === editingPlanId ? plan : item)) : [...prev.btcDcaPlans, plan],
    }));
    syncBtcRow("btc_dca_plans", plan.id, plan, { is_active: plan.isActive, next_run_at: plan.nextRunAt, status: plan.status });
    setPlanForm({ amountUsdt: "2", frequency: "daily", time: "12:00", startDate: today(), note: "" });
    setEditingPlanId(null);
    setPlanFormOpen(false);
    setBtcError("");
  };

  const saveLegacyDca = () => {
    const amountUsdt = parseDecimal(legacyDcaForm.amountUsdt);
    const activeRuns = Math.floor(parseDecimal(legacyDcaForm.activeRuns));
    const btcAmount = parseDecimal(legacyDcaForm.btcAmount);
    const latestPriceUsdt = parseDecimal(legacyDcaForm.latestPriceUsdt);
    const averagePriceUsdt = parseDecimal(legacyDcaForm.averagePriceUsdt);
    if (!amountUsdt || !activeRuns || !btcAmount || !latestPriceUsdt || !averagePriceUsdt || !legacyDcaForm.nextDate) {
      setBtcError("Nhập đủ số kỳ, BTC tích lũy, giá gần nhất và giá trung bình.");
      return;
    }

    const totalInvestedUsdt = amountUsdt * activeRuns;
    if (totalInvestedUsdt - stats.usdtBalance > 0.000001) {
      setBtcError(`Số dư USDT không đủ để import DCA này. Cần khoảng ${formatUsdt(totalInvestedUsdt)}, hiện có ${formatUsdt(stats.usdtBalance)}.`);
      return;
    }

    const planId = uid();
    const plan: BtcDcaPlan = normalizeDcaPlan({
      id: planId,
      amountUsdt,
      frequency: legacyDcaForm.frequency,
      time: legacyDcaForm.time,
      startDate: legacyDcaForm.startDate,
      nextRunAt: localDateTimeIso(legacyDcaForm.nextDate, legacyDcaForm.time),
      isActive: true,
      status: "active",
      btcAmountOverride: btcAmount,
      averagePriceUsdtOverride: averagePriceUsdt,
      note: legacyDcaForm.note.trim(),
    });

    const totalNote = legacyDcaForm.note.trim() || "Import DCA Binance";
    const perRunUsdt = amountUsdt;
    let trades: BtcTrade[];
    if (activeRuns === 1) {
      trades = [{
        id: uid(),
        type: "dca",
        usdtAmount: totalInvestedUsdt,
        btcAmount,
        btcPriceUsdt: averagePriceUsdt,
        executedAt: localDateTimeIso(legacyDcaForm.startDate, legacyDcaForm.time),
        planId,
        note: totalNote,
      }];
    } else {
      const latestBtc = perRunUsdt / latestPriceUsdt;
      const remainingBtc = btcAmount - latestBtc;
      const remainingUsdt = perRunUsdt * (activeRuns - 1);
      const previousPriceUsdt = remainingBtc > 0 ? remainingUsdt / remainingBtc : 0;
      if (!previousPriceUsdt) {
        setBtcError("Dữ liệu giá không hợp lệ để tạo lịch sử DCA.");
        return;
      }
      trades = Array.from({ length: activeRuns }, (_, index) => {
        const price = index === activeRuns - 1 ? latestPriceUsdt : previousPriceUsdt;
        const usdtAmount = perRunUsdt;
        return {
          id: uid(),
          type: "dca" as const,
          usdtAmount,
          btcAmount: usdtAmount / price,
          btcPriceUsdt: price,
          executedAt: localDateTimeIso(shiftDcaDate(legacyDcaForm.startDate, legacyDcaForm.frequency, index), legacyDcaForm.time),
          planId,
          note: totalNote,
        };
      });
    }

    commitWithUndo("Đã import DCA cũ.", (prev) => ({
      ...prev,
      btcDcaPlans: [...prev.btcDcaPlans, plan],
      btcTrades: [...prev.btcTrades, ...trades],
    }));
    syncBtcRow("btc_dca_plans", plan.id, plan, { is_active: plan.isActive, next_run_at: plan.nextRunAt, status: plan.status });
    trades.forEach((trade) => syncBtcRow("btc_trades", trade.id, trade, { executed_at: trade.executedAt, plan_id: plan.id }));
    setExpandedDcaPlanIds((prev) => [...prev, plan.id]);
    setLegacyDcaFormOpen(false);
    setBtcError("");
  };

  const editPlan = (plan: BtcDcaPlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({ amountUsdt: String(plan.amountUsdt), frequency: plan.frequency, time: plan.time, startDate: plan.startDate, note: plan.note });
    setPlanFormOpen(true);
  };

  const togglePlan = (plan: BtcDcaPlan) => {
    const next: BtcDcaPlan = {
      ...plan,
      isActive: !plan.isActive,
      status: !plan.isActive ? "active" : "paused",
      statusNote: !plan.isActive ? "" : "Đã tạm dừng",
      nextRunAt: !plan.isActive ? nextDcaRunAt(plan) : plan.nextRunAt,
    };
    commitWithUndo(next.isActive ? "Đã bật lại DCA." : "Đã tạm dừng DCA.", (prev) => ({ ...prev, btcDcaPlans: prev.btcDcaPlans.map((item) => (item.id === plan.id ? next : item)) }));
    syncBtcRow("btc_dca_plans", next.id, next, { is_active: next.isActive, next_run_at: next.nextRunAt, status: next.status });
  };

  const togglePlanDetails = (planId: string) => {
    setExpandedDcaPlanIds((prev) => (prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]));
  };

  const toggleDcaPlanHistory = (planId: string) => {
    setHistoryDcaPlanIds((prev) => (prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]));
  };

  const editDcaAsset = (plan: BtcDcaPlan) => {
    const planStats = dcaPlanStats(plan);
    setEditingDcaAssetPlanId(plan.id);
    setDcaAssetForm({
      btcAmount: String(planStats.btcAmount || ""),
      averagePriceUsdt: String(planStats.averagePriceUsdt || ""),
    });
    setExpandedDcaPlanIds((prev) => (prev.includes(plan.id) ? prev : [...prev, plan.id]));
  };

  const saveDcaAsset = (plan: BtcDcaPlan) => {
    const btcAmountOverride = parseDecimal(dcaAssetForm.btcAmount);
    const averagePriceUsdtOverride = parseDecimal(dcaAssetForm.averagePriceUsdt);
    if (!btcAmountOverride || !averagePriceUsdtOverride) {
      setBtcError("Nhập BTC tích lũy và giá trung bình hợp lệ.");
      return;
    }
    const next: BtcDcaPlan = {
      ...plan,
      btcAmountOverride,
      averagePriceUsdtOverride,
    };
    commitWithUndo("Đã chọn số BTC DCA.", (prev) => ({ ...prev, btcDcaPlans: prev.btcDcaPlans.map((item) => (item.id === plan.id ? next : item)) }));
    syncBtcRow("btc_dca_plans", next.id, next, { is_active: next.isActive, next_run_at: next.nextRunAt, status: next.status });
    setEditingDcaAssetPlanId(null);
    setDcaAssetForm({ btcAmount: "", averagePriceUsdt: "" });
    setBtcError("");
  };

  const deletePlan = (plan: BtcDcaPlan) => {
    const relatedTrades = state.btcTrades.filter((trade) => trade.type === "dca" && trade.planId === plan.id);
    if (!window.confirm(`Xóa lệnh DCA này? ${relatedTrades.length} giao dịch DCA liên quan sẽ được xóa khỏi BTC và hoàn lại USDT vào số dư.`)) return;
    commitWithUndo(
      "Đã xóa lệnh DCA.",
      (prev) =>
        withTrashItem(
          {
            ...prev,
            btcDcaPlans: prev.btcDcaPlans.filter((item) => item.id !== plan.id),
            btcTrades: prev.btcTrades.filter((trade) => !(trade.type === "dca" && trade.planId === plan.id)),
          },
          makeTrashItem("btc-dca", plan.id, `lệnh DCA ${formatUsdt(plan.amountUsdt)}`, plan, { btcTrades: relatedTrades })
        ),
      { action: "delete", entityType: "btc-dca", entityId: plan.id }
    );
    setExpandedDcaPlanIds((prev) => prev.filter((id) => id !== plan.id));
    setHistoryDcaPlanIds((prev) => prev.filter((id) => id !== plan.id));
    if (editingPlanId === plan.id) {
      setEditingPlanId(null);
      setPlanForm({ amountUsdt: "2", frequency: "daily", time: "12:00", startDate: today(), note: "" });
    }
    if (!btcCloudAccountId) return;
    void deleteCloudPayloadRow("btc_dca_plans", btcCloudAccountId, plan.id).catch(() => {
      // Local deletion still applies; cloud can be reconciled manually if offline.
    });
    relatedTrades.forEach((trade) => {
      void deleteCloudPayloadRow("btc_trades", btcCloudAccountId, trade.id).catch(() => {
        setBtcError("Đã xóa local, nhưng chưa xóa được toàn bộ giao dịch DCA trên cloud.");
      });
    });
  };

  const transferSourceAmount = () =>
    transferForm.asset === "btc" ? parseDecimal(transferForm.btc) : parseDecimal(transferForm.usdt);

  const transferPrice = () => parseDecimal(transferForm.price) || transferPriceFor(transferForm.asset, transferForm.destination);

  const transferReceiveUnit = () => {
    if (transferForm.asset === "usdt" && transferForm.destination === "btc") return "BTC";
    if (transferForm.asset === "btc" && transferForm.destination === "usdt") return "USDT";
    return "VND";
  };

  const transferEstimatedReceive = () => {
    const source = transferSourceAmount();
    const price = transferPrice();
    if (!source || !price) return 0;
    if (transferForm.asset === "usdt" && transferForm.destination === "btc") return source / price;
    if (transferForm.asset === "btc" && transferForm.destination === "usdt") return source * price;
    if (transferForm.asset === "usdt") return source * price;
    return source * price * (state.market.usdtVnd || state.market.usdVnd);
  };

  const formatBtcTransferReceiveInput = (value: number) => formatTransferReceiveInput(value, transferReceiveUnit());

  const syncBtcTransferForm = (next: typeof transferForm) => {
    const source = next.asset === "btc" ? parseDecimal(next.btc) : parseDecimal(next.usdt);
    const price = parseDecimal(next.price) || transferPriceFor(next.asset, next.destination);
    if (!source || !price) return { ...next, vnd: "" };
    let received = 0;
    if (next.asset === "usdt" && next.destination === "btc") received = source / price;
    else if (next.asset === "btc" && next.destination === "usdt") received = source * price;
    else if (next.asset === "usdt") received = source * price;
    else received = source * price * (state.market.usdtVnd || state.market.usdVnd);
    return { ...next, vnd: formatBtcTransferReceiveInput(received) };
  };

  const formatTransferReceive = (value: number) => {
    const unit = transferReceiveUnit();
    if (unit === "BTC") return formatBtc(value);
    if (unit === "USDT") return formatUsdt(value);
    return formatVnd(value);
  };

  const resetTransferForm = () => {
    setTransferForm({
      asset: "btc",
      btc: "",
      usdt: "",
      price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "",
      vnd: "",
      destination: "usdt",
      date: today(),
      note: "",
    });
  };

  const topupUsdtRate = () => {
    const vndAmount = parseMoney(topupForm.vnd);
    const usdtAmount = parseDecimal(topupForm.usdt);
    return vndAmount && usdtAmount ? vndAmount / usdtAmount : 0;
  };

  const saveTransfer = () => {
    const price = transferPrice();
    const sourceAmount = transferSourceAmount();
    const receivedInput = transferReceiveUnit() === "VND" ? parseMoney(transferForm.vnd) : parseDecimal(transferForm.vnd);
    const estimatedReceive = transferEstimatedReceive();
    const received = receivedInput || estimatedReceive;
    if (!sourceAmount || !price || !received) {
      setBtcError("Nhập tài sản, giá và số tiền nhận hợp lệ.");
      return;
    }
    if (transferForm.asset === "btc" && transferForm.destination !== "usdt") {
      setBtcError("BTC chỉ được đổi sang USDT trong quỹ BTC.");
      return;
    }
    if (transferForm.asset === "btc" && sourceAmount - stats.btcBalance > 0.00000001) {
      setBtcError("Số BTC rút lớn hơn số BTC đang có.");
      return;
    }
    if (transferForm.asset === "usdt" && sourceAmount > stats.usdtBalance) {
      setBtcError("Số USDT rút lớn hơn số dư USDT.");
      return;
    }

    if (transferForm.asset === "usdt" && transferForm.destination === "btc") {
      const trade: BtcTrade = {
        id: uid(),
        type: "manual-buy",
        usdtAmount: sourceAmount,
        btcAmount: received,
        btcPriceUsdt: price,
        executedAt: occurredAtForDate(transferForm.date),
        note: transferForm.note.trim() || "Chuyển USDT sang BTC",
      };
      commitWithUndo("Đã chuyển USDT sang BTC.", (prev) => ({ ...prev, btcTrades: [...prev.btcTrades, trade] }));
      syncBtcRow("btc_trades", trade.id, trade, { executed_at: trade.executedAt, plan_id: null });
      resetTransferForm();
      setTransferFormOpen(false);
      setBtcError("");
      return;
    }

    const btcAmount = transferForm.asset === "btc" ? sourceAmount : 0;
    const usdtAmount = transferForm.asset === "btc" ? received : sourceAmount;
    const vndAmount =
      transferForm.destination === "usdt"
        ? Math.round(usdtAmount * (state.market.usdtVnd || state.market.usdVnd))
        : transferReceiveUnit() === "VND"
          ? Math.round(received)
          : Math.round(usdtAmount * (state.market.usdtVnd || state.market.usdVnd));
    const transfer: BtcTransfer = {
      id: uid(),
      asset: transferForm.asset,
      btcAmount,
      usdtAmount,
      btcPriceUsdt: transferForm.asset === "btc" ? price : state.market.btcUsdt,
      vndAmount,
      destination: transferForm.destination,
      date: transferForm.date,
      occurredAt: occurredAtForDate(transferForm.date),
      closesPosition: transferForm.asset === "btc" && closesCryptoPosition(sourceAmount, stats.btcBalance),
      note: transferForm.note.trim(),
    };
    const transferNote =
      transfer.destination === "usdt"
        ? transfer.note
          ? `Chuyển BTC sang USDT · ${transfer.note} [btc-transfer:${transfer.id}]`
          : `Chuyển BTC sang USDT [btc-transfer:${transfer.id}]`
        : transfer.note
          ? `Rút từ BTC · ${transfer.note} [btc-transfer:${transfer.id}]`
          : `Rút từ BTC [btc-transfer:${transfer.id}]`;
    commitWithUndo("Đã lưu rút/chuyển BTC.", (prev) => ({
      ...prev,
      btcTransfers: [...prev.btcTransfers, transfer],
      fundTransactions:
        transfer.destination === "usdt"
          ? prev.fundTransactions
          : [
              ...prev.fundTransactions,
              { id: uid(), fund: "btc", type: "withdraw", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote },
              ...(transfer.destination === "stock"
                ? [{ id: uid(), fund: "stock" as const, type: "deposit" as const, amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote }]
                : []),
            ],
      incomeTransactions:
        transfer.destination === "cash"
          ? [
              ...prev.incomeTransactions,
              { id: uid(), categoryId: "other-income", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote },
            ]
          : prev.incomeTransactions,
    }));
    syncBtcRow("btc_transfers", transfer.id, transfer, { transfer_at: transfer.occurredAt });
    resetTransferForm();
    setTransferFormOpen(false);
    setBtcError("");
  };

  const estimatedTransferReceive = transferEstimatedReceive();
  const fillMaxTransferSource = () => {
    if (transferForm.asset === "btc") {
      setTransferForm((prev) => syncBtcTransferForm({ ...prev, btc: formatDecimalNumberInput(stats.btcBalance, 8) }));
      return;
    }
    setTransferForm((prev) => syncBtcTransferForm({ ...prev, usdt: formatDecimalNumberInput(stats.usdtBalance, 8) }));
  };
  const dcaFrequencyLabel: Record<BtcDcaFrequency, string> = { daily: "Hàng ngày", weekly: "Hàng tuần", monthly: "Hàng tháng" };
  const dcaPlanStats = (plan: BtcDcaPlan) => {
    const trades = state.btcTrades.filter((trade) => trade.type === "dca" && trade.planId === plan.id);
    const investedUsdt = trades.reduce((sum, trade) => sum + trade.usdtAmount, 0);
    const tradeBtcAmount = trades.reduce((sum, trade) => sum + trade.btcAmount, 0);
    const tradeAveragePriceUsdt = tradeBtcAmount ? investedUsdt / tradeBtcAmount : 0;
    const btcAmount = plan.btcAmountOverride && plan.btcAmountOverride > 0 ? plan.btcAmountOverride : tradeBtcAmount;
    const averagePriceUsdt =
      plan.averagePriceUsdtOverride && plan.averagePriceUsdtOverride > 0 ? plan.averagePriceUsdtOverride : tradeAveragePriceUsdt;
    const currentValueUsdt = btcAmount * state.market.btcUsdt;
    const pnlUsdt = currentValueUsdt - investedUsdt;
    const pnlPercent = investedUsdt ? (pnlUsdt / investedUsdt) * 100 : 0;
    const latestTrade = [...trades].sort((a, b) => b.executedAt.localeCompare(a.executedAt))[0];
    const startAt = new Date(`${plan.startDate}T${plan.time}:00`).toISOString();
    const activeDays = trades.length;
    return {
      activeDays,
      averagePriceUsdt,
      btcAmount,
      currentValueUsdt,
      investedUsdt,
      latestPriceUsdt: latestTrade.btcPriceUsdt || 0,
      pnlPercent,
      pnlUsdt,
      startAt,
      tradeCount: trades.length,
    };
  };
  const rows = [
    ...state.btcUsdtTopups.map((item) => ({ kind: "topup" as const, date: item.date, item })),
    ...state.btcTrades.filter((item) => item.type !== "dca").map((item) => ({ kind: "trade" as const, date: dateValueFromDateTime(item.executedAt), item })),
    ...state.btcTransfers.map((item) => ({ kind: "transfer" as const, date: item.date, item })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const deleteBtcHistoryRow = (row: (typeof rows)[number]) => {
    const label = row.kind === "topup" ? "lệnh mua USDT" : row.kind === "trade" ? "lệnh mua BTC" : "lệnh rút/chuyển BTC";
    if (!window.confirm(`Xóa ${label} này? Số dư và lịch sử BTC sẽ được cập nhật lại.`)) return;
    const entityType: AuditEntityType = row.kind === "topup" ? "btc-topup" : row.kind === "trade" ? "btc-trade" : "btc-transfer";
    commitWithUndo(`Đã xóa ${label}.`, (prev) => {
      const relatedPayloads =
        row.kind === "transfer"
          ? {
              fundTransactions: prev.fundTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`)),
              incomeTransactions: prev.incomeTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`)),
            }
          : undefined;
      return withTrashItem(
        {
          ...prev,
          btcUsdtTopups: row.kind === "topup" ? prev.btcUsdtTopups.filter((item) => item.id !== row.item.id) : prev.btcUsdtTopups,
          btcTrades: row.kind === "trade" ? prev.btcTrades.filter((item) => item.id !== row.item.id) : prev.btcTrades,
          btcTransfers: row.kind === "transfer" ? prev.btcTransfers.filter((item) => item.id !== row.item.id) : prev.btcTransfers,
          fundTransactions:
            row.kind === "transfer"
              ? prev.fundTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`))
              : prev.fundTransactions,
          incomeTransactions:
            row.kind === "transfer"
              ? prev.incomeTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`))
              : prev.incomeTransactions,
        },
        makeTrashItem(entityType, row.item.id, label, row.item, relatedPayloads)
      );
    }, { action: "delete", entityType, entityId: row.item.id });
    if (!btcCloudAccountId) return;
    const table = row.kind === "topup" ? "btc_usdt_topups" : row.kind === "trade" ? "btc_trades" : "btc_transfers";
    void deleteCloudPayloadRow(table, btcCloudAccountId, row.item.id).catch(() => {
      setBtcError("Đã xóa local, nhưng chưa xóa được dòng BTC cloud.");
    });
  };

  const content = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">BTC</p>
        </div>
      </header>
      <section className="metrics-grid stock-metrics-grid">
        <MetricCard label="Tổng vốn" value={formatVnd(stats.capitalVnd)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Tổng tài sản BTC" value={formatVnd(stats.totalValueVnd)} icon={<Bitcoin size={20} />} tone="highlight" />
        <MetricCard label="BTC đang giữ" value={formatBtc(stats.btcBalance)} subValue={formatUsdt(stats.btcValueUsdt)} icon={<Coins size={20} />} />
        <MetricCard label="Số dư USDT" value={formatUsdt(stats.usdtBalance)} icon={<CircleDollarSign size={20} />} />
        <MetricCard label="Lãi/lỗ" value={`${formatUsdt(stats.pnlUsdt)} · ${stats.pnlPercent.toFixed(1)}%`} subValue={formatVnd(stats.pnlVnd)} icon={<BarChart3 size={20} />} tone={stats.pnlVnd < 0 ? "loss" : undefined} />
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Giá thị trường</h2>
          <button className="ghost report-refresh-button" onClick={() => onRefreshMarket()} type="button" aria-label="Cập nhật giá"><RefreshCw size={17} /></button>
        </div>
        <small className="market-status">{marketStatus || (state.market.updatedAt ? `Cập nhật ${formatDateTime(state.market.updatedAt)}` : "Chưa cập nhật")}</small>
        <div className="market-grid">
          <div><small>BTC/USDT</small><strong>{state.market.btcUsdt ? formatUsdt(state.market.btcUsdt) : "Đang chờ"}</strong></div>
          <div><small>USDT/VND</small><strong>{state.market.usdtVnd ? formatVnd(state.market.usdtVnd) : "Đang chờ"}</strong></div>
          <div><small>Giá vốn TB</small><strong>{stats.averageCostUsdt ? formatUsdt(stats.averageCostUsdt) : "0 USDT"}</strong></div>
        </div>
      </section>
      <section className="two-column compact btc-action-grid">
        <article className="panel">
          <div className="panel-title">
            <h2>Mua USDT</h2>
            <small>Còn {formatVnd(stats.pendingVnd)} vốn BTC chưa đổi</small>
            {topupFormOpen && <button className="icon-button" onClick={() => setTopupFormOpen(false)} title="Hủy" aria-label="Hủy" type="button"><X size={17} /></button>}
          </div>
          {!topupFormOpen ? (
            <button className="primary asset-open-button action-button-sm" onClick={() => setTopupFormOpen(true)} type="button"><Plus size={16} /> Mua USDT</button>
          ) : (
            <div className="form-grid btc-form-grid">
              <label>VND dùng mua<input value={topupForm.vnd} onChange={(event) => updateTopupVnd(formatMoneyChange(event))} placeholder="1.000.000" /></label>
              <label>USDT thực nhận<input value={topupForm.usdt} onChange={(event) => setTopupForm({ ...topupForm, usdt: formatDecimalChange(event) })} placeholder="39,250" /></label>
              <label>Ngày<input type="date" value={topupForm.date} onChange={(event) => setTopupForm({ ...topupForm, date: event.target.value })} /></label>
              <label>Giá USDT (VND)<input value={topupUsdtRate() ? formatVnd(topupUsdtRate()) : ""} readOnly placeholder="Tự tính" /></label>
              <label>Note<input value={topupForm.note} onChange={(event) => setTopupForm({ ...topupForm, note: event.target.value })} placeholder="Binance P2P" /></label>
              <button className="primary btc-form-submit" onClick={saveTopup} type="button"><Plus size={17} /> Lưu USDT</button>
            </div>
          )}
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>{editingPlanId ? "Sửa DCA" : "Kế hoạch DCA"}</h2>
            {planFormOpen && <button className="icon-button" onClick={() => {
              setPlanFormOpen(false);
              setEditingPlanId(null);
            }} title="Hủy" aria-label="Hủy" type="button"><X size={17} /></button>}
            {legacyDcaFormOpen && <button className="icon-button" onClick={() => setLegacyDcaFormOpen(false)} title="Hủy import" aria-label="Hủy import" type="button"><X size={17} /></button>}
          </div>
          {!planFormOpen && !legacyDcaFormOpen && (
            <div className="btc-form-open-actions">
              <button className="primary asset-open-button action-button-sm" onClick={() => setPlanFormOpen(true)} type="button"><CalendarClock size={16} /> Mở form DCA</button>
              <button className="ghost asset-open-button action-button-sm" onClick={() => setLegacyDcaFormOpen(true)} type="button"><Upload size={16} /> Nhập DCA cũ</button>
            </div>
          )}
          {planFormOpen && (
            <div className="form-grid btc-form-grid">
              <label>USDT mỗi kỳ<input value={planForm.amountUsdt} onChange={(event) => setPlanForm({ ...planForm, amountUsdt: formatDecimalChange(event) })} placeholder="2" /></label>
              <label>Tần suất<select value={planForm.frequency} onChange={(event) => setPlanForm({ ...planForm, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
              <label>Giờ chạy<input type="time" value={planForm.time} onChange={(event) => setPlanForm({ ...planForm, time: event.target.value })} /></label>
              <label>Ngày bắt đầu<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm({ ...planForm, startDate: event.target.value })} /></label>
              <label>Note<input value={planForm.note} onChange={(event) => setPlanForm({ ...planForm, note: event.target.value })} placeholder="DCA Binance" /></label>
              <button className="primary btc-form-submit" onClick={savePlan} type="button"><CalendarClock size={17} /> Lưu kế hoạch</button>
            </div>
          )}
          {legacyDcaFormOpen && (
            <div className="form-grid btc-form-grid">
              <label>USDT mỗi kỳ<input value={legacyDcaForm.amountUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, amountUsdt: formatDecimalChange(event) })} placeholder="2" /></label>
              <label>Tần suất<select value={legacyDcaForm.frequency} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
              <label>Giờ chạy<input type="time" value={legacyDcaForm.time} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, time: event.target.value })} /></label>
              <label>Ngày bắt đầu<input type="date" value={legacyDcaForm.startDate} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, startDate: event.target.value })} /></label>
              <label>Ngày giao dịch tiếp theo<input type="date" value={legacyDcaForm.nextDate} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, nextDate: event.target.value })} /></label>
              <label>Số kỳ đã kích hoạt<input value={legacyDcaForm.activeRuns} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, activeRuns: event.target.value })} placeholder="14" /></label>
              <label>BTC tích lũy<input value={legacyDcaForm.btcAmount} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, btcAmount: formatDecimalChange(event) })} placeholder="0,00043251" /></label>
              <label>Giá gần nhất (USDT)<input value={legacyDcaForm.latestPriceUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, latestPriceUsdt: formatDecimalChange(event) })} placeholder="64.337,674905" /></label>
              <label>Giá trung bình (USDT)<input value={legacyDcaForm.averagePriceUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, averagePriceUsdt: formatDecimalChange(event) })} placeholder="64.565,25594748" /></label>
              <label>Note<input value={legacyDcaForm.note} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, note: event.target.value })} placeholder="DCA Binance" /></label>
              <button className="primary btc-form-submit" onClick={saveLegacyDca} type="button"><Upload size={17} /> Import DCA</button>
            </div>
          )}
        </article>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>Lệnh DCA</h2><small>{state.btcDcaPlans.length} kế hoạch</small></div>
        <div className="btc-plan-list">
          {state.btcDcaPlans.length === 0 ? <p className="muted">Chưa có kế hoạch DCA.</p> : state.btcDcaPlans.map((plan) => {
            const planStats = dcaPlanStats(plan);
            const isExpanded = expandedDcaPlanIds.includes(plan.id);
            const isHistoryOpen = historyDcaPlanIds.includes(plan.id);
            const dcaTrades = state.btcTrades
              .filter((trade) => trade.type === "dca" && trade.planId === plan.id)
              .sort((a, b) => b.executedAt.localeCompare(a.executedAt));
            return (
              <article className="btc-plan-card" key={plan.id}>
                <div className="btc-plan-header">
                  <div>
                    <div className="btc-plan-top-row">
                      <span className={`status-badge btc-plan-status ${plan.isActive ? "success" : "warning"}`}>{plan.isActive ? "Đang chạy" : "Tạm dừng"}</span>
                      <div className="btc-plan-top-actions">
                        <button className={`btc-plan-icon-button ${isHistoryOpen ? "active" : ""}`} onClick={() => toggleDcaPlanHistory(plan.id)} title="Lịch sử DCA" type="button"><History size={15} /></button>
                        <button className="btc-plan-delete-button danger-text" onClick={() => deletePlan(plan)} title="Xóa lệnh DCA" type="button"><X size={16} /></button>
                      </div>
                    </div>
                    <div className="btc-plan-title-row">
                      <h3>BTC Gói định kỳ</h3>
                      <strong className={`btc-plan-pnl ${planStats.pnlUsdt < 0 ? "stock-pnl loss" : "stock-pnl gain"}`}>
                        {formatUsdt(planStats.pnlUsdt)} · {planStats.pnlPercent.toFixed(2)}%
                      </strong>
                    </div>
                  </div>
                  <div className="btc-plan-actions">
                    <button className="ghost" onClick={() => togglePlanDetails(plan.id)} type="button">{isExpanded ? "Ẩn chi tiết" : "Xem chi tiết"}</button>
                    <button className="ghost" onClick={() => editPlan(plan)} type="button"><Pencil size={16} /> Sửa</button>
                    <button className="ghost" onClick={() => togglePlan(plan)} type="button">{plan.isActive ? "Tạm dừng" : "Bật lại"}</button>
                  </div>
                </div>
                <div className="btc-plan-summary">
                  <span>Tần suất <strong>{dcaFrequencyLabel[plan.frequency]}, {plan.time}</strong></span>
                  <span>Số tiền đầu tư <strong>{formatUsdt(plan.amountUsdt)}</strong></span>
                </div>
                {isExpanded && (
                  <>
                    <div className="btc-plan-detail-grid">
                      <span>Số lượng nắm giữ (USDT) <strong>{formatUsdt(planStats.currentValueUsdt)}</strong></span>
                      <span>Thời gian kích hoạt <strong>{planStats.activeDays}</strong></span>
                      <span>Ngày bắt đầu kế hoạch <strong>{formatShortDateTime(planStats.startAt)}</strong></span>
                      <span>Ngày giao dịch tiếp theo <strong>{plan.isActive ? formatShortDateTime(plan.nextRunAt) : "Đã tạm dừng"}</strong></span>
                    </div>
                    <div className="btc-plan-asset">
                      <div className="btc-plan-asset-title">
                        <span className="btc-token-mark"><Bitcoin size={16} /></span>
                        <strong>BTC</strong>
                        <button className="btc-plan-icon-button" onClick={() => editDcaAsset(plan)} title="Sửa số BTC và giá trung bình" type="button"><Pencil size={15} /></button>
                      </div>
                      {editingDcaAssetPlanId === plan.id ? (
                        <div className="form-grid btc-form-grid btc-dca-asset-edit">
                          <label>Số lượng tích lũy<input value={dcaAssetForm.btcAmount} onChange={(event) => setDcaAssetForm({ ...dcaAssetForm, btcAmount: formatDecimalChange(event) })} placeholder="0,00043251" /></label>
                          <label>Giá trung bình (USDT)<input value={dcaAssetForm.averagePriceUsdt} onChange={(event) => setDcaAssetForm({ ...dcaAssetForm, averagePriceUsdt: formatDecimalChange(event) })} placeholder="64.565,25594748" /></label>
                          <button className="primary btc-form-submit" onClick={() => saveDcaAsset(plan)} type="button"><Save size={16} /> Lưu BTC</button>
                          <button className="ghost btc-form-submit" onClick={() => {
                            setEditingDcaAssetPlanId(null);
                            setDcaAssetForm({ btcAmount: "", averagePriceUsdt: "" });
                          }} title="Hủy" aria-label="Hủy" type="button"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="btc-plan-detail-grid">
                          <span>Số lượng tích lũy <strong>{formatBtc(planStats.btcAmount)}</strong></span>
                          <span>Giá gần nhất (USDT) <strong>{planStats.latestPriceUsdt ? formatUsdt(planStats.latestPriceUsdt) : "0 USDT"}</strong></span>
                          <span>Giá trung bình (USDT) <strong>{planStats.averagePriceUsdt ? formatUsdt(planStats.averagePriceUsdt) : "0 USDT"}</strong></span>
                        </div>
                      )}
                    </div>
                    {plan.statusNote && <small className="muted">{plan.statusNote}</small>}
                  </>
                )}
                {isHistoryOpen && (
                  <div className="btc-dca-history">
                    <div className="btc-dca-history-title">
                      <strong>Lịch sử giao dịch DCA</strong>
                      <small>{dcaTrades.length} lệnh</small>
                    </div>
                    {dcaTrades.length === 0 ? (
                      <p className="muted">Chưa có giao dịch DCA nào.</p>
                    ) : (
                      <div className="btc-dca-history-list">
                        {dcaTrades.map((trade) => (
                          <div key={trade.id}>
                            <span><Bitcoin size={14} /></span>
                            <div>
                              <strong>{formatBtc(trade.btcAmount)} · {formatUsdt(trade.usdtAmount)}</strong>
                              <small>{formatShortDateTime(trade.executedAt)} · Giá mua {formatUsdt(trade.btcPriceUsdt)} · {trade.note || "Không ghi chú"}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="two-column compact btc-action-grid">
        <article className="panel">
          <div className="panel-title">
            <h2>Rút / chuyển</h2>
            <small>Ước tính {formatTransferReceive(estimatedTransferReceive)}</small>
            {transferFormOpen && <button className="icon-button" onClick={() => setTransferFormOpen(false)} title="Hủy" aria-label="Hủy" type="button"><X size={17} /></button>}
          </div>
          {!transferFormOpen ? (
            <button className="primary asset-open-button action-button-sm" onClick={() => setTransferFormOpen(true)} type="button"><ArrowDownCircle size={16} /> Rút / chuyển</button>
          ) : (
            <div className="form-grid btc-form-grid">
              <label>Tài sản nguồn<select value={transferForm.asset} onChange={(event) => {
                const asset = event.target.value as "btc" | "usdt";
                const destination: BtcTransferTarget = asset === "btc" ? "usdt" : "btc";
                setTransferForm((prev) => syncBtcTransferForm({ ...prev, asset, destination, price: formatDecimalInput(String(transferPriceFor(asset, destination) || "")), btc: "", usdt: "" }));
              }}><option value="btc">BTC</option><option value="usdt">USDT</option></select></label>
              {transferForm.asset === "btc" ? (
                <label>Số BTC<InputWithMax value={transferForm.btc} onChange={(event) => setTransferForm((prev) => syncBtcTransferForm({ ...prev, btc: formatDecimalChange(event) }))} onMax={fillMaxTransferSource} placeholder="0,0001" /></label>
              ) : (
                <label>Số USDT<InputWithMax value={transferForm.usdt} onChange={(event) => setTransferForm((prev) => syncBtcTransferForm({ ...prev, usdt: formatDecimalChange(event) }))} onMax={fillMaxTransferSource} placeholder="10" /></label>
              )}
              <label>{transferForm.asset === "usdt" && transferForm.destination !== "btc" ? "Giá USDT/VND" : "Giá BTC/USDT"}<input value={transferForm.price} onChange={(event) => setTransferForm((prev) => syncBtcTransferForm({ ...prev, price: formatDecimalChange(event) }))} placeholder={formatDecimalInput(String(transferPriceFor(transferForm.asset, transferForm.destination) || 0))} /></label>
              <label>Số tiền nhận<input value={transferForm.vnd || formatBtcTransferReceiveInput(transferEstimatedReceive())} onChange={(event) => setTransferForm({ ...transferForm, vnd: transferReceiveUnit() === "VND" ? formatMoneyChange(event) : formatDecimalChange(event) })} placeholder={formatTransferReceive(transferEstimatedReceive())} /></label>
              <label>Nơi nhận<select value={transferForm.destination} disabled={transferForm.asset === "btc"} onChange={(event) => {
                const destination = event.target.value as BtcTransferTarget;
                setTransferForm((prev) => syncBtcTransferForm({ ...prev, destination, price: formatDecimalInput(String(transferPriceFor(prev.asset, destination) || "")), vnd: "" }));
              }}>
                {transferForm.asset === "btc" ? <option value="usdt">USDT</option> : <option value="btc">BTC</option>}
                {transferForm.asset === "usdt" && <>
                  <option value="stock">CK</option>
                  <option value="saving">Tiết kiệm</option>
                  <option value="emergency">dự phòng</option>
                  <option value="cash">Tiền mặt</option>
                </>}
              </select></label>
              <label>Ngày<input type="date" value={transferForm.date} onChange={(event) => setTransferForm({ ...transferForm, date: event.target.value })} /></label>
              <label>Note<input value={transferForm.note} onChange={(event) => setTransferForm({ ...transferForm, note: event.target.value })} placeholder="Chuyển quỹ" /></label>
              <button className="primary btc-form-submit" onClick={saveTransfer} type="button"><ArrowDownCircle size={17} /> Lưu giao dịch</button>
            </div>
          )}
        </article>
      </section>
      {btcError && <span className="form-error">{btcError}</span>}
      <section className="panel">
        <div className="panel-title"><h2>Lịch sử BTC</h2><small>{rows.length} giao dịch</small></div>
        <div className="timeline history-five-list">
          {rows.map((row) => (
            <div key={`${row.kind}-${row.item.id}`}>
              <span className={row.kind === "transfer" ? "withdraw" : "deposit"}>{row.kind === "transfer" ? "-" : "+"}</span>
              <div className="timeline-row-content">
                <div>
                  {row.kind === "topup" && <><strong>{formatUsdt(row.item.usdtAmount)} · {formatVnd(row.item.vndAmount)}</strong><small>{formatDate(row.item.date)} · Giá USDT {row.item.usdtAmount ? formatVnd(row.item.vndAmount / row.item.usdtAmount) : "0d"} · Mua USDT · {row.item.note || "Không ghi chú"}</small></>}
                  {row.kind === "trade" && <><strong>{formatBtc(row.item.btcAmount)} · {formatUsdt(row.item.usdtAmount)}</strong><small>{formatDate(dateValueFromDateTime(row.item.executedAt))} · {row.item.type === "dca" ? "DCA" : "Mua thêm"} @ {formatUsdt(row.item.btcPriceUsdt)} · {row.item.note || "Không ghi chú"}</small></>}
                  {row.kind === "transfer" && <><strong>{row.item.destination === "usdt" ? formatUsdt(row.item.usdtAmount) : formatVnd(row.item.vndAmount)}</strong><small>{formatDate(row.item.date)} · {row.item.destination === "usdt" ? "Chuyển" : "Rút"} {row.item.asset.toUpperCase()} ví {btcTransferDestinationLabel(row.item.destination)} · {row.item.note || "Không ghi chú"}</small></>}
                </div>
                <button className="row-icon-button history-delete-button danger-text timeline-delete-button" onClick={() => deleteBtcHistoryRow(row)} title="Xóa lịch sử" type="button">
                  <X size={15} />
                </button>
                <button
                  className="row-icon-button timeline-delete-button"
                  onClick={() => setTraceEventIds([row.item.meta?.eventId ?? stableEventId(row.kind === "topup" ? "btc-topup" : row.kind === "trade" ? "btc-trade" : "btc-transfer", row.item.id)])}
                  title="Xem nguồn tiền"
                  type="button"
                >
                  <History size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền BTC"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function FundPage({
  state,
  setState,
  fund,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  fund: FundKey;
  embedded: boolean;
}) {
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const label = fund === "btc" ? "BTC" : "CK";
  const rows = state.fundTransactions.filter((item) => item.fund === fund);
  const balance = rows.reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);

  const withdraw = () => {
    const value = parseMoney(amount);
    if (!value) return;
    setState((prev) => ({
      ...prev,
      fundTransactions: [
        ...prev.fundTransactions,
        { id: uid(), fund, type: "withdraw", amount: value, date: today(), month: currentMonth(), note },
      ],
    }));
    setAmount("");
    setNote("");
  };

  const content = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Quỹ {label}</p>
        </div>
      </header>
      <section className="metrics-grid single">
        <MetricCard label={`Tổng quỹ ${label}`} value={formatVnd(balance)} icon={fund === "btc" ? <Bitcoin size={20} /> : <LineChart size={20} />} tone="highlight" />
      </section>
      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Rút tiền</h2>
            <small>Chỉ ghi lịch sử</small>
          </div>
          <div className="form-grid">
            <label>
              Số tiền
              <input value={amount} onChange={(event) => setAmount(formatMoneyChange(event))} placeholder="5.000.000" />
            </label>
            <label>
              Lý do
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mua laptop..." />
            </label>
          </div>
          <button className="primary" onClick={withdraw}>
            <ArrowDownCircle size={17} /> Rút khỏi quỹ
          </button>
        </article>
        <HistoryPanel rows={rows} onTrace={(item) => setTraceEventIds([item.meta?.eventId ?? stableEventId("fund-transaction", item.id)])} />
      </section>
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title={`Nguồn tiền quỹ ${label}`}
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function StockPage({
  state,
  setState,
  commitWithUndo,
  actionIntent,
  onActionHandled,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  actionIntent?: InvestmentActionIntent | null;
  onActionHandled: () => void;
  embedded: boolean;
}) {
  const stats = stockPortfolioStats(state);
  const saleHistoryRows = stockSaleHistoryRows(state);
  const saleHistoryById = new Map(saleHistoryRows.map((sale) => [sale.id, sale]));
  const stockAdjustmentHistoryRows = [
    ...state.adjustmentTransactions
      .filter((adjustment) => isStockCashAdjustment(adjustment) || isStockTotalAssetAdjustment(adjustment))
      .reduce((groups, adjustment) => {
        const key = adjustment.reconciliationSessionId || adjustment.id;
        const current = groups.get(key) ?? {
          id: key,
          date: adjustment.date,
          createdAt: adjustment.createdAt,
          order: groups.size,
          adjustments: [] as AdjustmentTransaction[],
        };
        current.date = adjustment.date > current.date ? adjustment.date : current.date;
        current.createdAt = adjustment.createdAt > current.createdAt ? adjustment.createdAt : current.createdAt;
        current.adjustments.push(adjustment);
        groups.set(key, current);
        return groups;
      }, new Map<string, { id: string; date: string; createdAt: string; order: number; adjustments: AdjustmentTransaction[] }>())
      .values(),
  ];
  const stockHistoryRows = [
    ...state.stockPurchases.map((purchase, index) => ({
      kind: "purchase" as const,
      id: `purchase-${purchase.id}`,
      date: purchase.date,
      createdAt: purchase.createdAt,
      order: index,
      purchase,
    })),
    ...state.stockSales.map((sale, index) => ({
      kind: "sale" as const,
      id: `sale-${sale.id}`,
      date: sale.date,
      createdAt: sale.createdAt,
      order: index,
      sale,
      saleStats: saleHistoryById.get(sale.id),
    })),
    ...stockAdjustmentHistoryRows.map((adjustmentGroup, index) => ({
        kind: "adjustment" as const,
        id: `adjustment-${adjustmentGroup.id}`,
        date: adjustmentGroup.date,
        createdAt: adjustmentGroup.createdAt,
        order: index,
        adjustmentGroup,
      })),
  ].sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    if (dateOrder) return dateOrder;
    const leftTime = new Date(left.createdAt ?? `${left.date}T00:00:00`).getTime();
    const rightTime = new Date(right.createdAt ?? `${right.date}T00:00:00`).getTime();
    if (leftTime !== rightTime) return rightTime - leftTime;
    return right.order - left.order;
  });
  const stockSymbolColor = (symbol: string) => {
    const normalized = symbol.toUpperCase();
    if (normalized === "MBB") return "#f97316";
    if (normalized === "ACB") return "#38bdf8";
    const palette = ["#22c55e", "#a78bfa", "#f43f5e", "#facc15", "#14b8a6", "#fb7185", "#60a5fa"];
    const sortedSymbols = [...new Set(stats.holdings.map((holding) => holding.symbol.toUpperCase()))]
      .filter((item) => item !== "MBB" && item !== "ACB")
      .sort((left, right) => left.localeCompare(right, "vi"));
    const index = Math.max(sortedSymbols.indexOf(normalized), 0) % palette.length;
    return palette[index];
  };
  const defaultBuyRows = (): StockBuyRow[] => [{ id: uid(), symbol: "", percent: "100", shares: "", buyPrice: "" }];
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [buyRows, setBuyRows] = useState<StockBuyRow[]>(defaultBuyRows);
  const [sellingSymbol, setSellingSymbol] = useState<string | null>(null);
  const [stockCashWithdrawOpen, setStockCashWithdrawOpen] = useState(false);
  const [stockCashWithdrawForm, setStockCashWithdrawForm] = useState({
    amount: "",
    destination: "btc" as StockCashWithdrawDestination,
    date: today(),
    note: "",
  });
  const [saleForm, setSaleForm] = useState({
    shares: "",
    price: "",
    fee: "",
    netVnd: "",
    destination: "stock" as SolDestination,
    date: today(),
    note: "",
  });
  const [stockSuggestions, setStockSuggestions] = useState<Record<string, StockLookupSuggestion[]>>({});
  const [activeSuggestionRow, setActiveSuggestionRow] = useState<string | null>(null);
  const [stockError, setStockError] = useState("");
  const [refreshStatus, setRefreshStatus] = useState("");
  const [activePlanLink, setActivePlanLink] = useState<PlanActionLink | null>(null);
  const [stockCashAdjustmentOpen, setStockCashAdjustmentOpen] = useState(false);
  const [stockCashAdjustmentForm, setStockCashAdjustmentForm] = useState({ cash: "", total: "", date: today() });
  const [stockCashAdjustmentError, setStockCashAdjustmentError] = useState("");
  const [corporateFormOpen, setCorporateFormOpen] = useState(false);
  const [corporateForm, setCorporateForm] = useState({
    symbol: "",
    newSymbol: "",
    type: "cash_dividend" as CorporateAction["type"],
    exDate: today(),
    recordDate: today(),
    receiveDate: today(),
    ratioFrom: "100",
    ratioTo: "10",
    cashDividendPercent: "10",
    cashPerShare: "",
    subscriptionPrice: "10",
    taxRate: "5",
    eligibleShares: "",
    resultingShares: "",
    cashReceived: "",
  });
const marketPriceForBuyRow = (row: StockBuyRow) =>
  stockMarketPrice(state, row.symbol)?.price ?? 0;

const effectiveBuyPrice = (row: StockBuyRow) =>
  parseDecimal(row.buyPrice) || marketPriceForBuyRow(row);
  const plannedGrossValue = buyRows.reduce((sum, row) => sum + stockLineValue({ shares: Number(row.shares) || 0, buyPrice: effectiveBuyPrice(row) }), 0);
  const plannedFeeAmount = estimateStockBuyFee(plannedGrossValue);
  const plannedValue = plannedGrossValue + plannedFeeAmount;
  const saleVndAmount = Math.round((Number(saleForm.shares) || 0) * parseDecimal(saleForm.price) * STOCK_PRICE_UNIT);
  const saleFeeAmount = saleForm.fee ? parseMoney(saleForm.fee) : estimateStockSaleFee(saleVndAmount, Number(saleForm.shares) || 0);
  const saleNetVndAmount = saleForm.netVnd ? parseMoney(saleForm.netVnd) : Math.max(saleVndAmount - saleFeeAmount, 0);
  const stockCashWithdrawAmount = parseMoney(stockCashWithdrawForm.amount);
  const stockCashWithdrawDepositAmount =
    stockCashWithdrawForm.destination === "saving" || stockCashWithdrawForm.destination === "emergency"
      ? Math.floor(stockCashWithdrawAmount / 100_000) * 100_000
      : stockCashWithdrawAmount;
  const stockCashWithdrawRemainder =
    stockCashWithdrawForm.destination === "saving" || stockCashWithdrawForm.destination === "emergency"
      ? Math.max(stockCashWithdrawAmount - stockCashWithdrawDepositAmount, 0)
      : 0;
  const selectedSaleHolding = stats.holdings.find((item) => item.symbol === sellingSymbol) ?? null;
  const latestStockAllocationNotice = [...state.fundTransactions]
    .reverse()
    .find(
      (transaction) =>
        transaction.fund === "stock" &&
        transaction.type === "deposit" &&
        transaction.note === "Chia quỹ cuối tháng" &&
        !state.settings.dismissedStockAllocationIds.includes(transaction.id)
    );
  const latestStockPriceUpdatedAt = stats.holdings
    .map((holding) => holding.updatedAt)
    .filter(Boolean)
    .sort()
    .slice(-1)[0];
  const stockRefreshTimeLabel = latestStockPriceUpdatedAt
    ? new Date(latestStockPriceUpdatedAt).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
  const stockHeaderStatusLabel = refreshStatus === "Đang cập nhật giá..." ? "Đang cập nhật..." : stockRefreshTimeLabel;
  const corporateActionLabels: Partial<Record<CorporateAction["type"], string>> = {
    cash_dividend: "Cổ tức tiền mặt",
    stock_dividend: "Cổ tức cổ phiếu",
    rights_issue: "Quyền mua",
  };
  const corporateActionLabel = (type: CorporateAction["type"]) => corporateActionLabels[type] ?? "Sự kiện cổ";
  const corporateActionOptions: Array<{ id: CorporateAction["type"]; label: string }> = [
    { id: "cash_dividend", label: "Cổ tức tiền mặt" },
    { id: "stock_dividend", label: "Cổ tức cổ phiếu" },
    { id: "rights_issue", label: "Quyền mua" },
  ];
  const appliedCorporateActions = [...state.corporateActions]
    .filter((action) => action.status === "applied")
    .sort((left, right) => (right.appliedAt ?? right.receiveDate ?? "").localeCompare(left.appliedAt ?? left.receiveDate ?? ""));
  const selectedCorporateSymbol = corporateForm.symbol.trim().toUpperCase();
  const selectedCorporateHolding = stats.holdings.find((item) => item.symbol === selectedCorporateSymbol);
  const selectedCorporateEventShares = selectedCorporateSymbol ? stockSharesAtDate(state, selectedCorporateSymbol, corporateForm.receiveDate) : 0;
  const corporateEligibleShares = Number(corporateForm.eligibleShares) || selectedCorporateEventShares || selectedCorporateHolding?.shares || 0;
  const corporateRatioFrom = parseDecimal(corporateForm.ratioFrom) || 1;
  const corporateRatioTo = parseDecimal(corporateForm.ratioTo) || 1;
  const computedCorporateShares = Math.floor((corporateEligibleShares * corporateRatioTo) / corporateRatioFrom);
  const effectiveCorporateShares = Number(corporateForm.resultingShares) || computedCorporateShares;
  const cashDividendPercent = parseDecimal(corporateForm.cashDividendPercent) || 10;
  const effectiveCashPerShare = parseMoney(corporateForm.cashPerShare) || Math.round((cashDividendPercent / 100) * STOCK_PAR_VALUE);
  const cashDividendGross = Math.round(corporateEligibleShares * effectiveCashPerShare);
  const cashDividendTaxRate = parseDecimal(corporateForm.taxRate);
  const cashDividendNet = Math.max(Math.round(cashDividendGross * (1 - cashDividendTaxRate / 100)), 0);
  const effectiveCashDividendResult = parseMoney(corporateForm.cashReceived) || cashDividendNet;
  const rightsIssuePrice = parseDecimal(corporateForm.subscriptionPrice);
  const rightsIssueAmount = Math.round(effectiveCorporateShares * rightsIssuePrice * STOCK_PRICE_UNIT);

  useEffect(() => {
    if (!actionIntent || actionIntent.tab !== "stock" || actionIntent.action !== "stock-purchase") return;
    openPurchasePanel();
    if (actionIntent.planLink) setActivePlanLink(actionIntent.planLink);
    onActionHandled?.();
  }, [actionIntent?.id]);

  const dismissStockAllocationNotice = () => {
    if (!latestStockAllocationNotice) return;
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        dismissedStockAllocationIds: [...new Set([...prev.settings.dismissedStockAllocationIds, latestStockAllocationNotice.id])],
      },
    }));
  };



  const withMarketPrice = (row: StockBuyRow) => {
    if (row.buyPriceTouched || parseDecimal(row.buyPrice)) return row;
    const marketPrice = marketPriceForBuyRow(row);
    return marketPrice ? { ...row, buyPrice: formatStockPrice(marketPrice) } : row;
  };

  const recalculateBuyRows = (rows: StockBuyRow[]) => {
    const pricedRows = rows.map(withMarketPrice);
    const fixedValue = pricedRows
      .filter((row) => row.sharesTouched && Number(row.shares) > 0)
      .reduce((sum, row) => sum + stockPurchaseLineCost({ shares: Number(row.shares) || 0, buyPrice: effectiveBuyPrice(row) }), 0);
    const autoRows = pricedRows.filter((row) => !row.sharesTouched);
    const autoPercentTotal = autoRows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
    const remainingCash = Math.max(stats.cash - fixedValue, 0);

    return pricedRows.map((row) => {
      if (row.sharesTouched) return row;
      const price = effectiveBuyPrice(row);
      const budget =
        autoRows.length === 1
          ? remainingCash
          : autoPercentTotal
            ? (remainingCash * (Number(row.percent) || 0)) / autoPercentTotal
            : 0;
      return { ...row, shares: stockSharesForBudget(budget, price) };
    });
  };

  const fetchPrice = fetchStockQuote;

  const extractStockSuggestions = (payload: unknown, fallbackSymbol: string) => {
    const root = payload as { data?: unknown; symbol?: string; code?: string; ticker?: string; companyName?: string; shortName?: string; floor?: string; exchange?: string };
    const rows = Array.isArray(root.data) ? root.data : Array.isArray(payload) ? payload : root.data ? [root.data] : [root];
    const suggestions: StockLookupSuggestion[] = [];
    rows.forEach((row) => {
      const item = row as Record<string, unknown>;
      const symbol = String(item.symbol ?? item.code ?? item.ticker ?? item.stockCode ?? fallbackSymbol).toUpperCase();
      const name = String(item.companyName ?? item.shortName ?? item.organName ?? item.name ?? item.companyNameEng ?? "");
      const exchange = String(item.floor ?? item.exchange ?? item.floorCode ?? "");
      if (!symbol || symbol === "UNDEFINED") return;
      suggestions.push({ symbol, name: name || symbol, exchange: exchange || undefined, source: "VNDIRECT" });
    });
    return suggestions;
  };

  const fetchStockSuggestions = async (query: string) => {
    const normalized = query.trim().toUpperCase();
    if (normalized.length < 2) return [];
    const urls = [
      `https://finfo-api.vndirect.com.vn/v4/stocks?q=code:${encodeURIComponent(normalized)}&size=8&page=1`,
      `https://finfo-api.vndirect.com.vn/stocks?symbol=${encodeURIComponent(normalized)}`,
    ];
    const settled = await Promise.allSettled(
      urls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Không lấy được thông tin cổ phiếu");
        return response.json();
      })
    );
    const baseSuggestions = settled
      .flatMap((result) => (result.status === "fulfilled" ? extractStockSuggestions(result.value, normalized) : []))
      .filter((item, index, rows) => rows.findIndex((row) => row.symbol === item.symbol) === index)
      .slice(0, 6);
    const pricedSuggestions = await Promise.all(
      baseSuggestions.map(async (item) => {
        try {
          const quote = await fetchPrice(item.symbol);
          return { ...item, price: quote.price, source: quote.source };
        } catch {
          return item;
        }
      })
    );
    return pricedSuggestions;
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      buyRows.forEach((row) => {
        const query = row.symbol.trim();
        if (query.length < 2) {
          setStockSuggestions((prev) => ({ ...prev, [row.id]: [] }));
          return;
        }
        fetchStockSuggestions(query)
          .then((suggestions) => {
            if (controller.signal.aborted) return;
            setStockSuggestions((prev) => ({ ...prev, [row.id]: suggestions }));
            const exact = suggestions.find((suggestion) => suggestion.symbol === query.toUpperCase() && suggestion.price);
            if (!exact) return;
            if (!exact.price) return;
            setState((prev) => ({
              ...prev,
              stockMarketPrices: [
                ...prev.stockMarketPrices.filter((item) => item.symbol !== exact.symbol),
                { symbol: exact.symbol, price: exact.price ?? 0, updatedAt: new Date().toISOString(), source: exact.source },
              ],
            }));
            setBuyRows((prev) =>
              recalculateBuyRows(prev.map((item) =>
                item.id === row.id && !item.buyPriceTouched
                  ? { ...item, symbol: exact.symbol, buyPrice: formatStockPrice(exact.price ?? 0) }
                  : item
              ))
            );
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            setStockSuggestions((prev) => ({ ...prev, [row.id]: [] }));
          });
      });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [buyRows.map((row) => `${row.id}:${row.symbol}`).join("|")]);

  useEffect(() => {
    if (!purchaseFormOpen) return;
    setBuyRows((prev) => recalculateBuyRows(prev));
  }, [purchaseFormOpen, state.stockMarketPrices, stats.cash]);

  const updateBuyRow = (id: string, patch: Partial<Omit<StockBuyRow, "id">>) => {
    setBuyRows((prev) =>
      recalculateBuyRows(prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, ...patch };
      }))
    );
  };

  const updateBuyPercent = (id: string, value: string) => {
    const nextPercent = Math.max(Math.min(Number(value) || 0, 100), 0);
    setBuyRows((prev) => {
      const others = prev.filter((row) => row.id !== id);
      if (others.length === 0) {
        return recalculateBuyRows(prev.map((row) => (row.id === id ? { ...row, percent: String(nextPercent) } : row)));
      }
      const remaining = Math.max(100 - nextPercent, 0);
      const otherCurrentTotal = others.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      let assigned = 0;
      return recalculateBuyRows(prev.map((row) => {
        if (row.id === id) return { ...row, percent: String(nextPercent) };
        const isLastOther = others[others.length - 1].id === row.id;
        const percent = isLastOther
          ? remaining - assigned
          : Math.round((otherCurrentTotal ? ((Number(row.percent) || 0) / otherCurrentTotal) * remaining : remaining / others.length) * 100) / 100;
        assigned += percent;
        return { ...row, percent: String(Math.max(percent, 0)) };
      }));
    });
  };

  const selectSuggestion = (rowId: string, suggestion: StockLookupSuggestion) => {
    updateBuyRow(rowId, {
      symbol: suggestion.symbol,
      buyPrice: suggestion.price ? formatStockPrice(suggestion.price) : "",
      buyPriceTouched: false,
    });
    if (suggestion.price) {
      setState((prev) => ({
        ...prev,
        stockMarketPrices: [
          ...prev.stockMarketPrices.filter((item) => item.symbol !== suggestion.symbol),
          { symbol: suggestion.symbol, price: suggestion.price ?? 0, updatedAt: new Date().toISOString(), source: suggestion.source },
        ],
      }));
    }
    setActiveSuggestionRow(null);
    setStockSuggestions((prev) => ({ ...prev, [rowId]: [] }));
  };

  const addBuyRow = () => {
    setBuyRows((prev) => {
      if (prev.length === 1) {
        const firstPercent = prev[0].percent === "100" ? "50" : prev[0].percent;
        return recalculateBuyRows([
          { ...prev[0], percent: firstPercent },
          { id: uid(), symbol: "", percent: String(Math.max(100 - (Number(firstPercent) || 0), 0)), shares: "", buyPrice: "" },
        ]);
      }
      return recalculateBuyRows([...prev, { id: uid(), symbol: "", percent: "0", shares: "", buyPrice: "" }]);
    });
  };

  const removeBuyRow = (id: string) => {
    setBuyRows((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((row) => row.id !== id);
      if (next.length === 1) return recalculateBuyRows([{ ...next[0], percent: "100" }]);
      const total = next.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      if (!total) return next;
      let assigned = 0;
      return recalculateBuyRows(next.map((row, index) => {
        const percent = index === next.length - 1 ? 100 - assigned : Math.round(((Number(row.percent) || 0) / total) * 10000) / 100;
        assigned += percent;
        return { ...row, percent: String(Math.max(percent, 0)) };
      }));
    });
  };

  const fillMaxBuyRow = async (id: string) => {
    const row = buyRows.find((item) => item.id === id);
    if (!row) {
      setStockError("Không tìm thấy dòng cổ phiếu.");
      return;
    }
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) {
      setStockError("Nhập mã cổ phiếu trước khi dùng Max.");
      return;
    }

    let price = parseDecimal(row.buyPrice) || marketPriceForBuyRow(row);
    if (!price) {
      try {
        const quote = await fetchPrice(symbol);
        price = quote.price;
        setState((prev) => ({
          ...prev,
          stockMarketPrices: [
            ...prev.stockMarketPrices.filter((item) => item.symbol !== symbol),
            { symbol, price: quote.price, updatedAt: new Date().toISOString(), source: quote.source },
          ],
        }));
      } catch {
        setStockError("Chưa lấy được giá thị trường cho mã này.");
        return;
      }
    }

    setBuyRows((prev) => {
      const rowsWithPrice = prev.map((item) =>
        item.id === id ? { ...item, symbol, buyPrice: item.buyPrice || formatStockPrice(price), buyPriceTouched: item.buyPriceTouched } : item
      );
      const otherValue = rowsWithPrice
        .filter((item) => item.id !== id)
        .reduce((sum, item) => sum + stockPurchaseLineCost({ shares: Number(item.shares) || 0, buyPrice: effectiveBuyPrice(item) }), 0);
      const shares = stockSharesForBudget(Math.max(stats.cash - otherValue, 0), price);
      return recalculateBuyRows(rowsWithPrice.map((item) => (item.id === id ? { ...item, shares, sharesTouched: Boolean(shares) } : item)));
    });
    setStockError("");
  };

  const resetPurchaseForm = () => {
    setBuyRows(defaultBuyRows());
    setPurchaseDate(today());
    setStockSuggestions({});
    setActiveSuggestionRow(null);
    setStockError("");
  };

  const savePurchase = () => {
    const lines = buyRows
      .map((row) => ({
        symbol: row.symbol.trim().toUpperCase(),
        shares: Number(row.shares) || 0,
        buyPrice: effectiveBuyPrice(row),
      }))
      .filter((line) => line.symbol && line.shares > 0 && line.buyPrice > 0);
    const total = stockPurchaseLinesCost(lines);
    if (!lines.length) {
      setStockError("Nhập ít nhất một mã cổ phiếu hợp lệ.");
      return;
    }
    if (total > stats.cash) {
      setStockError("Tổng giá trị mua đang vượt quá tiền mặt CK.");
      return;
    }
    const purchaseId = uid();
    const purchase: StockPurchase = {
      id: purchaseId,
      date: purchaseDate,
      month: monthFromDate(purchaseDate),
      note: activePlanLink ? `Từ kế hoạch phân bổ ${activePlanLink.planItemId}` : "",
      lines,
      createdAt: new Date().toISOString(),
      meta: metaForPlannedTransaction("stock-purchase", purchaseId, activePlanLink),
    };
    commitWithUndo("Đã mua cổ phiếu.", (prev) => withCompletedAllocationPlanItem({
      ...prev,
      stockPurchases: [...prev.stockPurchases, purchase],
    }, activePlanLink, stableEventId("stock-purchase", purchase.id)));
    setActivePlanLink(null);
    resetPurchaseForm();
    setPurchaseFormOpen(false);
  };

  const openSaleForm = (holding: ReturnType<typeof stockPortfolioStats>["holdings"][number]) => {
    setSellingSymbol(holding.symbol);
    setPurchaseFormOpen(false);
    setCorporateFormOpen(false);
    setStockCashWithdrawOpen(false);
    setSaleForm({
      shares: "",
      price: formatStockPrice(holding.marketPrice),
      fee: "",
      netVnd: "",
      destination: "stock",
      date: today(),
      note: "",
    });
    setStockError("");
  };

  const openPurchasePanel = () => {
    setPurchaseFormOpen(true);
    setSellingSymbol(null);
    setCorporateFormOpen(false);
    setStockCashWithdrawOpen(false);
    setStockError("");
  };

  const openSalePanel = () => {
    const holding = selectedSaleHolding ?? stats.holdings[0];
    if (!holding) {
      setStockError("Chưa có cổ phiếu được rút.");
      return;
    }
    openSaleForm(holding);
  };

  const openStockCashWithdrawPanel = () => {
    setPurchaseFormOpen(false);
    setSellingSymbol(null);
    setCorporateFormOpen(false);
    setStockCashWithdrawOpen(true);
    setStockCashWithdrawForm({ amount: "", destination: "btc", date: today(), note: "" });
    setStockError("");
  };

  const openCorporatePanel = () => {
    setPurchaseFormOpen(false);
    setSellingSymbol(null);
    setCorporateFormOpen(true);
    setStockCashWithdrawOpen(false);
    setStockError("");
  };

  const closeStockActionPanel = () => {
    resetPurchaseForm();
    setPurchaseFormOpen(false);
    setSellingSymbol(null);
    setStockCashWithdrawOpen(false);
    resetCorporateForm();
    setCorporateFormOpen(false);
    setStockError("");
  };

  const openStockCashAdjustment = () => {
    setStockCashAdjustmentForm({
      cash: formatMoneyInput(String(Math.round(stats.cash))),
      total: formatMoneyInput(String(Math.round(stats.totalValue))),
      date: today(),
    });
    setStockCashAdjustmentError("");
    setStockCashAdjustmentOpen(true);
  };

  const closeStockCashAdjustment = () => {
    setStockCashAdjustmentOpen(false);
    setStockCashAdjustmentError("");
  };

  const saveStockCashAdjustment = () => {
    const actualCash = parseMoney(stockCashAdjustmentForm.cash);
    const actualTotal = parseMoney(stockCashAdjustmentForm.total);
    if (!actualCash && stockCashAdjustmentForm.cash !== "0") return setStockCashAdjustmentError("Nhập sức mua thực tế trên MBS.");
    if (!actualTotal && stockCashAdjustmentForm.total !== "0") return setStockCashAdjustmentError("Nhập tổng tài sản thực tế trên MBS.");
    const cashDiff = actualCash - stats.cash;
    const totalChanged = Math.abs(actualTotal - stats.totalValue) > 1;
    const totalDiff = totalChanged ? actualTotal - (stats.totalValue + cashDiff) : 0;
    if (Math.abs(cashDiff) <= 1 && Math.abs(totalDiff) <= 1) return setStockCashAdjustmentError("Số liệu chưa lệch so với app.");
    const sessionId = `manual-stock-reconcile-${uid()}`;
    const createdAt = new Date().toISOString();
    const adjustments: AdjustmentTransaction[] = [];
    if (Math.abs(cashDiff) > 1) {
      adjustments.push({
        id: uid(),
        reconciliationSessionId: sessionId,
        accountId: "vps",
        asset: STOCK_CASH_ADJUSTMENT_ASSET,
        amountVnd: cashDiff,
        reason: "manual_adjustment",
        date: stockCashAdjustmentForm.date,
        note: `Điều chỉnh sức mua CK về ${formatVnd(actualCash)}`,
        createdAt,
      });
    }
    if (totalChanged && Math.abs(totalDiff) > 1) {
      adjustments.push({
        id: uid(),
        reconciliationSessionId: sessionId,
        accountId: "vps",
        asset: STOCK_TOTAL_ADJUSTMENT_ASSET,
        amountVnd: totalDiff,
        reason: "manual_adjustment",
        date: stockCashAdjustmentForm.date,
        note: `Điều chỉnh tổng tài sản CK về ${formatVnd(actualTotal)}`,
        createdAt,
      });
    }
    commitWithUndo(
      "Đã đối soát số dư CK.",
      (prev) => ({ ...prev, adjustmentTransactions: [...adjustments, ...prev.adjustmentTransactions] }),
      { action: "create", entityType: "adjustment", entityId: adjustments[0].id }
    );
    closeStockCashAdjustment();
  };

  const saveStockCashWithdraw = () => {
    const amount = stockCashWithdrawAmount;
    if (!amount) return setStockError("Nhập số tiền dư cần rút.");
    if (amount > stats.cash) return setStockError(`Số tiền rút vượt tiền dư CK ${formatVnd(stats.cash)}.`);
    const id = uid();
    const destination = stockCashWithdrawForm.destination;
    const date = stockCashWithdrawForm.date;
    const month = monthFromDate(date);
    const note = stockCashWithdrawForm.note.trim();
    const destinationLabel =
      destination === "btc" ? "BTC" : destination === "saving" ? "Tiết kiệm" : destination === "emergency" ? "Dự phòng" : "Tiền mặt";
    const depositAmount = stockCashWithdrawDepositAmount;
    const remainder = stockCashWithdrawRemainder;
    const marker = destination === "saving" || destination === "emergency" ? stockCashWithdrawalMarker(id, destination, depositAmount) : "";
    const stockWithdrawNote = [note ? `Rút tiền dư CK · ${note}` : "Rút tiền dư CK", `-> ${destinationLabel}`, marker].filter(Boolean).join(" ");
    const stockWithdraw: FundTransaction = {
      id,
      fund: "stock",
      type: "withdraw",
      amount,
      date,
      month,
      note: stockWithdrawNote,
    };
    const targetFundTransaction: FundTransaction | null =
      destination === "btc"
        ? { id: uid(), fund: "btc", type: "deposit", amount, date, month, note: note ? `Rút tiền dư CK · ${note}` : "Rút tiền dư CK" }
        : null;
    const incomeAmount = destination === "cash" ? amount : remainder;
    const incomeTransaction: IncomeTransaction | null =
      incomeAmount > 0
        ? {
            id: uid(),
            categoryId: "other-income",
            amount: incomeAmount,
            date,
            month,
            note:
              destination === "cash"
                ? note ? `Rút tiền dư CK · ${note}` : "Rút tiền dư CK"
                : note ? `Số lẻ rút tiền dư CK · ${note}` : "Số lẻ rút tiền dư CK",
          }
        : null;
    commitWithUndo("Đã rút tiền dư CK.", (prev) => ({
      ...prev,
      fundTransactions: [...prev.fundTransactions, stockWithdraw, ...(targetFundTransaction ? [targetFundTransaction] : [])],
      incomeTransactions: incomeTransaction ? [...prev.incomeTransactions, incomeTransaction] : prev.incomeTransactions,
    }));
    setStockCashWithdrawOpen(false);
    setStockCashWithdrawForm({ amount: "", destination: "btc", date: today(), note: "" });
    setStockError("");
  };

  const saveStockSale = () => {
    const holding = stats.holdings.find((item) => item.symbol === sellingSymbol);
    if (!holding) return;
    const shares = Number(saleForm.shares) || 0;
    const sellPrice = parseDecimal(saleForm.price);
    if (!shares || !sellPrice) {
      setStockError("Nhập số cổ phiếu và giá rút hợp lệ.");
      return;
    }
    if (shares > holding.shares) {
      setStockError("Số cổ phiếu rút lớn hơn số đang có.");
      return;
    }
    const vndAmount = Math.round(shares * sellPrice * STOCK_PRICE_UNIT);
    const fee = saleForm.fee ? parseMoney(saleForm.fee) : estimateStockSaleFee(vndAmount, shares);
    const netVndAmount = saleForm.netVnd ? parseMoney(saleForm.netVnd) : Math.max(vndAmount - fee, 0);
    const note = saleForm.note.trim();
    const sale: StockSale = {
      id: uid(),
      symbol: holding.symbol,
      shares,
      sellPrice,
      vndAmount,
      fee,
      netVndAmount,
      destination: saleForm.destination,
      date: saleForm.date,
      note,
      createdAt: new Date().toISOString(),
    };
    const transferNote = stockSaleTransferNote(sale);
    commitWithUndo("Đã rút/chuyển CK.", (prev) => ({
      ...prev,
      stockSales: [...prev.stockSales, sale],
      fundTransactions:
        sale.destination === "btc"
          ? [
              ...prev.fundTransactions,
              {
                id: uid(),
                fund: "btc",
                type: "deposit",
                amount: netVndAmount,
                date: sale.date,
                month: monthFromDate(sale.date),
                note: transferNote,
              },
            ]
          : prev.fundTransactions,
      incomeTransactions:
        sale.destination === "cash"
          ? [
              ...prev.incomeTransactions,
              {
                id: uid(),
                categoryId: "other-income",
                amount: netVndAmount,
                date: sale.date,
                month: monthFromDate(sale.date),
                note: transferNote,
              },
            ]
          : prev.incomeTransactions,
    }));
    setSellingSymbol(null);
    setSaleForm({ shares: "", price: "", fee: "", netVnd: "", destination: "stock", date: today(), note: "" });
    setStockError("");
  };

  const saveManualPrice = (symbol: string, value: string) => {
    const price = parseDecimal(value);
    if (!symbol || !price) return;
    setState((prev) => ({
      ...prev,
      stockMarketPrices: [
        ...prev.stockMarketPrices.filter((item) => item.symbol !== symbol),
        { symbol, price, updatedAt: new Date().toISOString(), source: "manual" },
      ],
    }));
  };

  const deleteStockPurchase = (purchase: StockPurchase) => {
    if (!window.confirm("Xóa lệnh mua cổ phiếu này? Danh mục CK sẽ được tính lại.")) return;
    commitWithUndo(
      "Đã xóa lệnh mua CK.",
      (prev) =>
        withTrashItem(
          { ...prev, stockPurchases: prev.stockPurchases.filter((item) => item.id !== purchase.id) },
          makeTrashItem("stock-purchase", purchase.id, `lệnh mua CK ${purchase.lines.map((line) => line.symbol).join(", ")}`, purchase)
        ),
      { action: "delete", entityType: "stock-purchase", entityId: purchase.id }
    );
  };

  const deleteStockSale = (sale: StockSale) => {
    if (!window.confirm("Xóa lệnh rút cổ phiếu này? Danh mục CK sẽ được tính lại.")) return;
    const generatedNote = stockSaleTransferNote(sale);
    const generatedAmount = stockSaleNetVndAmount(sale);
    commitWithUndo(
      "Đã xóa lệnh rút CK.",
      (prev) => {
        const relatedFundTransactions =
          sale.destination === "btc"
            ? prev.fundTransactions.filter(
                (item) =>
                  item.fund === "btc" &&
                  item.type === "deposit" &&
                  item.amount === generatedAmount &&
                  item.date === sale.date &&
                  item.note === generatedNote
              )
            : [];
        const relatedIncomeTransactions =
          sale.destination === "cash"
            ? prev.incomeTransactions.filter(
                (item) =>
                  item.categoryId === "other-income" &&
                  item.amount === generatedAmount &&
                  item.date === sale.date &&
                  item.note === generatedNote
              )
            : [];
        return withTrashItem(
          {
            ...prev,
            stockSales: prev.stockSales.filter((item) => item.id !== sale.id),
            fundTransactions: prev.fundTransactions.filter((item) => !relatedFundTransactions.some((related) => related.id === item.id)),
            incomeTransactions: prev.incomeTransactions.filter((item) => !relatedIncomeTransactions.some((related) => related.id === item.id)),
          },
          makeTrashItem("stock-sale", sale.id, `lệnh rút CK ${sale.symbol}`, sale, {
            fundTransactions: relatedFundTransactions,
            incomeTransactions: relatedIncomeTransactions,
          })
        );
      },
      { action: "delete", entityType: "stock-sale", entityId: sale.id }
    );
  };

  const deleteStockAdjustment = (adjustments: AdjustmentTransaction[]) => {
    if (!window.confirm("Xóa lệnh đối soát này? Số dư CK sẽ quay về trước khi đối soát.")) return;
    const adjustmentIds = new Set(adjustments.map((item) => item.id));
    const label = adjustments.some((item) => isStockCashAdjustment(item)) && adjustments.some((item) => isStockTotalAssetAdjustment(item))
      ? "đối soát sức mua và tổng tài sản CK"
      : adjustments.some((item) => isStockTotalAssetAdjustment(item))
        ? "đối soát tổng tài sản CK"
        : "đối soát sức mua CK";
    commitWithUndo(
      "Đã xóa đối soát CK.",
      (prev) =>
        withTrashItem(
          { ...prev, adjustmentTransactions: prev.adjustmentTransactions.filter((item) => !adjustmentIds.has(item.id)) },
          makeTrashItem("adjustment", adjustments[0].id, label, adjustments[0], { adjustmentTransactions: adjustments })
        ),
      { action: "delete", entityType: "adjustment", entityId: adjustments[0].id }
    );
  };

  const resetCorporateForm = () => {
    setCorporateForm({
      symbol: "",
      newSymbol: "",
      type: "cash_dividend",
      exDate: today(),
      recordDate: today(),
      receiveDate: today(),
      ratioFrom: "100",
      ratioTo: "10",
      cashDividendPercent: "10",
      cashPerShare: "",
      subscriptionPrice: "10",
      taxRate: "5",
      eligibleShares: "",
      resultingShares: "",
      cashReceived: "",
    });
    setStockError("");
  };

  const rightsIssueCost = (action: CorporateAction) => {
    if (action.type !== "rights_issue") return 0;
    const ratioFrom = action.ratioFrom || 1;
    const ratioTo = action.ratioTo || 1;
    const addedShares = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
    return Math.round(addedShares * (action.subscriptionPrice ?? 0) * STOCK_PRICE_UNIT);
  };

  const corporateActionFromForm = (): CorporateAction | null => {
    const symbol = corporateForm.symbol.trim().toUpperCase();
    if (!symbol || !corporateEligibleShares) return null;
    return {
      id: uid(),
      symbol,
      type: corporateForm.type,
      exDate: corporateForm.receiveDate,
      recordDate: corporateForm.receiveDate,
      receiveDate: corporateForm.receiveDate,
      paymentDate: corporateForm.receiveDate,
      ratioFrom: corporateRatioFrom,
      ratioTo: corporateRatioTo,
      cashPerShare: corporateForm.type === "cash_dividend" ? effectiveCashPerShare : undefined,
      subscriptionPrice: corporateForm.type === "rights_issue" ? rightsIssuePrice : undefined,
      taxRate: corporateForm.type === "cash_dividend" ? cashDividendTaxRate : undefined,
      eligibleShares: corporateEligibleShares,
      resultingShares: corporateForm.type === "cash_dividend" ? undefined : effectiveCorporateShares,
      cashReceived: corporateForm.type === "cash_dividend" ? effectiveCashDividendResult : undefined,
      status: "applied",
      linkedEventIds: [],
      appliedAt: new Date().toISOString(),
    };
  };

  const formatCorporateRatioBase100 = (ratioFrom: number, ratioTo: number) => {
    const normalizedTo = ratioFrom ? (ratioTo * 100) / ratioFrom : 0;
    const formatRatioNumber = (value: number) =>
      Number.isInteger(value)
        ? String(value)
        : value.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
    return `100:${formatRatioNumber(normalizedTo)}`;
  };

  const corporatePreview = (action: CorporateAction | null) => {
    if (!action) return "Chọn mã và ngày nhận để app tự tính số cổ tại ngày sự kiện.";
    const beforeShares = stockSharesAtDate(state, action.symbol, corporateActionEventDate(action), action.id) || action.eligibleShares;
    const ratioFrom = action.ratioFrom || 1;
    const ratioTo = action.ratioTo || 1;
    const ratioLabel = (changedShares?: number) => {
      if (action.type === "cash_dividend" || action.type === "symbol_change") return "";
      const sharesText = typeof changedShares === "number" ? ` (${Math.abs(changedShares).toLocaleString("vi-VN")} cp)` : "";
      return ` · Tỷ lệ ${formatCorporateRatioBase100(ratioFrom, ratioTo)}${sharesText}`;
    };
    if (action.type === "cash_dividend") {
      const cash = action.cashReceived ?? action.eligibleShares * (action.cashPerShare ?? 0) * (1 - (action.taxRate ?? 0) / 100) - (action.fee ?? 0);
      return `Tiền dư CK +${formatVnd(Math.max(cash, 0))}`;
    }
    if (action.type === "rights_issue") {
      const added = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
      return `${beforeShares.toLocaleString("vi-VN")} -> ${(beforeShares + added).toLocaleString("vi-VN")} cp${ratioLabel(added)}`;
    }
    if (action.type === "stock_dividend" || action.type === "bonus_issue") {
      const added = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
      return `${beforeShares.toLocaleString("vi-VN")} -> ${(beforeShares + added).toLocaleString("vi-VN")} cp${ratioLabel(added)}`;
    }
    if (action.type === "stock_split" || action.type === "reverse_split") {
      const afterShares = Math.floor((beforeShares * ratioTo) / ratioFrom);
      return `${beforeShares.toLocaleString("vi-VN")} -> ${afterShares.toLocaleString("vi-VN")} cp${ratioLabel(afterShares - beforeShares)}`;
    }
    return "Chưa áp dụng";
  };
  const corporateActionRatioSummary = (action: CorporateAction) => {
    if (action.type === "symbol_change") return "";
    if (action.type === "cash_dividend") {
      const cashPerShare = action.cashPerShare ?? 0;
      const dividendPercent = cashPerShare ? (cashPerShare / STOCK_PAR_VALUE) * 100 : 0;
      const percentText = Number.isInteger(dividendPercent)
        ? String(dividendPercent)
        : dividendPercent.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
      const netCash = action.cashReceived ?? Math.max(Math.round(action.eligibleShares * cashPerShare * (1 - (action.taxRate ?? 0) / 100) - (action.fee ?? 0)), 0);
      return ` · Tỷ lệ 100:${percentText} · Sau thuế ${formatVnd(netCash)}`;
    }
    const ratioFrom = action.ratioFrom || 1;
    const ratioTo = action.ratioTo || 1;
    const shares =
      action.type === "stock_split" || action.type === "reverse_split"
        ? Math.abs(Math.floor((action.eligibleShares * ratioTo) / ratioFrom) - action.eligibleShares)
        : action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
    const paidText = action.type === "rights_issue" ? ` · ${formatVnd(corporateActionRightsIssueCost(action))}` : "";
    return ` · Tỷ lệ ${formatCorporateRatioBase100(ratioFrom, ratioTo)} (${shares.toLocaleString("vi-VN")} cp)${paidText}`;
  };
  const corporatePreviewAction = corporateActionFromForm();

  const applyManualCorporateAction = () => {
    const action = corporateActionFromForm();
    if (!action) {
      setStockError("Chọn mã cổ phiếu đang giữ và số cổ đủ quyền hợp lệ.");
      return;
    }
    if (action.type === "cash_dividend" && !action.cashPerShare && !action.cashReceived) {
      setStockError("Nhập % cổ tức tiền mặt hoặc tiền/cp.");
      return;
    }
    if (action.type === "rights_issue") {
      const cost = rightsIssueCost(action);
      if (!action.subscriptionPrice || !action.resultingShares) {
        setStockError("Nhập số cổ được mua và giá quyền mua hợp lệ.");
        return;
      }
      if (cost > stats.cash) {
        setStockError(`Quyền mua cần ${formatVnd(cost)}, vượt tiền dư CK ${formatVnd(stats.cash)}.`);
        return;
      }
    }
    if (action.type === "stock_dividend" && !action.resultingShares) {
      setStockError("Nhập tỷ lệ hoặc số cổ nhận hợp lệ.");
      return;
    }
    commitWithUndo(
      "Đã áp dụng sự kiện cổ phiếu.",
      (prev) => normalizeFinancialMetadata({
        ...prev,
        corporateActions: [action, ...prev.corporateActions],
      }),
      { action: "create", entityType: "corporate-action", entityId: action.id }
    );
    resetCorporateForm();
    setCorporateFormOpen(false);
  };

  const undoCorporateAction = (action: CorporateAction) => {
    if (action.status !== "applied") return;
    commitWithUndo(
      "Đã hoàn tác sự kiện cổ phiếu.",
      (prev) => normalizeFinancialMetadata({
        ...prev,
        corporateActions: prev.corporateActions.map((item) =>
          item.id === action.id
            ? { ...item, status: "pending", appliedAt: undefined, linkedEventIds: [] }
            : item
        ),
      }),
      { action: "undo", entityType: "corporate-action", entityId: action.id }
    );
  };

  const refreshPrices = async (silent = false) => {
    const symbols = stats.holdings.map((item) => item.symbol);
    if (!symbols.length) return;
    if (!silent) setRefreshStatus("Đang cập nhật giá...");
    const { updated, total } = await refreshStockMarketPrices(symbols, setState);
    setRefreshStatus(
      silent
        ? updated
          ? `Tự động cập nhật lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.`
          : ""
        : updated === total
          ? ""
          : `Cập nhật được ${updated}/${total} mã. Có thể nhập tay mã lại.`
    );
  };

  const saleFormPanel = selectedSaleHolding ? (
    <div className="stock-sale-form stock-sale-form-standalone">
      <label>
        Mã đang giữ
        <select value={selectedSaleHolding.symbol} onChange={(event) => {
          const holding = stats.holdings.find((item) => item.symbol === event.target.value);
          if (holding) openSaleForm(holding);
        }}>
          {stats.holdings.map((holding) => (
            <option value={holding.symbol} key={holding.symbol}>{holding.symbol} · {holding.shares.toLocaleString("vi-VN")} cp</option>
          ))}
        </select>
      </label>
      <label>
        Số cổ phiếu rút
        <InputWithMax value={saleForm.shares} onChange={(event) => setSaleForm({ ...saleForm, shares: event.target.value.replace(/\D/g, "") })} onMax={() => setSaleForm({ ...saleForm, shares: String(selectedSaleHolding.shares) })} placeholder="100" inputMode="numeric" />
      </label>
      <label>
        Giá rút
        <input value={saleForm.price} onChange={(event) => setSaleForm({ ...saleForm, price: formatDecimalChange(event) })} placeholder={formatStockPrice(selectedSaleHolding.marketPrice)} />
      </label>
      <label>
        Phí bán
        <input value={saleForm.fee || (saleFeeAmount ? formatMoneyInput(String(saleFeeAmount)) : "")} onChange={(event) => setSaleForm({ ...saleForm, fee: formatMoneyChange(event), netVnd: "" })} placeholder="Tự tính" />
      </label>
      <label>
        Thực nhận
        <input value={saleForm.netVnd || (saleNetVndAmount ? formatMoneyInput(String(saleNetVndAmount)) : "")} onChange={(event) => setSaleForm({ ...saleForm, netVnd: formatMoneyChange(event) })} placeholder="Theo MBS" />
      </label>
      <label>
        Nơi nhận
        <select value={saleForm.destination} onChange={(event) => setSaleForm({ ...saleForm, destination: event.target.value as SolDestination })}>
          <option value="stock">Số dư CK</option>
          <option value="btc">BTC</option>
          <option value="saving">Tiết kiệm</option>
          <option value="emergency">dự phòng</option>
          <option value="cash">Tiền mặt</option>
        </select>
      </label>
      <label>
        Ngày
        <input type="date" value={saleForm.date} onChange={(event) => setSaleForm({ ...saleForm, date: event.target.value })} />
      </label>
      <div className="stock-sale-submit-row">
        <div className="stock-sale-summary">
          <span>Giá trị</span>
          <strong>{formatVnd(saleNetVndAmount)}</strong>
        </div>
        <button className="primary icon-only stock-sale-submit-button" onClick={saveStockSale} title="Rút" aria-label="Rút" type="button"><ArrowDownCircle size={17} /></button>
      </div>
    </div>
  ) : <p className="muted">Chưa có cổ phiếu được rút.</p>;

  const corporateFormPanel = (
    <div className="form-grid btc-form-grid">
      <label>Mã cổ phiếu<select value={corporateForm.symbol} onChange={(event) => {
        const symbol = event.target.value;
        const holding = stats.holdings.find((item) => item.symbol === symbol);
        const eventShares = stockSharesAtDate(state, symbol, corporateForm.receiveDate);
        setCorporateForm({ ...corporateForm, symbol, eligibleShares: eventShares ? String(eventShares) : holding ? String(holding.shares) : corporateForm.eligibleShares, resultingShares: "", cashReceived: "" });
      }}><option value="">Chọn mã</option>{stats.holdings.map((holding) => <option key={holding.symbol} value={holding.symbol}>{holding.symbol} · {holding.shares.toLocaleString("vi-VN")} cp</option>)}</select></label>
      <label>Loại sự kiện<select value={corporateForm.type} onChange={(event) => {
        const type = event.target.value as CorporateAction["type"];
        setCorporateForm({
          ...corporateForm,
          type,
          ratioFrom: "100",
          ratioTo: "10",
          cashDividendPercent: type === "cash_dividend" ? corporateForm.cashDividendPercent || "10" : corporateForm.cashDividendPercent,
          taxRate: type === "cash_dividend" ? corporateForm.taxRate || "5" : "",
          subscriptionPrice: type === "rights_issue" ? corporateForm.subscriptionPrice || "10" : corporateForm.subscriptionPrice,
          resultingShares: "",
          cashReceived: "",
        });
      }}>{corporateActionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Ngày nhận<input type="date" value={corporateForm.receiveDate} onChange={(event) => {
        const receiveDate = event.target.value;
        const eventShares = stockSharesAtDate(state, corporateForm.symbol, receiveDate);
        setCorporateForm({ ...corporateForm, receiveDate, eligibleShares: eventShares ? String(eventShares) : corporateForm.eligibleShares, resultingShares: "", cashReceived: "" });
      }} /></label>
      <label>Số cổ đủ quyền<input value={corporateForm.eligibleShares} onChange={(event) => setCorporateForm({ ...corporateForm, eligibleShares: event.target.value.replace(/\D/g, "") })} placeholder="1000" /></label>
      {corporateForm.type !== "cash_dividend" && (
        <>
          <label>Tỷ lệ từ<input value={corporateForm.ratioFrom} onChange={(event) => setCorporateForm({ ...corporateForm, ratioFrom: formatDecimalChange(event) })} placeholder="100" /></label>
          <label>Tỷ lệ đến<input value={corporateForm.ratioTo} onChange={(event) => setCorporateForm({ ...corporateForm, ratioTo: formatDecimalChange(event) })} placeholder="10" /></label>
        </>
      )}
      {corporateForm.type === "cash_dividend" && (
        <>
          <label>Cổ tức %<input value={corporateForm.cashDividendPercent} onChange={(event) => setCorporateForm({ ...corporateForm, cashDividendPercent: formatDecimalChange(event), cashPerShare: "", cashReceived: "" })} placeholder="10" /></label>
          <label>Tiền/cp<input value={corporateForm.cashPerShare || effectiveCashPerShare.toLocaleString("vi-VN")} onChange={(event) => setCorporateForm({ ...corporateForm, cashPerShare: formatMoneyChange(event), cashReceived: "" })} placeholder="1.000" /></label>
          <label>Tiền nhận<input value={cashDividendGross ? cashDividendGross.toLocaleString("vi-VN") : ""} readOnly placeholder="Tự tính" /></label>
          <label>Thuế %<input value={corporateForm.taxRate} onChange={(event) => setCorporateForm({ ...corporateForm, taxRate: formatDecimalChange(event), cashReceived: "" })} placeholder="5" /></label>
          <label>Kết quả dự kiến<input value={corporateForm.cashReceived || (effectiveCashDividendResult ? effectiveCashDividendResult.toLocaleString("vi-VN") : "")} onChange={(event) => setCorporateForm({ ...corporateForm, cashReceived: formatMoneyChange(event) })} placeholder="Tự tính" /></label>
          <button className="primary corporate-confirm-button" onClick={applyManualCorporateAction} type="button">Xác nhận</button>
        </>
      )}
      {corporateForm.type === "stock_dividend" && (
        <>
          <label>Số cổ nhận<input value={corporateForm.resultingShares || (computedCorporateShares ? String(computedCorporateShares) : "")} onChange={(event) => setCorporateForm({ ...corporateForm, resultingShares: event.target.value.replace(/\D/g, "") })} placeholder="Tự tính" /></label>
          <button className="primary corporate-confirm-button" onClick={applyManualCorporateAction} type="button">Xác nhận</button>
        </>
      )}
      {corporateForm.type === "rights_issue" && (
        <>
          <label>Giá quyền mua<input value={corporateForm.subscriptionPrice} onChange={(event) => setCorporateForm({ ...corporateForm, subscriptionPrice: formatDecimalChange(event) })} placeholder="10,0" /></label>
          <label>Số cổ được mua<input value={corporateForm.resultingShares || (computedCorporateShares ? String(computedCorporateShares) : "")} onChange={(event) => setCorporateForm({ ...corporateForm, resultingShares: event.target.value.replace(/\D/g, "") })} placeholder="Tự tính" /></label>
          <label>Thực trả<input value={rightsIssueAmount ? rightsIssueAmount.toLocaleString("vi-VN") : ""} readOnly placeholder="Tự tính" /></label>
          <button className="primary corporate-confirm-button" onClick={applyManualCorporateAction} type="button">Xác nhận</button>
        </>
      )}
    </div>
  );

  const content = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Chứng khoán</p>
        </div>
      </header>
      {latestStockAllocationNotice && (
        <button className="pending-banner clickable stock-allocation-notice" onClick={dismissStockAllocationNotice} type="button">
          <div>
            <strong>
              Đã chia {formatVnd(latestStockAllocationNotice.amount)} vào quỹ CK tháng {formatMonth(latestStockAllocationNotice.month)}
            </strong>
            <small>Bấm đầu tick được ẩn thông báo</small>
          </div>
          <CheckCircle2 size={20} />
        </button>
      )}
      <section className="metrics-grid stock-metrics-grid">
        <MetricCard label="Vốn đang đầu tư" value={formatVnd(stats.investedValueVnd)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Tài sản" value={formatVnd(stats.totalValue)} subValue={`Dư: ${formatVnd(stats.cash)}`} icon={<LineChart size={20} />} tone="highlight" />
        <MetricCard label="Lãi/lỗ" value={`${formatVnd(stats.pnl)} · ${stats.pnlPercent.toFixed(1)}%`} icon={<BarChart3 size={20} />} tone={stats.pnl < 0 ? "loss" : undefined} />
      </section>
      <section className="stock-action-grid stock-action-grid-full stock-mobile-compact">
        <div className="stock-trade-section">
          <div className="crypto-action-grid stock-command-grid">
            <button className={purchaseFormOpen ? "active" : ""} onClick={openPurchasePanel} type="button">
              <Plus size={20} />
              <span>Mua</span>
            </button>
            <button className={sellingSymbol ? "active" : ""} onClick={openSalePanel} type="button">
              <ArrowDownCircle size={20} />
              <span>Rút cổ</span>
            </button>
            <button className={stockCashWithdrawOpen ? "active" : ""} onClick={openStockCashWithdrawPanel} type="button">
              <BadgeDollarSign size={20} />
              <span>Rút tiền dư</span>
            </button>
            <button className={corporateFormOpen ? "active" : ""} onClick={openCorporatePanel} type="button">
              <CalendarClock size={20} />
              <span>Sự kiện</span>
            </button>
          </div>
        {purchaseFormOpen && (
        <article className="panel stock-buy-panel">
          <div className="panel-title">
            <h2>Mua</h2>
              <button className="icon-button" onClick={() => {
                resetPurchaseForm();
                setPurchaseFormOpen(false);
              }} title="Đóng" aria-label="Đóng" type="button"><X size={17} /></button>
          </div>
            <>
              <div className="confirm-summary stock-confirm-summary">
                <div>
                  <span>Phí mua</span>
                  <strong>{formatVnd(plannedFeeAmount)}</strong>
                </div>
                <div>
                  <span>Tổng tiền</span>
                  <strong>{formatVnd(plannedValue)} / {formatVnd(stats.cash)}</strong>
                </div>
              </div>
              <div className="stock-buy-list">
                {buyRows.map((row, index) => {
                  const value = stockPurchaseLineCost({ shares: Number(row.shares) || 0, buyPrice: effectiveBuyPrice(row) });
                  return (
                    <div className="stock-buy-row" key={row.id}>
                      <label>
                        Cổ phiếu
                        <div className="stock-symbol-field">
                          <input
                            value={row.symbol}
                            onChange={(event) => {
                              updateBuyRow(row.id, {
                                symbol: event.target.value.toUpperCase(),
                                buyPrice: row.buyPriceTouched ? row.buyPrice : "",
                                shares: row.sharesTouched ? row.shares : "",
                              });
                              setActiveSuggestionRow(row.id);
                            }}
                            onFocus={() => setActiveSuggestionRow(row.id)}
                            placeholder="MBB"
                            autoComplete="off"
                          />
                          {activeSuggestionRow === row.id && (stockSuggestions[row.id].length ?? 0) > 0 && (
                            <div className="stock-suggestions">
                              {stockSuggestions[row.id].map((suggestion) => (
                                <button key={suggestion.symbol} onClick={() => selectSuggestion(row.id, suggestion)} type="button">
                                  <span>
                                    <strong>{suggestion.symbol}</strong>
                                    <small>{suggestion.name}{suggestion.exchange ? ` · ${suggestion.exchange}` : ""}</small>
                                  </span>
                                  <b>{suggestion.price ? formatStockPrice(suggestion.price) : "Chưa có giá"}</b>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                      <label>
                        %
                        <input value={row.percent} onChange={(event) => updateBuyPercent(row.id, event.target.value)} placeholder={index === 0 ? "100" : "0"} />
                      </label>
                      <label>
                        Giá vào
                        <div className="stock-price-remove-field">
                          <input
                            value={stockBuyPriceInput(row, marketPriceForBuyRow(row))}
                            onChange={(event) => {
                              const buyPrice = formatDecimalChange(event);
                              updateBuyRow(row.id, { buyPrice, buyPriceTouched: Boolean(buyPrice) });
                            }}
                            placeholder={row.symbol ? formatStockPrice(marketPriceForBuyRow(row) || 27.5) : "27,5"}
                          />
                          <button className="stock-remove-mini stock-remove-mobile" onClick={() => removeBuyRow(row.id)} title="Xóa dòng" type="button">
                            <X size={13} />
                          </button>
                        </div>
                      </label>
                      <label>
                        Số cổ phiếu
                        <InputWithMax
                          value={row.shares}
                          onChange={(event) => {
                            const shares = event.target.value.replace(/\D/g, "");
                            updateBuyRow(row.id, { shares, sharesTouched: Boolean(shares) });
                          }}
                          onMax={() => void fillMaxBuyRow(row.id)}
                          placeholder="100"
                          inputMode="numeric"
                        />
                      </label>
                      <div className="stock-row-value">
                        <span>Giá trị</span>
                        <strong>{formatVnd(value)}</strong>
                      </div>
                      <button className="stock-remove-mini stock-remove-desktop" onClick={() => removeBuyRow(row.id)} title="Xóa dòng" type="button">
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="stock-form-actions stock-buy-actions">
                <label className="stock-action-date" aria-label="Ngày mua">
                  <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
                </label>
                <button className="ghost" onClick={addBuyRow} type="button"><Plus size={17} /> Thêm</button>
                <button className="primary" onClick={savePurchase} type="button"><Save size={17} /> Lưu</button>
              </div>
              {stockError && <span className="form-error">{stockError}</span>}
            </>
        </article>
        )}
        {stockCashWithdrawOpen && (
          <article className="panel stock-buy-panel crypto-form-panel">
            <div className="panel-title">
              <h2>Rút tiền dư</h2>
              <button className="icon-button" onClick={() => setStockCashWithdrawOpen(false)} title="Đóng" aria-label="Đóng" type="button"><X size={17} /></button>
            </div>
            <div className="form-grid btc-form-grid stock-cash-withdraw-form">
              <label>Số tiền rút<InputWithMax value={stockCashWithdrawForm.amount} onChange={(event) => setStockCashWithdrawForm({ ...stockCashWithdrawForm, amount: formatMoneyChange(event) })} onMax={() => setStockCashWithdrawForm({ ...stockCashWithdrawForm, amount: formatMoneyInput(String(Math.round(stats.cash))) })} placeholder="2.141.826" inputMode="numeric" /></label>
              <label>Nơi nhận<select value={stockCashWithdrawForm.destination} onChange={(event) => setStockCashWithdrawForm({ ...stockCashWithdrawForm, destination: event.target.value as StockCashWithdrawDestination })}>
                <option value="btc">BTC</option>
                <option value="saving">Tiết kiệm</option>
                <option value="emergency">Dự phòng</option>
                <option value="cash">Tiền mặt</option>
              </select></label>
              <label>Ngày<input type="date" value={stockCashWithdrawForm.date} onChange={(event) => setStockCashWithdrawForm({ ...stockCashWithdrawForm, date: event.target.value })} /></label>
              <div className="stock-cash-withdraw-note-action">
                <label>Ghi chú<input value={stockCashWithdrawForm.note} onChange={(event) => setStockCashWithdrawForm({ ...stockCashWithdrawForm, note: event.target.value })} placeholder="Rút tiền dư" /></label>
                <button className="primary icon-only stock-sale-submit-button" onClick={saveStockCashWithdraw} title="Rút tiền dư" aria-label="Rút tiền dư" type="button"><ArrowDownCircle size={17} /></button>
              </div>
            </div>
            {(stockCashWithdrawForm.destination === "saving" || stockCashWithdrawForm.destination === "emergency") && (
              <div className="stock-cash-withdraw-summary">
                Chuyển quỹ <b>{formatVnd(stockCashWithdrawDepositAmount)}</b>
                <span>·</span>
                Số lẻ <b>{formatVnd(stockCashWithdrawRemainder)}</b>
              </div>
            )}
            {stockError && <span className="form-error">{stockError}</span>}
          </article>
        )}
        {sellingSymbol && (
          <article className="panel stock-buy-panel crypto-form-panel">
            <div className="panel-title">
              <h2>Rút cổ phiếu</h2>
              <button className="icon-button" onClick={() => setSellingSymbol(null)} title="Đóng" aria-label="Đóng" type="button"><X size={17} /></button>
            </div>
            {saleFormPanel}
            {stockError && <span className="form-error">{stockError}</span>}
          </article>
        )}
        {corporateFormOpen && (
          <article className="panel stock-buy-panel crypto-form-panel">
            <div className="panel-title">
              <h2>Sự kiện cổ phiếu</h2>
              <button className="icon-button" onClick={() => { resetCorporateForm(); setCorporateFormOpen(false); }} title="Đóng" aria-label="Đóng" type="button"><X size={17} /></button>
            </div>
            {corporateFormPanel}
            {stockError && <span className="form-error">{stockError}</span>}
          </article>
        )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Danh mục cổ phiếu</h2>
          <div className="stock-title-actions">
            {stockHeaderStatusLabel && <small>{stockHeaderStatusLabel}</small>}
            <button className="ghost report-refresh-button" onClick={openStockCashAdjustment} type="button" aria-label="Đối soát sức mua CK" title="Đối soát sức mua CK"><Pencil size={17} /></button>
            <button className="ghost report-refresh-button" onClick={() => refreshPrices()} type="button" aria-label="Cập nhật giá"><RefreshCw size={17} /></button>
          </div>
        </div>
        {stats.holdings.length === 0 ? (
          <p className="muted">Chưa có cổ phiếu nào.</p>
        ) : (
          <div className="stock-holding-list">
            {stats.holdings.map((holding) => (
              <article className="stock-holding-card" key={holding.symbol} style={{ "--stock-symbol-color": stockSymbolColor(holding.symbol) } as React.CSSProperties}>
                <div className="stock-holding-head">
                  <div>
                    <div className="stock-symbol-line">
                      <h3>{holding.symbol}</h3>
                      <span>{holding.shares.toLocaleString("vi-VN")} cp</span>
                    </div>
                  </div>
                  <b className={holding.pnl < 0 ? "stock-holding-percent loss" : "stock-holding-percent gain"}>{holding.pnlPercent.toFixed(1)}%</b>
                </div>
                <div className="stock-holding-grid">
                  <label className="stock-price-pair">
                    <span>Giá TT</span>
                    <strong>{formatStockPrice(holding.marketPrice)}</strong>
                  </label>
                  <span className="stock-average-price">
                    Giá TB
                    <strong>{formatStockAveragePrice(holding.averageCost)}</strong>
                  </span>
                  <span className="stock-value-pair">
                    Giá trị
                    <b>{formatVnd(holding.marketValue)}</b>
                  </span>
                  <span className="stock-pnl-pair">
                    <span>Lãi/lỗ</span>
                    <strong className={holding.pnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{formatVnd(holding.pnl)}</strong>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {stockCashAdjustmentOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-cash-adjustment-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeStockCashAdjustment();
          }}
        >
          <section className="modal-card crypto-balance-adjustment-modal">
            <div className="panel-title">
              <h2 id="stock-cash-adjustment-title">Đối soát sức mua CK</h2>
              <button className="icon-button" onClick={closeStockCashAdjustment} title="Đóng" aria-label="Đóng" type="button"><X size={17} /></button>
            </div>
            <div className="form-grid btc-form-grid">
              <label>Sức mua trên MBS<input value={stockCashAdjustmentForm.cash} onChange={(event) => {
                const cash = formatMoneyChange(event);
                setStockCashAdjustmentForm((prev) => ({ ...prev, cash }));
              }} placeholder="2.141.826" /></label>
              <label>Tổng tài sản trên MBS<input value={stockCashAdjustmentForm.total} onChange={(event) => {
                const total = formatMoneyChange(event);
                setStockCashAdjustmentForm((prev) => ({ ...prev, total }));
              }} placeholder="3.621.627" /></label>
              <div className="stock-adjustment-date-actions">
                <label>Ngày<input type="date" value={stockCashAdjustmentForm.date} onChange={(event) => setStockCashAdjustmentForm((prev) => ({ ...prev, date: event.target.value }))} /></label>
                <button className="primary" onClick={saveStockCashAdjustment} type="button"><Save size={17} /> Lưu đối soát</button>
              </div>
            </div>
            {stockCashAdjustmentError && <span className="form-error">{stockCashAdjustmentError}</span>}
          </section>
        </div>
      )}
      <section className="panel">
        <div className="panel-title">
          <h2>Sự kiện cổ phiếu</h2>
        </div>
        {false && (
          <div className="form-grid btc-form-grid">
            <label>Mã cổ phiếu<select value={corporateForm.symbol} onChange={(event) => {
              const symbol = event.target.value;
              const holding = stats.holdings.find((item) => item.symbol === symbol);
              const eventShares = stockSharesAtDate(state, symbol, corporateForm.receiveDate);
              setCorporateForm({ ...corporateForm, symbol, eligibleShares: eventShares ? String(eventShares) : holding ? String(holding.shares) : corporateForm.eligibleShares, resultingShares: "", cashReceived: "" });
            }}><option value="">Chọn mã</option>{stats.holdings.map((holding) => <option key={holding.symbol} value={holding.symbol}>{holding.symbol} · {holding.shares.toLocaleString("vi-VN")} cp</option>)}</select></label>
            <label>Loại sự kiện<select value={corporateForm.type} onChange={(event) => {
              const type = event.target.value as CorporateAction["type"];
              setCorporateForm({
                ...corporateForm,
                type,
                ratioFrom: "100",
                ratioTo: "10",
                cashDividendPercent: type === "cash_dividend" ? corporateForm.cashDividendPercent || "10" : corporateForm.cashDividendPercent,
                taxRate: type === "cash_dividend" ? corporateForm.taxRate || "5" : "",
                subscriptionPrice: type === "rights_issue" ? corporateForm.subscriptionPrice || "10" : corporateForm.subscriptionPrice,
                resultingShares: "",
                cashReceived: "",
              });
            }}>{corporateActionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <label>Ngày nhận<input type="date" value={corporateForm.receiveDate} onChange={(event) => {
              const receiveDate = event.target.value;
              const eventShares = stockSharesAtDate(state, corporateForm.symbol, receiveDate);
              setCorporateForm({ ...corporateForm, receiveDate, eligibleShares: eventShares ? String(eventShares) : corporateForm.eligibleShares, resultingShares: "", cashReceived: "" });
            }} /></label>
            <label>Số cổ đủ quyền<input value={corporateForm.eligibleShares} onChange={(event) => setCorporateForm({ ...corporateForm, eligibleShares: event.target.value.replace(/\D/g, "") })} placeholder="1000" /></label>
            {corporateForm.type !== "cash_dividend" && (
              <>
                <label>Tỷ lệ từ<input value={corporateForm.ratioFrom} onChange={(event) => setCorporateForm({ ...corporateForm, ratioFrom: formatDecimalChange(event) })} placeholder="100" /></label>
                <label>Tỷ lệ đến<input value={corporateForm.ratioTo} onChange={(event) => setCorporateForm({ ...corporateForm, ratioTo: formatDecimalChange(event) })} placeholder="10" /></label>
              </>
            )}
            {corporateForm.type === "cash_dividend" && (
              <>
                <label>Cổ tức %<input value={corporateForm.cashDividendPercent} onChange={(event) => setCorporateForm({ ...corporateForm, cashDividendPercent: formatDecimalChange(event), cashPerShare: "", cashReceived: "" })} placeholder="10" /></label>
                <label>Tiền/cp<input value={corporateForm.cashPerShare || effectiveCashPerShare.toLocaleString("vi-VN")} onChange={(event) => setCorporateForm({ ...corporateForm, cashPerShare: formatMoneyChange(event), cashReceived: "" })} placeholder="1.000" /></label>
                <label>Tiền nhận<input value={cashDividendGross ? cashDividendGross.toLocaleString("vi-VN") : ""} readOnly placeholder="Tự tính" /></label>
                <label>Thuế %<input value={corporateForm.taxRate} onChange={(event) => setCorporateForm({ ...corporateForm, taxRate: formatDecimalChange(event), cashReceived: "" })} placeholder="5" /></label>
                <label>Kết quả dự kiến<input value={corporateForm.cashReceived || (effectiveCashDividendResult ? effectiveCashDividendResult.toLocaleString("vi-VN") : "")} onChange={(event) => setCorporateForm({ ...corporateForm, cashReceived: formatMoneyChange(event) })} placeholder="Tự tính" /></label>
                <button className="primary corporate-confirm-button" onClick={applyManualCorporateAction} type="button">Xác nhận</button>
              </>
            )}
            {corporateForm.type === "stock_dividend" && (
              <>
                <label>Số cổ nhận<input value={corporateForm.resultingShares || (computedCorporateShares ? String(computedCorporateShares) : "")} onChange={(event) => setCorporateForm({ ...corporateForm, resultingShares: event.target.value.replace(/\D/g, "") })} placeholder="Tự tính" /></label>
                <button className="primary corporate-confirm-button" onClick={applyManualCorporateAction} type="button">Xác nhận</button>
              </>
            )}
            {corporateForm.type === "rights_issue" && (
              <>
                <label>Giá quyền mua<input value={corporateForm.subscriptionPrice} onChange={(event) => setCorporateForm({ ...corporateForm, subscriptionPrice: formatDecimalChange(event) })} placeholder="10,0" /></label>
                <label>Số cổ được mua<input value={corporateForm.resultingShares || (computedCorporateShares ? String(computedCorporateShares) : "")} onChange={(event) => setCorporateForm({ ...corporateForm, resultingShares: event.target.value.replace(/\D/g, "") })} placeholder="Tự tính" /></label>
                <label>Thực trả<input value={rightsIssueAmount ? rightsIssueAmount.toLocaleString("vi-VN") : ""} readOnly placeholder="Tự tính" /></label>
                <button className="primary corporate-confirm-button" onClick={applyManualCorporateAction} type="button">Xác nhận</button>
              </>
            )}
          </div>
        )}
        <div className="settings-list history-five-list">
          {appliedCorporateActions.length === 0 ? <p className="muted">Chưa áp dụng cổ tức/quyền mua nào.</p> : appliedCorporateActions.map((action) => (
            <div className="settings-list-row corporate-action-row" key={action.id}>
              <div>
                <strong>{action.symbol} · {corporateActionLabel(action.type)}</strong>
                <small>{corporateActionEventDate(action) ? formatDate(corporateActionEventDate(action)) : "Đã áp dụng"}{corporateActionRatioSummary(action)}</small>
              </div>
              <div className="settings-list-actions">
                <button className="ghost action-button-sm icon-only corporate-action-undo" onClick={() => undoCorporateAction(action)} title="Hoàn tác" aria-label="Hoàn tác" type="button"><RotateCcw size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Lịch sử mua/rút</h2>
          <small>{stockHistoryRows.length} lệnh</small>
        </div>
        <div className="timeline history-five-list">
          {stockHistoryRows.length === 0 ? <p className="muted">Chưa có lịch sử mua/rút cổ phiếu.</p> : stockHistoryRows.map((row) => {
            if (row.kind === "purchase") {
              const purchase = row.purchase;
              return (
                <div key={row.id}>
                  <span className="deposit">+</span>
                  <div className="timeline-row-content">
                    <div>
                      <strong>{formatVnd(stockPurchaseLinesCost(purchase.lines))}</strong>
                      <small>
                        {formatDate(purchase.date)} · {purchase.lines.map((line) => `${line.symbol} ${line.shares.toLocaleString("vi-VN")}cp @ ${formatStockPrice(line.buyPrice)}`).join(" · ")}{purchase.note ? ` · ${purchase.note}` : ""}
                      </small>
                    </div>
                    <button className="row-icon-button history-delete-button danger-text timeline-delete-button" onClick={() => deleteStockPurchase(purchase)} title="Xóa lịch sử" type="button">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            }

            if (row.kind === "adjustment") {
              const adjustments = row.adjustmentGroup.adjustments;
              const cashAdjustment = adjustments.find((item) => isStockCashAdjustment(item));
              const totalAdjustment = adjustments.find((item) => isStockTotalAssetAdjustment(item));
              const formatAdjustmentTarget = (adjustment?: AdjustmentTransaction) => adjustment?.note.match(/về\s+(.+)$/i)?.[1] ?? "";
              const titleItems = [
                cashAdjustment && { label: totalAdjustment ? "Sức mua" : "", amount: cashAdjustment.amountVnd ?? 0 },
                totalAdjustment && { label: cashAdjustment ? "Tổng tài sản" : "", amount: totalAdjustment.amountVnd ?? 0 },
              ].filter(Boolean) as Array<{ label: string; amount: number }>;
              const detailItems = [
                cashAdjustment && `Điều chỉnh sức mua về ${formatAdjustmentTarget(cashAdjustment)}`,
                totalAdjustment && `Điều chỉnh tổng tài sản về ${formatAdjustmentTarget(totalAdjustment)}`,
              ].filter(Boolean);
              return (
                <div key={row.id}>
                  <span className="adjustment"><SlidersHorizontal size={15} /></span>
                  <div className="timeline-row-content">
                    <div>
                      <strong>
                        {titleItems.map((item, index) => (
                          <span key={`${item.label || "adjustment"}-${index}`}>
                            {index > 0 ? " · " : ""}{item.label ? `${item.label} ` : ""}
                            <b className={item.amount < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{formatVnd(item.amount)}</b>
                          </span>
                        ))}
                      </strong>
                      <small>
                        {formatDate(row.date)} · {detailItems.join(" · ")}
                      </small>
                    </div>
                    <button className="row-icon-button history-delete-button danger-text timeline-delete-button" onClick={() => deleteStockAdjustment(adjustments)} title="Xóa lịch sử" type="button">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            }

            const sale = row.sale;
            const saleValue = row.saleStats?.grossValue ?? sale.vndAmount;
            const saleNetValue = row.saleStats?.netValue ?? stockSaleNetVndAmount(sale);
            const saleGrossPnl = row.saleStats?.pnl ?? 0;
            const saleCostValue = saleValue - saleGrossPnl;
            const saleNetPnl = row.saleStats?.realizedPnlVnd ?? realizedStockSalePnl(saleNetValue, saleCostValue);
            return (
              <div key={row.id}>
                <span className="withdraw">-</span>
                <div className="timeline-row-content">
                  <div>
                    <strong>
                      {formatVnd(saleNetValue)}
                    </strong>
                    <small className={saleNetPnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>Lãi/lỗ đã chốt {formatVnd(saleNetPnl)}</small>
                    <small>
                      {formatDate(sale.date)} · {sale.symbol} {sale.shares.toLocaleString("vi-VN")}cp @ {formatStockPrice(sale.sellPrice)} · {formatVnd(saleValue)}{sale.note ? ` · ${sale.note}` : ""}
                    </small>
                  </div>
                  <button className="row-icon-button history-delete-button danger-text timeline-delete-button" onClick={() => deleteStockSale(sale)} title="Xóa lịch sử" type="button">
                    <X size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function reconciliationBalanceKey(balance: ReconciliationSession["expectedBalances"][number]) {
  return `${balance.asset}:${balance.stockSymbol ?? ""}`;
}

function corporateActionCashAmount(action: CorporateAction) {
  const netCash = action.cashReceived ?? action.eligibleShares * (action.cashPerShare ?? 0) * (1 - (action.taxRate ?? 0) / 100) - (action.fee ?? 0);
  return Math.max(Math.round(netCash), 0);
}

function corporateActionRightsIssueCost(action: CorporateAction) {
  if (action.type !== "rights_issue") return 0;
  const ratioFrom = action.ratioFrom || 1;
  const ratioTo = action.ratioTo || 1;
  const addedShares = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
  return Math.round(addedShares * (action.subscriptionPrice ?? 0) * STOCK_PRICE_UNIT);
}

function expectedReconciliationBalances(
  state: AppState,
  accountId: string,
  financialIndex = buildFinancialIndex(state)
): ReconciliationSession["expectedBalances"] {
  const accountEventIds = new Set((financialIndex.eventsByAccountId.get(accountId) ?? []).map((event) => event.id));
  const hasIndexedEvent = (entityType: string, entityId: string) =>
    accountEventIds.has(financialIndex.eventsById.get(stableEventId(entityType, entityId))?.id ?? "");
  const matchingAdjustments = state.adjustmentTransactions.filter((item) => item.accountId === accountId && hasIndexedEvent("adjustment", item.id));

  if (accountId === "binance") {
    const dcaTradesByPlan = new Map<string, BtcTrade[]>();
    state.btcTrades.forEach((trade) => {
      if (trade.type === "dca" && trade.planId) {
        dcaTradesByPlan.set(trade.planId, [...(dcaTradesByPlan.get(trade.planId) ?? []), trade]);
      }
    });
    const topupUsdt = state.btcUsdtTopups
      .filter((item) => hasIndexedEvent("btc-topup", item.id))
      .reduce((sum, item) => sum + item.usdtAmount, 0);
    const tradeSpentUsdt = state.btcTrades
      .filter((item) => hasIndexedEvent("btc-trade", item.id))
      .reduce((sum, item) => sum + (item.costVnd ? 0 : item.usdtAmount), 0);
    const convertedToUsdt = state.btcTransfers
      .filter((item) => hasIndexedEvent("btc-transfer", item.id) && item.asset === "btc" && item.destination === "usdt")
      .reduce((sum, item) => sum + item.usdtAmount, 0);
    const transferredUsdt = state.btcTransfers
      .filter((item) => hasIndexedEvent("btc-transfer", item.id) && item.asset === "usdt")
      .reduce((sum, item) => sum + item.usdtAmount, 0);
    const directBtc = state.btcTrades
      .filter((item) => hasIndexedEvent("btc-trade", item.id) && item.type !== "dca")
      .reduce((sum, item) => sum + item.btcAmount, 0);
    const dcaBtc = state.btcDcaPlans
      .filter((plan) => hasIndexedEvent("btc-dca", plan.id))
      .reduce((sum, plan) => {
        const planTrades = dcaTradesByPlan.get(plan.id) ?? [];
        const tradeBtcAmount = planTrades.reduce((tradeSum, trade) => tradeSum + trade.btcAmount, 0);
        return sum + (plan.btcAmountOverride && plan.btcAmountOverride > 0 ? plan.btcAmountOverride : tradeBtcAmount);
      }, 0);
    const transferredBtc = state.btcTransfers
      .filter((item) => hasIndexedEvent("btc-transfer", item.id) && item.asset === "btc")
      .reduce((sum, item) => sum + item.btcAmount, 0);
    const solBalance = state.solTransactions
      .filter((item) => hasIndexedEvent("sol", item.id))
      .reduce((sum, item) => sum + (isSolWithdrawal(item) ? -item.solAmount : item.solAmount), 0);
    const quantityAdjustment = (asset: string) =>
      matchingAdjustments.filter((item) => item.asset === asset).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    return [
      { asset: "USDT", quantity: Math.max(topupUsdt + convertedToUsdt - tradeSpentUsdt - transferredUsdt + quantityAdjustment("USDT"), 0) },
      { asset: "BTC", quantity: Math.max(directBtc + dcaBtc - transferredBtc + quantityAdjustment("BTC"), 0) },
      { asset: "SOL", quantity: Math.max(solBalance + quantityAdjustment("SOL"), 0) },
    ];
  }
  if (accountId === "vps") {
    const stockStats = stockPortfolioStats(state);
    const fundCash = state.fundTransactions
      .filter((item) => item.fund === "stock" && hasIndexedEvent("fund-transaction", item.id) && !item.note.startsWith("Rút từ CK"))
      .reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);
    const invested = state.stockPurchases
      .filter((purchase) => hasIndexedEvent("stock-purchase", purchase.id))
      .reduce((sum, purchase) => sum + stockPurchaseLinesCost(purchase.lines), 0);
    const soldToCashBalance = state.stockSales
      .filter((sale) => hasIndexedEvent("stock-sale", sale.id) && sale.destination === "stock")
      .reduce((sum, sale) => sum + stockSaleNetVndAmount(sale), 0);
    const appliedCorporateActions = state.corporateActions.filter((action) => hasIndexedEvent("corporate-action", action.id) && action.status === "applied");
    const corporateCashBalance = appliedCorporateActions
      .filter((action) => action.type === "cash_dividend")
      .reduce((sum, action) => sum + corporateActionCashAmount(action), 0);
    const corporateCost = appliedCorporateActions.reduce((sum, action) => sum + corporateActionRightsIssueCost(action), 0);
    const cashAdjustment = matchingAdjustments.filter((item) => item.asset === "VND").reduce((sum, item) => sum + (item.amountVnd ?? 0), 0);
    const stockQuantityAdjustment = (symbol: string) =>
      matchingAdjustments
        .filter((item) => item.asset === "STOCK" && item.stockSymbol === symbol)
        .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    return [
      { asset: "VND", amountVnd: Math.max(fundCash - invested + soldToCashBalance + corporateCashBalance - corporateCost + cashAdjustment, 0) },
      ...stockStats.holdings.map((holding) => ({
        asset: "STOCK",
        stockSymbol: holding.symbol,
        quantity: Math.max(holding.shares + stockQuantityAdjustment(holding.symbol), 0),
      })),
    ];
  }
  if (accountId === "mbb-books") {
    const amountAdjustment = (code: string) =>
      matchingAdjustments
        .filter((item) => item.asset === "VND" && item.stockSymbol === code)
        .reduce((sum, item) => sum + (item.amountVnd ?? 0), 0);
    return state.bankDeposits
      .filter((deposit) => deposit.status === "active" && hasIndexedEvent("deposit", deposit.id))
      .map((deposit) => ({ asset: "VND", stockSymbol: deposit.code, amountVnd: deposit.principal + amountAdjustment(deposit.code) }));
  }
  const vndAdjustment = matchingAdjustments.filter((item) => item.asset === "VND").reduce((sum, item) => sum + (item.amountVnd ?? 0), 0);
  return [{ asset: "VND", amountVnd: vndAdjustment }];
}

function reconciliationDifferences(
  expectedBalances: ReconciliationSession["expectedBalances"],
  actualBalances: ReconciliationSession["actualBalances"]
): ReconciliationSession["differences"] {
  return expectedBalances.map((expected) => {
    const actual = actualBalances.find((item) => reconciliationBalanceKey(item) === reconciliationBalanceKey(expected));
    return {
      asset: expected?.asset,
      stockSymbol: expected?.stockSymbol,
      expectedAmount: expected?.amountVnd,
      actualAmount: actual?.amountVnd,
      differenceAmount: expected?.amountVnd === undefined || actual?.amountVnd === undefined ? undefined : actual.amountVnd - expected.amountVnd,
      expectedQuantity: expected?.quantity,
      actualQuantity: actual?.quantity,
      differenceQuantity: expected?.quantity === undefined || actual?.quantity === undefined ? undefined : actual.quantity - expected.quantity,
      reason: "unknown" as const,
      resolutionStatus: "unresolved" as const,
    };
  });
}

function allocationSnapshotForState(state: AppState): AllocationPlan["currentSnapshot"] {
  const btcStats = btcPortfolioStats(state);
  const sol = solPositionFromState(state);
  const stockStats = stockPortfolioStats(state);
  const activeDepositTotal = (fund: TransferDepositFund) =>
    state.bankDeposits
      .filter((deposit) => deposit.fund === fund && deposit.status === "active")
      .reduce((sum, deposit) => sum + deposit.principal, 0);
  const saving = activeDepositTotal("saving");
  const emergency = activeDepositTotal("emergency");
  const crypto = btcStats.totalValueVnd + sol.balance * state.market.solUsd * (state.market.usdtVnd || state.market.usdVnd);
  return {
    totalAssets: crypto + stockStats.totalValue + saving + emergency,
    crypto,
    stock: stockStats.totalValue,
    saving,
    emergency,
  };
}

function buildAllocationPlanFromStrategy(state: AppState, availableAmount: number, strategyId: string): AllocationPlan {
  const strategy = state.allocationStrategies.find((item) => item.id === strategyId) ?? DEFAULT_ALLOCATION_STRATEGIES[1];
  const createdAt = new Date().toISOString();
  const currentSnapshot = allocationSnapshotForState(state);
  const rawItems = [
    { actionType: "buy_usdt" as const, targetFund: "crypto", amountVnd: (availableAmount * strategy.targetWeights.crypto) / 100, reason: `Theo chiến lược ${strategy.name}: Crypto ${strategy.targetWeights.crypto}%` },
    { actionType: "buy_stock" as const, targetFund: "stock", amountVnd: (availableAmount * strategy.targetWeights.stock) / 100, reason: `Theo chiến lược ${strategy.name}: CK ${strategy.targetWeights.stock}%` },
    { actionType: "create_mbb_book" as const, targetFund: "saving", amountVnd: (availableAmount * strategy.targetWeights.saving) / 100, reason: `Theo chiến lược ${strategy.name}: Tiết kiệm ${strategy.targetWeights.saving}%` },
    { actionType: "create_mbb_book" as const, targetFund: "emergency", amountVnd: (availableAmount * strategy.targetWeights.emergency) / 100, reason: `Theo chiến lược ${strategy.name}: Dự phòng ${strategy.targetWeights.emergency}%` },
  ];
  const items = rawItems
    .filter((item) => item.amountVnd > 0)
    .map((item, index) => ({
      id: uid(),
      ...item,
      amountVnd: Math.round(item.amountVnd),
      priority: index + 1,
      status: "ready" as const,
      executedEventIds: [] as string[],
    }));
  const projectedSnapshot = {
    ...currentSnapshot,
    totalAssets: currentSnapshot.totalAssets + availableAmount,
    crypto: currentSnapshot.crypto + (items.find((item) => item.targetFund === "crypto")?.amountVnd ?? 0),
    stock: currentSnapshot.stock + (items.find((item) => item.targetFund === "stock")?.amountVnd ?? 0),
    saving: currentSnapshot.saving + (items.find((item) => item.targetFund === "saving")?.amountVnd ?? 0),
    emergency: currentSnapshot.emergency + (items.find((item) => item.targetFund === "emergency")?.amountVnd ?? 0),
  };
  return {
    id: uid(),
    availableAmount,
    strategyId: strategy.id,
    status: "draft",
    currentSnapshot,
    projectedSnapshot,
    items,
    createdAt,
  };
}

function metaForPlannedTransaction(entityType: string, entityId: string, planLink?: PlanActionLink | null): TransactionMeta | undefined {
  if (!planLink) return undefined;
  const now = new Date().toISOString();
  return {
    eventId: stableEventId(entityType, entityId),
    allocationPlanId: planLink.allocationPlanId,
    planItemId: planLink.planItemId,
    createdAt: now,
    updatedAt: now,
    createdBy: "user",
    schemaVersion: FINANCIAL_SCHEMA_VERSION,
  };
}

function withCompletedAllocationPlanItem(state: AppState, planLink: PlanActionLink | null, executedEventId: string): AppState {
  if (!planLink) return state;
  const nextState = {
    ...state,
    allocationPlans: state.allocationPlans.map((plan) => {
      if (plan.id !== planLink.allocationPlanId) return plan;
      const items = plan.items.map((item) =>
        item.id === planLink.planItemId
          ? { ...item, status: "completed" as const, executedEventIds: [...new Set([...item.executedEventIds, executedEventId])] }
          : item
      );
      const isCompleted = items.every((item) => item.status === "completed" || item.status === "skipped");
      return {
        ...plan,
        status: isCompleted ? "completed" as const : "in_progress" as const,
        items,
      };
    }),
  };
  const projectedSnapshot = allocationSnapshotForState(nextState);
  return {
    ...nextState,
    allocationPlans: nextState.allocationPlans.map((plan) =>
      plan.id === planLink.allocationPlanId ? { ...plan, projectedSnapshot } : plan
    ),
  };
}

function ReconciliationPage({ state, commitWithUndo }: { state: AppState; commitWithUndo: CommitWithUndo }) {
  const activeAccounts = state.financialAccounts.filter((account) => account.isActive);
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? "binance");
  const [actualValues, setActualValues] = useState<Record<string, string>>({});
  const [reopenedActualValues, setReopenedActualValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const selectedAccount = state.financialAccounts.find((account) => account.id === accountId);
  const reconciliationFinancialIndex = useMemo(() => buildFinancialIndex(state), [state]);
  const expectedBalances = useMemo(() => expectedReconciliationBalances(state, accountId, reconciliationFinancialIndex), [state, accountId, reconciliationFinancialIndex]);
  const activeSessions = [...state.reconciliationSessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 20);
  const hasReconciliationDifference = (difference: ReconciliationSession["differences"][number]) =>
    Math.abs(difference.differenceAmount ?? 0) > 1 || Math.abs(difference.differenceQuantity ?? 0) > 0.000001;
  const reasonLabels: Record<NonNullable<ReconciliationSession["differences"][number]["reason"]>, string> = {
    missing_transaction: "Thiếu giao dịch",
    fee: "Phí",
    interest: "Lãi",
    dividend: "Cổ tức",
    rounding: "Làm tròn",
    wrong_price: "Sai giá",
    manual_adjustment: "Điều chỉnh tay",
    unknown: "Chưa rõ",
  };
  const resolutionLabels: Record<ReconciliationSession["differences"][number]["resolutionStatus"], string> = {
    unresolved: "Chưa xử lý",
    transaction_created: "Đã tạo giao dịch",
    adjusted: "Đã adjustment",
    accepted: "Chấp nhận lệch",
  };

  const saveSession = () => {
    const actualBalances = expectedBalances.map((expected) => {
      const rawValue = parseDecimal(actualValues[reconciliationBalanceKey(expected)] ?? "");
      return expected?.amountVnd !== undefined
        ? { asset: expected?.asset, stockSymbol: expected?.stockSymbol, amountVnd: rawValue }
        : { asset: expected?.asset, stockSymbol: expected?.stockSymbol, quantity: rawValue };
    });
    const session: ReconciliationSession = {
      id: uid(),
      accountId,
      reconciliationDate: today(),
      status: "completed",
      expectedBalances,
      actualBalances,
      differences: reconciliationDifferences(expectedBalances, actualBalances),
      notes,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    commitWithUndo(
      `Đã lưu đối soát ${selectedAccount?.name ?? accountId}.`,
      (prev) => ({
        ...prev,
        reconciliationSessions: [session, ...prev.reconciliationSessions],
        healthIssues: runHealthChecks(prev, buildFinancialIndex(prev)),
      }),
      { action: "create", entityType: "reconciliation", entityId: session.id }
    );
    setActualValues({});
    setNotes("");
  };

  const reopenSession = (sessionId: string) => {
    commitWithUndo(
      "Đã mở lại phiên đối soát.",
      (prev) => ({
        ...prev,
        reconciliationSessions: prev.reconciliationSessions.map((session) => (session.id === sessionId ? { ...session, status: "reopened" } : session)),
      }),
      { action: "update", entityType: "reconciliation", entityId: sessionId }
    );
  };

  const updateDifference = (
    sessionId: string,
    difference: ReconciliationSession["differences"][number],
    patch: Partial<ReconciliationSession["differences"][number]>
  ) => {
    commitWithUndo(
      "Đã cập nhật dòng chênh lệch đối soát.",
      (prev) => ({
        ...prev,
        reconciliationSessions: prev.reconciliationSessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                differences: session.differences.map((row) =>
                  reconciliationBalanceKey(row) === reconciliationBalanceKey(difference)
                    ? { ...row, ...patch }
                    : row
                ),
              }
            : session
        ),
      }),
      { action: "update", entityType: "reconciliation", entityId: sessionId }
    );
  };

  const saveReopenedSession = (session: ReconciliationSession) => {
    const actualBalances = session.expectedBalances.map((expected) => {
      const key = `${session.id}:${reconciliationBalanceKey(expected)}`;
      const existing = session.actualBalances.find((item) => reconciliationBalanceKey(item) === reconciliationBalanceKey(expected));
      const rawValue = parseDecimal(reopenedActualValues[key] ?? String(existing?.amountVnd ?? existing?.quantity ?? 0));
      return expected?.amountVnd !== undefined
        ? { asset: expected?.asset, stockSymbol: expected?.stockSymbol, amountVnd: rawValue }
        : { asset: expected?.asset, stockSymbol: expected?.stockSymbol, quantity: rawValue };
    });
    const nextDifferences = reconciliationDifferences(session.expectedBalances, actualBalances).map((difference) => {
      const previous = session.differences.find((item) => reconciliationBalanceKey(item) === reconciliationBalanceKey(difference));
      const changed =
        previous?.differenceAmount !== difference.differenceAmount ||
        previous?.differenceQuantity !== difference.differenceQuantity;
      return {
        ...difference,
        reason: previous?.reason ?? difference.reason,
        resolutionStatus: changed ? "unresolved" as const : previous?.resolutionStatus ?? difference.resolutionStatus,
      };
    });
    commitWithUndo(
      "Đã lưu lại phiên đối soát.",
      (prev) => ({
        ...prev,
        reconciliationSessions: prev.reconciliationSessions.map((item) =>
          item.id === session.id
            ? {
                ...item,
                status: "completed",
                actualBalances,
                differences: nextDifferences,
                completedAt: new Date().toISOString(),
              }
            : item
        ),
        healthIssues: runHealthChecks(prev, buildFinancialIndex(prev)),
      }),
      { action: "update", entityType: "reconciliation", entityId: session.id }
    );
    setReopenedActualValues((prev) => {
      const next = { ...prev };
      session.expectedBalances.forEach((balance) => delete next[`${session.id}:${reconciliationBalanceKey(balance)}`]);
      return next;
    });
  };

  const createAdjustment = (session: ReconciliationSession, difference: ReconciliationSession["differences"][number]) => {
    if (!hasReconciliationDifference(difference)) return;
    const adjustment: AdjustmentTransaction = {
      id: uid(),
      reconciliationSessionId: session.id,
      accountId: session.accountId,
      asset: difference.asset,
      stockSymbol: difference.stockSymbol,
      amountVnd: difference.differenceAmount,
      quantity: difference.differenceQuantity,
      reason: difference.reason ?? "unknown",
      date: today(),
      note: `Điều chỉnh từ đối soát ${formatDate(session.reconciliationDate)}`,
      createdAt: new Date().toISOString(),
    };
    commitWithUndo(
      "Đã tạo adjustment từ đối soát.",
      (prev) => normalizeFinancialMetadata({
        ...prev,
        adjustmentTransactions: [adjustment, ...prev.adjustmentTransactions],
        reconciliationSessions: prev.reconciliationSessions.map((item) =>
          item.id === session.id
            ? {
                ...item,
                differences: item.differences.map((row) =>
                  row.asset === difference.asset && row.stockSymbol === difference.stockSymbol
                    ? { ...row, resolutionStatus: "adjusted" }
                    : row
                ),
              }
            : item
        ),
      }),
      { action: "create", entityType: "adjustment", entityId: adjustment.id }
    );
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Đối soát</h2>
        <small>{state.reconciliationSessions.length} phiên</small>
      </div>
      <div className="form-grid">
        <label>
          Tài khoản
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </label>
        <label>
          Ghi chú
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Lý do/chọng từ đối soát" />
        </label>
      </div>
      <div className="settings-list">
        {expectedBalances.map((balance) => {
          const key = reconciliationBalanceKey(balance);
          const expectedText = balance.amountVnd !== undefined ? formatVnd(balance.amountVnd) : String(balance.quantity ?? 0);
          return (
            <div className="settings-list-row" key={key}>
              <div>
                <strong>{balance.stockSymbol ? `${balance.asset} · ${balance.stockSymbol}` : balance.asset}</strong>
                <small>Expected: {expectedText}</small>
              </div>
              <input
                value={actualValues[key] ?? ""}
                onChange={(event) => setActualValues((prev) => ({ ...prev, [key]: event.target.value }))}
                placeholder="Actual"
              />
            </div>
          );
        })}
      </div>
      <div className="form-actions">
        <button className="primary" onClick={saveSession} type="button">
          <Save size={16} /> Lưu phiên đối soát
        </button>
      </div>
      <div className="settings-list">
        {activeSessions.map((session) => (
          <div className="settings-list-row" key={session.id}>
            <div>
              <strong>{state.financialAccounts.find((account) => account.id === session.accountId)?.name ?? session.accountId}</strong>
              <small>{formatDate(session.reconciliationDate)} · {session.status} · {session.differences.length} dòng</small>
              {session.status === "reopened" && (
                <div className="reconciliation-reopen-grid">
                  {session.expectedBalances.map((balance) => {
                    const key = reconciliationBalanceKey(balance);
                    const existing = session.actualBalances.find((item) => reconciliationBalanceKey(item) === key);
                    const inputKey = `${session.id}:${key}`;
                    return (
                      <label key={key}>
                        {balance.stockSymbol ? `${balance.asset} ${balance.stockSymbol}` : balance.asset}
                        <input
                          value={reopenedActualValues[inputKey] ?? String(existing?.amountVnd ?? existing?.quantity ?? 0)}
                          onChange={(event) => setReopenedActualValues((prev) => ({ ...prev, [inputKey]: event.target.value }))}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
              {session.differences.filter(hasReconciliationDifference).map((difference) => (
                <div className="reconciliation-difference-row" key={`${difference.asset}-${difference.stockSymbol ?? ""}`}>
                  <small>
                    {difference.stockSymbol ? `${difference.asset} ${difference.stockSymbol}` : difference.asset}: {typeof difference.differenceAmount === "number" ? formatVnd(difference.differenceAmount) : difference.differenceQuantity}
                  </small>
                  <select
                    value={difference.reason ?? "unknown"}
                    onChange={(event) => updateDifference(session.id, difference, { reason: event.target.value as NonNullable<typeof difference.reason> })}
                  >
                    {Object.entries(reasonLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={difference.resolutionStatus}
                    onChange={(event) => updateDifference(session.id, difference, { resolutionStatus: event.target.value as typeof difference.resolutionStatus })}
                  >
                    {Object.entries(resolutionLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  {difference.resolutionStatus === "unresolved" && (
                    <button className="primary action-button-sm" onClick={() => createAdjustment(session, difference)} type="button">
                      <Plus size={16} /> Adjustment
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="settings-list-actions">
              {session.status === "completed" && (
                <button className="ghost action-button-sm" onClick={() => reopenSession(session.id)} type="button">
                  <RotateCcw size={16} /> Mở lại
                </button>
              )}
              {session.status === "reopened" && (
                <button className="primary action-button-sm" onClick={() => saveReopenedSession(session)} type="button">
                  <Save size={16} /> Lưu lại
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InvestmentPage({
  state,
  setState,
  commitWithUndo,
  activeTab,
  setActiveTab,
  mbbDepositIntent,
  onMbbDepositIntentHandled,
  investmentAction,
  onInvestmentActionHandled,
  onRefreshMarket,
  marketStatus,
  btcCloudAccountId,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  activeTab: InvestmentTab;
  setActiveTab: (tab: InvestmentTab) => void;
  mbbDepositIntent: MbbDepositIntent | null;
  onMbbDepositIntentHandled: () => void;
  investmentAction: InvestmentActionIntent | null;
  onInvestmentActionHandled: () => void;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  marketStatus: string;
  btcCloudAccountId: string;
}) {
  const [investmentRefreshSuccess, setInvestmentRefreshSuccess] = useState(false);
  const [investmentRefreshing, setInvestmentRefreshing] = useState(false);
  const [mbbView, setMbbView] = useState<MbbDepositView>("active");
  const investmentRefreshTimer = useRef<number | null>(null);
  const tabs: Array<{ id: InvestmentTab; label: string }> = [
    { id: "crypto", label: "Crypto" },
    { id: "stock", label: "CK" },
    { id: "mbb", label: "Số MB" },
  ];

  useEffect(() => () => {
    if (investmentRefreshTimer.current) window.clearTimeout(investmentRefreshTimer.current);
  }, []);

  useEffect(() => {
    if (activeTab !== "mbb") setMbbView("active");
  }, [activeTab]);

  const refreshInvestmentPrices = async () => {
    if (investmentRefreshing) return;
    setInvestmentRefreshing(true);
    const symbols = stockPortfolioStats(state).holdings.map((item) => item.symbol);
    const [stockResult, marketUpdated] = await Promise.all([
      refreshStockMarketPrices(symbols, setState),
      onRefreshMarket(true),
    ]);
    setInvestmentRefreshing(false);
    if (marketUpdated || stockResult.updated > 0) {
      setInvestmentRefreshSuccess(true);
      if (investmentRefreshTimer.current) window.clearTimeout(investmentRefreshTimer.current);
      investmentRefreshTimer.current = window.setTimeout(() => setInvestmentRefreshSuccess(false), 2000);
    }
  };

  return (
    <div className="page">
      <header className="page-header report-page-header investment-page-header">
        <div>
          <p className="eyebrow">Tài sản</p>
        </div>
        <div className="page-header-actions report-header-actions">
          {activeTab === "mbb" && (
            <button
              className={`ghost report-refresh-button mbb-history-button ${mbbView === "settled" ? "active" : ""}`}
              onClick={() => setMbbView((current) => current === "active" ? "settled" : "active")}
              type="button"
              title={mbbView === "active" ? "Sổ đã tất toán" : "Sổ đang gửi"}
              aria-label={mbbView === "active" ? "Mở sổ đã tất toán" : "Quay lại sổ đang gửi"}
              aria-pressed={mbbView === "settled"}
            >
              <History size={17} />
            </button>
          )}
          <button className="ghost report-refresh-button" onClick={refreshInvestmentPrices} disabled={investmentRefreshing} type="button" aria-label="Cập nhật giá BTC, CK, SOL">
            <RefreshCw size={17} />
          </button>
          {investmentRefreshSuccess && (
            <span className="refresh-success-pill">
              <CheckCircle2 size={14} /> Đã cập nhật
            </span>
          )}
        </div>
      </header>
      <div className="deposit-tabs investment-tabs" role="tablist" aria-label="Chọn danh mục tài sản">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "crypto" && <CryptoPage state={state} setState={setState} commitWithUndo={commitWithUndo} actionIntent={investmentAction} onActionHandled={onInvestmentActionHandled} onRefreshMarket={onRefreshMarket} marketStatus={marketStatus} btcCloudAccountId={btcCloudAccountId} embedded />}
      {activeTab === "stock" && <StockPage state={state} setState={setState} commitWithUndo={commitWithUndo} actionIntent={investmentAction} onActionHandled={onInvestmentActionHandled} embedded />}
      {activeTab === "mbb" && <BankDepositPage state={state} setState={setState} commitWithUndo={commitWithUndo} actionIntent={investmentAction} onActionHandled={onInvestmentActionHandled} mbbDepositIntent={mbbDepositIntent} onMbbDepositIntentHandled={onMbbDepositIntentHandled} embedded fixedFilter="all" view={mbbView} />}
    </div>
  );
}

function HistoryPanel({ rows, onTrace }: { rows: FundTransaction[]; onTrace?: (item: FundTransaction) => void }) {
  return (
    <article className="panel">
      <div className="panel-title">
        <h2>Lịch sử</h2>
        <small>{rows.length} giao dịch</small>
      </div>
      <div className="timeline">
        {[...rows].reverse().map((item) => (
          <div key={item.id}>
            <span className={item.type}>{item.type === "deposit" ? "+" : "-"}</span>
            <div className="timeline-row-content">
              <div>
                <strong>{formatVnd(item.amount)}</strong>
                <small>{formatDate(item.date)} · {item.note || "Không ghi chú"}</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function BankDepositPage({
  state,
  setState,
  commitWithUndo,
  actionIntent,
  onActionHandled,
  mbbDepositIntent,
  onMbbDepositIntentHandled,
  embedded = false,
  fixedFilter,
  view = "active",
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  actionIntent?: InvestmentActionIntent | null;
  onActionHandled: () => void;
  mbbDepositIntent?: MbbDepositIntent | null;
  onMbbDepositIntentHandled: () => void;
  embedded: boolean;
  fixedFilter?: DepositFilter;
  view?: MbbDepositView;
}) {
  type PendingDepositRequest = {
    source: "allocation" | "sol" | "stock" | "stock-cash" | "btc";
    fund: TransferDepositFund;
    month: string;
    amount: number;
    title: string;
    note: string;
    solWithdrawalId?: string;
  };

  const defaultDepositForm = (fund: DepositFund = "saving") => ({
    fund,
    product: "certificate" as DepositProduct,
    accumulationGoalId: "",
    amount: "",
    certificatePurchaseAmount: "",
    certificateMaturityValue: "",
    certificatePurchaseTouched: false,
    certificateMaturityTouched: false,
    date: today(),
    maturityDate: addMonths(today(), DEFAULT_DEPOSIT_TERM_MONTHS),
    term: String(DEFAULT_DEPOSIT_TERM_MONTHS),
    rate: depositRateForTerm(DEFAULT_DEPOSIT_TERM_MONTHS),
    note: "",
    sourceMonth: "",
    allocationSource: false,
    sourceSolWithdrawalId: "",
  });
  const [form, setForm] = useState(() => defaultDepositForm());
  const [activeFilter, setActiveFilter] = useState<DepositFilter>(fixedFilter ?? "all");
  const [embeddedFilter, setEmbeddedFilter] = useState<DepositFilter>("all");
  const [accumulationGoalFilter, setAccumulationGoalFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [depositFormError, setDepositFormError] = useState("");
  const [pendingSource, setPendingSource] = useState<BankDeposit | null>(null);
  const [earlySettlementDates, setEarlySettlementDates] = useState<Record<string, string>>({});
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const [activePlanLink, setActivePlanLink] = useState<PlanActionLink | null>(null);
  const fundLabel = (fund: DepositFund) => {
    const labels: Record<DepositFund, string> = {
      saving: "Tiết kiệm",
      emergency: "Dự phòng",
      accumulation: "Tích lũy",
    };
    return labels[fund];
  };
  const filterOptions: Array<{ id: DepositFilter; label: string }> = [
    { id: "all", label: "Tổng" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "accumulation", label: "Tích lũy" },
  ];
  const transferFundOptions: Array<{ id: TransferDepositFund; label: string }> = [
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
  ];
  const fundOptions: Array<{ id: DepositFund; label: string }> = [
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "accumulation", label: "Tích lũy" },
  ];
  const effectiveFilter = fixedFilter === "all" ? embeddedFilter : fixedFilter ?? activeFilter;
  const accumulationGoalOptions = state.accumulationGoals
    .filter((goal) => goal.status !== "deleted" || state.bankDeposits.some((deposit) => deposit.accumulationGoalId === goal.id))
    .filter((goal) => goal.status === "active" || state.bankDeposits.some((deposit) => deposit.accumulationGoalId === goal.id))
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  const rows = state.bankDeposits
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => view === "active" ? item.status === "active" : item.status !== "active")
    .filter(({ item }) => view === "settled" || effectiveFilter === "all" || item.fund === effectiveFilter)
    .filter(({ item }) => view === "settled" || effectiveFilter !== "accumulation" || accumulationGoalFilter === "all" || item.accumulationGoalId === accumulationGoalFilter)
    .sort((left, right) => view === "settled"
      ? (right.item.settledAt ?? right.item.maturityDate).localeCompare(left.item.settledAt ?? left.item.maturityDate) || right.index - left.index
      : right.item.startDate.localeCompare(left.item.startDate) || right.index - left.index)
    .map(({ item }) => item);
  const savingActiveTotal = state.bankDeposits.filter((item) => item.fund === "saving").reduce((sum, item) => sum + activePrincipal(item), 0);
  const emergencyActiveTotal = state.bankDeposits.filter((item) => item.fund === "emergency").reduce((sum, item) => sum + activePrincipal(item), 0);
  const accumulationActiveTotal = state.bankDeposits.filter((item) => item.fund === "accumulation").reduce((sum, item) => sum + activePrincipal(item), 0);
  const activeInterestForFund = (fund: DepositFund) => state.bankDeposits
    .filter((item) => item.fund === fund && item.status === "active")
    .reduce((sum, item) => sum + depositProgress(item).accruedInterest, 0);
  const metricBreakdownForFund = (principal: number, fund: DepositFund) => {
    const interest = activeInterestForFund(fund);
    const interestPercent = formatCompactPercent(principal ? (interest / principal) * 100 : 0);
    return {
      currentValue: principal + interest,
      left: {
        value: formatVnd(principal),
        ariaLabel: `Tiền gốc ${formatVnd(principal)}`,
      },
      right: {
        value: `${formatVnd(interest)} · ${interestPercent}`,
        ariaLabel: `Lãi hiện tại ${formatVnd(interest)}, ${interestPercent} so với tiền gốc`,
      },
    };
  };
  const pendingAllocations = state.allocations
    .filter((allocation) => allocation.confirmedAt)
    .flatMap((allocation) =>
      transferFundOptions.map(({ id }) => ({
        source: "allocation" as const,
        fund: id,
        month: allocation.month,
        amount: id === "saving" ? allocation.savingAmount ?? 0 : allocation.emergencyAmount ?? 0,
        title: `${fundLabel(id)} · Tháng ${formatMonth(allocation.month)} chưa tạo sổ`,
        note: `Tạo sổ từ chia quỹ ${formatMonth(allocation.month)}`,
        depositRequestedAt: allocation[depositRequestedField(id)],
        depositCreatedAt: allocation[depositCreatedField(id)],
      }))
    )
    .filter(
      (allocation) =>
        allocation.amount > 0 &&
        allocation.depositRequestedAt &&
        !allocation.depositCreatedAt &&
        !state.bankDeposits.some((deposit) => deposit.fund === allocation.fund && deposit.createdFromMonth === allocation.month)
    )
    .sort((a, b) => a.month.localeCompare(b.month));
  const pendingSolDeposits = state.solTransactions
    .filter(
      (transaction) =>
        isSolWithdrawal(transaction) &&
        (transaction.destination === "saving" || transaction.destination === "emergency") &&
        !state.bankDeposits.some((deposit) => deposit.createdFromSolWithdrawalId === transaction.id)
    )
    .map((transaction) => {
      const withdrawal = transaction as SolWithdrawTransaction;
      const fund = withdrawal.destination as TransferDepositFund;
      return {
        source: "sol" as const,
        fund,
        month: monthFromDate(withdrawal.date),
        amount: withdrawal.vndAmount,
        title: `${fundLabel(fund)} · Rút từ SOL chưa tạo sổ`,
        note: withdrawal.note ? `Rút từ SOL · ${withdrawal.note}` : "Rút từ SOL",
        solWithdrawalId: withdrawal.id,
      };
    });
  const pendingStockSaleDeposits = state.stockSales
    .filter(
      (sale) =>
        (sale.destination === "saving" || sale.destination === "emergency") &&
        !state.bankDeposits.some((deposit) => deposit.note.includes(stockSaleDepositMarker(sale.id)))
    )
    .map((sale) => {
      const fund = sale.destination as TransferDepositFund;
      return {
        source: "stock" as const,
        fund,
        month: monthFromDate(sale.date),
        amount: stockSaleNetVndAmount(sale),
        title: `${fundLabel(fund)} · Rút từ CK chưa tạo sổ`,
        note: sale.note ? `Rút từ CK ${sale.symbol} · ${sale.note} ${stockSaleDepositMarker(sale.id)}` : `Rút từ CK ${sale.symbol} ${stockSaleDepositMarker(sale.id)}`,
      };
    });
  const pendingStockCashDeposits = state.fundTransactions
    .map((transaction) => ({ transaction, marker: parseStockCashWithdrawalMarker(transaction.note) }))
    .filter(
      (row) =>
        row.transaction.fund === "stock" &&
        row.transaction.type === "withdraw" &&
        row.marker &&
        row.marker.amount > 0 &&
        !state.bankDeposits.some((deposit) => deposit.note.includes(row.marker!.marker))
    )
    .map((row) => {
      const marker = row.marker!;
      return {
        source: "stock-cash" as const,
        fund: marker.fund,
        month: row.transaction.month,
        amount: marker.amount,
        title: `${fundLabel(marker.fund)} · Rút tiền dư CK chưa tạo sổ`,
        note: `Rút tiền dư CK ${marker.marker}`,
      };
    });
  const pendingBtcTransferDeposits = state.btcTransfers
    .filter(
      (transfer) =>
        (transfer.destination === "saving" || transfer.destination === "emergency") &&
        !state.bankDeposits.some((deposit) => deposit.note.includes(btcTransferDepositMarker(transfer.id)))
    )
    .map((transfer) => {
      const fund = transfer.destination as TransferDepositFund;
      return {
        source: "btc" as const,
        fund,
        month: monthFromDate(transfer.date),
        amount: transfer.vndAmount,
        title: `${fundLabel(fund)} · Rút từ BTC chưa tạo sổ`,
        note: transfer.note ? `Rút từ BTC · ${transfer.note} ${btcTransferDepositMarker(transfer.id)}` : `Rút từ BTC ${btcTransferDepositMarker(transfer.id)}`,
      };
    });
  const pendingDepositRequests: PendingDepositRequest[] = [...pendingAllocations, ...pendingSolDeposits, ...pendingStockSaleDeposits, ...pendingStockCashDeposits, ...pendingBtcTransferDeposits].sort((a, b) => a.month.localeCompare(b.month));
  const depositTermForAccumulationGoal = (goal: AccumulationGoal, startDate: string) => {
    let term = accumulationUnpaidMonths(state, goal);
    if (!goal.dueDate) return term;
    const dueTime = dateOnlyTime(goal.dueDate);
    while (term > 0 && dateOnlyTime(addMonths(startDate, term)) >= dueTime) term -= 1;
    return term;
  };
  const accumulationDepositDefaults = (goal: AccumulationGoal | undefined, startDate: string) => {
    const term = goal ? depositTermForAccumulationGoal(goal, startDate) : DEFAULT_DEPOSIT_TERM_MONTHS;
    return {
      accumulationGoalId: goal?.id || "",
      amount: goal ? goal.monthlyAmount.toLocaleString("vi-VN") : "",
      term: String(term),
      rate: depositRateForTerm(term),
      maturityDate: addMonths(startDate, term),
    };
  };
  const standardDepositDefaults = (startDate: string) => ({
    term: String(DEFAULT_DEPOSIT_TERM_MONTHS),
    rate: depositRateForTerm(DEFAULT_DEPOSIT_TERM_MONTHS),
    maturityDate: addMonths(startDate, DEFAULT_DEPOSIT_TERM_MONTHS),
  });
  const formatCertificateMaturityEstimate = (input: ReturnType<typeof defaultDepositForm>) => {
    const amount = parseMoney(input.amount);
    if (!amount) return "";
    const term = Number(input.term) || 0;
    const maturityDate = input.maturityDate || addMonths(input.date, term);
    return estimateCertificateMaturityValue(amount, parseDecimal(input.rate), term, input.date, maturityDate).toLocaleString("vi-VN");
  };
  const withCertificateDefaults = (input: ReturnType<typeof defaultDepositForm>) => ({
    ...input,
    product: "certificate" as DepositProduct,
    certificatePurchaseAmount: input.certificatePurchaseTouched ? input.certificatePurchaseAmount : input.amount,
    certificateMaturityValue: input.certificateMaturityTouched ? input.certificateMaturityValue : formatCertificateMaturityEstimate(input),
  });

  const updateDepositDate = (date: string) => {
    setForm((prev) => {
      if (prev.fund === "accumulation") {
        const goal = state.accumulationGoals.find((item) => item.id === prev.accumulationGoalId);
        return withCertificateDefaults({
          ...prev,
          date,
          ...(goal ? accumulationDepositDefaults(goal, date) : standardDepositDefaults(date)),
          certificatePurchaseTouched: false,
          certificateMaturityTouched: false,
        });
      }
      const termMonths = Math.max(Number(prev.term) || 0, 0);
      return withCertificateDefaults({
        ...prev,
        date,
        rate: depositRateForTerm(termMonths),
        maturityDate: addMonths(date, termMonths),
      });
    });
  };

  const updateDepositTerm = (term: string) => {
    setForm((prev) => {
      let termMonths = Math.max(Number(term) || 0, 0);
      const goal = prev.fund === "accumulation"
        ? state.accumulationGoals.find((item) => item.id === prev.accumulationGoalId)
        : undefined;
      if (goal?.dueDate) {
        const dueTime = dateOnlyTime(goal.dueDate);
        while (termMonths > 0 && dateOnlyTime(addMonths(prev.date, termMonths)) >= dueTime) termMonths -= 1;
      }
      return withCertificateDefaults({
        ...prev,
        term: String(termMonths),
        rate: depositRateForTerm(termMonths),
        maturityDate: addMonths(prev.date, termMonths),
      });
    });
  };

  const updateDepositAmount = (amount: string) => {
    setForm((prev) => withCertificateDefaults({ ...prev, amount }));
  };

  const updateDepositRate = (rate: string) => {
    setForm((prev) => withCertificateDefaults({ ...prev, rate }));
  };

  const updateDepositMaturityDate = (maturityDate: string) => {
    setForm((prev) => {
      const goal = prev.fund === "accumulation"
        ? state.accumulationGoals.find((item) => item.id === prev.accumulationGoalId)
        : undefined;
      const safeMaturityDate = goal?.dueDate && dateOnlyTime(maturityDate) >= dateOnlyTime(goal.dueDate)
        ? addDays(goal.dueDate, -1)
        : maturityDate;
      return withCertificateDefaults({ ...prev, maturityDate: safeMaturityDate });
    });
  };

  const openDepositForm = (nextForm: Partial<typeof form>) => {
    setForm((prev) =>
      withCertificateDefaults({
        ...prev,
        certificatePurchaseTouched: Boolean(nextForm.certificatePurchaseAmount),
        certificateMaturityTouched: Boolean(nextForm.certificateMaturityValue),
        ...nextForm,
      })
    );
    setDepositFormError("");
    setFormOpen(true);
  };

  const selectMetricFilter = (fund: DepositFund) => {
    const nextFilter = effectiveFilter === fund ? "all" : fund;
    if (fixedFilter === "all") {
      setEmbeddedFilter(nextFilter);
    } else {
      setActiveFilter(nextFilter);
    }
    if (nextFilter !== "accumulation") setAccumulationGoalFilter("all");
  };

  const activeAccumulationGoals = state.accumulationGoals.filter((goal) => goal.status === "active");
  const updateDepositFund = (fund: DepositFund) => {
    setForm((prev) => {
      const firstGoal = activeAccumulationGoals[0];
      if (fund !== "accumulation") {
        return withCertificateDefaults({
          ...prev,
          fund,
          accumulationGoalId: "",
          ...standardDepositDefaults(prev.date),
          certificatePurchaseTouched: false,
          certificateMaturityTouched: false,
        });
      }
      const goal = state.accumulationGoals.find((item) => item.id === prev.accumulationGoalId) ?? firstGoal;
      return withCertificateDefaults({
        ...prev,
        fund,
        ...accumulationDepositDefaults(goal, prev.date),
        certificatePurchaseTouched: false,
        certificateMaturityTouched: false,
      });
    });
    setDepositFormError("");
  };

  const updateDepositAccumulationGoal = (accumulationGoalId: string) => {
    const goal = state.accumulationGoals.find((item) => item.id === accumulationGoalId);
    setForm((prev) => withCertificateDefaults({
      ...prev,
      ...accumulationDepositDefaults(goal, prev.date),
      certificatePurchaseTouched: false,
      certificateMaturityTouched: false,
    }));
    setDepositFormError("");
  };

  const openManualDepositForm = () => {
    setPendingSource(null);
    const nextFund = effectiveFilter === "all" ? form.fund : effectiveFilter;
    const nextGoal = nextFund === "accumulation" ? (accumulationGoalFilter !== "all" ? accumulationGoalFilter : activeAccumulationGoals[0]?.id ?? "") : "";
    const goal = state.accumulationGoals.find((item) => item.id === nextGoal);
    openDepositForm({
      fund: nextFund,
      ...(nextFund === "accumulation" ? accumulationDepositDefaults(goal, form.date) : standardDepositDefaults(form.date)),
      amount: nextFund === "accumulation" && goal ? goal.monthlyAmount.toLocaleString("vi-VN") : form.amount,
      allocationSource: false,
      sourceMonth: "",
      sourceSolWithdrawalId: "",
    });
  };

  useEffect(() => {
    if (!actionIntent || actionIntent.tab !== "mbb" || actionIntent.action !== "mbb-deposit") return;
    const targetFund: DepositFund = actionIntent.targetFund === "emergency" ? "emergency" : "saving";
    setActivePlanLink(actionIntent.planLink ?? null);
    openDepositForm({
      fund: targetFund,
      ...standardDepositDefaults(form.date),
      amount: actionIntent.amountVnd ? actionIntent.amountVnd.toLocaleString("vi-VN") : form.amount,
      note: actionIntent.planLink ? `Từ kế hoạch phân bổ ${actionIntent.planLink.planItemId}` : form.note,
      allocationSource: false,
      sourceMonth: "",
      sourceSolWithdrawalId: "",
    });
    onActionHandled?.();
  }, [actionIntent?.id]);

  useEffect(() => {
    if (!mbbDepositIntent) return;
    const nextFund = mbbDepositIntent.fund;
    if (fixedFilter === "all") {
      setEmbeddedFilter(nextFund);
    } else {
      setActiveFilter(nextFund);
    }
    setAccumulationGoalFilter(mbbDepositIntent.accumulationGoalId ?? "all");
    onMbbDepositIntentHandled?.();
  }, [mbbDepositIntent?.id]);

  const prefillPendingDeposit = (allocation: PendingDepositRequest) => {
    setPendingSource(null);
    openDepositForm({
      fund: allocation.fund,
      accumulationGoalId: "",
      amount: allocation.amount.toLocaleString("vi-VN"),
      date: today(),
      ...standardDepositDefaults(today()),
      sourceMonth: allocation.month,
      allocationSource: allocation.source === "allocation",
      sourceSolWithdrawalId: allocation.solWithdrawalId ?? "",
      note: allocation.note,
    });
  };

  const addDeposit = () => {
    const amount = parseMoney(form.amount);
    if (!amount) return;
    if (form.fund === "accumulation" && !form.accumulationGoalId) {
      setDepositFormError("Chọn mục tích lũy cho sổ này.");
      return;
    }
    const sourceDeposit = pendingSource;
    commitWithUndo("Đã thêm sổ MBB.", (prev) => {
      const sourceMonth = form.sourceMonth || monthFromDate(form.date);
      const nextDepositRaw = makeDeposit(
        prev.bankDeposits,
        form.fund,
        "certificate",
        amount,
        parseMoney(form.certificatePurchaseAmount),
        parseMoney(form.certificateMaturityValue),
        parseDecimal(form.rate),
        Number(form.term),
        form.date,
        form.maturityDate,
        sourceMonth,
        form.note,
        sourceDeposit?.id ?? "",
        form.sourceSolWithdrawalId || "",
        form.fund === "accumulation" ? form.accumulationGoalId : sourceDeposit?.accumulationGoalId ?? ""
      );
      const nextDeposit: BankDeposit = {
        ...nextDepositRaw,
        meta: metaForPlannedTransaction("deposit", nextDepositRaw.id, activePlanLink),
      };

      const bankDeposits = sourceDeposit
        ? prev.bankDeposits.map((item) =>
            item.id === sourceDeposit.id
              ? {
                  ...item,
                  status: "rolled-all" as DepositStatus,
                  childId: nextDeposit.id,
                  settledAt: sourceDeposit.maturityDate,
                  settledAmount: nextDeposit.principal,
                }
              : item
          )
        : prev.bankDeposits;

      return withCompletedAllocationPlanItem({
        ...prev,
        bankDeposits: [...bankDeposits, nextDeposit],
        allocations: form.allocationSource
          ? prev.allocations.map((allocation) =>
              allocation.month === sourceMonth
                ? { ...allocation, [depositCreatedField(form.fund as TransferDepositFund)]: new Date().toISOString() }
                : allocation
            )
          : prev.allocations,
      }, activePlanLink, stableEventId("deposit", nextDeposit.id));
    });
    setForm(defaultDepositForm());
    setActivePlanLink(null);
    setFormOpen(false);
    setPendingSource(null);
  };

  const settleEarly = (id: string, settlementDate: string) => {
    commitWithUndo("Đã tất toán trước hạn.", (prev) => {
      const source = prev.bankDeposits.find((item) => item.id === id && item.status === "active");
      if (!source) return prev;
      const settledDeposit: BankDeposit = {
        ...source,
        status: "early-settled",
        settledAt: settlementDate || today(),
        settledAmount: source.principal,
      };
      const settlementIncome = appendMbbSettlementIncome(
        prev.incomeCategories,
        prev.incomeTransactions,
        settledDeposit
      );
      return {
        ...prev,
        ...settlementIncome,
        bankDeposits: prev.bankDeposits.map((item) => item.id === id ? settledDeposit : item),
      };
    }, { action: "update", entityType: "deposit", entityId: id });
    setEarlySettlementDates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const createNewFromMatured = (item: BankDeposit) => {
    const nextPrincipal = item.principal + interestFor(item);
    const sourceDepositLabel = `${item.code}${item.mbLast4 ? ` ${item.mbLast4}` : ""}`;
    const linkedGoal = item.accumulationGoalId ? state.accumulationGoals.find((goal) => goal.id === item.accumulationGoalId) : undefined;
    const nextSchedule = item.fund === "accumulation" && linkedGoal
      ? accumulationDepositDefaults(linkedGoal, item.maturityDate)
      : {
          term: String(item.termMonths),
          rate: depositRateForTerm(item.termMonths),
          maturityDate: addMonths(item.maturityDate, item.termMonths),
        };
    setPendingSource(item);
    openDepositForm({
      fund: item.fund,
      product: "certificate",
      accumulationGoalId: item.accumulationGoalId ?? "",
      amount: nextPrincipal.toLocaleString("vi-VN"),
      certificateMaturityValue: "",
      date: item.maturityDate,
      ...nextSchedule,
      sourceMonth: monthFromDate(item.maturityDate),
      allocationSource: false,
      sourceSolWithdrawalId: "",
      note: `Quay vòng từ sổ ${sourceDepositLabel}`,
    });
  };

  const settleMatured = (id: string) => {
    commitWithUndo("Đã rút toàn bộ sổ.", (prev) => {
      const source = prev.bankDeposits.find((item) => item.id === id && item.status === "active");
      if (!source) return prev;
      const settledDeposit: BankDeposit = {
        ...source,
        status: "settled",
        settledAt: today(),
        settledAmount: source.principal + interestFor(source),
      };
      const settlementIncome = appendMbbSettlementIncome(
        prev.incomeCategories,
        prev.incomeTransactions,
        settledDeposit
      );
      return {
        ...prev,
        ...settlementIncome,
        bankDeposits: prev.bankDeposits.map((item) => item.id === id ? settledDeposit : item),
      };
    }, { action: "update", entityType: "deposit", entityId: id });
  };

  const deleteDeposit = (item: BankDeposit) => {
    if (!window.confirm(`Xóa sổ ${item.code}? Thao tác này sẽ xóa sổ khỏi lịch sử và bằng tăng trưởng tài sản.`)) return;

    commitWithUndo("Đã xóa sổ MBB.", (prev) => {
      const relatedIncomeTransactions = prev.incomeTransactions.filter((transaction) => transaction.id === mbbSettlementIncomeId(item.id));
      const relatedPayloads = {
        allocations: item.fund !== "accumulation" && item.createdFromMonth && !item.createdFromSolWithdrawalId
          ? prev.allocations.filter((allocation) => allocation.month === item.createdFromMonth)
          : [],
        incomeTransactions: relatedIncomeTransactions,
      };
      return withTrashItem(
        {
          ...prev,
          bankDeposits: prev.bankDeposits
            .filter((deposit) => deposit.id !== item.id)
            .map((deposit) => {
              if (deposit.childId === item.id) {
                return {
                  ...deposit,
                  status: "active" as DepositStatus,
                  childId: undefined,
                  settledAt: undefined,
                  settledAmount: undefined,
                };
              }
              if (deposit.parentId === item.id) {
                return { ...deposit, parentId: undefined };
              }
              return deposit;
            }),
          allocations: item.fund !== "accumulation" && item.createdFromMonth && !item.createdFromSolWithdrawalId
            ? prev.allocations.map((allocation) =>
                allocation.month === item.createdFromMonth
                  ? item.fund === "accumulation"
                    ? allocation
                    : { ...allocation, [depositCreatedField(item.fund)]: allocation[depositCreatedField(item.fund)] ?? new Date().toISOString() }
                  : allocation
              )
            : prev.allocations,
          incomeTransactions: relatedIncomeTransactions.length
            ? prev.incomeTransactions.filter((transaction) => transaction.id !== mbbSettlementIncomeId(item.id))
            : prev.incomeTransactions,
        },
        makeTrashItem("deposit", item.id, `sổ MBB ${item.code}`, item, relatedPayloads)
      );
    }, { action: "delete", entityType: "deposit", entityId: item.id });
    setEarlySettlementDates((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    if (pendingSource?.id === item.id) setPendingSource(null);
  };

  const fundSelectionLocked = Boolean(form.sourceMonth);

  const content = (
    <>
      {!embedded && (
        <header className="page-header">
          <div>
            <p className="eyebrow">Qu? MBB</p>
            <h1>S? MBB</h1>
          </div>
        </header>
      )}
      {view === "active" && (
        <>
      {!fixedFilter && (
        <div className="deposit-tabs" role="tablist" aria-label="LĐc sổ MBB">
          {filterOptions.map((option) => (
            <button
              className={activeFilter === option.id ? "active" : ""}
              key={option.id}
              onClick={() => setActiveFilter(option.id)}
              role="tab"
              type="button"
              aria-selected={activeFilter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <section className="metrics-grid mbb-metrics-grid">
        {fundOptions.map(({ id, label }) => {
          const principal = id === "saving" ? savingActiveTotal : id === "emergency" ? emergencyActiveTotal : accumulationActiveTotal;
          const metric = metricBreakdownForFund(principal, id);
          const icon = id === "emergency" ? <Landmark size={20} /> : <PiggyBank size={20} />;
          return (
            <MetricCard
              key={id}
              label={label}
              value={formatVnd(metric.currentValue)}
              breakdown={{ left: metric.left, right: metric.right }}
              icon={icon}
              tone={effectiveFilter === id ? "highlight" : undefined}
              onClick={() => selectMetricFilter(id)}
            />
          );
        })}
      </section>
      {effectiveFilter === "accumulation" && (
        <div className="deposit-tabs accumulation-goal-filter" role="tablist" aria-label="LĐc sổ MBB tích lũy theo mục">
          <button
            className={accumulationGoalFilter === "all" ? "active" : ""}
            onClick={() => setAccumulationGoalFilter("all")}
            role="tab"
            type="button"
            aria-selected={accumulationGoalFilter === "all"}
          >
            Tất cả mục
          </button>
          {accumulationGoalOptions.map((goal) => (
            <button
              className={accumulationGoalFilter === goal.id ? "active" : ""}
              key={goal.id}
              onClick={() => setAccumulationGoalFilter(goal.id)}
              role="tab"
              type="button"
              aria-selected={accumulationGoalFilter === goal.id}
            >
              {goal.name}
            </button>
          ))}
        </div>
      )}
      {pendingDepositRequests.length > 0 && (
        <section className="pending-stack">
          {pendingDepositRequests.map((allocation) => (
            <article
              className="pending-banner clickable"
              key={`${allocation.source}-${allocation.fund}-${allocation.month}-${allocation.solWithdrawalId ?? "allocation"}`}
              onClick={() => prefillPendingDeposit(allocation)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  prefillPendingDeposit(allocation);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div>
                <strong>{allocation.title}</strong>
                <small>{formatVnd(allocation.amount)}</small>
              </div>
              <button
                className="primary"
                onClick={(event) => {
                  event.stopPropagation();
                  prefillPendingDeposit(allocation);
                }}
              >
                <Plus size={17} /> Tạo sổ
              </button>
            </article>
          ))}
        </section>
      )}
      <section className="panel">
        <div className="panel-title">
          <h2>Thêm sổ MBB</h2>
          {!formOpen ? (
            <button className="ghost asset-open-button action-button-sm" onClick={openManualDepositForm}>
              Mở form
            </button>
          ) : (
            <button
              className="icon-button"
              title="Đóng form"
              onClick={() => {
                setFormOpen(false);
                setDepositFormError("");
                setPendingSource(null);
              }}
              type="button"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {formOpen && (
          <div className="deposit-confirm bank-deposit-form">
            {pendingSource && (
              <p className="muted deposit-source-hint">
                Tạo từ {pendingSource.code} · gốc {formatVnd(pendingSource.principal)} · lãi {formatVnd(interestFor(pendingSource))}
              </p>
            )}
            <div className="deposit-fund-field">
              <span>Loại sổ</span>
              <div className="deposit-fund-toggle" role="group" aria-label="Chọn loại sổ">
                {fundOptions.map((option) => (
                  <button
                    className={form.fund === option.id ? "active" : ""}
                    disabled={fundSelectionLocked}
                    key={option.id}
                    onClick={() => updateDepositFund(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Đã thanh toán
              <input
                value={form.certificatePurchaseAmount || (!form.certificatePurchaseTouched && form.amount ? form.amount : "")}
                onChange={(event) => setForm({ ...form, certificatePurchaseAmount: formatMoneyChange(event), certificatePurchaseTouched: true })}
                placeholder={form.amount || "2.000.055"}
              />
            </label>
            <label>
              Giá trị cuối kỳ MB
              <input
                value={form.certificateMaturityValue || (!form.certificateMaturityTouched ? formatCertificateMaturityEstimate(form) : "")}
                onChange={(event) => setForm({ ...form, certificateMaturityValue: formatMoneyChange(event), certificateMaturityTouched: true })}
                placeholder={formatCertificateMaturityEstimate(form) || "2.035.288"}
              />
            </label>
            {form.fund === "accumulation" && (
              <label className="deposit-accumulation-select-field">
                Mục tích lũy
                <select value={form.accumulationGoalId} onChange={(event) => updateDepositAccumulationGoal(event.target.value)} required>
                  <option value="">Chọn mục tích lũy</option>
                  {activeAccumulationGoals.map((goal) => (
                    <option value={goal.id} key={goal.id}>{goal.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Số tiền
              <input value={form.amount} onChange={(event) => updateDepositAmount(formatMoneyChange(event))} placeholder="6.000.000" />
            </label>
            <label>
              Ngày gửi
              <input type="date" value={form.date} onChange={(event) => updateDepositDate(event.target.value)} />
            </label>
            <label>
              Kỳ hạn tháng
              <input value={form.term} onChange={(event) => updateDepositTerm(event.target.value)} />
            </label>
            <label>
              Ngày đáo hạn
              <input type="date" value={form.maturityDate} onChange={(event) => updateDepositMaturityDate(event.target.value)} />
            </label>
            <label>
              Lãi suất %
              <input value={form.rate} onChange={(event) => updateDepositRate(formatDecimalChange(event))} />
            </label>
            <label>
              Note
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </label>
            <button className="primary bank-deposit-submit" onClick={addDeposit}>
              <Plus size={17} /> Thêm sổ
            </button>
            {depositFormError && <span className="form-error">{depositFormError}</span>}
          </div>
        )}
      </section>
        </>
      )}

      {view === "settled" && (
        <div className="deposit-history-heading">
          <div>
            <p className="eyebrow">Lịch sử MBB</p>
            <h2>Sổ đã tất toán</h2>
          </div>
          <strong>{rows.length} sổ</strong>
        </div>
      )}

      <section className="deposit-list">
        {rows.length === 0 && (
          <div className="deposit-empty-state">
            {view === "settled" ? "Chưa có sổ MBB nào đã tất toán." : "Chưa có sổ MBB đang gửi."}
          </div>
        )}
        {rows.map((item) => {
          const due = daysUntil(item.maturityDate);
          const matured = due <= 0 && item.status === "active";
          const interest = interestFor(item);
          const displayRate = Number.isFinite(item.rate) ? item.rate : 0;
          const progress = depositProgress(item);
          const parentDeposit = item.parentId ? state.bankDeposits.find((deposit) => deposit.id === item.parentId) : undefined;
          const parentDepositLabel = parentDeposit ? `${parentDeposit.code}${parentDeposit.mbLast4 ? ` ${parentDeposit.mbLast4}` : ""}` : "";
          const linkedGoal = item.accumulationGoalId ? state.accumulationGoals.find((goal) => goal.id === item.accumulationGoalId) : undefined;
          return (
            <article className={`deposit-card ${due <= 7 && item.status === "active" ? "danger" : due <= 30 && item.status === "active" ? "warning" : ""}`} key={item.id}>
              <button className="deposit-delete-button" onClick={() => deleteDeposit(item)} title={`Xóa sổ ${item.code}`} type="button" aria-label={`Xóa sổ ${item.code}`}>
                <X size={16} />
              </button>
              <button className="deposit-trace-button" onClick={() => setTraceEventIds([item.meta?.eventId ?? stableEventId("deposit", item.id)])} title={`Xem nguồn tiền số ${item.code}`} type="button" aria-label={`Xem nguồn tiền số ${item.code}`}>
                <History size={15} />
              </button>
              <div className="deposit-head">
                <div>
                  <div className="deposit-code-row">
                    <span className={`fund-badge ${item.fund}`}>{fundLabel(item.fund)}</span>
                    <input
                      className="deposit-last4-inline"
                      value={item.mbLast4}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          bankDeposits: prev.bankDeposits.map((deposit) =>
                            deposit.id === item.id ? { ...deposit, mbLast4: event.target.value.replace(/\D/g, "").slice(0, 4) } : deposit
                          ),
                        }))
                      }
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4 số cuối"
                      aria-label={`4 số cuối số ${item.code}`}
                    />
                  </div>
                  <h3>{formatVnd(item.principal)}</h3>
                </div>
                <span className={`status ${item.status}`}>{matured ? "Đã đáo hạn - Chưa xử lý" : statusLabel(item.status)}</span>
              </div>
              <div className="deposit-meta">
                <span>Gửi {formatDate(item.startDate)}</span>
                <span>Đáo hạn {formatDate(item.maturityDate)}</span>
                <span>Kỳ hạn {item.termMonths} tháng</span>
                <span>Lãi {displayRate.toLocaleString("vi-VN", { maximumFractionDigits: 3 })}%/năm</span>
                {view === "active" && <span>Lãi cuối kỳ {formatVnd(interest)}</span>}
                {linkedGoal && <span className="deposit-accumulation-goal"><strong>Mục tích lũy</strong> <b>{linkedGoal.name}</b></span>}
                {item.settledAt && <span>Ngày {formatDate(item.settledAt)}</span>}
              </div>
              {view === "active" && (
                <>
              <div className="progress-track deposit-progress-track" aria-label={`Tiến độ sổ ${item.code}: ${progress.progressPercent.toFixed(0)}%`}>
                <span style={{ width: `${progress.progressPercent}%` }} />
              </div>
              <div className="deposit-progress-summary">
                <span>
                  Còn lại
                  <strong>{progress.remainingDays.toLocaleString("vi-VN")} ngày</strong>
                </span>
                <span>
                  Tiền lãi
                  <strong>{formatVnd(progress.accruedInterest)}</strong>
                </span>
              </div>
              {item.parentId && <p className="muted">{parentDepositLabel ? `Quay vòng từ sổ ${parentDepositLabel}.` : "Tạo mới từ sổ trước."}</p>}
              {item.childId && <p className="muted">Đã tạo sổ mới từ sổ này.</p>}
              {matured && (
                <div className="card-actions">
                  <button className="primary" onClick={() => createNewFromMatured(item)}>
                    Tạo sổ mới
                  </button>
                  <button className="ghost" onClick={() => settleMatured(item.id)}>
                    Rút toàn bộ
                  </button>
                </div>
              )}
              {item.status === "active" && !matured && (
                <div className="card-actions">
                  <input
                    className="compact-date-input"
                    type="date"
                    value={earlySettlementDates[item.id] ?? today()}
                    onChange={(event) => setEarlySettlementDates((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    aria-label={`Ngày tất toán trước hạn ${item.code}`}
                  />
                  <button className="ghost" onClick={() => settleEarly(item.id, earlySettlementDates[item.id] ?? today())}>
                    Tất toán
                  </button>
                </div>
              )}
                </>
              )}
            </article>
          );
        })}
      </section>
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền Sổ MBB"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function statusLabel(status: DepositStatus) {
  const labels: Record<DepositStatus, string> = {
    active: "Đang gửi",
    "rolled-principal": "gốc",
    "rolled-all": "gốc + lãi",
    settled: "Đã tất toán",
    "early-settled": "Tất toán",
  };
  return labels[status];
}

function SolPage({
  state,
  setState,
  commitWithUndo,
  onRefreshMarket,
  marketStatus,
  btcCloudAccountId,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  marketStatus: string;
  btcCloudAccountId: string;
  embedded: boolean;
}) {
  type SolFormMode = "buy" | "withdraw";

  const [form, setForm] = useState({ sol: "", price: "", date: today(), note: "" });
  const [formMode, setFormMode] = useState<SolFormMode>("buy");
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const [withdrawForm, setWithdrawForm] = useState({
    sol: "",
    price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "",
    vnd: "",
    btc: "",
    destination: "cash" as SolDestination,
    date: today(),
    note: "",
  });
  const [withdrawBtcTouched, setWithdrawBtcTouched] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const solStats = solPositionFromState(state);
  const totalSol = solStats.balance;
  const cost = solStats.cost;
  const currentUsd = totalSol * state.market.solUsd;
  const pnl = currentUsd - cost;
  const pnlPercent = cost ? (pnl / cost) * 100 : 0;
  const currentVnd = currentUsd * (state.market.usdtVnd || state.market.usdVnd);
  const pnlVnd = pnl * (state.market.usdtVnd || state.market.usdVnd);
  const destinationOptions: Array<{ id: SolDestination; label: string }> = [
    { id: "btc", label: "BTC - về USDT" },
    { id: "btc-direct", label: "BTC - mua BTC trước tiếp" },
    { id: "stock", label: "CK" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "cash", label: "Tiền mặt" },
  ];

  useEffect(() => {
    if (!state.market.solUsd) return;
    const nextPrice = formatDecimalInput(String(state.market.solUsd));
    setForm((prev) => (prev.price === nextPrice ? prev : { ...prev, price: nextPrice }));
    setWithdrawForm((prev) => {
      const estimate = prev.sol ? Math.round(parseDecimal(prev.sol) * parseDecimal(nextPrice) * (state.market.usdtVnd || state.market.usdVnd)) : 0;
      const nextVnd = estimate ? estimate.toLocaleString("vi-VN") : prev.vnd;
      const nextBtc = prev.destination === "btc-direct" && !withdrawBtcTouched ? estimateBtcFromSolInput(prev.sol, nextPrice, state.market.btcUsdt) : prev.btc;
      if (prev.price === nextPrice && prev.vnd === nextVnd && prev.btc === nextBtc) return prev;
      return { ...prev, price: nextPrice, vnd: nextVnd, btc: nextBtc };
    });
  }, [state.market.solUsd, state.market.usdtVnd, state.market.usdVnd, state.market.btcUsdt, withdrawBtcTouched]);

  const estimatedWithdrawVnd = (solInput: string, priceInput: string) =>
    Math.round(parseDecimal(solInput) * parseDecimal(priceInput) * (state.market.usdtVnd || state.market.usdVnd));

  const updateWithdrawSol = (sol: string) => {
    const nextSol = formatSolInput(sol);
    setWithdrawBtcTouched(false);
    setWithdrawForm((prev) => {
      const estimate = estimatedWithdrawVnd(nextSol, prev.price);
      return {
        ...prev,
        sol: nextSol,
        vnd: estimate ? estimate.toLocaleString("vi-VN") : "",
        btc: prev.destination === "btc-direct" ? estimateBtcFromSolInput(nextSol, prev.price, state.market.btcUsdt) : prev.btc,
      };
    });
    setWithdrawError("");
  };

  const updateWithdrawPrice = (price: string) => {
    const nextPrice = formatDecimalInput(price);
    setWithdrawBtcTouched(false);
    setWithdrawForm((prev) => {
      const estimate = estimatedWithdrawVnd(prev.sol, nextPrice);
      return {
        ...prev,
        price: nextPrice,
        vnd: estimate ? estimate.toLocaleString("vi-VN") : "",
        btc: prev.destination === "btc-direct" ? estimateBtcFromSolInput(prev.sol, nextPrice, state.market.btcUsdt) : prev.btc,
      };
    });
    setWithdrawError("");
  };

  const updateWithdrawVnd = (vnd: string) => {
    const nextVnd = formatMoneyInput(vnd);
    const sol = parseDecimal(withdrawForm.sol);
    const vndAmount = parseMoney(nextVnd);
    const usdtVndRate = state.market.usdtVnd || state.market.usdVnd;
    const price = sol && usdtVndRate ? vndAmount / sol / usdtVndRate : 0;
    setWithdrawBtcTouched(false);
    setWithdrawForm((prev) => {
      const nextPrice = price ? formatDecimalInput(price.toFixed(2)) : prev.price;
      return {
        ...prev,
        vnd: nextVnd,
        price: nextPrice,
        btc: prev.destination === "btc-direct" ? estimateBtcFromSolInput(prev.sol, nextPrice, state.market.btcUsdt) : prev.btc,
      };
    });
    setWithdrawError("");
  };

  const updateWithdrawDestination = (destination: SolDestination) => {
    setWithdrawBtcTouched(false);
    setWithdrawForm((prev) => ({
      ...prev,
      destination,
      btc: destination === "btc-direct" ? estimateBtcFromSolInput(prev.sol, prev.price, state.market.btcUsdt) : "",
    }));
  };

  const fillMaxWithdrawSol = () => {
    setWithdrawBtcTouched(false);
    updateWithdrawSol(formatDecimalNumberInput(totalSol, 8));
  };

  const addSol = () => {
    const sol = parseDecimal(form.sol);
    const price = parseDecimal(form.price);
    if (!sol || !price) return;
    const costVnd = Math.round(sol * price * (state.market.usdtVnd || state.market.usdVnd));
    commitWithUndo("Đã thêm SOL.", (prev) => ({
      ...prev,
      solTransactions: [...prev.solTransactions, { id: uid(), type: "buy", solAmount: sol, buyPrice: price, costVnd, date: form.date, occurredAt: occurredAtForDate(form.date), note: form.note }],
    }));
    setForm({ sol: "", price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "", date: today(), note: "" });
  };

  const withdrawSol = () => {
    const sol = parseDecimal(withdrawForm.sol);
    const sellPrice = parseDecimal(withdrawForm.price);
    const vndAmount = parseMoney(withdrawForm.vnd);
    const btcAmount = parseDecimal(withdrawForm.btc);
    const usdtAmount = sol * sellPrice;
    if (!sol || !sellPrice || !vndAmount || (withdrawForm.destination === "btc-direct" && !btcAmount)) return;
    if (sol - totalSol > 0.00000001) {
      setWithdrawError("Số SOL rút lớn hơn số SOL đang có.");
      return;
    }

    const userNote = withdrawForm.note.trim();
    const note = userNote || "Rút từ SOL";
    const transferNote = userNote ? `Rút từ SOL · ${userNote}` : "Rút từ SOL";
    const withdrawal: SolWithdrawTransaction = {
      id: uid(),
      type: "withdraw",
      solAmount: sol,
      sellPrice,
      usdtAmount,
      vndAmount,
      destination: withdrawForm.destination,
      date: withdrawForm.date,
      occurredAt: occurredAtForDate(withdrawForm.date),
      closesPosition: closesCryptoPosition(sol, totalSol),
      note,
    };
    const btcTopup: BtcUsdtTopup | null =
      withdrawal.destination === "btc"
        ? {
            id: uid(),
            vndAmount,
            usdtAmount,
            date: withdrawal.date,
            occurredAt: occurredAtForDate(withdrawal.date),
            sourceSolWithdrawalId: withdrawal.id,
            note: `${transferNote} · USDT từ SOL`,
          }
        : null;
    const btcTrade: BtcTrade | null =
      withdrawal.destination === "btc-direct" && btcAmount
        ? {
            id: uid(),
            type: "manual-buy",
            usdtAmount,
            btcAmount,
            btcPriceUsdt: usdtAmount / btcAmount,
            costVnd: vndAmount,
            executedAt: occurredAtForDate(withdrawal.date),
            note: `${transferNote} · Mua BTC trực tiếp ${solBtcTradeMarker(withdrawal.id)}`,
          }
        : null;

    commitWithUndo("Đã rút/chuyển SOL.", (prev) => ({
      ...prev,
      solTransactions: [...prev.solTransactions, withdrawal],
      btcUsdtTopups: btcTopup ? [...prev.btcUsdtTopups, btcTopup] : prev.btcUsdtTopups,
      btcTrades: btcTrade ? [...prev.btcTrades, btcTrade] : prev.btcTrades,
      fundTransactions:
        withdrawal.destination === "btc" || withdrawal.destination === "btc-direct" || withdrawal.destination === "stock"
          ? [
              ...prev.fundTransactions,
              {
                id: uid(),
                fund: withdrawal.destination === "btc-direct" ? "btc" : withdrawal.destination,
                type: "deposit",
                amount: vndAmount,
                date: withdrawal.date,
                month: monthFromDate(withdrawal.date),
                note: transferNote,
              },
            ]
          : prev.fundTransactions,
      incomeTransactions:
        withdrawal.destination === "cash"
          ? [
              ...prev.incomeTransactions,
              {
                id: uid(),
                categoryId: "other-income",
                amount: vndAmount,
                date: withdrawal.date,
                month: monthFromDate(withdrawal.date),
                note: transferNote,
              },
            ]
          : prev.incomeTransactions,
    }));
    if (btcTopup && btcCloudAccountId) {
      void upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, btcTopup.id, btcTopup).catch(() => {
        // The encrypted app snapshot still keeps this topup if direct ledger sync is offline.
      });
    }
    if (btcTrade && btcCloudAccountId) {
      void upsertCloudPayloadRow("btc_trades", btcCloudAccountId, btcTrade.id, btcTrade, { executed_at: btcTrade.executedAt, plan_id: null }).catch(() => {
        // Local snapshot keeps the direct BTC buy if cloud ledger sync is offline.
      });
    }

    setWithdrawForm({
      sol: "",
      price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "",
      vnd: "",
      btc: "",
      destination: "cash",
      date: today(),
      note: "",
    });
    setWithdrawBtcTouched(false);
    setWithdrawError("");
  };

  const solTransferNoteForHistory = (item: SolWithdrawTransaction) =>
    item.note && item.note !== "Rút từ SOL" ? `Rút từ SOL · ${item.note}` : "Rút từ SOL";

  const deleteSolHistoryItem = (item: SolTransaction) => {
    if (!window.confirm(`Xóa ${isSolWithdrawal(item) ? "lệnh rút/chuyển SOL" : "lệnh thêm SOL"} này? Số dư SOL và các quỹ liên quan sẽ được tính lại.`)) return;
    const relatedBtcTopups =
      isSolWithdrawal(item) && item.destination === "btc"
        ? state.btcUsdtTopups.filter((topup) => {
            const transferNote = solTransferNoteForHistory(item);
            return isTopupLinkedToSolWithdrawal(topup, item, `${transferNote} · USDT từ SOL`);
          })
        : [];
    const relatedBtcTrades =
      isSolWithdrawal(item) && item.destination === "btc-direct"
        ? state.btcTrades.filter((trade) => trade.note.includes(solBtcTradeMarker(item.id)))
        : [];

    commitWithUndo(isSolWithdrawal(item) ? "Đã xóa lệnh rút/chuyển SOL." : "Đã xóa lệnh thêm SOL.", (prev) => {
      if (!isSolWithdrawal(item)) {
        return withTrashItem(
          {
            ...prev,
            solTransactions: prev.solTransactions.filter((transaction) => transaction.id !== item.id),
          },
          makeTrashItem("sol", item.id, `lệnh thêm SOL ${formatSolAmount(item.solAmount)}`, item)
        );
      }
      const transferNote = solTransferNoteForHistory(item);
      const relatedBtcTopupIds = new Set(relatedBtcTopups.map((topup) => topup.id));
      const relatedBtcTradeIds = new Set(relatedBtcTrades.map((trade) => trade.id));
      const relatedFundTransactions =
        item.destination === "btc" || item.destination === "btc-direct" || item.destination === "stock"
          ? prev.fundTransactions.filter(
              (transaction) =>
                transaction.fund === (item.destination === "btc-direct" ? "btc" : item.destination) &&
                transaction.type === "deposit" &&
                transaction.amount === item.vndAmount &&
                transaction.date === item.date &&
                transaction.note === transferNote
            )
          : [];
      const relatedIncomeTransactions =
        item.destination === "cash"
          ? prev.incomeTransactions.filter(
              (transaction) =>
                transaction.categoryId === "other-income" &&
                transaction.amount === item.vndAmount &&
                transaction.date === item.date &&
                transaction.note === transferNote
            )
          : [];
      return withTrashItem(
        {
          ...prev,
          solTransactions: prev.solTransactions.filter((transaction) => transaction.id !== item.id),
          btcUsdtTopups: relatedBtcTopupIds.size ? prev.btcUsdtTopups.filter((topup) => !relatedBtcTopupIds.has(topup.id)) : prev.btcUsdtTopups,
          btcTrades: relatedBtcTradeIds.size ? prev.btcTrades.filter((trade) => !relatedBtcTradeIds.has(trade.id)) : prev.btcTrades,
          fundTransactions: relatedFundTransactions.length ? prev.fundTransactions.filter((transaction) => !relatedFundTransactions.some((row) => row.id === transaction.id)) : prev.fundTransactions,
          incomeTransactions: relatedIncomeTransactions.length ? prev.incomeTransactions.filter((transaction) => !relatedIncomeTransactions.some((row) => row.id === transaction.id)) : prev.incomeTransactions,
        },
        makeTrashItem("sol", item.id, `lệnh rút/chuyển SOL ${formatSolAmount(item.solAmount)}`, item, {
          btcUsdtTopups: relatedBtcTopups,
          btcTrades: relatedBtcTrades,
          fundTransactions: relatedFundTransactions,
          incomeTransactions: relatedIncomeTransactions,
        })
      );
    }, { action: "delete", entityType: "sol", entityId: item.id });
    if (btcCloudAccountId) {
      relatedBtcTopups.forEach((topup) => {
        void deleteCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, topup.id).catch(() => {
          setWithdrawError("Đã xóa local, nhưng chưa xóa được USDT từ SOL trên BTC cloud.");
        });
      });
      relatedBtcTrades.forEach((trade) => {
        void deleteCloudPayloadRow("btc_trades", btcCloudAccountId, trade.id).catch(() => {
          setWithdrawError("Đã xóa local, nhưng chưa xóa được BTC mua từ SOL trên BTC cloud.");
        });
      });
    }
  };

  const content = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">SOL</p>
        </div>
      </header>
      <section className="metrics-grid">
        <MetricCard label="Tổng SOL" value={formatSolAmount(totalSol)} icon={<Coins size={20} />} />
        <MetricCard label="giá SOL" value={formatUsd(currentUsd)} subValue={formatUsd(cost)} icon={<CircleDollarSign size={20} />} />
        <MetricCard
          label="Lãi/lỗ"
          value={`${formatUsd(pnl)} · ${pnlPercent.toFixed(1)}%`}
          subValue={formatVnd(pnlVnd)}
          icon={<BarChart3 size={20} />}
          tone={pnl >= 0 ? "highlight" : "loss"}
        />
      </section>
      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Giá thị trường</h2>
            <button className="ghost report-refresh-button" onClick={() => onRefreshMarket()} type="button" aria-label="Cập nhật giá">
              <RefreshCw size={17} />
            </button>
          </div>
          <small className="market-status">{marketStatus || (state.market.updatedAt ? `Cập nhật ${formatDateTime(state.market.updatedAt)}` : "Chưa cập nhật")}</small>
          <div className="market-grid">
            <div>
              <small>SOL/USDT</small>
              <strong>{state.market.solUsd ? formatUsdt(state.market.solUsd) : "Đang chờ"}</strong>
            </div>
            <div>
              <small>USDT/VND</small>
              <strong>{state.market.usdtVnd ? formatVnd(state.market.usdtVnd) : "Đang chờ"}</strong>
            </div>
            <div>
              <small>SOL sở hữu</small>
              <strong>{formatVnd(currentVnd)}</strong>
            </div>
          </div>
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>Giao dịch SOL</h2>
            <button className="icon-button" title="Lưu SOL" onClick={formMode === "buy" ? addSol : withdrawSol}>
              <Save size={18} />
            </button>
          </div>
          <div className="deposit-tabs investment-tabs" role="tablist" aria-label="Chọn loại giao dịch SOL">
            <button className={formMode === "buy" ? "active" : ""} onClick={() => setFormMode("buy")} role="tab" type="button" aria-selected={formMode === "buy"}>
              Thêm SOL
            </button>
            <button className={formMode === "withdraw" ? "active" : ""} onClick={() => setFormMode("withdraw")} role="tab" type="button" aria-selected={formMode === "withdraw"}>
              Rút SOL
            </button>
          </div>
          {formMode === "buy" ? (
            <>
              <div className="form-grid">
                <label>
                  Số SOL
                  <input value={form.sol} onChange={(event) => setForm({ ...form, sol: formatSolChange(event) })} placeholder="0,61" />
                </label>
                <label>
                  Giá mua
                  <input value={form.price} onChange={(event) => setForm({ ...form, price: formatDecimalChange(event) })} placeholder="77,58" />
                </label>
                <label>
                  Ngày
                  <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
                </label>
                <label>
                  Note
                  <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
                </label>
              </div>
              <button className="primary" onClick={addSol}>
                <Plus size={17} /> Thêm SOL
              </button>
            </>
          ) : (
            <>
              <div className="form-grid sol-withdraw-grid">
                <label>
                  Số SOL rút
                  <InputWithMax value={withdrawForm.sol} onChange={(event) => updateWithdrawSol(formatSolChange(event))} onMax={fillMaxWithdrawSol} placeholder="0,25" />
                </label>
                <label>
                  Giá SOL lúc rút
                  <input value={withdrawForm.price} onChange={(event) => updateWithdrawPrice(formatDecimalChange(event))} placeholder={state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "76,43"} />
                </label>
                <label>
                  Tiền VND nhận
                  <input value={withdrawForm.vnd} onChange={(event) => updateWithdrawVnd(formatMoneyChange(event))} placeholder="5.000.000" />
                </label>
                {withdrawForm.destination === "btc-direct" && (
                  <label>
                    Số BTC nhận
                    <input value={withdrawForm.btc} onChange={(event) => { setWithdrawBtcTouched(true); setWithdrawForm({ ...withdrawForm, btc: formatDecimalChange(event) }); }} placeholder="0,0001234" />
                  </label>
                )}
                <label>
                  Nơi nhận
                  <select value={withdrawForm.destination} onChange={(event) => updateWithdrawDestination(event.target.value as SolDestination)}>
                    {destinationOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note
                  <input value={withdrawForm.note} onChange={(event) => setWithdrawForm({ ...withdrawForm, note: event.target.value })} placeholder="Rút từ SOL" />
                </label>
                <label>
                  Ngày
                  <input type="date" value={withdrawForm.date} onChange={(event) => setWithdrawForm({ ...withdrawForm, date: event.target.value })} />
                </label>
              </div>
              {withdrawError && <span className="form-error">{withdrawError}</span>}
              <button className="primary" onClick={withdrawSol}>
                <ArrowDownCircle size={17} /> Rút SOL
              </button>
            </>
          )}
        </article>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Lịch sử SOL</h2>
          <small>Giá vốn trung bình {cost && totalSol ? formatUsd(cost / totalSol) : "0 USDT"}</small>
        </div>
        <div className="timeline history-five-list">
          {[...state.solTransactions].reverse().map((item) => (
            <div key={item.id}>
              <span className={isSolWithdrawal(item) ? "withdraw" : "deposit"}>{isSolWithdrawal(item) ? "-" : "+"}</span>
              <div className="timeline-row-content">
                <div>
                  {isSolWithdrawal(item) ? (
                    <>
                      <strong>-{formatSolAmount(item.solAmount)} · {formatVnd(item.vndAmount)}</strong>
                      <small>{formatDate(item.date)} · Rút về {solDestinationLabel(item.destination)} · Giá rút {formatUsd(item.sellPrice)} · {item.note || "Không ghi chú"}</small>
                    </>
                  ) : (
                    <>
                      <strong>{formatSolAmount(item.solAmount)} · {formatUsd(item.solAmount * item.buyPrice)}</strong>
                      <small>{formatDate(item.date)} · Giá mua {formatUsd(item.buyPrice)} · {item.note || "Không ghi chú"}</small>
                    </>
                  )}
                </div>
                <button className="row-icon-button history-delete-button danger-text timeline-delete-button" onClick={() => deleteSolHistoryItem(item)} title="Xóa lịch sử" type="button">
                  <X size={15} />
                </button>
                <button className="row-icon-button timeline-delete-button" onClick={() => setTraceEventIds([item.meta?.eventId ?? stableEventId("sol", item.id)])} title="Xem nguồn tiền" type="button">
                  <History size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền SOL"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function CryptoPage({
  state,
  setState,
  commitWithUndo,
  actionIntent,
  onActionHandled,
  onRefreshMarket,
  marketStatus,
  btcCloudAccountId,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  actionIntent?: InvestmentActionIntent | null;
  onActionHandled: () => void;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  marketStatus: string;
  btcCloudAccountId: string;
  embedded: boolean;
}) {
  type CryptoAction = "topup" | "dca" | "sol" | "withdraw" | null;
  type CryptoTransferAsset = "btc" | "usdt" | "sol";

  const btcStats = btcPortfolioStats(state);
  const solStats = solPositionFromState(state);
  const [activeAction, setActiveAction] = useState<CryptoAction>(null);
  const [topupForm, setTopupForm] = useState({ vnd: "", usdt: "", date: today(), note: "" });
  const [planForm, setPlanForm] = useState({ amountUsdt: "2", frequency: "daily" as BtcDcaFrequency, time: "12:00", startDate: today() });
  const [legacyDcaForm, setLegacyDcaForm] = useState({
    amountUsdt: "2",
    frequency: "daily" as BtcDcaFrequency,
    time: "12:00",
    startDate: "2026-07-13",
    nextDate: "2026-07-30",
    activeRuns: "14",
    btcAmount: "0,00043251",
    latestPriceUsdt: "64.337,674905",
    averagePriceUsdt: "64.565,25594748",
    note: "DCA Binance",
  });
  const [solForm, setSolForm] = useState({
    sol: "",
    price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "",
    valueUsdt: "",
    valueVnd: "",
    date: today(),
  });
  const [transferForm, setTransferForm] = useState({
    asset: "btc" as CryptoTransferAsset,
    btc: "",
    usdt: "",
    sol: "",
    price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "",
    received: "",
    btcReceived: "",
    destination: "usdt" as BtcTransferTarget | "btc-direct",
    date: today(),
    note: "",
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showLegacyDca, setShowLegacyDca] = useState(false);
  const [expandedDcaPlanIds, setExpandedDcaPlanIds] = useState<string[]>([]);
  const [historyDcaPlanIds, setHistoryDcaPlanIds] = useState<string[]>([]);
  const [editingDcaAssetPlanId, setEditingDcaAssetPlanId] = useState<string | null>(null);
  const [dcaAssetForm, setDcaAssetForm] = useState({ btcAmount: "", averagePriceUsdt: "" });
  const [cryptoError, setCryptoError] = useState("");
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const [activePlanLink, setActivePlanLink] = useState<PlanActionLink | null>(null);
  const [balanceAdjustmentOpen, setBalanceAdjustmentOpen] = useState(false);
  const [balanceAdjustmentForm, setBalanceAdjustmentForm] = useState({ btc: "", sol: "", usdt: "", date: today() });
  const [balanceAdjustmentError, setBalanceAdjustmentError] = useState("");
  const cryptoFinancialIndex = useMemo(() => buildFinancialIndex(state), [state]);
  const cryptoSnapshot = cryptoAssetPnlSnapshot(state);
  const solValueVnd = cryptoSnapshot.solValueVnd;
  const solPnlVnd = solValueVnd - cryptoSnapshot.solHoldingCostVnd;
  const cryptoValue = cryptoSnapshot.current;
  const cryptoPrincipal = cryptoSnapshot.principal;
  const cryptoPnl = cryptoSnapshot.pnl;
  const cryptoPnlPercent = cryptoSnapshot.pnlPercent;
  const usdtVndRate = state.market.usdtVnd || state.market.usdVnd;
  const cryptoValueUsdt = usdtVndRate ? cryptoValue / usdtVndRate : 0;
  const formatSolFormDecimal = (value: number, digits = 6) => {
    if (!Number.isFinite(value) || value <= 0) return "";
    return formatDecimalInput(value.toFixed(digits).replace(/\.?0+$/, ""));
  };
  const solFormComputedUsdt = (parseDecimal(solForm.sol) || 0) * (parseDecimal(solForm.price) || 0);
  const solFormComputedVnd = Math.round(solFormComputedUsdt * usdtVndRate);
  const btcValueVnd = btcStats.btcValueUsdt * usdtVndRate;
  const usdtValueVnd = btcStats.usdtBalance * usdtVndRate;
  const btcCostBasis = cryptoSnapshot.btcCostBasis;
  const solAverageCost = solStats.balance ? solStats.cost / solStats.balance : 0;
  const usdtAverageCost = btcStats.usdtBalance ? btcCostBasis.usdtCostVnd / btcStats.usdtBalance : 0;
  const btcPnlUsdt = btcStats.btcValueUsdt - btcStats.btcCostUsdt;
  const solValueUsdt = solStats.balance * state.market.solUsd;
  const solPnlUsdt = solValueUsdt - solStats.cost;
  const usdtPnlVnd = usdtValueVnd - btcCostBasis.usdtCostVnd;
  const formatBtcPlain = (value: number) =>
    value.toLocaleString("vi-VN", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
  const formatCryptoPricePlain = (value: number, digits = 3) =>
    value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
  const formatCryptoAmountPlain = (value: number, digits = 5) =>
    value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
  const formatBalanceAdjustmentInput = (value: number, digits: number) =>
    formatDecimalInput(value.toFixed(digits).replace(".", ","));
  const openBalanceAdjustment = () => {
    setBalanceAdjustmentForm({
      btc: formatBalanceAdjustmentInput(btcStats.btcBalance, 8),
      sol: formatBalanceAdjustmentInput(solStats.balance, 5),
      usdt: formatBalanceAdjustmentInput(btcStats.usdtBalance, 3),
      date: today(),
    });
    setBalanceAdjustmentError("");
    setBalanceAdjustmentOpen(true);
  };
  const closeBalanceAdjustment = () => {
    setBalanceAdjustmentOpen(false);
    setBalanceAdjustmentError("");
  };
  const saveBalanceAdjustment = () => {
    if (!balanceAdjustmentForm.btc || !balanceAdjustmentForm.sol || !balanceAdjustmentForm.usdt) {
      return setBalanceAdjustmentError("Nhập đủ số lượng BTC, SOL và USDT thực tế.");
    }

    const targets: Array<{ asset: CryptoAdjustmentAsset; current: number; target: number; tolerance: number; label: string }> = [
      { asset: "BTC", current: btcStats.btcBalance, target: parseDecimal(balanceAdjustmentForm.btc), tolerance: 0.00000001, label: formatBtcPlain(parseDecimal(balanceAdjustmentForm.btc)) },
      { asset: "SOL", current: solStats.balance, target: parseDecimal(balanceAdjustmentForm.sol), tolerance: 0.00001, label: formatCryptoAmountPlain(parseDecimal(balanceAdjustmentForm.sol)) },
      { asset: "USDT", current: btcStats.usdtBalance, target: parseDecimal(balanceAdjustmentForm.usdt), tolerance: 0.000001, label: formatCryptoAmountPlain(parseDecimal(balanceAdjustmentForm.usdt), 3) },
    ];
    if (targets.some((target) => target.target < 0 || !Number.isFinite(target.target))) {
      return setBalanceAdjustmentError("Số lượng thực tế không hợp lệ.");
    }

    const createdAt = new Date().toISOString();
    const adjustments: AdjustmentTransaction[] = [];
    targets.forEach((target) => {
      const quantity = target.target - target.current;
      if (Math.abs(quantity) <= target.tolerance) return;
      const id = uid();
      adjustments.push({
        id,
        reconciliationSessionId: `manual-crypto-${id}`,
        accountId: CRYPTO_ADJUSTMENT_ACCOUNT_ID,
        asset: target.asset,
        quantity,
        reason: "manual_adjustment",
        date: balanceAdjustmentForm.date,
        note: `Điều chỉnh số lượng ${target.asset} về ${target.label}`,
        createdAt,
      });
    });

    if (!adjustments.length) {
      return setBalanceAdjustmentError("Số lượng chưa thay đổi so với app.");
    }

    commitWithUndo(
      "Đã điều chỉnh số lượng Crypto.",
      (prev) => ({
        ...prev,
        adjustmentTransactions: [...adjustments, ...prev.adjustmentTransactions],
      }),
      { action: "create", entityType: "adjustment", entityId: adjustments[0].id }
    );
    closeBalanceAdjustment();
  };
  const activeDcaPlans = state.btcDcaPlans.filter((plan) => plan.isActive);
  const latestCryptoAllocationNotice = [...state.fundTransactions]
    .reverse()
    .find(
      (transaction) =>
        transaction.fund === "btc" &&
        transaction.type === "deposit" &&
        transaction.note === "Chia quỹ cuối tháng" &&
        !state.settings.dismissedCryptoAllocationIds.includes(transaction.id)
    );
  const dcaFrequencyLabel: Record<BtcDcaFrequency, string> = { daily: "Hàng ngày", weekly: "Hàng tuần", monthly: "Hàng tháng" };
  const destinationOptions = (asset: CryptoTransferAsset): Array<{ id: BtcTransferTarget | "btc-direct"; label: string }> => {
    if (asset === "btc") return [{ id: "usdt", label: "USDT" }];
    if (asset === "sol") return [{ id: "btc", label: "USDT" }];
    return [
      { id: "btc", label: "BTC" },
      { id: "stock", label: "CK" },
      { id: "saving", label: "Tiết kiệm" },
      { id: "emergency", label: "Dự phòng" },
      { id: "cash", label: "Tiền mặt" },
    ];
  };
  const assetRows = [
    {
      id: "btc",
      name: "Bitcoin",
      symbol: "BTC",
      amount: formatBtcPlain(btcStats.btcBalance),
      valueDisplay: formatUsdt(btcStats.btcValueUsdt),
      marketPrice: state.market.btcUsdt ? formatCryptoPricePlain(state.market.btcUsdt) : "Đang chờ",
      averagePrice: btcStats.averageCostUsdt ? formatCryptoPricePlain(btcStats.averageCostUsdt) : "0",
      pnlValue: btcPnlUsdt,
      pnlDisplay: formatUsdt(btcPnlUsdt),
      icon: <Bitcoin size={18} />,
    },
    {
      id: "sol",
      name: "Solana",
      symbol: "SOL",
      amount: formatCryptoAmountPlain(solStats.balance),
      valueDisplay: formatUsdt(solValueUsdt),
      marketPrice: state.market.solUsd ? formatCryptoPricePlain(state.market.solUsd, 2) : "Đang chờ",
      averagePrice: solAverageCost ? formatCryptoPricePlain(solAverageCost, 2) : "0",
      pnlValue: solPnlUsdt,
      pnlDisplay: formatUsdt(solPnlUsdt),
      icon: <Coins size={18} />,
    },
    {
      id: "usdt",
      name: "Tether",
      symbol: "USDT",
      amount: formatCryptoAmountPlain(btcStats.usdtBalance, 3),
      valueDisplay: formatVnd(usdtValueVnd),
      marketPrice: state.market.usdtVnd ? formatVnd(state.market.usdtVnd) : "Đang chờ",
      averagePrice: usdtAverageCost ? formatVnd(usdtAverageCost) : "0đ",
      pnlValue: usdtPnlVnd,
      pnlDisplay: formatVnd(usdtPnlVnd),
      icon: <CircleDollarSign size={18} />,
    },
  ];
  const cryptoMarketStatusLabel = state.market.updatedAt
    ? `Cập nhật ${new Date(state.market.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : marketStatus || "Chưa cập nhật";

  const dismissCryptoAllocationNotice = () => {
    if (!latestCryptoAllocationNotice) return;
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        dismissedCryptoAllocationIds: [...new Set([...(prev.settings.dismissedCryptoAllocationIds ?? []), latestCryptoAllocationNotice.id])],
      },
    }));
  };

  const updateSolFormSol = (value: string) => {
    const sol = formatSolInput(value);
    setSolForm((prev) => {
      const amount = parseDecimal(sol);
      const price = parseDecimal(prev.price);
      const valueUsdt = amount && price ? amount * price : 0;
      return {
        ...prev,
        sol,
        valueUsdt: formatSolFormDecimal(valueUsdt),
        valueVnd: valueUsdt ? formatMoneyInput(String(Math.round(valueUsdt * usdtVndRate))) : "",
      };
    });
  };

  const updateSolFormPrice = (value: string) => {
    const price = formatDecimalInput(value);
    setSolForm((prev) => {
      const amount = parseDecimal(prev.sol);
      const valueUsdt = amount && parseDecimal(price) ? amount * parseDecimal(price) : 0;
      return {
        ...prev,
        price,
        valueUsdt: formatSolFormDecimal(valueUsdt),
        valueVnd: valueUsdt ? formatMoneyInput(String(Math.round(valueUsdt * usdtVndRate))) : "",
      };
    });
  };

  const updateSolFormValueUsdt = (value: string) => {
    const valueUsdt = formatDecimalInput(value);
    setSolForm((prev) => {
      const amount = parseDecimal(prev.sol);
      const total = parseDecimal(valueUsdt);
      return {
        ...prev,
        valueUsdt,
        price: amount && total ? formatSolFormDecimal(total / amount) : prev.price,
        valueVnd: total ? formatMoneyInput(String(Math.round(total * usdtVndRate))) : "",
      };
    });
  };

  const updateSolFormValueVnd = (value: string) => {
    const valueVnd = formatMoneyInput(value);
    setSolForm((prev) => {
      const vnd = parseMoney(valueVnd);
      const totalUsdt = vnd && usdtVndRate ? vnd / usdtVndRate : 0;
      const amount = parseDecimal(prev.sol);
      return {
        ...prev,
        valueVnd,
        valueUsdt: totalUsdt ? formatSolFormDecimal(totalUsdt) : "",
        price: amount && totalUsdt ? formatSolFormDecimal(totalUsdt / amount) : prev.price,
      };
    });
  };

  useEffect(() => {
    const nextPrice = transferPriceFor(transferForm.asset, transferForm.destination);
    if (!nextPrice) return;
    setTransferForm((prev) => (prev.price === formatDecimalInput(String(nextPrice)) ? prev : { ...prev, price: formatDecimalInput(String(nextPrice)) }));
  }, [state.market.btcUsdt, state.market.solUsd, state.market.usdtVnd, state.market.usdVnd, transferForm.asset, transferForm.destination]);

  useEffect(() => {
    if (!state.market.solUsd) return;
    setSolForm((prev) => {
      if (prev.price) return prev;
      const price = formatDecimalInput(String(state.market.solUsd));
      const valueUsdt = (parseDecimal(prev.sol) || 0) * state.market.solUsd;
      return {
        ...prev,
        price,
        valueUsdt: formatSolFormDecimal(valueUsdt),
        valueVnd: valueUsdt ? formatMoneyInput(String(Math.round(valueUsdt * usdtVndRate))) : prev.valueVnd,
      };
    });
  }, [state.market.solUsd]);

  useEffect(() => {
    if (!actionIntent || actionIntent.tab !== "crypto" || actionIntent.action !== "btc-topup") return;
    setActiveAction("topup");
    if (actionIntent.planLink) {
      const planLink = actionIntent.planLink;
      setActivePlanLink(planLink);
      setTopupForm((prev) => ({
        ...prev,
        vnd: actionIntent.amountVnd ? actionIntent.amountVnd.toLocaleString("vi-VN") : prev.vnd,
        note: `Từ kế hoạch phân bổ ${planLink.planItemId}`,
      }));
    }
    onActionHandled?.();
  }, [actionIntent?.id]);

  const syncBtcRow = (table: string, id: string, payload: unknown, columns: Record<string, unknown> = {}) => {
    if (!btcCloudAccountId) return;
    void upsertCloudPayloadRow(table, btcCloudAccountId, id, payload, columns).catch(() => {
      setCryptoError("Đã lưu local, nhưng chưa đồng bộ được BTC cloud.");
    });
  };

  function transferPriceFor(asset: CryptoTransferAsset, destination: BtcTransferTarget | "btc-direct") {
    if (asset === "sol") return state.market.solUsd;
    if (asset === "usdt" && destination !== "btc") return usdtVndRate;
    return state.market.btcUsdt;
  }

  const transferSourceAmount = () => {
    if (transferForm.asset === "btc") return parseDecimal(transferForm.btc);
    if (transferForm.asset === "sol") return parseDecimal(transferForm.sol);
    return parseDecimal(transferForm.usdt);
  };

  const transferReceiveUnit = () => {
    if (transferForm.asset === "btc" && transferForm.destination === "usdt") return "USDT";
    if (transferForm.asset === "sol") return "USDT";
    if (transferForm.asset === "usdt" && transferForm.destination === "btc") return "BTC";
    return "VND";
  };

  const transferEstimatedReceive = () => {
    const source = transferSourceAmount();
    const price = parseDecimal(transferForm.price) || transferPriceFor(transferForm.asset, transferForm.destination);
    if (!source || !price) return 0;
    if (transferForm.asset === "btc") return source * price;
    if (transferForm.asset === "sol") return source * price;
    if (transferForm.asset === "usdt" && transferForm.destination === "btc") return source / price;
    if (transferForm.asset === "usdt") return source * price;
    return 0;
  };

  const transferEstimatedBtcFromSol = () => {
    if (transferForm.asset !== "sol" || transferForm.destination !== "btc-direct") return "";
    return estimateBtcFromSolInput(transferForm.sol, transferForm.price, state.market.btcUsdt);
  };

  const formatTransferReceive = () => {
    const value = transferEstimatedReceive();
    const unit = transferReceiveUnit();
    if (unit === "BTC") return formatBtc(value);
    if (unit === "USDT") return formatUsdt(value);
    return formatVnd(value);
  };

  const formatCryptoTransferReceiveInput = () =>
    formatTransferReceiveInput(transferEstimatedReceive(), transferReceiveUnit());

  const estimateUsdtFromVnd = (vndInput: string) => {
    const vndAmount = parseMoney(vndInput);
    return vndAmount && usdtVndRate ? formatDecimalNumberInput(vndAmount / usdtVndRate, 3) : "";
  };

  const updateTopupVnd = (value: string) => {
    const vnd = formatMoneyInput(value);
    setTopupForm((prev) => ({ ...prev, vnd, usdt: vnd ? estimateUsdtFromVnd(vnd) || prev.usdt : "" }));
  };

  useEffect(() => {
    if (activeAction !== "topup" || !topupForm.vnd || topupForm.usdt) return;
    const estimatedUsdt = estimateUsdtFromVnd(topupForm.vnd);
    if (estimatedUsdt) setTopupForm((prev) => ({ ...prev, usdt: estimatedUsdt }));
  }, [state.market.usdtVnd, state.market.usdVnd, activeAction]);

  const topupUsdtRate = () => {
    const vndAmount = parseMoney(topupForm.vnd);
    const usdtAmount = parseDecimal(topupForm.usdt);
    return vndAmount && usdtAmount ? vndAmount / usdtAmount : 0;
  };

  const openAction = (action: Exclude<CryptoAction, null>) => {
    setActiveAction((current) => (current === action ? null : action));
    setCryptoError("");
    if (action !== "dca") setShowLegacyDca(false);
  };

  const saveTopup = () => {
    const vndAmount = parseMoney(topupForm.vnd);
    const usdtAmount = parseDecimal(topupForm.usdt);
    if (!vndAmount || !usdtAmount) return setCryptoError("Nhập VND và USDT thực nhận hợp lệ.");
    if (vndAmount > btcStats.pendingVnd) return setCryptoError("Số VND mua USDT đang lớn hơn vốn crypto chưa đổi.");
    const topupId = uid();
    const topup: BtcUsdtTopup = {
      id: topupId,
      vndAmount,
      usdtAmount,
      date: topupForm.date,
      occurredAt: occurredAtForDate(topupForm.date),
      note: topupForm.note.trim(),
      meta: metaForPlannedTransaction("btc-topup", topupId, activePlanLink),
    };
    commitWithUndo("Đã thêm mua USDT.", (prev) => withCompletedAllocationPlanItem({ ...prev, btcUsdtTopups: [...prev.btcUsdtTopups, topup] }, activePlanLink, stableEventId("btc-topup", topup.id)));
    syncBtcRow("btc_usdt_topups", topup.id, topup);
    setTopupForm({ vnd: "", usdt: "", date: today(), note: "" });
    setActivePlanLink(null);
    setActiveAction(null);
    setCryptoError("");
  };

  const saveSol = () => {
    const sol = parseDecimal(solForm.sol);
    const price = parseDecimal(solForm.price);
    const costVnd = parseMoney(solForm.valueVnd) || solFormComputedVnd;
    if (!sol || !price) return setCryptoError("Nhập số SOL và giá mua hợp lệ.");
    commitWithUndo("Đã thêm SOL.", (prev) => ({
      ...prev,
      solTransactions: [...prev.solTransactions, { id: uid(), type: "buy", solAmount: sol, buyPrice: price, costVnd, date: solForm.date, occurredAt: occurredAtForDate(solForm.date), note: "" }],
    }));
    setSolForm({
      sol: "",
      price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "",
      valueUsdt: "",
      valueVnd: "",
      date: today(),
    });
    setActiveAction(null);
    setCryptoError("");
  };

  const savePlan = () => {
    const amountUsdt = parseDecimal(planForm.amountUsdt);
    if (!amountUsdt) return setCryptoError("Nhập số USDT mỗi kỳ hợp lệ.");
    const existingPlan = state.btcDcaPlans.find((item) => item.id === editingPlanId);
    const plan: BtcDcaPlan = normalizeDcaPlan({
      id: editingPlanId ?? uid(),
      amountUsdt,
      frequency: planForm.frequency,
      time: planForm.time,
      startDate: planForm.startDate,
      nextRunAt: nextDcaRunAt(planForm),
      isActive: existingPlan?.isActive ?? true,
      status: existingPlan?.status ?? "active",
      btcAmountOverride: existingPlan?.btcAmountOverride,
      averagePriceUsdtOverride: existingPlan?.averagePriceUsdtOverride,
      note: existingPlan?.note || "DCA Binance",
    });
    commitWithUndo(editingPlanId ? "Đã sửa kế hoạch DCA." : "Đã tạo kế hoạch DCA.", (prev) => ({
      ...prev,
      btcDcaPlans: editingPlanId ? prev.btcDcaPlans.map((item) => (item.id === editingPlanId ? plan : item)) : [...prev.btcDcaPlans, plan],
    }));
    syncBtcRow("btc_dca_plans", plan.id, plan, { is_active: plan.isActive, next_run_at: plan.nextRunAt, status: plan.status });
    setPlanForm({ amountUsdt: "2", frequency: "daily", time: "12:00", startDate: today() });
    setEditingPlanId(null);
    setActiveAction(null);
    setCryptoError("");
  };

  const saveLegacyDca = () => {
    const amountUsdt = parseDecimal(legacyDcaForm.amountUsdt);
    const activeRuns = Math.floor(parseDecimal(legacyDcaForm.activeRuns));
    const btcAmount = parseDecimal(legacyDcaForm.btcAmount);
    const latestPriceUsdt = parseDecimal(legacyDcaForm.latestPriceUsdt);
    const averagePriceUsdt = parseDecimal(legacyDcaForm.averagePriceUsdt);
    if (!amountUsdt || !activeRuns || !btcAmount || !latestPriceUsdt || !averagePriceUsdt || !legacyDcaForm.nextDate) {
      return setCryptoError("Nhập đủ số kỳ, BTC tích lũy, giá gần nhất và giá trung bình.");
    }
    const totalInvestedUsdt = amountUsdt * activeRuns;
    if (totalInvestedUsdt - btcStats.usdtBalance > 0.000001) {
      return setCryptoError(`Số dư USDT không đủ để import DCA này. Cần khoảng ${formatUsdt(totalInvestedUsdt)}, hiện có ${formatUsdt(btcStats.usdtBalance)}.`);
    }

    const planId = uid();
    const plan: BtcDcaPlan = normalizeDcaPlan({
      id: planId,
      amountUsdt,
      frequency: legacyDcaForm.frequency,
      time: legacyDcaForm.time,
      startDate: legacyDcaForm.startDate,
      nextRunAt: localDateTimeIso(legacyDcaForm.nextDate, legacyDcaForm.time),
      isActive: true,
      status: "active",
      btcAmountOverride: btcAmount,
      averagePriceUsdtOverride: averagePriceUsdt,
      note: legacyDcaForm.note.trim(),
    });
    const totalNote = legacyDcaForm.note.trim() || "Import DCA Binance";
    const perRunUsdt = amountUsdt;
    let trades: BtcTrade[];
    if (activeRuns === 1) {
      trades = [{ id: uid(), type: "dca", usdtAmount: totalInvestedUsdt, btcAmount, btcPriceUsdt: averagePriceUsdt, executedAt: localDateTimeIso(legacyDcaForm.startDate, legacyDcaForm.time), planId, note: totalNote }];
    } else {
      const latestBtc = perRunUsdt / latestPriceUsdt;
      const remainingBtc = btcAmount - latestBtc;
      const remainingUsdt = perRunUsdt * (activeRuns - 1);
      const previousPriceUsdt = remainingBtc > 0 ? remainingUsdt / remainingBtc : 0;
      if (!previousPriceUsdt) return setCryptoError("Dữ liệu giá không hợp lệ Đã tạo lịch sử DCA.");
      trades = Array.from({ length: activeRuns }, (_, index) => {
        const price = index === activeRuns - 1 ? latestPriceUsdt : previousPriceUsdt;
        return { id: uid(), type: "dca" as const, usdtAmount: perRunUsdt, btcAmount: perRunUsdt / price, btcPriceUsdt: price, executedAt: localDateTimeIso(shiftDcaDate(legacyDcaForm.startDate, legacyDcaForm.frequency, index), legacyDcaForm.time), planId, note: totalNote };
      });
    }

    commitWithUndo("Đã import DCA cũ.", (prev) => ({ ...prev, btcDcaPlans: [...prev.btcDcaPlans, plan], btcTrades: [...prev.btcTrades, ...trades] }));
    syncBtcRow("btc_dca_plans", plan.id, plan, { is_active: plan.isActive, next_run_at: plan.nextRunAt, status: plan.status });
    trades.forEach((trade) => syncBtcRow("btc_trades", trade.id, trade, { executed_at: trade.executedAt, plan_id: plan.id }));
    setExpandedDcaPlanIds((prev) => [...prev, plan.id]);
    setShowLegacyDca(false);
    setActiveAction(null);
    setCryptoError("");
  };

  const dcaPlanStats = (plan: BtcDcaPlan) => {
    const trades = state.btcTrades.filter((trade) => trade.type === "dca" && trade.planId === plan.id);
    const investedUsdt = trades.reduce((sum, trade) => sum + trade.usdtAmount, 0);
    const tradeBtcAmount = trades.reduce((sum, trade) => sum + trade.btcAmount, 0);
    const tradeAveragePriceUsdt = tradeBtcAmount ? investedUsdt / tradeBtcAmount : 0;
    const btcAmount = plan.btcAmountOverride && plan.btcAmountOverride > 0 ? plan.btcAmountOverride : tradeBtcAmount;
    const averagePriceUsdt = plan.averagePriceUsdtOverride && plan.averagePriceUsdtOverride > 0 ? plan.averagePriceUsdtOverride : tradeAveragePriceUsdt;
    const currentValueUsdt = btcAmount * state.market.btcUsdt;
    const pnlUsdt = currentValueUsdt - investedUsdt;
    const pnlPercent = investedUsdt ? (pnlUsdt / investedUsdt) * 100 : 0;
    const latestTrade = [...trades].sort((a, b) => b.executedAt.localeCompare(a.executedAt))[0];
    return {
      activeDays: trades.length,
      averagePriceUsdt,
      btcAmount,
      currentValueUsdt,
      investedUsdt,
      latestPriceUsdt: latestTrade.btcPriceUsdt || 0,
      pnlPercent,
      pnlUsdt,
      startAt: new Date(`${plan.startDate}T${plan.time}:00`).toISOString(),
      tradeCount: trades.length,
    };
  };

  const editPlan = (plan: BtcDcaPlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({ amountUsdt: String(plan.amountUsdt), frequency: plan.frequency, time: plan.time, startDate: plan.startDate });
    setShowLegacyDca(false);
    setActiveAction("dca");
  };

  const togglePlan = (plan: BtcDcaPlan) => {
    const next: BtcDcaPlan = { ...plan, isActive: !plan.isActive, status: !plan.isActive ? "active" : "paused", statusNote: !plan.isActive ? "" : "Đã tạm dừng", nextRunAt: !plan.isActive ? nextDcaRunAt(plan) : plan.nextRunAt };
    commitWithUndo(next.isActive ? "Đã bật lại DCA." : "Đã tạm dừng DCA.", (prev) => ({ ...prev, btcDcaPlans: prev.btcDcaPlans.map((item) => (item.id === plan.id ? next : item)) }));
    syncBtcRow("btc_dca_plans", next.id, next, { is_active: next.isActive, next_run_at: next.nextRunAt, status: next.status });
  };

  const deletePlan = (plan: BtcDcaPlan) => {
    const relatedTrades = state.btcTrades.filter((trade) => trade.type === "dca" && trade.planId === plan.id);
    if (!window.confirm(`Xóa lệnh DCA này? ${relatedTrades.length} giao dịch DCA liên quan sẽ được xóa khỏi Crypto và hoàn lại USDT vào số dư.`)) return;
    commitWithUndo(
      "Đã xóa lệnh DCA.",
      (prev) =>
        withTrashItem(
          { ...prev, btcDcaPlans: prev.btcDcaPlans.filter((item) => item.id !== plan.id), btcTrades: prev.btcTrades.filter((trade) => !(trade.type === "dca" && trade.planId === plan.id)) },
          makeTrashItem("btc-dca", plan.id, `lệnh DCA ${formatUsdt(plan.amountUsdt)}`, plan, { btcTrades: relatedTrades })
        ),
      { action: "delete", entityType: "btc-dca", entityId: plan.id }
    );
    if (!btcCloudAccountId) return;
    void deleteCloudPayloadRow("btc_dca_plans", btcCloudAccountId, plan.id).catch(() => setCryptoError("Đã xóa local, nhưng chưa xóa được DCA trên cloud."));
    relatedTrades.forEach((trade) => void deleteCloudPayloadRow("btc_trades", btcCloudAccountId, trade.id).catch(() => setCryptoError("Đã xóa local, nhưng chưa xóa được toàn bộ giao dịch DCA trên cloud.")));
  };

  const editDcaAsset = (plan: BtcDcaPlan) => {
    const planStats = dcaPlanStats(plan);
    setEditingDcaAssetPlanId(plan.id);
    setDcaAssetForm({ btcAmount: String(planStats.btcAmount || ""), averagePriceUsdt: String(planStats.averagePriceUsdt || "") });
    setExpandedDcaPlanIds((prev) => (prev.includes(plan.id) ? prev : [...prev, plan.id]));
  };

  const saveDcaAsset = (plan: BtcDcaPlan) => {
    const btcAmountOverride = parseDecimal(dcaAssetForm.btcAmount);
    const averagePriceUsdtOverride = parseDecimal(dcaAssetForm.averagePriceUsdt);
    if (!btcAmountOverride || !averagePriceUsdtOverride) return setCryptoError("Nhập BTC tích lũy và giá trung bình hợp lệ.");
    const next: BtcDcaPlan = { ...plan, btcAmountOverride, averagePriceUsdtOverride };
    commitWithUndo("Đã chọn số BTC DCA.", (prev) => ({ ...prev, btcDcaPlans: prev.btcDcaPlans.map((item) => (item.id === plan.id ? next : item)) }));
    syncBtcRow("btc_dca_plans", next.id, next, { is_active: next.isActive, next_run_at: next.nextRunAt, status: next.status });
    setEditingDcaAssetPlanId(null);
    setDcaAssetForm({ btcAmount: "", averagePriceUsdt: "" });
    setCryptoError("");
  };

  const updateTransferAsset = (asset: CryptoTransferAsset) => {
    const destination = destinationOptions(asset)[0]?.id ?? "cash";
    setTransferForm((prev) => ({ ...prev, asset, destination, price: formatDecimalInput(String(transferPriceFor(asset, destination) || "")), received: "", btcReceived: "" }));
    setCryptoError("");
  };

  const updateTransferBtc = (value: string) => {
    const btc = formatDecimalInput(value);
    setTransferForm((prev) => {
      const price = parseDecimal(prev.price) || transferPriceFor("btc", prev.destination) || 0;
      const received = parseDecimal(btc) * price;
      return {
        ...prev,
        btc,
        received: received ? formatTransferReceiveInput(received, "USDT") : "",
        btcReceived: "",
      };
    });
  };

  const updateTransferDestination = (destination: BtcTransferTarget | "btc-direct") => {
    setTransferForm((prev) => ({ ...prev, destination, price: formatDecimalInput(String(transferPriceFor(prev.asset, destination) || "")), received: "", btcReceived: destination === "btc-direct" ? transferEstimatedBtcFromSol() : "" }));
    setCryptoError("");
  };

  const updateTransferSol = (value: string) => {
    const sol = formatSolInput(value);
    const received = parseDecimal(sol) * (parseDecimal(transferForm.price) || transferPriceFor("sol", transferForm.destination) || 0);
    setTransferForm((prev) => ({
      ...prev,
      sol,
      received: received ? formatTransferReceiveInput(received, "USDT") : "",
      btcReceived: prev.destination === "btc-direct" ? estimateBtcFromSolInput(sol, prev.price, state.market.btcUsdt) : "",
    }));
  };

  const updateTransferPrice = (value: string) => {
    const price = formatDecimalInput(value);
    setTransferForm((prev) => {
      if (prev.asset === "btc") {
        const received = parseDecimal(prev.btc) * (parseDecimal(price) || 0);
        return { ...prev, price, received: received ? formatTransferReceiveInput(received, "USDT") : "", btcReceived: "" };
      }
      if (prev.asset === "sol") {
        const received = parseDecimal(prev.sol) * (parseDecimal(price) || 0);
        return {
          ...prev,
          price,
          received: received ? formatTransferReceiveInput(received, "USDT") : "",
          btcReceived: prev.destination === "btc-direct" ? estimateBtcFromSolInput(prev.sol, price, state.market.btcUsdt) : "",
        };
      }
      if (prev.asset === "usdt" && prev.destination !== "btc") {
        const rate = parseDecimal(price);
        const usdt = parseDecimal(prev.usdt);
        if (usdt && rate) return { ...prev, price, received: formatTransferReceiveInput(usdt * rate, "VND") };
      }
      return { ...prev, price, btcReceived: "" };
    });
  };

  const updateTransferUsdt = (value: string) => {
    const usdt = formatDecimalInput(value);
    setTransferForm((prev) => {
      if (prev.destination !== "btc") {
        const rate = parseDecimal(prev.price) || transferPriceFor("usdt", prev.destination) || 0;
        return {
          ...prev,
          usdt,
          received: rate && parseDecimal(usdt) ? formatTransferReceiveInput(parseDecimal(usdt) * rate, "VND") : prev.received,
        };
      }
      return { ...prev, usdt };
    });
  };

  const updateTransferReceived = (value: string) => {
    if (transferReceiveUnit() !== "VND") {
      setTransferForm((prev) => ({ ...prev, received: formatDecimalInput(value) }));
      return;
    }
    const received = formatMoneyInput(value);
    setTransferForm((prev) => ({ ...prev, received }));
  };

  const fillMaxTransferSource = () => {
    if (transferForm.asset === "btc") return updateTransferBtc(formatDecimalNumberInput(btcStats.btcBalance, 8));
    if (transferForm.asset === "sol") return updateTransferSol(formatDecimalNumberInput(solStats.balance, 8));
    setTransferForm((prev) => {
      const usdt = formatDecimalNumberInput(btcStats.usdtBalance, 8);
      const rate = parseDecimal(prev.price) || transferPriceFor("usdt", prev.destination) || 0;
      return {
        ...prev,
        usdt,
        received: prev.destination !== "btc" && rate ? formatTransferReceiveInput(parseDecimal(usdt) * rate, "VND") : "",
      };
    });
  };

  const resetTransferForm = () => {
    setTransferForm({ asset: "btc", btc: "", usdt: "", sol: "", price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "", received: "", btcReceived: "", destination: "usdt", date: today(), note: "" });
  };

  const saveTransfer = () => {
    const source = transferSourceAmount();
    const price = parseDecimal(transferForm.price) || transferPriceFor(transferForm.asset, transferForm.destination);
    const receivedInput = transferReceiveUnit() === "VND" ? parseMoney(transferForm.received) : parseDecimal(transferForm.received);
    const received = receivedInput || transferEstimatedReceive();
    if (!source || !price || !received) return setCryptoError("Nhập tài sản, giá và số tiền nhận hợp lệ.");

    if (transferForm.asset === "btc") {
      if (transferForm.destination !== "usdt") return setCryptoError("BTC chỉ được đổi sang USDT trong quỹ Crypto.");
      if (source - btcStats.btcBalance > 0.00000001) return setCryptoError("Số BTC rút lớn hơn số BTC đang có.");
      const transfer: BtcTransfer = { id: uid(), asset: "btc", btcAmount: source, usdtAmount: received, btcPriceUsdt: price, vndAmount: Math.round(received * usdtVndRate), destination: "usdt", date: transferForm.date, occurredAt: occurredAtForDate(transferForm.date), closesPosition: closesCryptoPosition(source, btcStats.btcBalance), note: transferForm.note.trim() };
      commitWithUndo("Đã chuyển BTC sang USDT.", (prev) => ({ ...prev, btcTransfers: [...prev.btcTransfers, transfer] }));
      syncBtcRow("btc_transfers", transfer.id, transfer, { transfer_at: transfer.occurredAt });
      resetTransferForm();
      setActiveAction(null);
      setCryptoError("");
      return;
    }

    if (transferForm.asset === "usdt") {
      if (source > btcStats.usdtBalance) return setCryptoError("Số USDT lớn hơn số dư USDT.");
      if (transferForm.destination === "btc") {
        const trade: BtcTrade = { id: uid(), type: "manual-buy", usdtAmount: source, btcAmount: received, btcPriceUsdt: price, executedAt: occurredAtForDate(transferForm.date), note: transferForm.note.trim() || "Chuyển USDT sang BTC" };
        commitWithUndo("Đã chuyển USDT sang BTC.", (prev) => ({ ...prev, btcTrades: [...prev.btcTrades, trade] }));
        syncBtcRow("btc_trades", trade.id, trade, { executed_at: trade.executedAt, plan_id: null });
        resetTransferForm();
        setActiveAction(null);
        setCryptoError("");
        return;
      }
      const vndAmount = Math.round(received);
      const transfer: BtcTransfer = { id: uid(), asset: "usdt", btcAmount: 0, usdtAmount: source, btcPriceUsdt: state.market.btcUsdt, vndAmount, destination: transferForm.destination as BtcTransferDestination, date: transferForm.date, occurredAt: occurredAtForDate(transferForm.date), note: transferForm.note.trim() };
      const transferNote = transfer.note ? `Rút từ Crypto · ${transfer.note} [btc-transfer:${transfer.id}]` : `Rút từ Crypto [btc-transfer:${transfer.id}]`;
      commitWithUndo("Đã lưu rút/chuyển Crypto.", (prev) => ({
        ...prev,
        btcTransfers: [...prev.btcTransfers, transfer],
        fundTransactions: [
          ...prev.fundTransactions,
          { id: uid(), fund: "btc", type: "withdraw", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote },
          ...(transfer.destination === "stock" ? [{ id: uid(), fund: "stock" as const, type: "deposit" as const, amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote }] : []),
        ],
        incomeTransactions: transfer.destination === "cash" ? [...prev.incomeTransactions, { id: uid(), categoryId: "other-income", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote }] : prev.incomeTransactions,
      }));
      syncBtcRow("btc_transfers", transfer.id, transfer, { transfer_at: transfer.occurredAt });
      resetTransferForm();
      setActiveAction(null);
      setCryptoError("");
      return;
    }

    if (transferForm.destination !== "btc") return setCryptoError("SOL chỉ được đổi sang USDT trong quỹ Crypto.");
    if (source - solStats.balance > 0.00000001) return setCryptoError("Số SOL rút lớn hơn số SOL đang có.");
    const usdtAmount = received;
    const vndAmount = Math.round(usdtAmount * usdtVndRate);
    const userNote = transferForm.note.trim();
    const note = userNote || "Rút từ SOL";
    const transferNote = userNote ? `Rút từ SOL · ${userNote}` : "Rút từ SOL";
    const withdrawal: SolWithdrawTransaction = { id: uid(), type: "withdraw", solAmount: source, sellPrice: price, usdtAmount, vndAmount, destination: "btc", date: transferForm.date, occurredAt: occurredAtForDate(transferForm.date), closesPosition: closesCryptoPosition(source, solStats.balance), note };
    const btcTopup: BtcUsdtTopup = { id: uid(), vndAmount, usdtAmount, date: withdrawal.date, occurredAt: occurredAtForDate(withdrawal.date), sourceSolWithdrawalId: withdrawal.id, note: `${transferNote} · USDT từ SOL` };
    commitWithUndo("Đã rút/chuyển SOL.", (prev) => ({
      ...prev,
      solTransactions: [...prev.solTransactions, withdrawal],
      btcUsdtTopups: [...prev.btcUsdtTopups, btcTopup],
      fundTransactions: [...prev.fundTransactions, { id: uid(), fund: "btc", type: "deposit", amount: vndAmount, date: withdrawal.date, month: monthFromDate(withdrawal.date), note: transferNote }],
    }));
    syncBtcRow("btc_usdt_topups", btcTopup.id, btcTopup);
    resetTransferForm();
    setActiveAction(null);
    setCryptoError("");
  };

  const btcRows = [
    ...state.btcUsdtTopups.filter((item) => !isSolDerivedUsdtTopup(item)).map((item) => ({ kind: "btc-topup" as const, date: item.date, at: item.occurredAt ?? item.date, item })),
    ...state.btcTrades.filter((item) => item.type !== "dca" && !isSolDerivedBtcTrade(item)).map((item) => ({ kind: "btc-trade" as const, date: dateValueFromDateTime(item.executedAt), at: item.executedAt, item })),
    ...state.btcTransfers.map((item) => ({ kind: "btc-transfer" as const, date: item.date, at: item.occurredAt ?? item.date, item })),
  ];
  const solRows = state.solTransactions.map((item) => ({ kind: "sol" as const, date: item.date, at: item.occurredAt ?? item.meta?.createdAt ?? item.date, item }));
  const historyRows = [...btcRows, ...solRows].sort((a, b) => b.at.localeCompare(a.at));
  const isInternalCryptoHistoryRow = (row: (typeof historyRows)[number]) =>
    row.kind === "btc-trade" ||
    (row.kind === "btc-transfer" && row.item.destination === "usdt") ||
    (row.kind === "sol" && isSolWithdrawal(row.item) && (row.item.destination === "btc" || row.item.destination === "btc-direct"));

  const solTransferNoteForHistory = (item: SolWithdrawTransaction) =>
    item.note && item.note !== "Rút từ SOL" ? `Rút từ SOL · ${item.note}` : "Rút từ SOL";

  const deleteHistoryRow = (row: (typeof historyRows)[number]) => {
    if (row.kind === "sol") {
      const item = row.item;
      if (!window.confirm(`Xóa ${isSolWithdrawal(item) ? "lệnh rút/chuyển SOL" : "lệnh thêm SOL"} này? Số dư Crypto và các quỹ liên quan sẽ được tính lại.`)) return;
      const relatedBtcTopups = isSolWithdrawal(item) && item.destination === "btc"
        ? state.btcUsdtTopups.filter((topup) => isTopupLinkedToSolWithdrawal(topup, item, `${solTransferNoteForHistory(item)} · USDT từ SOL`))
        : [];
      const relatedBtcTrades = isSolWithdrawal(item) && item.destination === "btc-direct" ? state.btcTrades.filter((trade) => trade.note.includes(solBtcTradeMarker(item.id))) : [];
      commitWithUndo(isSolWithdrawal(item) ? "Đã xóa lệnh rút/chuyển SOL." : "Đã xóa lệnh thêm SOL.", (prev) => {
        if (!isSolWithdrawal(item)) {
          return withTrashItem({ ...prev, solTransactions: prev.solTransactions.filter((transaction) => transaction.id !== item.id) }, makeTrashItem("sol", item.id, `lệnh thêm SOL ${formatSolAmount(item.solAmount)}`, item));
        }
        const transferNote = solTransferNoteForHistory(item);
        const relatedBtcTopupIds = new Set(relatedBtcTopups.map((topup) => topup.id));
        const relatedBtcTradeIds = new Set(relatedBtcTrades.map((trade) => trade.id));
        const relatedFundTransactions = item.destination === "btc" || item.destination === "btc-direct" || item.destination === "stock"
          ? prev.fundTransactions.filter((transaction) => transaction.fund === (item.destination === "btc-direct" ? "btc" : item.destination) && transaction.type === "deposit" && transaction.amount === item.vndAmount && transaction.date === item.date && transaction.note === transferNote)
          : [];
        const relatedIncomeTransactions = item.destination === "cash" ? prev.incomeTransactions.filter((transaction) => transaction.categoryId === "other-income" && transaction.amount === item.vndAmount && transaction.date === item.date && transaction.note === transferNote) : [];
        return withTrashItem(
          {
            ...prev,
            solTransactions: prev.solTransactions.filter((transaction) => transaction.id !== item.id),
            btcUsdtTopups: relatedBtcTopupIds.size ? prev.btcUsdtTopups.filter((topup) => !relatedBtcTopupIds.has(topup.id)) : prev.btcUsdtTopups,
            btcTrades: relatedBtcTradeIds.size ? prev.btcTrades.filter((trade) => !relatedBtcTradeIds.has(trade.id)) : prev.btcTrades,
            fundTransactions: relatedFundTransactions.length ? prev.fundTransactions.filter((transaction) => !relatedFundTransactions.some((candidate) => candidate.id === transaction.id)) : prev.fundTransactions,
            incomeTransactions: relatedIncomeTransactions.length ? prev.incomeTransactions.filter((transaction) => !relatedIncomeTransactions.some((candidate) => candidate.id === transaction.id)) : prev.incomeTransactions,
          },
          makeTrashItem("sol", item.id, `lệnh rút/chuyển SOL ${formatSolAmount(item.solAmount)}`, item, { btcUsdtTopups: relatedBtcTopups, btcTrades: relatedBtcTrades, fundTransactions: relatedFundTransactions, incomeTransactions: relatedIncomeTransactions })
        );
      }, { action: "delete", entityType: "sol", entityId: item.id });
      relatedBtcTopups.forEach((topup) => void deleteCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, topup.id).catch(() => setCryptoError("Đã xóa local, nhưng chưa xóa được USDT từ SOL trên BTC cloud.")));
      relatedBtcTrades.forEach((trade) => void deleteCloudPayloadRow("btc_trades", btcCloudAccountId, trade.id).catch(() => setCryptoError("Đã xóa local, nhưng chưa xóa được BTC mua từ SOL trên BTC cloud.")));
      return;
    }

    const label = row.kind === "btc-topup" ? "lệnh mua USDT" : row.kind === "btc-trade" ? "lệnh mua BTC" : "lệnh rút/chuyển Crypto";
    if (!window.confirm(`Xóa ${label} này? Số dư và lịch sử Crypto sẽ được cập nhật lại.`)) return;
    const entityType: AuditEntityType = row.kind === "btc-topup" ? "btc-topup" : row.kind === "btc-trade" ? "btc-trade" : "btc-transfer";
    commitWithUndo(`Đã xóa ${label}.`, (prev) => {
      const relatedPayloads = row.kind === "btc-transfer"
        ? {
            fundTransactions: prev.fundTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`)),
            incomeTransactions: prev.incomeTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`)),
          }
        : undefined;
      return withTrashItem(
        {
          ...prev,
          btcUsdtTopups: row.kind === "btc-topup" ? prev.btcUsdtTopups.filter((item) => item.id !== row.item.id) : prev.btcUsdtTopups,
          btcTrades: row.kind === "btc-trade" ? prev.btcTrades.filter((item) => item.id !== row.item.id) : prev.btcTrades,
          btcTransfers: row.kind === "btc-transfer" ? prev.btcTransfers.filter((item) => item.id !== row.item.id) : prev.btcTransfers,
          fundTransactions: row.kind === "btc-transfer" ? prev.fundTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`)) : prev.fundTransactions,
          incomeTransactions: row.kind === "btc-transfer" ? prev.incomeTransactions.filter((item) => !item.note.includes(btcTransferDepositMarker(row.item.id)) && !item.note.includes(`[btc-transfer:${row.item.id}]`)) : prev.incomeTransactions,
        },
        makeTrashItem(entityType, row.item.id, label, row.item, relatedPayloads)
      );
    }, { action: "delete", entityType, entityId: row.item.id });
    if (!btcCloudAccountId) return;
    const table = row.kind === "btc-topup" ? "btc_usdt_topups" : row.kind === "btc-trade" ? "btc_trades" : "btc_transfers";
    void deleteCloudPayloadRow(table, btcCloudAccountId, row.item.id).catch(() => setCryptoError("Đã xóa local, nhưng chưa xóa được dòng BTC cloud."));
  };

  const content = (
    <div className="crypto-page">
      {latestCryptoAllocationNotice && (
        <button className="pending-banner clickable stock-allocation-notice" onClick={dismissCryptoAllocationNotice} type="button">
          <div>
            <strong>
              Đã chia {formatVnd(latestCryptoAllocationNotice.amount)} vào qu? Crypto tháng {formatMonth(latestCryptoAllocationNotice.month)}
            </strong>
            <small>Bấm đầu tick được ẩn thông báo</small>
          </div>
          <CheckCircle2 size={20} />
        </button>
      )}
      <section className="crypto-portfolio-card">
        <span className={`crypto-pnl-pill ${cryptoPnl < 0 ? "loss" : "gain"}`}>{cryptoPnlPercent.toFixed(1)}%</span>
        <small>Tổng tài sản Crypto</small>
        <p className="crypto-portfolio-total-line">
          <strong>{cryptoValueUsdt ? formatUsdt(cryptoValueUsdt) : "Đang chờ"}</strong>
          <em className="crypto-portfolio-vnd-estimate">~ {formatVnd(cryptoValue)}</em>
        </p>
        <div>
          <span>Vốn đang đầu tư <b>{formatVnd(cryptoPrincipal)}</b></span>
          <span>Tiền dư <b>{formatVnd(btcStats.pendingVnd)}</b></span>
          <span>Lãi/lỗ <b className={cryptoPnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{formatVnd(cryptoPnl)}</b></span>
        </div>
      </section>

      <section className="crypto-action-grid" aria-label="Thao tác Crypto">
        <button className={activeAction === "topup" ? "active" : ""} onClick={() => openAction("topup")} type="button"><CircleDollarSign size={19} /><span>Mua USDT</span></button>
        <button className={activeAction === "dca" ? "active" : ""} onClick={() => openAction("dca")} type="button"><CalendarClock size={19} /><span>DCA</span></button>
        <button className={activeAction === "withdraw" ? "active" : ""} onClick={() => openAction("withdraw")} type="button"><ArrowDownCircle size={19} /><span>Rút tiền</span></button>
        <button className={activeAction === "sol" ? "active" : ""} onClick={() => openAction("sol")} type="button"><Plus size={19} /><span>Thêm SOL</span></button>
      </section>

      {activeAction && (
        <section className="panel crypto-form-panel">
          <div className="panel-title">
            <h2>{activeAction === "topup" ? "Mua USDT" : activeAction === "dca" ? (showLegacyDca ? "Nhập DCA cu" : editingPlanId ? "Sửa DCA" : "Tạo DCA") : activeAction === "sol" ? "Thêm SOL" : "Rút / chuyển Crypto"}</h2>
            <button className="icon-button" onClick={() => { setActiveAction(null); setShowLegacyDca(false); setEditingPlanId(null); setCryptoError(""); }} type="button" title="Đóng"><X size={16} /></button>
          </div>
          {activeAction === "topup" && (
            <div className="form-grid btc-form-grid">
              <label>VND dùng mua<input value={topupForm.vnd} onChange={(event) => updateTopupVnd(formatMoneyChange(event))} placeholder="1.000.000" /></label>
              <label>USDT thực nhận<input value={topupForm.usdt} onChange={(event) => setTopupForm({ ...topupForm, usdt: formatDecimalChange(event) })} placeholder="39,250" /></label>
              <label>Ngày<input type="date" value={topupForm.date} onChange={(event) => setTopupForm({ ...topupForm, date: event.target.value })} /></label>
              <label>Giá USDT (VND)<input value={topupUsdtRate() ? formatVnd(topupUsdtRate()) : ""} readOnly placeholder="Tự tính" /></label>
              <label>Note<input value={topupForm.note} onChange={(event) => setTopupForm({ ...topupForm, note: event.target.value })} placeholder="Binance P2P" /></label>
              <button className="primary btc-form-submit" onClick={saveTopup} type="button"><Save size={17} /> Lưu USDT</button>
            </div>
          )}
          {activeAction === "dca" && !showLegacyDca && (
            <div className="form-grid btc-form-grid">
              <label>USDT mỗi kỳ<input value={planForm.amountUsdt} onChange={(event) => setPlanForm({ ...planForm, amountUsdt: formatDecimalChange(event) })} placeholder="2" /></label>
              <label>Tần suất<select value={planForm.frequency} onChange={(event) => setPlanForm({ ...planForm, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
              <label>Giờ chạy<input type="time" value={planForm.time} onChange={(event) => setPlanForm({ ...planForm, time: event.target.value })} /></label>
              <label>Ngày bắt đầu<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm({ ...planForm, startDate: event.target.value })} /></label>
              <button className="ghost btc-form-submit" onClick={() => setShowLegacyDca(true)} type="button"><Upload size={17} /> Nhập DCA cũ</button>
              <button className="primary btc-form-submit" onClick={savePlan} type="button"><Save size={17} /> Lưu kế hoạch</button>
            </div>
          )}
          {activeAction === "dca" && showLegacyDca && (
            <div className="form-grid btc-form-grid">
              <label>USDT mỗi kỳ<input value={legacyDcaForm.amountUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, amountUsdt: formatDecimalChange(event) })} placeholder="2" /></label>
              <label>Tần suất<select value={legacyDcaForm.frequency} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
              <label>Giờ chạy<input type="time" value={legacyDcaForm.time} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, time: event.target.value })} /></label>
              <label>Ngày bắt đầu<input type="date" value={legacyDcaForm.startDate} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, startDate: event.target.value })} /></label>
              <label>Ngày giao dịch tiếp theo<input type="date" value={legacyDcaForm.nextDate} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, nextDate: event.target.value })} /></label>
              <label>Số kỳ đã kích hoạt<input value={legacyDcaForm.activeRuns} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, activeRuns: event.target.value })} placeholder="14" /></label>
              <label>BTC tích lũy<input value={legacyDcaForm.btcAmount} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, btcAmount: formatDecimalChange(event) })} placeholder="0,00043251" /></label>
              <label>Giá gần nhất (USDT)<input value={legacyDcaForm.latestPriceUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, latestPriceUsdt: formatDecimalChange(event) })} placeholder="64.337,674905" /></label>
              <label>Giá trung bình (USDT)<input value={legacyDcaForm.averagePriceUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, averagePriceUsdt: formatDecimalChange(event) })} placeholder="64.565,25594748" /></label>
              <label>Note<input value={legacyDcaForm.note} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, note: event.target.value })} placeholder="DCA Binance" /></label>
              <button className="ghost btc-form-submit" onClick={() => setShowLegacyDca(false)} type="button"><X size={17} /> Quay lại</button>
              <button className="primary btc-form-submit" onClick={saveLegacyDca} type="button"><Upload size={17} /> Import DCA</button>
            </div>
          )}
          {activeAction === "sol" && (
            <div className="form-grid btc-form-grid">
              <label>Số SOL<input value={solForm.sol} onChange={(event) => updateSolFormSol(formatSolChange(event))} placeholder="0,61" /></label>
              <label>Giá mua USDT<input value={solForm.price} onChange={(event) => updateSolFormPrice(formatDecimalChange(event))} placeholder={formatDecimalInput(String(state.market.solUsd || 0))} /></label>
              <label>Giá trị<input value={solForm.valueUsdt || (solFormComputedUsdt ? formatSolFormDecimal(solFormComputedUsdt) : "")} onChange={(event) => updateSolFormValueUsdt(formatDecimalChange(event))} placeholder={formatSolFormDecimal(solFormComputedUsdt)} /></label>
              <label>Giá tiền VND<input value={solForm.valueVnd || (solFormComputedVnd ? formatMoneyInput(String(solFormComputedVnd)) : "")} onChange={(event) => updateSolFormValueVnd(formatMoneyChange(event))} placeholder={solFormComputedVnd ? formatMoneyInput(String(solFormComputedVnd)) : ""} /></label>
              <label>Ngày<input type="date" value={solForm.date} onChange={(event) => setSolForm({ ...solForm, date: event.target.value })} /></label>
              <button className="primary btc-form-submit" onClick={saveSol} type="button"><Plus size={17} /> Thêm SOL</button>
            </div>
          )}
          {activeAction === "withdraw" && (
            <div className="form-grid btc-form-grid">
              <label>Tài sản nguồn<select value={transferForm.asset} onChange={(event) => updateTransferAsset(event.target.value as CryptoTransferAsset)}><option value="btc">BTC</option><option value="usdt">USDT</option><option value="sol">SOL</option></select></label>
              {transferForm.asset === "btc" && <label>Số BTC<InputWithMax value={transferForm.btc} onChange={(event) => updateTransferBtc(formatDecimalChange(event))} onMax={fillMaxTransferSource} placeholder="0,0001" /></label>}
              {transferForm.asset === "usdt" && <label>Số USDT<InputWithMax value={transferForm.usdt} onChange={(event) => updateTransferUsdt(formatDecimalChange(event))} onMax={fillMaxTransferSource} placeholder="10" /></label>}
              {transferForm.asset === "sol" && <label>Số SOL<InputWithMax value={transferForm.sol} onChange={(event) => updateTransferSol(formatSolChange(event))} onMax={fillMaxTransferSource} placeholder="0,25" /></label>}
              <label>{transferForm.asset === "sol" ? "Giá SOL/USDT" : transferForm.asset === "usdt" && transferForm.destination !== "btc" ? "Giá USDT/VND" : "Giá BTC/USDT"}<input value={transferForm.price} onChange={(event) => updateTransferPrice(formatDecimalChange(event))} placeholder={formatDecimalInput(String(transferPriceFor(transferForm.asset, transferForm.destination) || 0))} /></label>
              <label>{transferReceiveUnit() === "USDT" ? "Số USDT nhận" : transferReceiveUnit() === "BTC" ? "Số BTC nhận" : "Số tiền nhận"}<input value={transferForm.received || formatCryptoTransferReceiveInput()} onChange={(event) => updateTransferReceived(event.target.value)} placeholder={formatTransferReceive()} /></label>
              <label>Nơi nhận<select value={transferForm.destination} disabled={transferForm.asset === "btc" || transferForm.asset === "sol"} onChange={(event) => updateTransferDestination(event.target.value as BtcTransferTarget | "btc-direct")}>{destinationOptions(transferForm.asset).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label>Ngày<input type="date" value={transferForm.date} onChange={(event) => setTransferForm({ ...transferForm, date: event.target.value })} /></label>
              <label>Note<input value={transferForm.note} onChange={(event) => setTransferForm({ ...transferForm, note: event.target.value })} placeholder="Chuyển quỹ" /></label>
              <button className="primary btc-form-submit" onClick={saveTransfer} type="button"><ArrowDownCircle size={17} /> Lưu giao dịch</button>
            </div>
          )}
          {cryptoError && <span className="form-error">{cryptoError}</span>}
        </section>
      )}

      <section className="panel crypto-section crypto-asset-panel">
        <div className="crypto-section-title">
          <h2>Danh mục tài sản</h2>
          <small className="market-status crypto-asset-market-status">{cryptoMarketStatusLabel}</small>
          <div className="crypto-asset-title-actions">
            <button className="ghost report-refresh-button" onClick={openBalanceAdjustment} type="button" aria-label="Điều chỉnh số lượng" title="Điều chỉnh số lượng"><Pencil size={17} /></button>
            <button className="ghost report-refresh-button" onClick={() => onRefreshMarket()} type="button" aria-label="Cập nhật giá"><RefreshCw size={17} /></button>
          </div>
        </div>
        <div className="crypto-asset-header" aria-hidden="true">
          <span>Coin</span>
          <span>Giá TT/Giá TB</span>
          <span>Số lượng</span>
        </div>
        <div className="crypto-asset-list">
          {assetRows.map((asset) => (
            <article className="crypto-asset-row" key={asset.id}>
              <div className={`crypto-asset-coin ${asset.id}`}>
                <strong>{asset.name}</strong>
                <small>{asset.symbol}</small>
              </div>
              <div className="crypto-asset-prices" aria-label={`Giá ${asset.symbol}`}>
                <strong>{asset.marketPrice}</strong>
                <strong>{asset.averagePrice}</strong>
              </div>
              <div className="crypto-asset-values">
                <strong>{asset.amount}</strong>
                <small>{asset.valueDisplay}</small>
                <small className={`crypto-asset-pnl ${asset.pnlValue < 0 ? "loss" : "gain"}`}>{asset.pnlDisplay}</small>
              </div>
              <button className="ghost icon-only" onClick={() => setTraceEventIds((cryptoFinancialIndex.eventsByAsset.get(asset.symbol) ?? []).map((event) => event.id))} title="Xem nguồn tiền" type="button">
                <History size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>

      {balanceAdjustmentOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="crypto-adjustment-title">
          <section className="modal-card crypto-balance-adjustment-modal">
            <div className="panel-title">
              <h2 id="crypto-adjustment-title">Điều chỉnh số lượng Crypto</h2>
              <button className="icon-button" onClick={closeBalanceAdjustment} title="Đóng" aria-label="Đóng" type="button"><X size={17} /></button>
            </div>
            <div className="form-grid btc-form-grid">
              <label>BTC thực tế<input value={balanceAdjustmentForm.btc} onChange={(event) => {
                const btc = formatDecimalChange(event);
                setBalanceAdjustmentForm((prev) => ({ ...prev, btc }));
              }} placeholder="0,00000000" /></label>
              <label>SOL thực tế<input value={balanceAdjustmentForm.sol} onChange={(event) => {
                const sol = formatSolChange(event);
                setBalanceAdjustmentForm((prev) => ({ ...prev, sol }));
              }} placeholder="0,00000" /></label>
              <label>USDT thực tế<input value={balanceAdjustmentForm.usdt} onChange={(event) => {
                const usdt = formatDecimalChange(event);
                setBalanceAdjustmentForm((prev) => ({ ...prev, usdt }));
              }} placeholder="0" /></label>
              <label>Ngày<input type="date" value={balanceAdjustmentForm.date} onChange={(event) => setBalanceAdjustmentForm((prev) => ({ ...prev, date: event.target.value }))} /></label>
            </div>
            {balanceAdjustmentError && <span className="form-error">{balanceAdjustmentError}</span>}
            <div className="modal-actions">
              <button className="ghost icon-only" onClick={closeBalanceAdjustment} title="Hủy" aria-label="Hủy" type="button"><X size={17} /></button>
              <button className="primary" onClick={saveBalanceAdjustment} type="button"><Save size={17} /> Lưu điều chỉnh</button>
            </div>
          </section>
        </div>
      )}

      <section className="panel">
        <div className="panel-title"><h2>Lệnh DCA đang chạy</h2><small>{activeDcaPlans.length} kế hoạch</small></div>
        <div className="btc-plan-list">
          {activeDcaPlans.length === 0 ? <p className="muted">Chưa có kế hoạch DCA đang chạy.</p> : activeDcaPlans.map((plan) => {
            const planStats = dcaPlanStats(plan);
            const isExpanded = expandedDcaPlanIds.includes(plan.id);
            const isHistoryOpen = historyDcaPlanIds.includes(plan.id);
            const dcaTrades = state.btcTrades.filter((trade) => trade.type === "dca" && trade.planId === plan.id).sort((a, b) => b.executedAt.localeCompare(a.executedAt));
            return (
              <article className="btc-plan-card" key={plan.id}>
                <div className="btc-plan-header">
                  <div>
                    <div className="btc-plan-top-row">
                      <span className="status-badge btc-plan-status success">Đang chạy</span>
                      <div className="btc-plan-top-actions">
                        <button className={`btc-plan-icon-button ${isHistoryOpen ? "active" : ""}`} onClick={() => setHistoryDcaPlanIds((prev) => (prev.includes(plan.id) ? prev.filter((id) => id !== plan.id) : [...prev, plan.id]))} title="Lịch sử DCA" type="button"><History size={15} /></button>
                        <button className="btc-plan-delete-button danger-text" onClick={() => deletePlan(plan)} title="Xóa lệnh DCA" type="button"><X size={16} /></button>
                      </div>
                    </div>
                    <div className="btc-plan-title-row">
                      <h3>BTC Gói định kỳ</h3>
                      <strong className={`btc-plan-pnl ${planStats.pnlUsdt < 0 ? "stock-pnl loss" : "stock-pnl gain"}`}>{formatUsdt(planStats.pnlUsdt)} · {planStats.pnlPercent.toFixed(2)}%</strong>
                    </div>
                  </div>
                  <div className="btc-plan-actions">
                    <button className="ghost" onClick={() => setExpandedDcaPlanIds((prev) => (prev.includes(plan.id) ? prev.filter((id) => id !== plan.id) : [...prev, plan.id]))} type="button">{isExpanded ? "Ẩn chi tiết" : "Xem chi tiết"}</button>
                    <button className="ghost" onClick={() => editPlan(plan)} type="button"><Pencil size={16} /> Sửa</button>
                    <button className="ghost" onClick={() => togglePlan(plan)} type="button">Tạm dừng</button>
                  </div>
                </div>
                <div className="btc-plan-summary">
                  <span>Tần suất <strong>{dcaFrequencyLabel[plan.frequency]}, {plan.time}</strong></span>
                  <span>Số tiền đầu tư <strong>{formatUsdt(plan.amountUsdt)}</strong></span>
                </div>
                {isExpanded && (
                  <>
                    <div className="btc-plan-detail-grid">
                      <span>Số lượng nắm giữ <strong>{formatBtc(planStats.btcAmount)}</strong></span>
                      <span>Giá trị hiện tại <strong>{formatUsdt(planStats.currentValueUsdt)}</strong></span>
                      <span>Ngày bắt đầu <strong>{formatShortDateTime(planStats.startAt)}</strong></span>
                      <span>Giao dịch tiếp theo <strong>{formatShortDateTime(plan.nextRunAt)}</strong></span>
                    </div>
                    <div className="btc-plan-asset">
                      <div className="btc-plan-asset-title"><span className="btc-token-mark"><Bitcoin size={16} /></span><strong>BTC</strong><button className="btc-plan-icon-button" onClick={() => editDcaAsset(plan)} title="Sửa số BTC và giá trung bình" type="button"><Pencil size={15} /></button></div>
                      {editingDcaAssetPlanId === plan.id ? (
                        <div className="form-grid btc-form-grid btc-dca-asset-edit">
                          <label>Số lượng tích lũy<input value={dcaAssetForm.btcAmount} onChange={(event) => setDcaAssetForm({ ...dcaAssetForm, btcAmount: formatDecimalChange(event) })} placeholder="0,00043251" /></label>
                          <label>Giá trung bình (USDT)<input value={dcaAssetForm.averagePriceUsdt} onChange={(event) => setDcaAssetForm({ ...dcaAssetForm, averagePriceUsdt: formatDecimalChange(event) })} placeholder="64.565,25594748" /></label>
                          <button className="primary btc-form-submit" onClick={() => saveDcaAsset(plan)} type="button"><Save size={16} /> Lưu BTC</button>
                          <button className="ghost btc-form-submit" onClick={() => setEditingDcaAssetPlanId(null)} title="Hủy" aria-label="Hủy" type="button"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="btc-plan-detail-grid">
                          <span>Giá gần nhất <strong>{planStats.latestPriceUsdt ? formatUsdt(planStats.latestPriceUsdt) : "0 USDT"}</strong></span>
                          <span>Giá trung bình <strong>{planStats.averagePriceUsdt ? formatUsdt(planStats.averagePriceUsdt) : "0 USDT"}</strong></span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {isHistoryOpen && (
                  <div className="btc-dca-history">
                    <div className="btc-dca-history-title"><strong>Lịch sử giao dịch DCA</strong><small>{dcaTrades.length} lệnh</small></div>
                    {dcaTrades.length === 0 ? <p className="muted">Chưa có giao dịch DCA nào.</p> : (
                      <div className="btc-dca-history-list history-five-list">
                        {dcaTrades.map((trade) => (
                          <div key={trade.id}><span><Bitcoin size={14} /></span><div><strong>{formatBtc(trade.btcAmount)} · {formatUsdt(trade.usdtAmount)}</strong><small>{formatShortDateTime(trade.executedAt)} · Giá mua {formatUsdt(trade.btcPriceUsdt)} · {trade.note || "Không ghi chú"}</small></div></div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Lịch sử</h2><small>{historyRows.length} giao dịch Crypto</small></div>
        <div className="timeline crypto-history history-five-list">
          {historyRows.length === 0 ? <p className="muted">Chưa có giao dịch Crypto.</p> : historyRows.map((row) => (
            <div key={`${row.kind}-${row.item.id}`}>
              <span className={isInternalCryptoHistoryRow(row) ? "conversion" : row.kind === "btc-transfer" || (row.kind === "sol" && isSolWithdrawal(row.item)) ? "withdraw" : "deposit"}>
                {isInternalCryptoHistoryRow(row) ? <ArrowLeftRight size={15} /> : row.kind === "btc-transfer" || (row.kind === "sol" && isSolWithdrawal(row.item)) ? "-" : "+"}
              </span>
              <div className="timeline-row-content">
                <div>
                  {row.kind === "btc-topup" && <><strong>{formatUsdt(row.item.usdtAmount)} · {formatVnd(row.item.vndAmount)}</strong><small>{formatDate(row.item.date)} · Mua USDT · Giá {row.item.usdtAmount ? formatVnd(row.item.vndAmount / row.item.usdtAmount) : "0d"} · {row.item.note || "Không ghi chú"}</small></>}
                  {row.kind === "btc-trade" && <><strong>{formatBtc(row.item.btcAmount)} · {formatUsdt(row.item.usdtAmount)}</strong><small>{formatDate(dateValueFromDateTime(row.item.executedAt))} · Mua BTC @ {formatUsdt(row.item.btcPriceUsdt)} · {row.item.note || "Không ghi chú"}</small></>}
                  {row.kind === "btc-transfer" && <><strong>{row.item.destination === "usdt" ? formatUsdt(row.item.usdtAmount) : formatVnd(row.item.vndAmount)}</strong><small>{formatDate(row.item.date)} · {row.item.destination === "usdt" ? "Chuyển" : "Rút"} {row.item.asset.toUpperCase()} về {btcTransferDestinationLabel(row.item.destination)} · {row.item.note || "Không ghi chú"}</small></>}
                  {row.kind === "btc-transfer" && row.item.asset === "btc" && btcCostBasis.coinSaleByTransferId[row.item.id] && <small className={btcCostBasis.coinSaleByTransferId[row.item.id].pnlVnd < 0 ? "stock-pnl loss" : "stock-pnl gain"}>Lãi/lỗ đã chốt {formatSignedUsdt(btcCostBasis.coinSaleByTransferId[row.item.id].pnlUsdt)} · {formatSignedVnd(btcCostBasis.coinSaleByTransferId[row.item.id].pnlVnd)}</small>}
                  {row.kind === "btc-transfer" && row.item.asset === "usdt" && row.item.destination !== "usdt" && btcCostBasis.realizedByTransferId[row.item.id] && <small className={btcCostBasis.realizedByTransferId[row.item.id].pnlVnd < 0 ? "stock-pnl loss" : "stock-pnl gain"}>Lãi/lỗ đã chốt {formatSignedVnd(btcCostBasis.realizedByTransferId[row.item.id].pnlVnd)}</small>}
                  {row.kind === "sol" && isSolWithdrawal(row.item) && <><strong>-{formatSolAmount(row.item.solAmount)} · {formatVnd(row.item.vndAmount)}</strong><small>{formatDate(row.item.date)} · Rút SOL về {row.item.destination === "btc" ? "USDT" : solDestinationLabel(row.item.destination)} · Giá {formatUsd(row.item.sellPrice)} · {row.item.note || "Không ghi chú"}</small></>}
                  {row.kind === "sol" && isSolWithdrawal(row.item) && cryptoSnapshot.solCoinSaleByTransactionId[row.item.id] && <small className={cryptoSnapshot.solCoinSaleByTransactionId[row.item.id].pnlVnd < 0 ? "stock-pnl loss" : "stock-pnl gain"}>Lãi/lỗ đã chốt {formatSignedUsdt(cryptoSnapshot.solCoinSaleByTransactionId[row.item.id].pnlUsdt)} · {formatSignedVnd(cryptoSnapshot.solCoinSaleByTransactionId[row.item.id].pnlVnd)}</small>}
                  {row.kind === "sol" && !isSolWithdrawal(row.item) && <><strong>{formatSolAmount(row.item.solAmount)} · {formatUsd(row.item.solAmount * row.item.buyPrice)}</strong><small>{formatDate(row.item.date)} · Thêm SOL @ {formatUsd(row.item.buyPrice)} · {row.item.note || "Không ghi chú"}</small></>}
                </div>
                <button className="row-icon-button history-delete-button danger-text timeline-delete-button" onClick={() => deleteHistoryRow(row)} title="Xóa lịch sử" type="button"><X size={15} /></button>
                <button className="row-icon-button timeline-delete-button" onClick={() => setTraceEventIds([row.item.meta?.eventId ?? stableEventId(row.kind, row.item.id)])} title="Xem nguồn tiền" type="button"><History size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền Crypto"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </div>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

const reportSnapshotHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const roundReportValue = (value: number) =>
  Number.isFinite(value) ? Math.round(value) : 0;

function reportMonthlySnapshotSourceHash(state: AppState, month: string) {
  const upToMonth = (date: string) => monthFromDate(date) <= month;
  const source = {
    funds: state.fundTransactions
      .filter((item) => (item.fund === "btc" || item.fund === "stock") && item.month <= month)
      .map((item) => ({ id: item.id, fund: item.fund, type: item.type, amount: item.amount, date: item.date, month: item.month, note: item.note })),
    btcTopups: state.btcUsdtTopups
      .filter((item) => upToMonth(item.date))
      .map((item) => ({ id: item.id, vndAmount: item.vndAmount, usdtAmount: item.usdtAmount, date: item.date, occurredAt: item.occurredAt, sourceSolWithdrawalId: item.sourceSolWithdrawalId, note: item.note })),
    btcTrades: state.btcTrades
      .filter((item) => monthFromDate(dateValueFromDateTime(item.executedAt)) <= month)
      .map((item) => ({ id: item.id, type: item.type, usdtAmount: item.usdtAmount, btcAmount: item.btcAmount, btcPriceUsdt: item.btcPriceUsdt, costVnd: item.costVnd, executedAt: item.executedAt, planId: item.planId })),
    btcTransfers: state.btcTransfers
      .filter((item) => upToMonth(item.date))
      .map((item) => ({ id: item.id, asset: item.asset, btcAmount: item.btcAmount, usdtAmount: item.usdtAmount, btcPriceUsdt: item.btcPriceUsdt, vndAmount: item.vndAmount, destination: item.destination, date: item.date, occurredAt: item.occurredAt, closesPosition: item.closesPosition })),
    btcDcaPlans: state.btcDcaPlans.map((item) => ({ id: item.id, amountUsdt: item.amountUsdt, frequency: item.frequency, time: item.time, startDate: item.startDate, nextRunAt: item.nextRunAt, isActive: item.isActive, status: item.status })),
    solTransactions: state.solTransactions
      .filter((item) => upToMonth(item.date))
      .map((item) => ({
        id: item.id,
        type: item.type,
        solAmount: item.solAmount,
        buyPrice: isSolWithdrawal(item) ? undefined : item.buyPrice,
        sellPrice: isSolWithdrawal(item) ? item.sellPrice : undefined,
        costVnd: isSolWithdrawal(item) ? undefined : item.costVnd,
        vndAmount: isSolWithdrawal(item) ? item.vndAmount : undefined,
        usdtAmount: isSolWithdrawal(item) ? item.usdtAmount : undefined,
        destination: isSolWithdrawal(item) ? item.destination : undefined,
        date: item.date,
        occurredAt: item.occurredAt,
      })),
    stockPurchases: state.stockPurchases
      .filter((item) => item.month <= month)
      .map((item) => ({ id: item.id, date: item.date, month: item.month, lines: item.lines, createdAt: item.createdAt })),
    stockSales: state.stockSales
      .filter((item) => upToMonth(item.date))
      .map((item) => ({ id: item.id, symbol: item.symbol, shares: item.shares, sellPrice: item.sellPrice, vndAmount: item.vndAmount, fee: item.fee, tax: item.tax, netVndAmount: item.netVndAmount, destination: item.destination, date: item.date, createdAt: item.createdAt })),
    corporateActions: state.corporateActions
      .filter((item) => item.status === "applied" && upToMonth(corporateActionEventDate(item)))
      .map((item) => ({ id: item.id, symbol: item.symbol, type: item.type, receiveDate: item.receiveDate, paymentDate: item.paymentDate, recordDate: item.recordDate, exDate: item.exDate, ratioFrom: item.ratioFrom, ratioTo: item.ratioTo, cashPerShare: item.cashPerShare, subscriptionPrice: item.subscriptionPrice, taxRate: item.taxRate, fee: item.fee, eligibleShares: item.eligibleShares, resultingShares: item.resultingShares, cashReceived: item.cashReceived, newSymbol: item.newSymbol, status: item.status, appliedAt: item.appliedAt })),
    adjustments: state.adjustmentTransactions
      .filter((item) => (isCryptoQuantityAdjustment(item, "BTC") || isCryptoQuantityAdjustment(item, "USDT") || isCryptoQuantityAdjustment(item, "SOL") || isStockCashAdjustment(item) || isStockTotalAssetAdjustment(item)) && upToMonth(item.date))
      .map((item) => ({ id: item.id, asset: item.asset, accountId: item.accountId, amountVnd: item.amountVnd, quantity: item.quantity, date: item.date, createdAt: item.createdAt, note: item.note })),
  };
  return reportSnapshotHash(JSON.stringify(source));
}

function liveReportAssetSnapshot(state: AppState, month: string, sourceHash = reportMonthlySnapshotSourceHash(state, month)): ReportMonthlySnapshot {
  const sol = roundReportValue(solPositionFromState(state, month).balance * state.market.solUsd * (state.market.usdtVnd || state.market.usdVnd));
  return {
    month,
    btc: roundReportValue(btcPortfolioStats(state, month).reportValueVnd + sol),
    stock: roundReportValue(stockPortfolioStats(state, month).totalValue),
    sol,
    sourceHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const sameReportAssetSnapshotValues = (left: ReportMonthlySnapshot | undefined, right: ReportMonthlySnapshot) => {
  if (!left) return false;
  return (
    left.btc === right.btc &&
    left.stock === right.stock &&
    left.sol === right.sol &&
    left.sourceHash === right.sourceHash
  );
};

function ReportsPage({
  state,
  setState,
  onRefreshMarket,
  onOpenAccumulation,
  onOpenInvestment,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  onOpenAccumulation: () => void;
  onOpenInvestment: (target: { tab: InvestmentTab; depositFund?: DepositFund }) => void;
}) {
  const [activeReportChart, setActiveReportChart] = useState<ReportChartKey>("current-assets");
  const [reportRefreshSuccess, setReportRefreshSuccess] = useState(false);
  const [expandedPnlRowId, setExpandedPnlRowId] = useState<string | null>(null);
  const [traceEventIds, setTraceEventIds] = useState<string[] | null>(null);
  const reportRefreshTimer = useRef<number | null>(null);
  const reportFinancialIndex = useMemo(() => buildFinancialIndex(state), [state]);
  const months = useMemo(() => {
    const allMonths = new Set<string>();
    state.incomeTransactions.forEach((item) => allMonths.add(item.month));
    state.expenseEntries.forEach((item) => allMonths.add(item.month));
    state.allocations.forEach((item) => allMonths.add(item.month));
    state.fundTransactions.forEach((item) => allMonths.add(item.month));
    state.stockPurchases.forEach((item) => allMonths.add(item.month));
    state.stockSales.forEach((item) => allMonths.add(monthFromDate(item.date)));
    state.solTransactions.forEach((item) => allMonths.add(monthFromDate(item.date)));
    state.bankDeposits.forEach((item) => {
      allMonths.add(monthFromDate(item.startDate));
      if (item.settledAt) allMonths.add(monthFromDate(item.settledAt));
    });
    allMonths.add(DEFAULT_START_MONTH);
    allMonths.add(currentMonth());

    const sortedMonths = [...allMonths].sort();
    const lastMonth = sortedMonths[sortedMonths.length - 1] ?? currentMonth();
    const series: string[] = [];
    let cursor = DEFAULT_START_MONTH;

    while (cursor <= lastMonth) {
      series.push(cursor);
      cursor = shiftMonth(cursor, 1);
    }

    return series;
  }, [state]);

  const btcStats = btcPortfolioStats(state);
  const stockStats = stockPortfolioStats(state);
  const solVnd = solPositionFromState(state).balance * state.market.solUsd * (state.market.usdtVnd || state.market.usdVnd);
  const btc = btcStats.reportValueVnd + solVnd;
  const stock = stockStats.totalValue;
  const saving = depositFundPnl(state, "saving").current;
  const emergency = depositFundPnl(state, "emergency").current;
  const totalAssets = btc + stock + saving + emergency;
  const averageExpense = averageMonthlyExpenseSince(state);
  const retirementTarget = averageExpense * 300;
  const emergencyTarget = averageExpense * 6;
  const emergencyReserve = saving + emergency;
  const retirementProgress = retirementTarget ? Math.min((totalAssets / retirementTarget) * 100, 100) : 0;
  const emergencyProgress = emergencyTarget ? Math.min((emergencyReserve / emergencyTarget) * 100, 100) : 0;
  const assetMilestoneTarget = nextAssetMilestone(totalAssets);
  const assetMilestoneProgress = assetMilestoneTarget ? Math.min((totalAssets / assetMilestoneTarget) * 100, 100) : 0;
  const assetPercent = (value: number) => totalAssets ? Math.round((value / totalAssets) * 100) : 0;
  const accumulatedMonthCount = Math.max(months.length, 1);
  const formatGoalDuration = (monthCount: number) => {
    const normalized = Math.max(Math.ceil(monthCount), 1);
    const years = Math.floor(normalized / 12);
    const remainingMonths = normalized % 12;
    if (years && remainingMonths) return `${years} năm ${remainingMonths} tháng`;
    if (years) return `${years} năm`;
    return `${remainingMonths} tháng`;
  };
  const ruleForecast = (current: number, target: number) => {
    const averageMonthly = Math.round(Math.max(current, 0) / accumulatedMonthCount);
    if (target <= 0) return `TB ${formatVnd(averageMonthly)}/tháng · Chưa có mục tiêu`;
    if (current >= target) return `TB ${formatVnd(averageMonthly)}/tháng · Đã đạt mục tiêu`;
    if (averageMonthly <= 0) return `TB ${formatVnd(0)}/tháng · Chưa đủ dữ liệu dự kiến`;
    return `TB ${formatVnd(averageMonthly)}/tháng · còn ${formatGoalDuration((target - current) / averageMonthly)}`;
  };
  const reportChartLabels: Record<ReportChartKey, string> = {
    "current-assets": "Tổng tài sản hiện tại",
    "net-accumulation": "Tổng số tiền tích lũy",
    btc: "Crypto",
    stock: "CK",
    saving: "Quỹ tiết kiệm",
    emergency: "Quỹ dự phòng",
  };
  const fundRows: Array<{ id: FundKey | TransferDepositFund; label: string; value: number; tab: InvestmentTab; depositFund?: DepositFund }> = [
    { id: "btc", label: "Crypto", value: btc, tab: "crypto" },
    { id: "stock", label: "CK", value: stock, tab: "stock" },
    { id: "saving", label: "Quỹ tiết kiệm", value: saving, tab: "mbb", depositFund: "saving" },
    { id: "emergency", label: "Quỹ dự phòng", value: emergency, tab: "mbb", depositFund: "emergency" },
  ];
  const pnlRows = assetPnlRows(state);
  const totalPnlRow = pnlRows.find((row) => row.id === "total");
  const activeAccumulationGoals = state.accumulationGoals.filter((goal) => goal.status === "active");
  const reportGoalTimeline = (goal: AccumulationGoal) => {
    const endMonth = goal.dueDate ? monthFromDate(goal.dueDate) : shiftMonth(goal.startMonth, Math.max(goal.months - 1, 0));
    const unpaidMonths = accumulationUnpaidMonths(state, goal);
    return unpaidMonths > 0
      ? `Còn ${unpaidMonths}mo · end ${formatMonth(endMonth)}`
      : `Hoàn tất · end ${formatMonth(endMonth)}`;
  };
  const pnlRowDetails = (row: AssetPnlRow) => {
    const detail = (label: string, value: string) => ({ label, value });
    if (row.id === "total") {
      return pnlRows
        .filter((item) => item.id !== "total")
        .map((item) => detail(item.label, `${formatVnd(item.current)} · gốc ${formatVnd(item.principal)}`));
    }
    if (row.id === "btc") {
      const sol = solPositionFromState(state);
      const solCurrentUsd = sol.balance * state.market.solUsd;
      return [
        detail("Vốn Crypto", formatVnd(row.principal)),
        detail("VND dư", formatVnd(btcStats.pendingVnd)),
        detail("USDT còn", formatUsdt(btcStats.usdtBalance)),
        detail("BTC Đang nắm giữ", formatBtc(btcStats.btcBalance)),
        detail("SOL Đang nắm giữ", formatSolAmount(sol.balance)),
        detail("BTC quy VND", formatVnd(btcStats.btcValueUsdt * (state.market.usdtVnd || state.market.usdVnd))),
        detail("SOL quy VND", formatVnd(solCurrentUsd * (state.market.usdtVnd || state.market.usdVnd))),
        detail("Lãi/lỗ", `${formatVnd(row.pnl)} · ${row.pnlPercent.toFixed(1)}%`),
      ];
    }
    if (row.id === "stock") {
      return [
        detail("Vốn đang đầu tư CK", formatVnd(stockStats.investedValueVnd)),
        detail("Tiền mặt CK", formatVnd(stockStats.cash)),
        detail("Giá trị cổ phiếu", formatVnd(stockStats.stockValue)),
        detail("Giá vốn cổ phiếu", formatVnd(stockStats.totalCost)),
        detail("Lãi/lỗ", `${formatVnd(row.pnl)} · ${row.pnlPercent.toFixed(1)}%`),
        ...stockStats.holdings.map((holding) =>
          detail(holding.symbol, `${holding.shares.toLocaleString("vi-VN")} cp · ${formatVnd(holding.marketValue)}`)
        ),
      ];
    }
    if (row.id === "saving" || row.id === "emergency") {
      const fund = row.id as TransferDepositFund;
      const active = state.bankDeposits.filter((item) => item.fund === fund && item.status === "active");
      const pending = pendingSolDepositTotal(state, fund) + pendingStockSaleDepositTotal(state, fund) + pendingBtcTransferDepositTotal(state, fund);
      return [
        detail("Số Đang chạy", `${active.length.toLocaleString("vi-VN")} sổ`),
        detail("Gốc số Đang chạy", formatVnd(active.reduce((sum, item) => sum + originalDepositPrincipal(item, state.bankDeposits), 0))),
        detail("Giá trị hiện tại", formatVnd(active.reduce((sum, item) => sum + item.principal, 0))),
        detail("Tiền chờ tạo sổ", formatVnd(pending)),
        detail("Lãi/lỗ", `${formatVnd(row.pnl)} · ${row.pnlPercent.toFixed(1)}%`),
      ];
    }
    return [];
  };
  const pnlTraceEventIds = (rowId: AssetPnlRow["id"]) => {
    const events = reportFinancialIndex.events;
    if (rowId === "total") return events.map((event) => event.id);
    if (rowId === "btc") {
      return events
        .filter((event) =>
          event.asset === "BTC" ||
          event.asset === "USDT" ||
          event.asset === "SOL" ||
          event.entityType.startsWith("btc") ||
          event.entityType === "sol" ||
          event.accountFromId === "binance" ||
          event.accountToId === "binance"
        )
        .map((event) => event.id);
    }
    if (rowId === "stock") {
      return events
        .filter((event) =>
          event.asset === "STOCK" ||
          event.entityType === "stock-purchase" ||
          event.entityType === "stock-sale" ||
          event.entityType === "corporate-action" ||
          event.accountFromId === "vps" ||
          event.accountToId === "vps"
        )
        .map((event) => event.id);
    }
    if (rowId === "saving" || rowId === "emergency") {
      const depositIds = new Set(state.bankDeposits.filter((deposit) => deposit.fund === rowId).map((deposit) => deposit.id));
      return events
        .filter((event) =>
          (event.entityType === "deposit" && depositIds.has(event.entityId)) ||
          (event.entityType === "deposit-interest" && depositIds.has(event.entityId))
        )
        .map((event) => event.id);
    }
    return [];
  };

  useEffect(() => () => {
    if (reportRefreshTimer.current) window.clearTimeout(reportRefreshTimer.current);
  }, []);

  const refreshReportPrices = async () => {
    const symbols = stockPortfolioStats(state).holdings.map((item) => item.symbol);
    const [stockResult, solUpdated] = await Promise.all([
      refreshStockMarketPrices(symbols, setState),
      onRefreshMarket(true),
    ]);
    if (solUpdated || stockResult.updated > 0) {
      setReportRefreshSuccess(true);
      if (reportRefreshTimer.current) window.clearTimeout(reportRefreshTimer.current);
      reportRefreshTimer.current = window.setTimeout(() => setReportRefreshSuccess(false), 2000);
    }
  };

  const fundBalanceAtMonth = (fund: FundKey, month: string) =>
    state.fundTransactions
      .filter((item) => item.fund === fund && item.month <= month)
      .reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);
  const depositBalanceAtMonth = (fund: DepositFund, month: string) => {
    const asOfDate = month === currentMonth() ? today() : lastDayOfMonth(month);
    return state.bankDeposits
      .filter((item) =>
        item.fund === fund &&
        monthFromDate(item.startDate) <= month &&
        (!item.settledAt || monthFromDate(item.settledAt) > month)
      )
      .reduce((sum, item) => sum + item.principal + accruedInterestAt(item, asOfDate), 0);
  };
  const pendingSolDepositAtMonth = (fund: DepositFund, month: string) =>
    state.solTransactions
      .filter((transaction) => {
        if (!isSolWithdrawal(transaction) || transaction.destination !== fund || monthFromDate(transaction.date) > month) return false;
        const deposit = state.bankDeposits.find((item) => item.createdFromSolWithdrawalId === transaction.id);
        return !deposit || month < monthFromDate(deposit.startDate);
      })
      .reduce((sum, transaction) => sum + (isSolWithdrawal(transaction) ? transaction.vndAmount : 0), 0);
  const pendingStockSaleDepositAtMonth = (fund: DepositFund, month: string) =>
    state.stockSales
      .filter((sale) => {
        if (sale.destination !== fund || monthFromDate(sale.date) > month) return false;
        const deposit = state.bankDeposits.find((item) => item.note.includes(stockSaleDepositMarker(sale.id)));
        return !deposit || month < monthFromDate(deposit.startDate);
      })
      .reduce((sum, sale) => sum + stockSaleNetVndAmount(sale), 0);
  const pendingBtcTransferDepositAtMonth = (fund: DepositFund, month: string) =>
    state.btcTransfers
      .filter((transfer) => {
        if (transfer.destination !== fund || monthFromDate(transfer.date) > month) return false;
        const deposit = state.bankDeposits.find((item) => item.note.includes(btcTransferDepositMarker(transfer.id)));
        return !deposit || month < monthFromDate(deposit.startDate);
      })
      .reduce((sum, transfer) => sum + transfer.vndAmount, 0);
  const depositFundBalanceAtMonth = (fund: DepositFund, month: string) =>
    depositBalanceAtMonth(fund, month) + pendingSolDepositAtMonth(fund, month) + pendingStockSaleDepositAtMonth(fund, month) + pendingBtcTransferDepositAtMonth(fund, month);
  const withdrawalAtMonth = (key: ReportChartKey, month: string) => {
    if (key === "btc" || key === "stock") {
      return state.fundTransactions
        .filter((item) => item.fund === key && item.type === "withdraw" && item.month === month)
        .reduce((sum, item) => sum + item.amount, 0);
    }
    if (key === "saving" || key === "emergency") {
      return state.bankDeposits
        .filter((item) => item.fund === key && isIncomeGeneratingMbbSettlement(item) && monthFromDate(item.settledAt!) === month)
        .reduce((sum, item) => sum + (item.settledAmount ?? item.principal), 0);
    }
    return monthlyWithdrawal(state, month);
  };
  const reportSnapshotByMonth = useMemo(
    () => new Map(state.reportMonthlySnapshots.map((item) => [item.month, item])),
    [state.reportMonthlySnapshots]
  );
  const reportAssetSnapshotAtMonth = (month: string) => {
    const sourceHash = reportMonthlySnapshotSourceHash(state, month);
    const snapshot = reportSnapshotByMonth.get(month);
    if (month < currentMonth() && snapshot?.sourceHash === sourceHash) return snapshot;
    return liveReportAssetSnapshot(state, month, sourceHash);
  };

  useEffect(() => {
    setState((prev) => {
      const thisMonth = currentMonth();
      const snapshotMonths = months.filter((item) => item <= thisMonth);
      if (!snapshotMonths.length) return prev;

      const now = new Date().toISOString();
      const nextByMonth = new Map(prev.reportMonthlySnapshots.map((item) => [item.month, item]));
      let changed = false;

      snapshotMonths.forEach((month) => {
        const sourceHash = reportMonthlySnapshotSourceHash(prev, month);
        const live = liveReportAssetSnapshot(prev, month, sourceHash);
        const existing = nextByMonth.get(month);
        const shouldReplace =
          !existing ||
          existing.sourceHash !== sourceHash ||
          (month === thisMonth && !sameReportAssetSnapshotValues(existing, live));

        if (!shouldReplace) return;
        changed = true;
        nextByMonth.set(month, {
          ...live,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      });

      if (!changed) return prev;
      const snapshotMonthSet = new Set(snapshotMonths);
      const retained = prev.reportMonthlySnapshots.filter((item) => !snapshotMonthSet.has(item.month));
      const nextSnapshots = [
        ...retained,
        ...snapshotMonths.map((month) => nextByMonth.get(month)!),
      ].sort((left, right) => left.month.localeCompare(right.month));
      return { ...prev, reportMonthlySnapshots: nextSnapshots };
    });
  }, [months, setState, state]);

  const reportRows = months.reduce<
    Array<{
      month: string;
      currentAssets: number;
      netAccumulation: number;
      btc: number;
      stock: number;
      saving: number;
      emergency: number;
      sol: number;
      withdrawn: number;
      value: number;
    }>
  >(
    (rows, month) => {
      const summary = monthlySummary(state, month);
      const withdrawn = monthlyWithdrawal(state, month);
      const previousNetAccumulation = rows[rows.length - 1]?.netAccumulation ?? 0;
      const rowAssetSnapshot = reportAssetSnapshotAtMonth(month);
      const rowSol = rowAssetSnapshot.sol;
      const rowBtc = rowAssetSnapshot.btc;
      const rowStock = rowAssetSnapshot.stock;
      const rowSaving = depositFundBalanceAtMonth("saving", month);
      const rowEmergency = depositFundBalanceAtMonth("emergency", month);
      const currentAssets = rowBtc + rowStock + rowSaving + rowEmergency;
      const netAccumulation = Math.max(previousNetAccumulation + summary.saving - withdrawn, 0);
      const values: Record<ReportChartKey, number> = {
        "current-assets": currentAssets,
        "net-accumulation": netAccumulation,
        btc: rowBtc,
        stock: rowStock,
        saving: rowSaving,
        emergency: rowEmergency,
      };
      return [
        ...rows,
        {
          month: formatMonth(month),
          currentAssets,
          netAccumulation,
          btc: rowBtc,
          stock: rowStock,
          saving: rowSaving,
          emergency: rowEmergency,
          sol: rowSol,
          withdrawn: withdrawalAtMonth(activeReportChart, month),
          value: values[activeReportChart],
        },
      ];
    },
    []
  );
  const netAccumulationTotal = reportRows[reportRows.length - 1].netAccumulation ?? 0;

  return (
    <div className="page">
      <header className="page-header report-page-header">
        <div>
          <p className="eyebrow">Tổng tài sản</p>
        </div>
        <div className="page-header-actions report-header-actions">
          <button className="ghost report-refresh-button" onClick={refreshReportPrices} type="button" aria-label="Cập nhật giá">
            <RefreshCw size={17} />
          </button>
          {reportRefreshSuccess && (
            <span className="refresh-success-pill">
              <CheckCircle2 size={14} /> Đã cập nhật
            </span>
          )}
        </div>
      </header>
      <section className="metrics-grid report-metrics">
        <MetricCard
          label="Tài sản"
          value={formatVnd(totalAssets)}
          icon={<PiggyBank size={20} />}
          tone={activeReportChart === "current-assets" ? "highlight" : undefined}
          onClick={() => setActiveReportChart("current-assets")}
        />
        <MetricCard
          label="Tích lũy"
          value={formatVnd(netAccumulationTotal)}
          icon={<BadgeDollarSign size={20} />}
          tone={activeReportChart === "net-accumulation" ? "highlight" : undefined}
          onClick={() => setActiveReportChart("net-accumulation")}
        />
        <MetricCard
          label="Lãi/lỗ"
          value={formatVnd(totalPnlRow?.pnl ?? 0)}
          percent={Number((totalPnlRow?.pnlPercent ?? 0).toFixed(1))}
          icon={<Coins size={20} />}
          tone={(totalPnlRow?.pnl ?? 0) < 0 ? "loss" : undefined}
        />
      </section>
      <section className="panel asset-growth-panel">
        <div className="panel-title">
          <h2>{reportChartLabels[activeReportChart]}</h2>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={reportRows} margin={{ top: 12, right: 18, bottom: 8, left: -4 }}>
            <defs>
              <linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff8a00" stopOpacity={0.34} />
                <stop offset="58%" stopColor="#ff8a00" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#ff8a00" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" strokeDasharray="0" />
            <XAxis
              dataKey="month"
              axisLine={{ stroke: "rgba(255, 255, 255, 0.08)" }}
              tickLine={false}
              tick={{ fill: "rgba(221, 193, 174, 0.68)", fontSize: 10, fontWeight: 700 }}
              dy={8}
              interval="preserveStartEnd"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(221, 193, 174, 0.68)", fontSize: 10, fontWeight: 700 }}
              tickFormatter={formatChartMoneyTick}
              width={52}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255, 138, 0, 0.26)", strokeWidth: 1 }}
              content={(props) => <GrowthTooltip {...(props as any)} chartKey={activeReportChart} label={reportChartLabels[activeReportChart]} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#ff8a00"
              strokeWidth={2.4}
              fill="url(#assetFill)"
              dot={{ r: 2.2, fill: "#fff7ed", stroke: "#ff8a00", strokeWidth: 1.8 }}
              activeDot={{ r: 4.4, fill: "#fff7ed", stroke: "#ff8a00", strokeWidth: 2.2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <section className="asset-grid">
        {fundRows.map((fund) => (
          <FundChip
            key={fund?.label}
            label={fund?.label}
            value={fund?.value}
            percent={assetPercent(fund?.value)}
            tone={activeReportChart === fund?.id ? "highlight" : undefined}
            onClick={() => setActiveReportChart(fund?.id)}
            onOpen={() => onOpenInvestment({ tab: fund.tab, depositFund: fund.depositFund })}
          />
        ))}
      </section>
      <section className="report-bento-grid">
        <section className="report-financial-rule-stack" aria-label="Quy tắc tài chính">
          <article className="financial-rule-card milestone">
            <div>
              <small>Mục tiêu</small>
              <strong>{formatVnd(totalAssets)} / {formatVnd(assetMilestoneTarget)}</strong>
            </div>
            <b>{assetMilestoneProgress.toFixed(0)}%</b>
            <div className="financial-rule-progress"><span style={{ width: `${assetMilestoneProgress}%` }} /></div>
            <p className="financial-rule-forecast">{ruleForecast(totalAssets, assetMilestoneTarget)}</p>
          </article>
          <article className="financial-rule-card emergency">
            <div>
              <small>Dự phòng 6 tháng</small>
              <strong>{formatVnd(emergencyReserve)} / {formatVnd(emergencyTarget)}</strong>
            </div>
            <b>{emergencyProgress.toFixed(0)}%</b>
            <div className="financial-rule-progress"><span style={{ width: `${emergencyProgress}%` }} /></div>
            <p className="financial-rule-forecast">{ruleForecast(emergencyReserve, emergencyTarget)}</p>
          </article>
          <article className="financial-rule-card">
            <div>
              <small>Tự do tài chính</small>
              <strong>{formatVnd(totalAssets)} / {formatVnd(retirementTarget)}</strong>
            </div>
            <b>{retirementProgress.toFixed(0)}%</b>
            <div className="financial-rule-progress"><span style={{ width: `${retirementProgress}%` }} /></div>
            <p className="financial-rule-forecast">{ruleForecast(totalAssets, retirementTarget)}</p>
          </article>
        </section>
        <article className="panel report-goals-card">
          <div className="panel-title report-card-title">
            <h2>Mục tiêu tích lũy</h2>
            <button type="button" onClick={onOpenAccumulation}>Xem tất cả</button>
          </div>
          {activeAccumulationGoals.length === 0 ? (
            <p className="muted">Chưa có mục tích lũy đang hoạt động.</p>
          ) : (
            <div className="report-goal-list">
              {activeAccumulationGoals.slice(0, 3).map((goal) => {
                const progress = accumulationProgress(state, goal);
                const percent = goal.targetAmount ? Math.min((progress / goal.targetAmount) * 100, 100) : 0;
                return (
                  <div className="report-goal-item" key={goal.id}>
                    <div className="report-goal-row">
                      <div>
                        <strong>{goal.name}</strong>
                        <small>{reportGoalTimeline(goal)}</small>
                      </div>
                      <div>
                        <b>{percent.toFixed(0)}%</b>
                        <small>{formatVnd(progress)}/{formatVnd(goal.targetAmount)}</small>
                      </div>
                    </div>
                    <div className="report-mini-progress">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Lãi/lỗ theo gốc</h2>
        </div>
        <div className="asset-pnl-table">
          <div className="asset-pnl-header">
            <strong>Tên quỹ</strong>
            <strong>Vốn đang đầu tư</strong>
            <strong>Giá trị hiện tại</strong>
            <strong>Lãi/lỗ</strong>
            <strong>%</strong>
          </div>
          {pnlRows.map((row) => {
            const isExpanded = expandedPnlRowId === row.id;
            const details = pnlRowDetails(row);
            return (
              <div className="asset-pnl-row-group" key={row.id}>
                <button className={`asset-pnl-row ${row.id === "total" ? "total" : ""} ${isExpanded ? "expanded" : ""}`} onClick={() => setExpandedPnlRowId(isExpanded ? null : row.id)} type="button">
                  <span data-label="Tên quỹ">{row.label}</span>
                  <span data-label="Vốn đang đầu tư">{formatVnd(row.principal)}</span>
                  <span data-label="Giá trị hiện tại">{formatVnd(row.current)}</span>
                  <span data-label="Lãi/lỗ" className={row.pnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{formatVnd(row.pnl)}</span>
                  <span data-label="% lãi/lỗ" className={row.pnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{row.principal ? `${row.pnlPercent.toFixed(1)}%` : "0.0%"}</span>
                </button>
                {isExpanded && (
                  <div className="asset-pnl-drilldown">
                    {details.map((item) => (
                      <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                    <button className="ghost action-button-sm asset-pnl-trace-button" onClick={() => setTraceEventIds(pnlTraceEventIds(row.id))} type="button">
                      <History size={15} /> Xem nguồn tiền
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {traceEventIds && (
        <SourceTraceModal
          state={state}
          eventIds={traceEventIds}
          title="Nguồn tiền báo cáo"
          onClose={() => setTraceEventIds(null)}
        />
      )}
    </div>
  );
}

function formatChartMoneyTick(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 1) return "0";
  const absolute = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) {
    return `${sign}${(absolute / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}${Math.round(absolute / 1_000_000).toLocaleString("vi-VN")} triệu`;
  }
  if (absolute >= 1_000) {
    return `${sign}${Math.round(absolute / 1_000).toLocaleString("vi-VN")}K`;
  }
  return `${sign}${Math.round(absolute).toLocaleString("vi-VN")}`;
}

function monthlyWithdrawal(state: AppState, month: string) {
  const fundWithdrawals = state.fundTransactions
    .filter((item) => item.type === "withdraw" && item.month === month)
    .reduce((sum, item) => sum + item.amount, 0);

  const depositSettlements = state.bankDeposits
    .filter((item) => isIncomeGeneratingMbbSettlement(item) && monthFromDate(item.settledAt!) === month)
    .reduce((sum, item) => sum + (item.settledAmount ?? item.principal), 0);

  return fundWithdrawals + depositSettlements;
}

function GrowthTooltip({
  active,
  payload,
  chartKey,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      month: string;
      value: number;
      currentAssets: number;
      netAccumulation: number;
      btc: number;
      stock: number;
      saving: number;
      emergency: number;
      sol: number;
      withdrawn: number;
    };
  }>;
  chartKey: ReportChartKey;
  label: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const breakdown = [
    { label: "Crypto", value: point.btc },
    { label: "CK", value: point.stock },
    { label: "Tiết kiệm", value: point.saving },
    { label: "Dự phòng", value: point.emergency },
  ];

  return (
    <div className="growth-tooltip">
      <strong>{point.month}</strong>
      {chartKey === "current-assets" ? (
        <>
          {breakdown.map((item) => (
            <span key={item.label}>
              <em>{item.label}</em>
              <b>{formatVnd(item.value)}</b>
            </span>
          ))}
          <span>
            <em>Tổng</em>
            <b>{formatVnd(point.currentAssets)}</b>
          </span>
        </>
      ) : (
        <>
          <span>
            <em>{label}</em>
            <b>{formatVnd(point.value)}</b>
          </span>
          <span>
            <em>Số tiền rút</em>
            <b>{formatVnd(point.withdrawn)}</b>
          </span>
        </>
      )}
    </div>
  );
}

type SettingsSection = "data" | "security" | "trash" | "history";
type PinBypassOption = "now" | "10m" | "1h" | "6h" | "manual";
type AuditFilter = "all" | AuditAction;

const pinBypassOptions: Array<{ value: PinBypassOption; label: string; ms?: number }> = [
  { value: "now", label: "Ngay lập tức" },
  { value: "10m", label: "10 phút", ms: 10 * 60_000 },
  { value: "1h", label: "1 giờ", ms: 60 * 60_000 },
  { value: "6h", label: "6 giờ", ms: 6 * 60 * 60_000 },
  { value: "manual", label: "Đến khi bật lại" },
];

function pinLoginBypassStatus(value?: string) {
  if (!value) return "Yêu cầu PIN";
  if (value === "manual") return "Tắt đến khi bật lại.";
  const expiresAt = new Date(value).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return "Yêu cầu PIN";
  return `${formatDateTime(value)} mở lại`;
}

function isPinLoginBypassActive(value?: string) {
  if (!value) return false;
  if (value === "manual") return true;
  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function SettingsPage({
  state,
  setState,
  cloudSync,
  dataTools,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  cloudSync: {
    configured: boolean;
    status: string;
    activePin: string;
    onSyncNow: () => void;
    onPullFromCloud: () => void;
    onVerifyAdminPassword: (password: string) => Promise<AdminActionResult>;
    onChangePin: (pin: string) => Promise<void> | void;
  };
  dataTools: {
    onExportBackup: () => void;
    onExportCsv: () => void;
    onRestoreBackup: (file: File) => Promise<void>;
    onRestoreTrash: (trashItemId: string) => void;
    onPermanentDeleteTrash: (trashItemId: string) => void;
  };
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("data");
  const [restoreStatus, setRestoreStatus] = useState("");
  const [restorePinModalOpen, setRestorePinModalOpen] = useState(false);
  const [restorePin, setRestorePin] = useState("");
  const [restoreAuthorized, setRestoreAuthorized] = useState(false);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinStatus, setPinStatus] = useState("");
  const [historyFilter, setHistoryFilter] = useState<AuditFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const trashItems = [...state.trashItems].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  const filteredAuditLogs = state.auditLogs.filter((log) => historyFilter === "all" || log.action === historyFilter).slice(0, 80);
  const currentPin = cloudSync.activePin || state.settings.pin;
  const bypassActive = state.settings.pinLoginDisabledUntil === "manual" || (
    Boolean(state.settings.pinLoginDisabledUntil) &&
    new Date(state.settings.pinLoginDisabledUntil ?? "").getTime() > Date.now()
  );

  const updateSettings = (updater: (settings: SettingsState) => SettingsState) => {
    setState((prev) => ({ ...prev, settings: updater(prev.settings) }));
  };

  const openRestorePinModal = () => {
    setRestorePin("");
    setRestoreStatus("");
    setRestorePinModalOpen(true);
  };

  const authorizeRestore = () => {
    if (!currentPin || restorePin !== currentPin) {
      setRestoreStatus("PIN không đúng. Không thể khôi phục JSON.");
      return;
    }
    setRestoreAuthorized(true);
    setRestorePinModalOpen(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const restoreFromFile = async (file?: File) => {
    if (!file) return;
    if (!restoreAuthorized) {
      setRestoreStatus("Nhập đúng PIN trước khi khôi phục JSON.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!window.confirm("Restore backup sẽ thay toàn bộ dữ liệu hiện tại. App sẽ tự lưu bản backup trước khi restore. Tiếp tục?")) {
      setRestoreAuthorized(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      setRestoreStatus("Đang restore backup...");
      await dataTools.onRestoreBackup(file);
      setRestoreStatus("Đã restore backup thành công.");
    } catch (error) {
      setRestoreStatus(error instanceof Error ? error.message : "Không restore được backup.");
    } finally {
      setRestoreAuthorized(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const changePinWithAdmin = async () => {
    if (!adminPassword) {
      setPinStatus("Nhập mật khẩu admin.");
      return;
    }
    if (newPin.length < 4) {
      setPinStatus("PIN mới cần tối thiểu 4 số.");
      return;
    }
    if (newPin === currentPin) {
      setPinStatus("PIN mới phải khác PIN hiện tại.");
      return;
    }

    setPinStatus("Đang kiểm tra mật khẩu admin...");
    const adminResult = await cloudSync.onVerifyAdminPassword(adminPassword);
    if (!adminResult.ok) {
      setPinStatus(adminResult.status);
      return;
    }
    setPinStatus("Đang đổi PIN...");
    await cloudSync.onChangePin(newPin);
    setAdminPassword("");
    setNewPin("");
    setPinChangeOpen(false);
    setPinStatus("Đã đổi PIN.");
  };

  const applyPinBypass = (value: PinBypassOption) => {
    const option = pinBypassOptions.find((item) => item.value === value);
    const nextValue = value === "manual" ? "manual" : option?.ms ? new Date(Date.now() + option.ms).toISOString() : undefined;
    updateSettings((settings) => ({ ...settings, pinLoginDisabledUntil: nextValue }));
  };

  const daysLeft = (iso: string) => Math.max(Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000), 0);
  const menuItems: Array<{ id: SettingsSection; label: string; icon: JSX.Element; tone: string }> = [
    { id: "data", label: "Dữ liệu", icon: <Database size={15} />, tone: "orange" },
    { id: "security", label: "PIN & bảo mật", icon: <ShieldCheck size={15} />, tone: "blue" },
    { id: "trash", label: "Thùng rác", icon: <Trash2 size={15} />, tone: "rose" },
    { id: "history", label: "Lịch sử thao tác", icon: <History size={15} />, tone: "green" },
  ];

  return (
    <div className="page settings-page">
      <div className="settings-shell">
        <aside className="settings-menu panel" aria-label="Menu cài đặt">
          {menuItems.map((item) => (
            <button
              className={`settings-menu-item ${activeSection === item.id ? "active" : ""} tone-${item.tone}`}
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <section className="panel settings-section-panel">
          {activeSection === "data" && (
            <>
              <div className="panel-title settings-section-title">
                <h2>Quản lý dữ liệu</h2>
                <small>{state.backupMeta?.lastExportAt ? `Backup ${formatDateTime(state.backupMeta.lastExportAt)}` : "Chưa backup"}</small>
              </div>
              <div className="settings-action-list">
                <button className="settings-action-row" disabled={!cloudSync.configured || !cloudSync.activePin} onClick={cloudSync.onPullFromCloud} type="button">
                  <span className="settings-action-icon info"><RefreshCw size={18} /></span>
                  <span><strong>Tải từ cloud</strong></span>
                  <b>Kéo xuống</b>
                </button>
                <button className="settings-action-row" disabled={!cloudSync.configured || !cloudSync.activePin} onClick={cloudSync.onSyncNow} type="button">
                  <span className="settings-action-icon success"><Upload size={18} /></span>
                  <span><strong>Đồng bộ lên cloud</strong></span>
                  <b>Đẩy lên</b>
                </button>
                <button className="settings-action-row" onClick={dataTools.onExportBackup} type="button">
                  <span className="settings-action-icon warm"><Download size={18} /></span>
                  <span><strong>Tạo backup JSON</strong></span>
                  <b>Tải xuống</b>
                </button>
                <button className="settings-action-row" onClick={dataTools.onExportCsv} type="button">
                  <span className="settings-action-icon success"><FileText size={18} /></span>
                  <span><strong>Xuất dữ liệu CSV</strong></span>
                  <b>Xuất file</b>
                </button>
                <button className="settings-action-row" onClick={openRestorePinModal} type="button">
                  <span className="settings-action-icon info"><Upload size={18} /></span>
                  <span><strong>Khôi phục từ JSON</strong></span>
                  <b>Chọn file</b>
                </button>
              </div>
              <input
                ref={fileInputRef}
                className="hidden-file-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void restoreFromFile(event.target.files?.[0])}
              />
              <small className={restoreStatus.includes("thành công") ? "ok" : restoreStatus ? "form-error" : "muted"}>
                {restoreStatus || (cloudSync.configured ? cloudSync.status : "Cloud sync chưa cấu hình; PIN và dữ liệu vẫn lưu local/PWA.")}
              </small>
            </>
          )}

          {activeSection === "security" && (
            <>
              <div className="panel-title settings-section-title">
                <h2>PIN & bảo mật</h2>
                <small>{state.settings.hasPin ? "PIN đang bật" : "Chưa bật PIN"}</small>
              </div>
              <div className="settings-security-card">
                <span className="settings-action-icon info"><KeyRound size={18} /></span>
                <div>
                  <strong>Mã PIN đang bật</strong>
                </div>
                <button className="ghost" onClick={() => setPinChangeOpen((open) => !open)} type="button">Đổi PIN</button>
              </div>
              {pinChangeOpen && (
                <div className="settings-pin-change">
                  <label>Mật khẩu admin<input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label>
                  <label>PIN mới<input className="pin-input" type="tel" inputMode="numeric" pattern="[0-9]*" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))} /></label>
                  <button className="primary" onClick={() => void changePinWithAdmin()} type="button">Lưu PIN mới</button>
                </div>
              )}
              <div className="settings-toggle-row">
                <div>
                  <strong>Tự khóa khi không hoạt động</strong>
                  <small>Khóa app sau 5 phút không thao tác.</small>
                </div>
                <button
                  className={`settings-switch ${state.settings.autoLockEnabled ? "on" : ""}`}
                  onClick={() => updateSettings((settings) => ({ ...settings, autoLockEnabled: !settings.autoLockEnabled }))}
                  role="switch"
                  aria-checked={state.settings.autoLockEnabled}
                  type="button"
                >
                  <span />
                </button>
              </div>
              <div className="settings-toggle-row">
                <div>
                  <strong>Tắt PIN</strong>
                  <small>{pinLoginBypassStatus(state.settings.pinLoginDisabledUntil)}</small>
                </div>
                <label className="settings-select-label">
                  <TimerReset size={16} />
                  <select value={bypassActive ? (state.settings.pinLoginDisabledUntil === "manual" ? "manual" : "10m") : "now"} onChange={(event) => applyPinBypass(event.target.value as PinBypassOption)}>
                    {pinBypassOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              {pinStatus && <small className={pinStatus.includes("Đã") ? "ok" : "form-error"}>{pinStatus}</small>}
            </>
          )}

          {activeSection === "trash" && (
            <>
              <div className="panel-title settings-section-title">
                <h2>Thùng rác 30 ngày</h2>
                <small>{trashItems.length} mục</small>
              </div>
              {trashItems.length === 0 ? (
                <p className="muted">Chưa có dữ liệu nào trong thùng rác.</p>
              ) : (
                <div className="settings-list settings-list-full">
                  {trashItems.map((item) => (
                    <div className="settings-list-row" key={item.id}>
                      <div className="settings-row-main">
                        <span className="settings-action-icon danger"><Trash2 size={16} /></span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>Đã xóa {formatDateTime(item.deletedAt)} · còn {daysLeft(item.expiresAt)} ngày</small>
                        </div>
                      </div>
                      <div className="settings-list-actions">
                        <button className="ghost" onClick={() => dataTools.onRestoreTrash(item.id)} type="button">
                          <RotateCcw size={15} /> Khôi phục
                        </button>
                        <button
                          className="ghost danger-action"
                          onClick={() => {
                            if (window.confirm(`Xóa vĩnh viễn ${item.label}? Không thể khôi phục sau thao tác này.`)) dataTools.onPermanentDeleteTrash(item.id);
                          }}
                          type="button"
                        >
                          <Trash2 size={15} /> Xóa hẳn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeSection === "history" && (
            <>
              <div className="panel-title settings-section-title">
                <h2>Lịch sử thao tác</h2>
                <button className="ghost" onClick={() => setFiltersOpen((open) => !open)} type="button"><ListFilter size={15} /> Lọc</button>
              </div>
              {filtersOpen && (
                <div className="settings-filter-row">
                  {(["all", "create", "update", "delete", "restore", "backup", "sync"] as AuditFilter[]).map((filter) => (
                    <button className={historyFilter === filter ? "active" : ""} key={filter} onClick={() => setHistoryFilter(filter)} type="button">
                      {filter === "all" ? "Tất cả" : filter}
                    </button>
                  ))}
                </div>
              )}
              {filteredAuditLogs.length === 0 ? (
                <p className="muted">Chưa có log thao tác.</p>
              ) : (
                <div className="settings-list audit-list settings-list-full">
                  {filteredAuditLogs.map((log) => (
                    <div className="settings-list-row audit-row" key={log.id}>
                      <div>
                        <strong>{log.label}</strong>
                        <small>{log.action} · {log.entityType} · {formatDateTime(log.createdAt)}</small>
                      </div>
                      <span className={`status-badge neutral audit-action-${log.action}`}>{log.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {restorePinModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card settings-pin-modal">
            <div className="panel-title">
              <h2>Xác nhận PIN</h2>
              <button className="ghost icon-only" onClick={() => setRestorePinModalOpen(false)} title="Đóng" type="button"><X size={16} /></button>
            </div>
            <p className="muted">Nhập PIN hiện tại để khôi phục dữ liệu từ JSON.</p>
            <input
              className="pin-input"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={restorePin}
              onChange={(event) => setRestorePin(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") authorizeRestore();
              }}
            />
            <button className="primary full" onClick={authorizeRestore} type="button">Xác nhận và chọn file</button>
          </div>
        </div>
      )}
    </div>
  );
}

type QuickActionGroup = "income" | "expense" | "crypto" | "stock" | "mbb" | "undo";
type QuickActionKind =
  | "income"
  | "expense"
  | "btc-usdt"
  | "btc-dca"
  | "crypto-transfer"
  | "btc-transfer"
  | "stock-buy"
  | "stock-transfer"
  | "stock-event"
  | "deposit"
  | "sol-buy"
  | "sol-transfer"
  | "undo";

function QuickActionButton({
  state,
  setState,
  commitWithUndo,
  undoStack,
  onUndoToEntry,
  btcCloudAccountId,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  commitWithUndo: CommitWithUndo;
  undoStack: UndoEntry[];
  onUndoToEntry: (entryId: string) => void;
  btcCloudAccountId: string;
}) {
  const [open, setOpen] = useState(false);
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null);
  const fabDragRef = useRef({ pointerId: 0, startX: 0, startY: 0, left: 0, top: 0, moved: false, dragging: false });
  const suppressFabClickRef = useRef(false);
  const [group, setGroup] = useState<QuickActionGroup>("income");
  const [kind, setKind] = useState<QuickActionKind>("income");
  const [error, setError] = useState("");
  const [income, setIncome] = useState({ categoryId: defaultIncomeCategoryId(state.incomeCategories), amount: "", date: today(), note: "" });
  const [expense, setExpense] = useState({ categoryId: defaultExpenseCategoryId(state.expenseCategories), amount: "", date: today(), note: "" });
  const [usdt, setUsdt] = useState({ vnd: "", amount: "", date: today(), note: "Binance P2P" });
  const [dca, setDca] = useState({ amount: "2", frequency: "daily" as BtcDcaFrequency, time: "12:00", startDate: today(), note: "DCA Binance" });
  const [btcTransfer, setBtcTransfer] = useState({
    asset: "usdt" as "btc" | "usdt",
    btc: "",
    usdt: "",
    price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "",
    received: "",
    destination: "btc" as BtcTransferTarget,
    date: today(),
    note: "",
  });
  const [cryptoTransfer, setCryptoTransfer] = useState({
    asset: "btc" as "btc" | "usdt" | "sol",
    btc: "",
    usdt: "",
    sol: "",
    price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "",
    received: "",
    btcReceived: "",
    destination: "usdt" as BtcTransferTarget | "btc-direct",
    date: today(),
    note: "",
  });
  const [quickStockRows, setQuickStockRows] = useState<StockBuyRow[]>(() => [{ id: uid(), symbol: "", percent: "100", shares: "", buyPrice: "" }]);
  const [quickStockMeta, setQuickStockMeta] = useState({ date: today(), note: "" });
  const [stockTransfer, setStockTransfer] = useState({ symbol: "", shares: "", price: "", fee: "", netVnd: "", destination: "stock" as SolDestination, date: today(), note: "" });
  const [quickCorporate, setQuickCorporate] = useState({
    symbol: "",
    type: "cash_dividend" as CorporateAction["type"],
    receiveDate: today(),
    ratioFrom: "100",
    ratioTo: "10",
    cashDividendPercent: "10",
    cashPerShare: "",
    subscriptionPrice: "10",
    taxRate: "5",
    eligibleShares: "",
    resultingShares: "",
    cashReceived: "",
  });
  const [deposit, setDeposit] = useState({
    fund: "saving" as DepositFund,
    product: "certificate" as DepositProduct,
    accumulationGoalId: "",
    amount: "",
    certificatePurchaseAmount: "",
    certificateMaturityValue: "",
    certificatePurchaseTouched: false,
    certificateMaturityTouched: false,
    rate: depositRateForTerm(DEFAULT_DEPOSIT_TERM_MONTHS),
    term: String(DEFAULT_DEPOSIT_TERM_MONTHS),
    date: today(),
    mbLast4: "",
    note: "",
  });
  const [sol, setSol] = useState({
    amount: "",
    price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "",
    valueUsdt: "",
    valueVnd: "",
    date: today(),
  });
  const [solTransfer, setSolTransfer] = useState({ amount: "", price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "", vnd: "", btc: "", destination: "cash" as SolDestination, date: today(), note: "" });
  const [solTransferBtcTouched, setSolTransferBtcTouched] = useState(false);
  const clampFabPosition = (x: number, y: number, size = 40) => ({
    x: Math.min(Math.max(x, 6), Math.max(window.innerWidth - size - 6, 6)),
    y: Math.min(Math.max(y, 6), Math.max(window.innerHeight - size - 6, 6)),
  });
  useEffect(() => {
    if (!fabPosition) return;
    const keepFabInViewport = () => {
      setFabPosition((current) => {
        if (!current) return current;
        const next = clampFabPosition(current.x, current.y);
        if (next.x === current.x && next.y === current.y) return current;
        return next;
      });
    };
    window.addEventListener("resize", keepFabInViewport);
    return () => window.removeEventListener("resize", keepFabInViewport);
  }, [fabPosition]);
  const startFabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    fabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
      dragging: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveFabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current;
    if (!drag.dragging || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;
    const next = clampFabPosition(drag.left + dx, drag.top + dy, event.currentTarget.offsetWidth || 40);
    setFabPosition(next);
  };
  const endFabDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current;
    if (!drag.dragging || drag.pointerId !== event.pointerId) return;
    fabDragRef.current = { ...drag, dragging: false };
    if (drag.moved) {
      suppressFabClickRef.current = true;
      const rect = event.currentTarget.getBoundingClientRect();
      setFabPosition(clampFabPosition(rect.left, rect.top, event.currentTarget.offsetWidth || 40));
      window.setTimeout(() => {
        suppressFabClickRef.current = false;
      }, 0);
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const groups: Array<{ id: QuickActionGroup; label: string; defaultKind: QuickActionKind }> = [
    { id: "income", label: "Thu nhập", defaultKind: "income" },
    { id: "expense", label: "Chi tiêu", defaultKind: "expense" },
    { id: "crypto", label: "Crypto", defaultKind: "btc-usdt" },
    { id: "stock", label: "CK", defaultKind: "stock-buy" },
    { id: "mbb", label: "Sổ MBB", defaultKind: "deposit" },
    { id: "undo", label: "Undo", defaultKind: "undo" },
  ];
  const subActions: Record<QuickActionGroup, Array<{ id: QuickActionKind; label: string }>> = {
    income: [{ id: "income", label: "Thêm thu nhập" }],
    expense: [{ id: "expense", label: "Thêm chi tiêu" }],
    crypto: [
      { id: "btc-usdt", label: "Mua USDT" },
      { id: "btc-dca", label: "Tạo DCA" },
      { id: "sol-buy", label: "Mua SOL" },
      { id: "crypto-transfer", label: "Rút Crypto" },
    ],
    stock: [
      { id: "stock-buy", label: "Mua CK" },
      { id: "stock-transfer", label: "Rút / chuyển" },
      { id: "stock-event", label: "Sự kiện" },
    ],
    mbb: [{ id: "deposit", label: "Tạo sổ" }],
    undo: [{ id: "undo", label: "Hoàn tác" }],
  };
  const btcStats = btcPortfolioStats(state);
  const stockStats = stockPortfolioStats(state);
  const solStats = solPositionFromState(state);
  const quickUsdtVndRate = state.market.usdtVnd || state.market.usdVnd;
  const formatQuickSolDecimal = (value: number, digits = 6) => {
    if (!Number.isFinite(value) || value <= 0) return "";
    return formatDecimalInput(value.toFixed(digits).replace(/\.?0+$/, ""));
  };
  // Phải khai báo trước khi quickStockPlannedValue sử dụng
  const quickMarketPriceForBuyRow = (row: StockBuyRow) =>
  stockMarketPrice(state, row.symbol)?.price ?? 0;

  const quickEffectiveBuyPrice = (row: StockBuyRow) =>
  parseDecimal(row.buyPrice) || quickMarketPriceForBuyRow(row);
  const quickStockPlannedGrossValue = quickStockRows.reduce((sum, row) => sum + stockLineValue({ shares: Number(row.shares) || 0, buyPrice: quickEffectiveBuyPrice(row) }), 0);
  const quickStockPlannedFee = estimateStockBuyFee(quickStockPlannedGrossValue);
  const quickStockPlannedValue = quickStockPlannedGrossValue + quickStockPlannedFee;
  const quickStockTransferValue = Math.round((parseDecimal(stockTransfer.shares) || 0) * (parseDecimal(stockTransfer.price) || 0) * STOCK_PRICE_UNIT);
  const quickStockTransferFee = stockTransfer.fee ? parseMoney(stockTransfer.fee) : estimateStockSaleFee(quickStockTransferValue, parseDecimal(stockTransfer.shares) || 0);
  const quickStockTransferNet = stockTransfer.netVnd ? parseMoney(stockTransfer.netVnd) : Math.max(quickStockTransferValue - quickStockTransferFee, 0);
  const quickSolBuyValueUsdt = (parseDecimal(sol.amount) || 0) * (parseDecimal(sol.price) || 0);
  const quickSolBuyValueVnd = Math.round(quickSolBuyValueUsdt * quickUsdtVndRate);
  const stockDestinationOptions: Array<{ id: SolDestination; label: string }> = [
    { id: "stock", label: "CK" },
    { id: "btc", label: "BTC" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "cash", label: "Tiền mặt" },
  ];
  const activeAccumulationGoals = state.accumulationGoals.filter((goal) => goal.status === "active");
  const selectedQuickCorporateSymbol = quickCorporate.symbol.trim().toUpperCase();
  const selectedQuickCorporateHolding = stockStats.holdings.find((item) => item.symbol === selectedQuickCorporateSymbol);
  const selectedQuickCorporateEventShares = selectedQuickCorporateSymbol ? stockSharesAtDate(state, selectedQuickCorporateSymbol, quickCorporate.receiveDate) : 0;
  const quickCorporateEligibleShares = Number(quickCorporate.eligibleShares) || selectedQuickCorporateEventShares || selectedQuickCorporateHolding?.shares || 0;
  const quickCorporateRatioFrom = parseDecimal(quickCorporate.ratioFrom) || 1;
  const quickCorporateRatioTo = parseDecimal(quickCorporate.ratioTo) || 1;
  const quickComputedCorporateShares = Math.floor((quickCorporateEligibleShares * quickCorporateRatioTo) / quickCorporateRatioFrom);
  const quickEffectiveCorporateShares = Number(quickCorporate.resultingShares) || quickComputedCorporateShares;
  const quickCashDividendPercent = parseDecimal(quickCorporate.cashDividendPercent) || 10;
  const quickEffectiveCashPerShare = parseMoney(quickCorporate.cashPerShare) || Math.round((quickCashDividendPercent / 100) * STOCK_PAR_VALUE);
  const quickCashDividendGross = Math.round(quickCorporateEligibleShares * quickEffectiveCashPerShare);
  const quickCashDividendTaxRate = parseDecimal(quickCorporate.taxRate);
  const quickCashDividendNet = Math.max(Math.round(quickCashDividendGross * (1 - quickCashDividendTaxRate / 100)), 0);
  const quickEffectiveCashDividendResult = parseMoney(quickCorporate.cashReceived) || quickCashDividendNet;
  const quickRightsIssuePrice = parseDecimal(quickCorporate.subscriptionPrice);
  const quickRightsIssueAmount = Math.round(quickEffectiveCorporateShares * quickRightsIssuePrice * STOCK_PRICE_UNIT);
  const quickCorporateActionOptions: Array<{ id: CorporateAction["type"]; label: string }> = [
    { id: "cash_dividend", label: "Cổ tức tiền mặt" },
    { id: "stock_dividend", label: "Cổ tức cổ phiếu" },
    { id: "rights_issue", label: "Quyền mua" },
  ];
  const solDestinationOptions: Array<{ id: SolDestination; label: string }> = [
    { id: "btc", label: "BTC - về USDT" },
    { id: "btc-direct", label: "BTC - mua BTC trước tiếp" },
    { id: "stock", label: "CK" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "cash", label: "Tiền mặt" },
  ];
  const quickCryptoDestinationOptions = (asset: "btc" | "usdt" | "sol"): Array<{ id: BtcTransferTarget | "btc-direct"; label: string }> => {
    if (asset === "btc") return [{ id: "usdt", label: "USDT" }];
    if (asset === "sol") return [{ id: "btc", label: "USDT" }];
    return [
      { id: "btc", label: "BTC" },
      { id: "stock", label: "CK" },
      { id: "saving", label: "Tiết kiệm" },
      { id: "emergency", label: "Dự phòng" },
      { id: "cash", label: "Tiền mặt" },
    ];
  };

  const close = () => {
    setOpen(false);
    setError("");
  };

  const selectGroup = (next: (typeof groups)[number]) => {
    setGroup(next.id);
    setKind(next.defaultKind);
    setError("");
  };

  const recentUndoEntries = [...undoStack].reverse().slice(0, 10);
  const undoFromQuickAction = (entry: UndoEntry, displayIndex: number) => {
    const newerCount = displayIndex;
    const message = newerCount > 0
      ? `Hoàn tác "${entry.label}" và ${newerCount} thao tác thực hiện sau đó cũng sẽ bị hoàn lại.`
      : `Hoàn tác "${entry.label}"?`;
    if (!window.confirm(message)) return;
    onUndoToEntry(entry.id);
    close();
  };

  const btcTransferPriceFor = (asset: "btc" | "usdt", destination: BtcTransferTarget) => {
    if (asset === "btc" || destination === "btc") return state.market.btcUsdt;
    return state.market.usdtVnd || state.market.usdVnd;
  };

  const quickCryptoPriceFor = (asset: "btc" | "usdt" | "sol", destination: BtcTransferTarget | "btc-direct") => {
    if (asset === "sol") return state.market.solUsd;
    if (asset === "usdt" && destination !== "btc") return state.market.usdtVnd || state.market.usdVnd;
    return state.market.btcUsdt;
  };

  const quickCryptoSource = () => {
    if (cryptoTransfer.asset === "btc") return parseDecimal(cryptoTransfer.btc);
    if (cryptoTransfer.asset === "sol") return parseDecimal(cryptoTransfer.sol);
    return parseDecimal(cryptoTransfer.usdt);
  };

  const quickCryptoReceiveUnit = () => {
    if (cryptoTransfer.asset === "btc" && cryptoTransfer.destination === "usdt") return "USDT";
    if (cryptoTransfer.asset === "sol") return "USDT";
    if (cryptoTransfer.asset === "usdt" && cryptoTransfer.destination === "btc") return "BTC";
    return "VND";
  };

  const quickCryptoEstimate = () => {
    const source = quickCryptoSource();
    const price = parseDecimal(cryptoTransfer.price) || quickCryptoPriceFor(cryptoTransfer.asset, cryptoTransfer.destination);
    if (!source || !price) return 0;
    if (cryptoTransfer.asset === "btc") return source * price;
    if (cryptoTransfer.asset === "sol") return source * price;
    if (cryptoTransfer.asset === "usdt" && cryptoTransfer.destination === "btc") return source / price;
    if (cryptoTransfer.asset === "usdt") return source * price;
    return 0;
  };

  const quickCryptoBtcFromSol = () => {
    if (cryptoTransfer.asset !== "sol" || cryptoTransfer.destination !== "btc-direct") return "";
    return estimateBtcFromSolInput(cryptoTransfer.sol, cryptoTransfer.price, state.market.btcUsdt);
  };

  const formatQuickCryptoEstimate = () => {
    const value = quickCryptoEstimate();
    const unit = quickCryptoReceiveUnit();
    if (unit === "BTC") return formatBtc(value);
    if (unit === "USDT") return formatUsdt(value);
    return formatVnd(value);
  };

  const updateQuickCryptoAsset = (asset: "btc" | "usdt" | "sol") => {
    const destination = quickCryptoDestinationOptions(asset)[0]?.id ?? "cash";
    setCryptoTransfer((prev) => ({ ...prev, asset, destination, price: formatDecimalInput(String(quickCryptoPriceFor(asset, destination) || "")), received: "", btcReceived: "" }));
    setError("");
  };

  const updateQuickCryptoDestination = (destination: BtcTransferTarget | "btc-direct") => {
    setCryptoTransfer((prev) => ({ ...prev, destination, price: formatDecimalInput(String(quickCryptoPriceFor(prev.asset, destination) || "")), received: "", btcReceived: destination === "btc-direct" ? quickCryptoBtcFromSol() : "" }));
    setError("");
  };

  const updateQuickCryptoSol = (value: string) => {
    const solAmount = formatSolInput(value);
    setCryptoTransfer((prev) => {
      const received = parseDecimal(solAmount) * (parseDecimal(prev.price) || quickCryptoPriceFor("sol", prev.destination) || 0);
      return { ...prev, sol: solAmount, received: received ? formatDecimalInput(received.toFixed(6)) : "", btcReceived: "" };
    });
  };

  const updateQuickCryptoPrice = (value: string) => {
    const price = formatDecimalInput(value);
    setCryptoTransfer((prev) => {
      if (prev.asset === "sol") {
        const received = parseDecimal(prev.sol) * (parseDecimal(price) || 0);
        return { ...prev, price, received: received ? formatDecimalInput(received.toFixed(6)) : "", btcReceived: "" };
      }
      if (prev.asset === "usdt" && prev.destination !== "btc") {
        const rate = parseDecimal(price);
        const usdt = parseDecimal(prev.usdt);
        if (usdt && rate) return { ...prev, price, received: formatMoneyInput(String(Math.round(usdt * rate))) };
      }
      return { ...prev, price, btcReceived: "" };
    });
  };

  const updateQuickCryptoUsdt = (value: string) => {
    const usdt = formatDecimalInput(value);
    setCryptoTransfer((prev) => {
      if (prev.destination !== "btc") {
        const rate = parseDecimal(prev.price) || quickCryptoPriceFor("usdt", prev.destination) || 0;
        return { ...prev, usdt, received: rate && parseDecimal(usdt) ? formatMoneyInput(String(Math.round(parseDecimal(usdt) * rate))) : prev.received };
      }
      return { ...prev, usdt };
    });
  };

  const updateQuickCryptoReceived = (value: string) => {
    if (quickCryptoReceiveUnit() !== "VND") {
      setCryptoTransfer((prev) => ({ ...prev, received: formatDecimalInput(value) }));
      return;
    }
    const received = formatMoneyInput(value);
    setCryptoTransfer((prev) => ({ ...prev, received }));
  };

  const fillMaxQuickCryptoSource = () => {
    if (cryptoTransfer.asset === "btc") return setCryptoTransfer((prev) => ({ ...prev, btc: formatDecimalNumberInput(btcStats.btcBalance, 8), received: "" }));
    if (cryptoTransfer.asset === "sol") return updateQuickCryptoSol(formatDecimalNumberInput(solStats.balance, 8));
    setCryptoTransfer((prev) => {
      const usdt = formatDecimalNumberInput(btcStats.usdtBalance, 8);
      const rate = parseDecimal(prev.price) || quickCryptoPriceFor("usdt", prev.destination) || 0;
      return {
        ...prev,
        usdt,
        received: prev.destination !== "btc" && rate ? formatMoneyInput(String(Math.round(parseDecimal(usdt) * rate))) : "",
      };
    });
  };

  const resetQuickCryptoTransfer = () => {
    setCryptoTransfer({
      asset: "btc",
      btc: "",
      usdt: "",
      sol: "",
      price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "",
      received: "",
      btcReceived: "",
      destination: "usdt",
      date: today(),
      note: "",
    });
  };

  const updateBtcTransferAsset = (asset: "btc" | "usdt") => {
    const destination: BtcTransferTarget = asset === "btc" ? "usdt" : "btc";
    setBtcTransfer((prev) => ({ ...prev, asset, destination, price: formatDecimalInput(String(btcTransferPriceFor(asset, destination) || "")), received: "" }));
    setError("");
  };

  const updateBtcTransferDestination = (destination: BtcTransferTarget) => {
    setBtcTransfer((prev) => ({ ...prev, destination, price: formatDecimalInput(String(btcTransferPriceFor(prev.asset, destination) || "")), received: "" }));
    setError("");
  };

  const btcTransferSource = () => (btcTransfer.asset === "btc" ? parseDecimal(btcTransfer.btc) : parseDecimal(btcTransfer.usdt));
  const btcTransferPrice = () => parseDecimal(btcTransfer.price) || btcTransferPriceFor(btcTransfer.asset, btcTransfer.destination);
  const btcTransferReceiveUnit = () => {
    if (btcTransfer.asset === "usdt" && btcTransfer.destination === "btc") return "BTC";
    if (btcTransfer.asset === "btc" && btcTransfer.destination === "usdt") return "USDT";
    return "VND";
  };
  const btcTransferEstimate = () => {
    const source = btcTransferSource();
    const price = btcTransferPrice();
    if (!source || !price) return 0;
    if (btcTransfer.asset === "usdt" && btcTransfer.destination === "btc") return source / price;
    if (btcTransfer.asset === "btc" && btcTransfer.destination === "usdt") return source * price;
    if (btcTransfer.asset === "usdt") return source * price;
    return 0;
  };
  const formatBtcTransferEstimate = () => {
    const value = btcTransferEstimate();
    const unit = btcTransferReceiveUnit();
    if (unit === "BTC") return formatBtc(value);
    if (unit === "USDT") return formatUsdt(value);
    return formatVnd(value);
  };

  const fillMaxQuickBtcTransferSource = () => {
    if (btcTransfer.asset === "btc") {
      setBtcTransfer((prev) => ({ ...prev, btc: formatDecimalNumberInput(btcStats.btcBalance, 8), received: "" }));
      return;
    }
    setBtcTransfer((prev) => ({ ...prev, usdt: formatDecimalNumberInput(btcStats.usdtBalance, 8), received: "" }));
  };

  const estimateQuickUsdtFromVnd = (vndInput: string) => {
    const vndAmount = parseMoney(vndInput);
    const rate = state.market.usdtVnd || state.market.usdVnd;
    return vndAmount && rate ? formatDecimalNumberInput(vndAmount / rate, 3) : "";
  };

  const updateQuickUsdtVnd = (value: string) => {
    const vnd = formatMoneyInput(value);
    setUsdt((prev) => ({ ...prev, vnd, amount: vnd ? estimateQuickUsdtFromVnd(vnd) || prev.amount : "" }));
  };

  const updateQuickSolBuyAmount = (value: string) => {
    const amount = formatSolInput(value);
    setSol((prev) => {
      const solAmount = parseDecimal(amount);
      const price = parseDecimal(prev.price);
      const valueUsdt = solAmount && price ? solAmount * price : 0;
      return {
        ...prev,
        amount,
        valueUsdt: formatQuickSolDecimal(valueUsdt),
        valueVnd: valueUsdt ? formatMoneyInput(String(Math.round(valueUsdt * quickUsdtVndRate))) : "",
      };
    });
  };

  const updateQuickSolBuyPrice = (value: string) => {
    const price = formatDecimalInput(value);
    setSol((prev) => {
      const solAmount = parseDecimal(prev.amount);
      const valueUsdt = solAmount && parseDecimal(price) ? solAmount * parseDecimal(price) : 0;
      return {
        ...prev,
        price,
        valueUsdt: formatQuickSolDecimal(valueUsdt),
        valueVnd: valueUsdt ? formatMoneyInput(String(Math.round(valueUsdt * quickUsdtVndRate))) : "",
      };
    });
  };

  const updateQuickSolBuyValueUsdt = (value: string) => {
    const valueUsdt = formatDecimalInput(value);
    setSol((prev) => {
      const total = parseDecimal(valueUsdt);
      const solAmount = parseDecimal(prev.amount);
      return {
        ...prev,
        valueUsdt,
        price: solAmount && total ? formatQuickSolDecimal(total / solAmount) : prev.price,
        valueVnd: total ? formatMoneyInput(String(Math.round(total * quickUsdtVndRate))) : "",
      };
    });
  };

  const updateQuickSolBuyValueVnd = (value: string) => {
    const valueVnd = formatMoneyInput(value);
    setSol((prev) => {
      const vnd = parseMoney(valueVnd);
      const totalUsdt = vnd && quickUsdtVndRate ? vnd / quickUsdtVndRate : 0;
      const solAmount = parseDecimal(prev.amount);
      return {
        ...prev,
        valueVnd,
        valueUsdt: totalUsdt ? formatQuickSolDecimal(totalUsdt) : "",
        price: solAmount && totalUsdt ? formatQuickSolDecimal(totalUsdt / solAmount) : prev.price,
      };
    });
  };

  useEffect(() => {
    if (!open || kind !== "stock-buy") return;
    setQuickStockRows((prev) => recalculateQuickStockRows(prev));
  }, [open, kind, state.stockMarketPrices, stockStats.cash]);

  useEffect(() => {
    if (!open || kind !== "btc-usdt" || !usdt.vnd || usdt.amount) return;
    const estimatedUsdt = estimateQuickUsdtFromVnd(usdt.vnd);
    if (estimatedUsdt) setUsdt((prev) => ({ ...prev, amount: estimatedUsdt }));
  }, [state.market.usdtVnd, state.market.usdVnd, open, kind]);

  useEffect(() => {
    if (!state.market.solUsd) return;
    const nextPrice = formatDecimalInput(String(state.market.solUsd));
    setSol((prev) => {
      const valueUsdt = (parseDecimal(prev.amount) || 0) * state.market.solUsd;
      const next = {
        ...prev,
        price: nextPrice,
        valueUsdt: formatQuickSolDecimal(valueUsdt),
        valueVnd: valueUsdt ? formatMoneyInput(String(Math.round(valueUsdt * quickUsdtVndRate))) : prev.valueVnd,
      };
      if (prev.price === next.price && prev.valueUsdt === next.valueUsdt && prev.valueVnd === next.valueVnd) return prev;
      return next;
    });
    setSolTransfer((prev) => {
      const estimate = prev.amount ? Math.round(parseDecimal(prev.amount) * parseDecimal(nextPrice) * (state.market.usdtVnd || state.market.usdVnd)) : 0;
      const nextVnd = estimate ? estimate.toLocaleString("vi-VN") : prev.vnd;
      const nextBtc = prev.destination === "btc-direct" && !solTransferBtcTouched ? estimateBtcFromSolInput(prev.amount, nextPrice, state.market.btcUsdt) : prev.btc;
      if (prev.price === nextPrice && prev.vnd === nextVnd && prev.btc === nextBtc) return prev;
      return { ...prev, price: nextPrice, vnd: nextVnd, btc: nextBtc };
    });
  }, [state.market.solUsd, state.market.usdtVnd, state.market.usdVnd, state.market.btcUsdt, solTransferBtcTouched]);

  const updateQuickSolTransferAmount = (value: string) => {
    const amount = formatSolInput(value);
    setSolTransferBtcTouched(false);
    setSolTransfer((prev) => {
      const estimate = Math.round(parseDecimal(amount) * parseDecimal(prev.price) * (state.market.usdtVnd || state.market.usdVnd));
      return {
        ...prev,
        amount,
        vnd: estimate ? estimate.toLocaleString("vi-VN") : "",
        btc: prev.destination === "btc-direct" ? estimateBtcFromSolInput(amount, prev.price, state.market.btcUsdt) : prev.btc,
      };
    });
  };

  const updateQuickSolTransferPrice = (value: string) => {
    const price = formatDecimalInput(value);
    setSolTransferBtcTouched(false);
    setSolTransfer((prev) => {
      const estimate = Math.round(parseDecimal(prev.amount) * parseDecimal(price) * (state.market.usdtVnd || state.market.usdVnd));
      return {
        ...prev,
        price,
        vnd: estimate ? estimate.toLocaleString("vi-VN") : "",
        btc: prev.destination === "btc-direct" ? estimateBtcFromSolInput(prev.amount, price, state.market.btcUsdt) : prev.btc,
      };
    });
  };

  const updateQuickSolTransferDestination = (destination: SolDestination) => {
    setSolTransferBtcTouched(false);
    setSolTransfer((prev) => ({
      ...prev,
      destination,
      btc: destination === "btc-direct" ? estimateBtcFromSolInput(prev.amount, prev.price, state.market.btcUsdt) : "",
    }));
  };

  const fillMaxQuickSolTransfer = () => {
    setSolTransferBtcTouched(false);
    updateQuickSolTransferAmount(formatDecimalNumberInput(solStats.balance, 8));
  };

  const fillMaxQuickStockTransfer = () => {
    const holding = stockStats.holdings.find((item) => item.symbol === stockTransfer.symbol);
    if (!holding) return;
    setStockTransfer((prev) => ({ ...prev, shares: String(holding.shares), price: prev.price || formatStockPrice(holding.marketPrice) }));
  };

  const resetBtcTransfer = () => {
    setBtcTransfer({
      asset: "usdt",
      btc: "",
      usdt: "",
      price: state.market.btcUsdt ? formatDecimalInput(String(state.market.btcUsdt)) : "",
      received: "",
      destination: "btc",
      date: today(),
      note: "",
    });
  };



  const quickWithMarketPrice = (row: StockBuyRow) => {
    if (row.buyPriceTouched || parseDecimal(row.buyPrice)) return row;
    const marketPrice = quickMarketPriceForBuyRow(row);
    return marketPrice ? { ...row, buyPrice: formatStockPrice(marketPrice) } : row;
  };

  const recalculateQuickStockRows = (rows: StockBuyRow[]) => {
    const pricedRows = rows.map(quickWithMarketPrice);
    const fixedValue = pricedRows
      .filter((row) => row.sharesTouched && Number(row.shares) > 0)
      .reduce((sum, row) => sum + stockPurchaseLineCost({ shares: Number(row.shares) || 0, buyPrice: quickEffectiveBuyPrice(row) }), 0);
    const autoRows = pricedRows.filter((row) => !row.sharesTouched);
    const autoPercentTotal = autoRows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
    const remainingCash = Math.max(stockStats.cash - fixedValue, 0);

    return pricedRows.map((row) => {
      if (row.sharesTouched) return row;
      const price = quickEffectiveBuyPrice(row);
      const budget =
        autoRows.length === 1
          ? remainingCash
          : autoPercentTotal
            ? (remainingCash * (Number(row.percent) || 0)) / autoPercentTotal
            : 0;
      return { ...row, shares: stockSharesForBudget(budget, price) };
    });
  };

  const updateQuickStockRow = (id: string, patch: Partial<Omit<StockBuyRow, "id">>) => {
    setQuickStockRows((prev) =>
      recalculateQuickStockRows(prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, ...patch };
      }))
    );
  };

  const updateQuickStockPercent = (id: string, value: string) => {
    const nextPercent = Math.max(Math.min(Number(value) || 0, 100), 0);
    setQuickStockRows((prev) => {
      const others = prev.filter((row) => row.id !== id);
      if (others.length === 0) {
        return recalculateQuickStockRows(prev.map((row) => (row.id === id ? { ...row, percent: String(nextPercent) } : row)));
      }
      const remaining = Math.max(100 - nextPercent, 0);
      const otherCurrentTotal = others.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      let assigned = 0;
      return recalculateQuickStockRows(prev.map((row) => {
        if (row.id === id) return { ...row, percent: String(nextPercent) };
        const isLastOther = others[others.length - 1].id === row.id;
        const percent = isLastOther
          ? remaining - assigned
          : Math.round((otherCurrentTotal ? ((Number(row.percent) || 0) / otherCurrentTotal) * remaining : remaining / others.length) * 100) / 100;
        assigned += percent;
        return { ...row, percent: String(Math.max(percent, 0)) };
      }));
    });
  };

  const addQuickStockRow = () => {
    setQuickStockRows((prev) => {
      if (prev.length === 1) {
        const firstPercent = prev[0].percent === "100" ? "50" : prev[0].percent;
        return recalculateQuickStockRows([
          { ...prev[0], percent: firstPercent },
          { id: uid(), symbol: "", percent: String(Math.max(100 - (Number(firstPercent) || 0), 0)), shares: "", buyPrice: "" },
        ]);
      }
      return recalculateQuickStockRows([...prev, { id: uid(), symbol: "", percent: "0", shares: "", buyPrice: "" }]);
    });
  };

  const removeQuickStockRow = (id: string) => {
    setQuickStockRows((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((row) => row.id !== id);
      if (next.length === 1) return recalculateQuickStockRows([{ ...next[0], percent: "100" }]);
      const total = next.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      if (!total) return next;
      let assigned = 0;
      return recalculateQuickStockRows(next.map((row, index) => {
        const percent = index === next.length - 1 ? 100 - assigned : Math.round(((Number(row.percent) || 0) / total) * 10000) / 100;
        assigned += percent;
        return { ...row, percent: String(Math.max(percent, 0)) };
      }));
    });
  };

  const fillMaxQuickStockBuyRow = async (id: string) => {
    const row = quickStockRows.find((item) => item.id === id);
    if (!row) {
      setError("Không tìm thấy dòng cổ phiếu.");
      return;
    }
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) {
      setError("Nhập mã cổ phiếu trước khi dùng Max.");
      return;
    }

    let price = parseDecimal(row.buyPrice) || quickMarketPriceForBuyRow(row);
    if (!price) {
      try {
        const quote = await fetchStockQuote(symbol);
        price = quote.price;
        setState((prev) => ({
          ...prev,
          stockMarketPrices: [
            ...prev.stockMarketPrices.filter((item) => item.symbol !== symbol),
            { symbol, price: quote.price, updatedAt: new Date().toISOString(), source: quote.source },
          ],
        }));
      } catch {
        setError("Chưa lấy được giá thị trường cho mã này.");
        return;
      }
    }

    setQuickStockRows((prev) => {
      const rowsWithPrice = prev.map((item) =>
        item.id === id ? { ...item, symbol, buyPrice: item.buyPrice || formatStockPrice(price), buyPriceTouched: item.buyPriceTouched } : item
      );
      const otherValue = rowsWithPrice
        .filter((item) => item.id !== id)
        .reduce((sum, item) => sum + stockPurchaseLineCost({ shares: Number(item.shares) || 0, buyPrice: quickEffectiveBuyPrice(item) }), 0);
      const shares = stockSharesForBudget(Math.max(stockStats.cash - otherValue, 0), price);
      return recalculateQuickStockRows(rowsWithPrice.map((item) => (item.id === id ? { ...item, shares, sharesTouched: Boolean(shares) } : item)));
    });
    setError("");
  };

  const resetQuickStockForm = () => {
    setQuickStockRows([{ id: uid(), symbol: "", percent: "100", shares: "", buyPrice: "" }]);
    setQuickStockMeta({ date: today(), note: "" });
  };

  const resetQuickCorporateForm = () => {
    setQuickCorporate({
      symbol: "",
      type: "cash_dividend",
      receiveDate: today(),
      ratioFrom: "100",
      ratioTo: "10",
      cashDividendPercent: "10",
      cashPerShare: "",
      subscriptionPrice: "10",
      taxRate: "5",
      eligibleShares: "",
      resultingShares: "",
      cashReceived: "",
    });
  };

  const quickCorporateActionFromForm = (): CorporateAction | null => {
    const symbol = quickCorporate.symbol.trim().toUpperCase();
    if (!symbol || !quickCorporateEligibleShares) return null;
    return {
      id: uid(),
      symbol,
      type: quickCorporate.type,
      exDate: quickCorporate.receiveDate,
      recordDate: quickCorporate.receiveDate,
      receiveDate: quickCorporate.receiveDate,
      paymentDate: quickCorporate.receiveDate,
      ratioFrom: quickCorporateRatioFrom,
      ratioTo: quickCorporateRatioTo,
      cashPerShare: quickCorporate.type === "cash_dividend" ? quickEffectiveCashPerShare : undefined,
      subscriptionPrice: quickCorporate.type === "rights_issue" ? quickRightsIssuePrice : undefined,
      taxRate: quickCorporate.type === "cash_dividend" ? quickCashDividendTaxRate : undefined,
      eligibleShares: quickCorporateEligibleShares,
      resultingShares: quickCorporate.type === "cash_dividend" ? undefined : quickEffectiveCorporateShares,
      cashReceived: quickCorporate.type === "cash_dividend" ? quickEffectiveCashDividendResult : undefined,
      status: "applied",
      linkedEventIds: [],
      appliedAt: new Date().toISOString(),
    };
  };

  const quickRightsIssueCost = (action: CorporateAction) => {
    if (action.type !== "rights_issue") return 0;
    const ratioFrom = action.ratioFrom || 1;
    const ratioTo = action.ratioTo || 1;
    const addedShares = action.resultingShares ?? Math.floor((action.eligibleShares * ratioTo) / ratioFrom);
    return Math.round(addedShares * (action.subscriptionPrice ?? 0) * STOCK_PRICE_UNIT);
  };

  const quickDepositTermForAccumulationGoal = (goal: AccumulationGoal, startDate: string) => {
    let term = accumulationUnpaidMonths(state, goal);
    if (!goal.dueDate) return term;
    const dueTime = dateOnlyTime(goal.dueDate);
    while (term > 0 && dateOnlyTime(addMonths(startDate, term)) >= dueTime) term -= 1;
    return term;
  };

  const quickAccumulationDepositDefaults = (goal: AccumulationGoal | undefined, startDate: string) => {
    const term = goal ? quickDepositTermForAccumulationGoal(goal, startDate) : DEFAULT_DEPOSIT_TERM_MONTHS;
    return {
      accumulationGoalId: goal?.id || "",
      amount: goal ? goal.monthlyAmount.toLocaleString("vi-VN") : "",
      term: String(term),
      rate: depositRateForTerm(term),
    };
  };

  const quickStandardDepositDefaults = () => ({
    accumulationGoalId: "",
    term: String(DEFAULT_DEPOSIT_TERM_MONTHS),
    rate: depositRateForTerm(DEFAULT_DEPOSIT_TERM_MONTHS),
  });

  const formatQuickDepositMaturityEstimate = (input: typeof deposit) => {
    const amount = parseMoney(input.amount);
    if (!amount) return "";
    const term = Number(input.term) || 0;
    return estimateCertificateMaturityValue(
      amount,
      parseDecimal(input.rate),
      term,
      input.date,
      addMonths(input.date, term)
    ).toLocaleString("vi-VN");
  };

  const withQuickCertificateDefaults = (input: typeof deposit) => ({
    ...input,
    product: "certificate" as DepositProduct,
    certificatePurchaseAmount: input.certificatePurchaseTouched ? input.certificatePurchaseAmount : input.amount,
    certificateMaturityValue: input.certificateMaturityTouched ? input.certificateMaturityValue : formatQuickDepositMaturityEstimate(input),
  });

  const updateQuickDepositFund = (fund: DepositFund) => {
    setDeposit((prev) => {
      if (fund === "accumulation") {
        const goal = activeAccumulationGoals.find((item) => item.id === prev.accumulationGoalId) ?? activeAccumulationGoals[0];
        return withQuickCertificateDefaults({
          ...prev,
          fund,
          ...quickAccumulationDepositDefaults(goal, prev.date),
          certificatePurchaseTouched: false,
          certificateMaturityTouched: false,
        });
      }
      return withQuickCertificateDefaults({
        ...prev,
        fund,
        ...quickStandardDepositDefaults(),
        certificatePurchaseTouched: false,
        certificateMaturityTouched: false,
      });
    });
  };

  const updateQuickDepositAccumulationGoal = (goalId: string) => {
    const goal = activeAccumulationGoals.find((item) => item.id === goalId);
    setDeposit((prev) => withQuickCertificateDefaults({
      ...prev,
      ...quickAccumulationDepositDefaults(goal, prev.date),
      certificatePurchaseTouched: false,
      certificateMaturityTouched: false,
    }));
  };

  const updateQuickDepositAmount = (amount: string) => {
    setDeposit((prev) => withQuickCertificateDefaults({ ...prev, amount }));
  };

  const updateQuickDepositRate = (rate: string) => {
    setDeposit((prev) => withQuickCertificateDefaults({ ...prev, rate }));
  };

  const updateQuickDepositTerm = (term: string) => {
    setDeposit((prev) => {
      let termMonths = Math.max(Number(term) || 0, 0);
      const goal = prev.fund === "accumulation"
        ? activeAccumulationGoals.find((item) => item.id === prev.accumulationGoalId)
        : undefined;
      if (goal?.dueDate) {
        const dueTime = dateOnlyTime(goal.dueDate);
        while (termMonths > 0 && dateOnlyTime(addMonths(prev.date, termMonths)) >= dueTime) termMonths -= 1;
      }
      return withQuickCertificateDefaults({ ...prev, term: String(termMonths), rate: depositRateForTerm(termMonths) });
    });
  };

  const updateQuickDepositDate = (date: string) => {
    setDeposit((prev) => {
      if (prev.fund === "accumulation") {
        const goal = activeAccumulationGoals.find((item) => item.id === prev.accumulationGoalId);
        return withQuickCertificateDefaults({
          ...prev,
          date,
          ...quickAccumulationDepositDefaults(goal, date),
          certificatePurchaseTouched: false,
          certificateMaturityTouched: false,
        });
      }
      const termMonths = Math.max(Number(prev.term) || 0, 0);
      return withQuickCertificateDefaults({ ...prev, date, rate: depositRateForTerm(termMonths) });
    });
  };

  const save = () => {
    setError("");
    if (kind === "income") {
      const amount = parseMoney(income.amount);
      if (!amount || !income.categoryId) return setError("Nhập thu nhập hợp lệ.");
      commitWithUndo("Đã thêm thu nhập.", (prev) => ({ ...prev, incomeTransactions: [...prev.incomeTransactions, { id: uid(), categoryId: income.categoryId, amount, date: income.date, month: monthFromDate(income.date), note: income.note.trim() }] }));
      setIncome((prev) => ({ ...prev, amount: "", note: "" }));
      close();
      return;
    }
    if (kind === "expense") {
      const amount = parseMoney(expense.amount);
      if (!amount || !expense.categoryId) return setError("Nhập khoản chi hợp lệ.");
      commitWithUndo("Đã thêm khoản chi.", (prev) => ({ ...prev, expenseEntries: [...prev.expenseEntries, { id: uid(), categoryId: expense.categoryId, amount, date: expense.date, month: monthFromDate(expense.date), note: expense.note.trim() }] }));
      setExpense((prev) => ({ ...prev, amount: "", note: "" }));
      close();
      return;
    }
    if (kind === "btc-usdt") {
      const vndAmount = parseMoney(usdt.vnd);
      const usdtAmount = parseDecimal(usdt.amount);
      if (!vndAmount || !usdtAmount) return setError("Nhập VND và USDT hợp lệ.");
      const topup: BtcUsdtTopup = { id: uid(), vndAmount, usdtAmount, date: usdt.date, occurredAt: occurredAtForDate(usdt.date), note: usdt.note.trim() };
      commitWithUndo("Đã thêm mua USDT.", (prev) => ({ ...prev, btcUsdtTopups: [...prev.btcUsdtTopups, topup] }));
      if (btcCloudAccountId) void upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, topup.id, topup);
      setUsdt((prev) => ({ ...prev, vnd: "", amount: "" }));
      close();
      return;
    }
    if (kind === "btc-dca") {
      const amountUsdt = parseDecimal(dca.amount);
      if (!amountUsdt) return setError("Nhập số USDT mỗi kỳ hợp lệ.");
      const plan = normalizeDcaPlan({ id: uid(), amountUsdt, frequency: dca.frequency, time: dca.time, startDate: dca.startDate, nextRunAt: nextDcaRunAt(dca), isActive: true, status: "active", note: dca.note.trim() });
      commitWithUndo("Đã tạo kế hoạch DCA.", (prev) => ({ ...prev, btcDcaPlans: [...prev.btcDcaPlans, plan] }));
      if (btcCloudAccountId) void upsertCloudPayloadRow("btc_dca_plans", btcCloudAccountId, plan.id, plan, { is_active: plan.isActive, next_run_at: plan.nextRunAt, status: plan.status });
      close();
      return;
    }
    if (kind === "crypto-transfer") {
      const source = quickCryptoSource();
      const price = parseDecimal(cryptoTransfer.price) || quickCryptoPriceFor(cryptoTransfer.asset, cryptoTransfer.destination);
      const receivedInput = quickCryptoReceiveUnit() === "VND" ? parseMoney(cryptoTransfer.received) : parseDecimal(cryptoTransfer.received);
      const received = receivedInput || quickCryptoEstimate();
      if (!source || !price || !received) return setError("Nhập tài sản, giá và số tiền nhận hợp lệ.");

      if (cryptoTransfer.asset === "btc") {
        if (cryptoTransfer.destination !== "usdt") return setError("BTC chỉ được đổi sang USDT trong quỹ Crypto.");
        if (source - btcStats.btcBalance > 0.00000001) return setError("Số BTC lớn hơn số BTC đang có.");
        const transfer: BtcTransfer = { id: uid(), asset: "btc", btcAmount: source, usdtAmount: received, btcPriceUsdt: price, vndAmount: Math.round(received * (state.market.usdtVnd || state.market.usdVnd)), destination: "usdt", date: cryptoTransfer.date, occurredAt: occurredAtForDate(cryptoTransfer.date), closesPosition: closesCryptoPosition(source, btcStats.btcBalance), note: cryptoTransfer.note.trim() };
        commitWithUndo("Đã chuyển BTC sang USDT.", (prev) => ({ ...prev, btcTransfers: [...prev.btcTransfers, transfer] }));
        if (btcCloudAccountId) void upsertCloudPayloadRow("btc_transfers", btcCloudAccountId, transfer.id, transfer, { transfer_at: transfer.occurredAt });
        resetQuickCryptoTransfer();
        close();
        return;
      }

      if (cryptoTransfer.asset === "usdt") {
        if (source > btcStats.usdtBalance) return setError("Số USDT lớn hơn số dư USDT.");
        if (cryptoTransfer.destination === "btc") {
          const trade: BtcTrade = { id: uid(), type: "manual-buy", usdtAmount: source, btcAmount: received, btcPriceUsdt: price, executedAt: occurredAtForDate(cryptoTransfer.date), note: cryptoTransfer.note.trim() || "Chuyển USDT sang BTC" };
          commitWithUndo("Đã chuyển USDT sang BTC.", (prev) => ({ ...prev, btcTrades: [...prev.btcTrades, trade] }));
          if (btcCloudAccountId) void upsertCloudPayloadRow("btc_trades", btcCloudAccountId, trade.id, trade, { executed_at: trade.executedAt, plan_id: null });
          resetQuickCryptoTransfer();
          close();
          return;
        }
        const vndAmount = Math.round(received);
        const transfer: BtcTransfer = { id: uid(), asset: "usdt", btcAmount: 0, usdtAmount: source, btcPriceUsdt: state.market.btcUsdt, vndAmount, destination: cryptoTransfer.destination as BtcTransferDestination, date: cryptoTransfer.date, occurredAt: occurredAtForDate(cryptoTransfer.date), note: cryptoTransfer.note.trim() };
        const transferNote = transfer.note ? `Rút từ Crypto · ${transfer.note} [btc-transfer:${transfer.id}]` : `Rút từ Crypto [btc-transfer:${transfer.id}]`;
        commitWithUndo("Đã lưu rút/chuyển Crypto.", (prev) => ({
          ...prev,
          btcTransfers: [...prev.btcTransfers, transfer],
          fundTransactions: [
            ...prev.fundTransactions,
            { id: uid(), fund: "btc", type: "withdraw", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote },
            ...(transfer.destination === "stock" ? [{ id: uid(), fund: "stock" as const, type: "deposit" as const, amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote }] : []),
          ],
          incomeTransactions: transfer.destination === "cash" ? [...prev.incomeTransactions, { id: uid(), categoryId: "other-income", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote }] : prev.incomeTransactions,
        }));
        if (btcCloudAccountId) void upsertCloudPayloadRow("btc_transfers", btcCloudAccountId, transfer.id, transfer, { transfer_at: transfer.occurredAt });
        resetQuickCryptoTransfer();
        close();
        return;
      }

      if (cryptoTransfer.destination !== "btc") return setError("SOL chỉ được đổi sang USDT trong quỹ Crypto.");
      if (source - solStats.balance > 0.00000001) return setError("Số SOL rút lớn hơn số SOL đang có.");
      const usdtAmount = received;
      const vndAmount = Math.round(usdtAmount * (state.market.usdtVnd || state.market.usdVnd));
      const userNote = cryptoTransfer.note.trim();
      const note = userNote || "Rút từ SOL";
      const transferNote = userNote ? `Rút từ SOL · ${userNote}` : "Rút từ SOL";
      const withdrawal: SolWithdrawTransaction = { id: uid(), type: "withdraw", solAmount: source, sellPrice: price, usdtAmount, vndAmount, destination: "btc", date: cryptoTransfer.date, occurredAt: occurredAtForDate(cryptoTransfer.date), closesPosition: closesCryptoPosition(source, solStats.balance), note };
      const btcTopup: BtcUsdtTopup = { id: uid(), vndAmount, usdtAmount, date: withdrawal.date, occurredAt: occurredAtForDate(withdrawal.date), sourceSolWithdrawalId: withdrawal.id, note: `${transferNote} · USDT từ SOL` };
      commitWithUndo("Đã rút/chuyển SOL.", (prev) => ({
        ...prev,
        solTransactions: [...prev.solTransactions, withdrawal],
        btcUsdtTopups: [...prev.btcUsdtTopups, btcTopup],
        fundTransactions: [...prev.fundTransactions, { id: uid(), fund: "btc", type: "deposit", amount: vndAmount, date: withdrawal.date, month: monthFromDate(withdrawal.date), note: transferNote }],
      }));
      if (btcCloudAccountId) void upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, btcTopup.id, btcTopup);
      resetQuickCryptoTransfer();
      close();
      return;
    }
    if (kind === "btc-transfer") {
      const source = btcTransferSource();
      const price = btcTransferPrice();
      const unit = btcTransferReceiveUnit();
      const receivedInput = unit === "VND" ? parseMoney(btcTransfer.received) : parseDecimal(btcTransfer.received);
      const received = receivedInput || btcTransferEstimate();
      if (!source || !price || !received) return setError("Nhập tài sản, giá và số tiền nhận hợp lệ.");
      if (btcTransfer.asset === "btc" && btcTransfer.destination !== "usdt") return setError("BTC chỉ được đổi sang USDT trong quỹ BTC.");
      if (btcTransfer.asset === "btc" && source - btcStats.btcBalance > 0.00000001) return setError("Số BTC lớn hơn số BTC đang có.");
      if (btcTransfer.asset === "usdt" && source > btcStats.usdtBalance) return setError("Số USDT lớn hơn số dư USDT.");

      if (btcTransfer.asset === "usdt" && btcTransfer.destination === "btc") {
        const trade: BtcTrade = {
          id: uid(),
          type: "manual-buy",
          usdtAmount: source,
          btcAmount: received,
          btcPriceUsdt: price,
          executedAt: occurredAtForDate(btcTransfer.date),
          note: btcTransfer.note.trim() || "Chuyển USDT sang BTC",
        };
        commitWithUndo("Đã chuyển USDT sang BTC.", (prev) => ({ ...prev, btcTrades: [...prev.btcTrades, trade] }));
        if (btcCloudAccountId) void upsertCloudPayloadRow("btc_trades", btcCloudAccountId, trade.id, trade, { executed_at: trade.executedAt, plan_id: null });
        resetBtcTransfer();
        close();
        return;
      }

      const btcAmount = btcTransfer.asset === "btc" ? source : 0;
      const usdtAmount = btcTransfer.asset === "btc" ? received : source;
      const vndAmount = btcTransfer.destination === "usdt" ? Math.round(usdtAmount * (state.market.usdtVnd || state.market.usdVnd)) : unit === "VND" ? Math.round(received) : Math.round(usdtAmount * (state.market.usdtVnd || state.market.usdVnd));
      const transfer: BtcTransfer = {
        id: uid(),
        asset: btcTransfer.asset,
        btcAmount,
        usdtAmount,
        btcPriceUsdt: btcTransfer.asset === "btc" ? price : state.market.btcUsdt,
        vndAmount,
        destination: btcTransfer.destination,
        date: btcTransfer.date,
        occurredAt: occurredAtForDate(btcTransfer.date),
        closesPosition: btcTransfer.asset === "btc" && closesCryptoPosition(source, btcStats.btcBalance),
        note: btcTransfer.note.trim(),
      };
      const transferNote =
        transfer.destination === "usdt"
          ? transfer.note
            ? `Chuyển BTC sang USDT · ${transfer.note} [btc-transfer:${transfer.id}]`
            : `Chuyển BTC sang USDT [btc-transfer:${transfer.id}]`
          : transfer.note
            ? `Rút từ BTC · ${transfer.note} [btc-transfer:${transfer.id}]`
            : `Rút từ BTC [btc-transfer:${transfer.id}]`;
      commitWithUndo("Đã lưu rút/chuyển BTC.", (prev) => ({
        ...prev,
        btcTransfers: [...prev.btcTransfers, transfer],
        fundTransactions:
          transfer.destination === "usdt"
            ? prev.fundTransactions
            : [
                ...prev.fundTransactions,
                { id: uid(), fund: "btc", type: "withdraw", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote },
                ...(transfer.destination === "stock"
                  ? [{ id: uid(), fund: "stock" as const, type: "deposit" as const, amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote }]
                  : []),
              ],
        incomeTransactions:
          transfer.destination === "cash"
            ? [...prev.incomeTransactions, { id: uid(), categoryId: "other-income", amount: vndAmount, date: transfer.date, month: monthFromDate(transfer.date), note: transferNote }]
            : prev.incomeTransactions,
      }));
      if (btcCloudAccountId) void upsertCloudPayloadRow("btc_transfers", btcCloudAccountId, transfer.id, transfer, { transfer_at: transfer.occurredAt });
      resetBtcTransfer();
      close();
      return;
    }
    if (kind === "stock-buy") {
      const lines = quickStockRows
        .map((row) => ({
          symbol: row.symbol.trim().toUpperCase(),
          shares: Number(row.shares) || 0,
          buyPrice: quickEffectiveBuyPrice(row),
        }))
        .filter((line) => line.symbol && line.shares > 0 && line.buyPrice > 0);
      const total = stockPurchaseLinesCost(lines);
      if (!lines.length) return setError("Nhập ít nhất một mã cổ phiếu hợp lệ.");
      if (total > stockStats.cash) return setError("Tổng giá trị mua đang vượt quá tiền mặt CK.");
      const purchase: StockPurchase = { id: uid(), date: quickStockMeta.date, month: monthFromDate(quickStockMeta.date), note: "", lines, createdAt: new Date().toISOString() };
      commitWithUndo("Đã mua cổ phiếu.", (prev) => ({ ...prev, stockPurchases: [...prev.stockPurchases, purchase] }));
      resetQuickStockForm();
      close();
      return;
    }
    if (kind === "stock-transfer") {
      const symbol = stockTransfer.symbol.trim().toUpperCase();
      const holding = stockStats.holdings.find((item) => item.symbol === symbol);
      const shares = parseDecimal(stockTransfer.shares);
      const sellPrice = parseDecimal(stockTransfer.price);
      if (!holding || !shares || !sellPrice) return setError("Chọn mã đang giữ, số lượng và giá hợp lệ.");
      if (shares > holding.shares) return setError("Số cổ phiếu rút lớn hơn số đang có.");
      const vndAmount = Math.round(shares * sellPrice * STOCK_PRICE_UNIT);
      const fee = stockTransfer.fee ? parseMoney(stockTransfer.fee) : estimateStockSaleFee(vndAmount, shares);
      const netVndAmount = stockTransfer.netVnd ? parseMoney(stockTransfer.netVnd) : Math.max(vndAmount - fee, 0);
      const note = stockTransfer.note.trim();
      const transferNote = note ? `Rút từ CK ${holding.symbol} · ${note}` : `Rút từ CK ${holding.symbol}`;
      const sale: StockSale = {
        id: uid(),
        symbol: holding.symbol,
        shares,
        sellPrice,
        vndAmount,
        fee,
        netVndAmount,
        destination: stockTransfer.destination,
        date: stockTransfer.date,
        note,
        createdAt: new Date().toISOString(),
      };
      commitWithUndo("Đã rút/chuyển CK.", (prev) => ({
        ...prev,
        stockSales: [...prev.stockSales, sale],
        fundTransactions:
          sale.destination === "btc"
            ? [...prev.fundTransactions, { id: uid(), fund: "btc", type: "deposit", amount: netVndAmount, date: sale.date, month: monthFromDate(sale.date), note: transferNote }]
            : prev.fundTransactions,
        incomeTransactions:
          sale.destination === "cash"
            ? [...prev.incomeTransactions, { id: uid(), categoryId: "other-income", amount: netVndAmount, date: sale.date, month: monthFromDate(sale.date), note: transferNote }]
            : prev.incomeTransactions,
      }));
      setStockTransfer({ symbol: "", shares: "", price: "", fee: "", netVnd: "", destination: "stock", date: today(), note: "" });
      close();
      return;
    }
    if (kind === "stock-event") {
      const action = quickCorporateActionFromForm();
      if (!action) return setError("Chọn mã cổ phiếu đang giữ và số cổ đủ quyền hợp lệ.");
      if (action.type === "cash_dividend" && !action.cashPerShare && !action.cashReceived) return setError("Nhập % cổ tức tiền mặt hoặc tiền/cp.");
      if (action.type === "rights_issue") {
        const cost = quickRightsIssueCost(action);
        if (!action.subscriptionPrice || !action.resultingShares) return setError("Nhập số cổ được mua và giá quyền mua hợp lệ.");
        if (cost > stockStats.cash) return setError(`Quyền mua cần ${formatVnd(cost)}, vượt tiền mặt CK ${formatVnd(stockStats.cash)}.`);
      }
      if (action.type === "stock_dividend" && !action.resultingShares) return setError("Nhập tỷ lệ hoặc số cổ nhận hợp lệ.");
      commitWithUndo(
        "Đã áp dụng sự kiện cổ phiếu.",
        (prev) => normalizeFinancialMetadata({ ...prev, corporateActions: [action, ...prev.corporateActions] }),
        { action: "create", entityType: "corporate-action", entityId: action.id }
      );
      resetQuickCorporateForm();
      close();
      return;
    }
    if (kind === "sol-buy") {
      const solAmount = parseDecimal(sol.amount);
      const buyPrice = parseDecimal(sol.price);
      const costVnd = parseMoney(sol.valueVnd) || quickSolBuyValueVnd;
      if (!solAmount || !buyPrice) return setError("Nhập số SOL và giá mua hợp lệ.");
      commitWithUndo("Đã thêm SOL.", (prev) => ({ ...prev, solTransactions: [...prev.solTransactions, { id: uid(), type: "buy", solAmount, buyPrice, costVnd, date: sol.date, occurredAt: occurredAtForDate(sol.date), note: "" }] }));
      setSol((prev) => ({ ...prev, amount: "", valueUsdt: "", valueVnd: "" }));
      close();
      return;
    }
    if (kind === "sol-transfer") {
      const solAmount = parseDecimal(solTransfer.amount);
      const sellPrice = parseDecimal(solTransfer.price);
      const vndAmount = parseMoney(solTransfer.vnd) || Math.round(solAmount * sellPrice * (state.market.usdtVnd || state.market.usdVnd));
      const btcAmount = parseDecimal(solTransfer.btc);
      const usdtAmount = solAmount * sellPrice;
      if (!solAmount || !sellPrice || !vndAmount || (solTransfer.destination === "btc-direct" && !btcAmount)) return setError("Nhập số SOL, giá và số tiền nhận hợp lệ.");
      if (solAmount - solStats.balance > 0.00000001) return setError("Số SOL rút lớn hơn số SOL đang có.");
      const userNote = solTransfer.note.trim();
      const note = userNote || "Rút từ SOL";
      const transferNote = userNote ? `Rút từ SOL · ${userNote}` : "Rút từ SOL";
      const withdrawal: SolWithdrawTransaction = {
        id: uid(),
        type: "withdraw",
        solAmount,
        sellPrice,
        usdtAmount,
        vndAmount,
        destination: solTransfer.destination,
        date: solTransfer.date,
        occurredAt: occurredAtForDate(solTransfer.date),
        closesPosition: closesCryptoPosition(solAmount, solStats.balance),
        note,
      };
      const btcTopup: BtcUsdtTopup | null =
        withdrawal.destination === "btc"
          ? { id: uid(), vndAmount, usdtAmount, date: withdrawal.date, occurredAt: occurredAtForDate(withdrawal.date), sourceSolWithdrawalId: withdrawal.id, note: `${transferNote} · USDT từ SOL` }
          : null;
      const btcTrade: BtcTrade | null =
        withdrawal.destination === "btc-direct" && btcAmount
          ? {
              id: uid(),
              type: "manual-buy",
              usdtAmount,
              btcAmount,
              btcPriceUsdt: usdtAmount / btcAmount,
              costVnd: vndAmount,
              executedAt: occurredAtForDate(withdrawal.date),
              note: `${transferNote} · Mua BTC trực tiếp ${solBtcTradeMarker(withdrawal.id)}`,
            }
          : null;
      commitWithUndo("Đã rút/chuyển SOL.", (prev) => ({
        ...prev,
        solTransactions: [...prev.solTransactions, withdrawal],
        btcUsdtTopups: btcTopup ? [...prev.btcUsdtTopups, btcTopup] : prev.btcUsdtTopups,
        btcTrades: btcTrade ? [...prev.btcTrades, btcTrade] : prev.btcTrades,
        fundTransactions:
          withdrawal.destination === "btc" || withdrawal.destination === "btc-direct" || withdrawal.destination === "stock"
            ? [...prev.fundTransactions, { id: uid(), fund: withdrawal.destination === "btc-direct" ? "btc" : withdrawal.destination, type: "deposit", amount: vndAmount, date: withdrawal.date, month: monthFromDate(withdrawal.date), note: transferNote }]
            : prev.fundTransactions,
        incomeTransactions:
          withdrawal.destination === "cash"
            ? [...prev.incomeTransactions, { id: uid(), categoryId: "other-income", amount: vndAmount, date: withdrawal.date, month: monthFromDate(withdrawal.date), note: transferNote }]
            : prev.incomeTransactions,
      }));
      if (btcTopup && btcCloudAccountId) void upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, btcTopup.id, btcTopup);
      if (btcTrade && btcCloudAccountId) void upsertCloudPayloadRow("btc_trades", btcCloudAccountId, btcTrade.id, btcTrade, { executed_at: btcTrade.executedAt, plan_id: null });
      setSolTransfer({ amount: "", price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "", vnd: "", btc: "", destination: "cash", date: today(), note: "" });
      setSolTransferBtcTouched(false);
      close();
      return;
    }
    const amount = parseMoney(deposit.amount);
    const term = Number(deposit.term) || 0;
    if (!amount || !term) return setError("Nhập sổ MBB hợp lệ.");
    const next = {
      ...makeDeposit(
        state.bankDeposits,
        deposit.fund,
        "certificate",
        amount,
        parseMoney(deposit.certificatePurchaseAmount),
        parseMoney(deposit.certificateMaturityValue),
        parseDecimal(deposit.rate),
        term,
        deposit.date,
        addMonths(deposit.date, term),
        monthFromDate(deposit.date),
        deposit.note.trim(),
        "",
        "",
        deposit.fund === "accumulation" ? deposit.accumulationGoalId : ""
      ),
      mbLast4: deposit.mbLast4.replace(/\D/g, "").slice(0, 4),
    };
    commitWithUndo("Đã tạo sổ MBB.", (prev) => ({ ...prev, bankDeposits: [...prev.bankDeposits, next] }));
    setDeposit((prev) => ({
      ...prev,
      amount: "",
      certificatePurchaseAmount: "",
      certificateMaturityValue: "",
      certificatePurchaseTouched: false,
      certificateMaturityTouched: false,
      note: "",
    }));
    close();
  };

  return (
    <>
      <button
        className="quick-action-fab"
        onClick={(event) => {
          if (suppressFabClickRef.current) {
            event.preventDefault();
            return;
          }
          setOpen(true);
        }}
        onPointerDown={startFabDrag}
        onPointerMove={moveFabDrag}
        onPointerUp={endFabDrag}
        onPointerCancel={endFabDrag}
        style={fabPosition ? { left: fabPosition.x, top: fabPosition.y, right: "auto", bottom: "auto" } : undefined}
        title="Thêm nhanh"
        type="button"
      >
        <Plus size={24} />
      </button>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="quick-action-title">
          <section className="modal-card quick-action-modal">
            <div className="panel-title">
              <h2 id="quick-action-title">Thêm nhanh</h2>
              <button className="icon-button" onClick={close} title="Đóng" type="button"><X size={17} /></button>
            </div>
            <div className="quick-action-tabs">
              {groups.map((item) => <button className={group === item.id ? "active" : ""} key={item.id} onClick={() => selectGroup(item)} type="button">{item.label}</button>)}
            </div>
            {subActions[group].length > 1 && (
              <div className="quick-action-subtabs">
                {subActions[group].map((item) => <button className={kind === item.id ? "active" : ""} key={item.id} onClick={() => { setKind(item.id); setError(""); }} type="button">{item.label}</button>)}
              </div>
            )}
            <div className="form-grid">
              {kind === "undo" && (
                <div className="quick-undo-list">
                  {recentUndoEntries.length === 0 ? (
                    <p className="muted">Chưa có thao tác nào có thể hoàn tác trong phiên này.</p>
                  ) : (
                    recentUndoEntries.map((entry, index) => (
                      <button className="quick-undo-item" key={entry.id} onClick={() => undoFromQuickAction(entry, index)} type="button">
                        <div>
                          <strong>{entry.label}</strong>
                          <small>
                            {new Date(entry.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            {index > 0 ? ` · hoàn lại cả ${index} thao tác sau đó` : ""}
                          </small>
                        </div>
                        <span>Hoàn tác</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {kind === "income" && <>
                <label>Mục thu<select value={income.categoryId} onChange={(event) => setIncome({ ...income, categoryId: event.target.value })}>{state.incomeCategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                <label>Số tiền<input value={income.amount} onChange={(event) => setIncome({ ...income, amount: formatMoneyChange(event) })} placeholder="9.000.000" /></label>
                <label>Ngày<input type="date" value={income.date} onChange={(event) => setIncome({ ...income, date: event.target.value })} /></label>
                <label>Note<input value={income.note} onChange={(event) => setIncome({ ...income, note: event.target.value })} /></label>
              </>}
              {kind === "expense" && <>
                <label>Mục chi<select value={expense.categoryId} onChange={(event) => setExpense({ ...expense, categoryId: event.target.value })}>{state.expenseCategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                <label>Số tiền<input value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: formatMoneyChange(event) })} placeholder="500.000" /></label>
                <label>Ngày<input type="date" value={expense.date} onChange={(event) => setExpense({ ...expense, date: event.target.value })} /></label>
                <label>Note<input value={expense.note} onChange={(event) => setExpense({ ...expense, note: event.target.value })} /></label>
              </>}
              {kind === "btc-usdt" && <>
                <label>VND dùng mua<input value={usdt.vnd} onChange={(event) => updateQuickUsdtVnd(formatMoneyChange(event))} placeholder="1.000.000" /></label>
                <label>USDT nhận<input value={usdt.amount} onChange={(event) => setUsdt({ ...usdt, amount: formatDecimalChange(event) })} placeholder="39,25" /></label>
                <label>Ngày<input type="date" value={usdt.date} onChange={(event) => setUsdt({ ...usdt, date: event.target.value })} /></label>
                <label>Note<input value={usdt.note} onChange={(event) => setUsdt({ ...usdt, note: event.target.value })} /></label>
              </>}
              {kind === "btc-dca" && <>
                <label>USDT mỗi kỳ<input value={dca.amount} onChange={(event) => setDca({ ...dca, amount: formatDecimalChange(event) })} /></label>
                <label>Tần suất<select value={dca.frequency} onChange={(event) => setDca({ ...dca, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
                <label>Giờ chạy<input type="time" value={dca.time} onChange={(event) => setDca({ ...dca, time: event.target.value })} /></label>
                <label>Ngày bắt đầu<input type="date" value={dca.startDate} onChange={(event) => setDca({ ...dca, startDate: event.target.value })} /></label>
                <label>Note<input value={dca.note} onChange={(event) => setDca({ ...dca, note: event.target.value })} /></label>
              </>}
              {kind === "crypto-transfer" && <>
                <label>Tài sản nguồn<select value={cryptoTransfer.asset} onChange={(event) => updateQuickCryptoAsset(event.target.value as "btc" | "usdt" | "sol")}><option value="btc">BTC</option><option value="usdt">USDT</option><option value="sol">SOL</option></select></label>
                {cryptoTransfer.asset === "btc" && (
                  <label>Số BTC<InputWithMax value={cryptoTransfer.btc} onChange={(event) => setCryptoTransfer({ ...cryptoTransfer, btc: formatDecimalChange(event) })} onMax={fillMaxQuickCryptoSource} placeholder="0,0001" /></label>
                )}
                {cryptoTransfer.asset === "usdt" && (
                  <label>Số USDT<InputWithMax value={cryptoTransfer.usdt} onChange={(event) => updateQuickCryptoUsdt(formatDecimalChange(event))} onMax={fillMaxQuickCryptoSource} placeholder="10" /></label>
                )}
                {cryptoTransfer.asset === "sol" && (
                  <label>Số SOL<InputWithMax value={cryptoTransfer.sol} onChange={(event) => updateQuickCryptoSol(formatSolChange(event))} onMax={fillMaxQuickCryptoSource} placeholder="0,25" /></label>
                )}
                <label>{cryptoTransfer.asset === "sol" ? "Giá SOL/USDT" : cryptoTransfer.asset === "usdt" && cryptoTransfer.destination !== "btc" ? "Giá USDT/VND" : "Giá BTC/USDT"}<input value={cryptoTransfer.price} onChange={(event) => updateQuickCryptoPrice(formatDecimalChange(event))} placeholder={formatDecimalInput(String(quickCryptoPriceFor(cryptoTransfer.asset, cryptoTransfer.destination) || 0))} /></label>
                <label>{quickCryptoReceiveUnit() === "USDT" ? "Số USDT nhận" : quickCryptoReceiveUnit() === "BTC" ? "Số BTC nhận" : "Số tiền nhận"}<input value={cryptoTransfer.received || formatTransferReceiveInput(quickCryptoEstimate(), quickCryptoReceiveUnit())} onChange={(event) => updateQuickCryptoReceived(event.target.value)} placeholder={formatQuickCryptoEstimate()} /></label>
                <label>Nơi nhận<select value={cryptoTransfer.destination} disabled={cryptoTransfer.asset === "btc" || cryptoTransfer.asset === "sol"} onChange={(event) => updateQuickCryptoDestination(event.target.value as BtcTransferTarget | "btc-direct")}>{quickCryptoDestinationOptions(cryptoTransfer.asset).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
                <label>Ngày<input type="date" value={cryptoTransfer.date} onChange={(event) => setCryptoTransfer({ ...cryptoTransfer, date: event.target.value })} /></label>
                <label>Note<input value={cryptoTransfer.note} onChange={(event) => setCryptoTransfer({ ...cryptoTransfer, note: event.target.value })} /></label>
              </>}
              {kind === "btc-transfer" && <>
                <label>Tài sản nguồn<select value={btcTransfer.asset} onChange={(event) => updateBtcTransferAsset(event.target.value as "btc" | "usdt")}><option value="usdt">USDT</option><option value="btc">BTC</option></select></label>
                {btcTransfer.asset === "btc" ? (
                  <label>Số BTC<InputWithMax value={btcTransfer.btc} onChange={(event) => setBtcTransfer({ ...btcTransfer, btc: formatDecimalChange(event) })} onMax={fillMaxQuickBtcTransferSource} placeholder="0,0001" /></label>
                ) : (
                  <label>Số USDT<InputWithMax value={btcTransfer.usdt} onChange={(event) => setBtcTransfer({ ...btcTransfer, usdt: formatDecimalChange(event) })} onMax={fillMaxQuickBtcTransferSource} placeholder="10" /></label>
                )}
                <label>Nơi nhận<select value={btcTransfer.destination} disabled={btcTransfer.asset === "btc"} onChange={(event) => updateBtcTransferDestination(event.target.value as BtcTransferTarget)}>
                  {btcTransfer.asset === "btc" ? <option value="usdt">USDT</option> : <option value="btc">BTC</option>}
                  {btcTransfer.asset === "usdt" && <><option value="stock">CK</option><option value="saving">Tiết kiệm</option><option value="emergency">dự phòng</option><option value="cash">Tiền mặt</option></>}
                </select></label>
                <label>{btcTransfer.asset === "usdt" && btcTransfer.destination !== "btc" ? "Giá USDT/VND" : "Giá BTC/USDT"}<input value={btcTransfer.price} onChange={(event) => setBtcTransfer({ ...btcTransfer, price: formatDecimalChange(event) })} placeholder={formatDecimalInput(String(btcTransferPriceFor(btcTransfer.asset, btcTransfer.destination) || 0))} /></label>
                <label>Số tiền nhận<input value={btcTransfer.received} onChange={(event) => setBtcTransfer({ ...btcTransfer, received: btcTransferReceiveUnit() === "VND" ? formatMoneyChange(event) : formatDecimalChange(event) })} placeholder={formatBtcTransferEstimate()} /></label>
                <label>Ngày<input type="date" value={btcTransfer.date} onChange={(event) => setBtcTransfer({ ...btcTransfer, date: event.target.value })} /></label>
                <label>Note<input value={btcTransfer.note} onChange={(event) => setBtcTransfer({ ...btcTransfer, note: event.target.value })} /></label>
              </>}
              {kind === "stock-buy" && <>
                <div className="confirm-summary stock-confirm-summary">
                  <div>
                    <span>Phí mua</span>
                    <strong>{formatVnd(quickStockPlannedFee)}</strong>
                  </div>
                  <div>
                    <span>Tổng tiền</span>
                    <strong>{formatVnd(quickStockPlannedValue)} / {formatVnd(stockStats.cash)}</strong>
                  </div>
                </div>
                <div className="stock-buy-list">
                  {quickStockRows.map((row, index) => {
                    const value = stockPurchaseLineCost({ shares: Number(row.shares) || 0, buyPrice: quickEffectiveBuyPrice(row) });
                    return (
                      <div className="stock-buy-row" key={row.id}>
                        <label>
                          Cổ phiếu
                          <input value={row.symbol} onChange={(event) => updateQuickStockRow(row.id, { symbol: event.target.value.toUpperCase() })} placeholder="MBB" />
                        </label>
                        <label>
                          %
                          <input value={row.percent} onChange={(event) => updateQuickStockPercent(row.id, event.target.value)} placeholder={index === 0 ? "100" : "0"} />
                        </label>
                        <label>
                          Giá vào
                          <div className="stock-price-remove-field">
                            <input
                              value={stockBuyPriceInput(row, quickMarketPriceForBuyRow(row))}
                              onChange={(event) => {
                                const buyPrice = formatDecimalChange(event);
                                updateQuickStockRow(row.id, { buyPrice, buyPriceTouched: Boolean(buyPrice) });
                              }}
                              placeholder={row.symbol ? formatStockPrice(quickMarketPriceForBuyRow(row) || 27.5) : "27,5"}
                            />
                            <button className="stock-remove-mini stock-remove-mobile" onClick={() => removeQuickStockRow(row.id)} title="Xóa dòng" type="button">
                              <X size={13} />
                            </button>
                          </div>
                        </label>
                        <label>
                          Số cổ phiếu
                          <InputWithMax
                            value={row.shares}
                            onChange={(event) => {
                              const shares = event.target.value.replace(/\D/g, "");
                              updateQuickStockRow(row.id, { shares, sharesTouched: Boolean(shares) });
                            }}
                            onMax={() => void fillMaxQuickStockBuyRow(row.id)}
                            placeholder="100"
                            inputMode="numeric"
                          />
                        </label>
                        <div className="stock-row-value">
                          <span>Giá trị</span>
                          <strong>{formatVnd(value)}</strong>
                        </div>
                        <button className="stock-remove-mini stock-remove-desktop" onClick={() => removeQuickStockRow(row.id)} title="Xóa dòng" type="button">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="stock-form-actions stock-buy-actions">
                  <label className="stock-action-date" aria-label="Ngày mua"><input type="date" value={quickStockMeta.date} onChange={(event) => setQuickStockMeta({ ...quickStockMeta, date: event.target.value })} /></label>
                  <button className="ghost" onClick={addQuickStockRow} type="button"><Plus size={17} /> Thêm</button>
                  <button className="primary" onClick={save} type="button"><Save size={17} /> Lưu</button>
                </div>
              </>}
              {kind === "stock-transfer" && <>
                <label>Mã đang giữ<select value={stockTransfer.symbol} onChange={(event) => {
                  const holding = stockStats.holdings.find((item) => item.symbol === event.target.value);
                  setStockTransfer({ ...stockTransfer, symbol: event.target.value, price: holding ? formatStockPrice(holding.marketPrice) : stockTransfer.price, fee: "", netVnd: "" });
                }}><option value="">Chọn mã</option>{stockStats.holdings.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.shares.toLocaleString("vi-VN")}</option>)}</select></label>
                <label>Số cổ phiếu rút<InputWithMax value={stockTransfer.shares} onChange={(event) => setStockTransfer({ ...stockTransfer, shares: event.target.value.replace(/\D/g, "") })} onMax={fillMaxQuickStockTransfer} inputMode="numeric" /></label>
                <label>Giá rút<input value={stockTransfer.price} onChange={(event) => setStockTransfer({ ...stockTransfer, price: formatDecimalChange(event) })} /></label>
                <label>Phí bán<input value={stockTransfer.fee || (quickStockTransferFee ? formatMoneyInput(String(quickStockTransferFee)) : "")} onChange={(event) => setStockTransfer({ ...stockTransfer, fee: formatMoneyChange(event), netVnd: "" })} placeholder="Tự tính" /></label>
                <label>Thực nhận<input value={stockTransfer.netVnd || (quickStockTransferNet ? formatMoneyInput(String(quickStockTransferNet)) : "")} onChange={(event) => setStockTransfer({ ...stockTransfer, netVnd: formatMoneyChange(event) })} placeholder="Theo MBS" /></label>
                <label>Nơi nhận<select value={stockTransfer.destination} onChange={(event) => setStockTransfer({ ...stockTransfer, destination: event.target.value as SolDestination })}>{stockDestinationOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
                <label>Ngày<input type="date" value={stockTransfer.date} onChange={(event) => setStockTransfer({ ...stockTransfer, date: event.target.value })} /></label>
                <div className="stock-sale-submit-row">
                  <div className="stock-sale-summary">
                    <span>Giá trị</span>
                    <strong>{formatVnd(quickStockTransferNet)}</strong>
                  </div>
                  <button className="primary icon-only stock-sale-submit-button" onClick={save} title="Rút" aria-label="Rút" type="button"><ArrowDownCircle size={17} /></button>
                </div>
              </>}
              {kind === "stock-event" && <>
                  <label>Mã cổ phiếu<select value={quickCorporate.symbol} onChange={(event) => {
                    const symbol = event.target.value;
                    const holding = stockStats.holdings.find((item) => item.symbol === symbol);
                    const eventShares = stockSharesAtDate(state, symbol, quickCorporate.receiveDate);
                    setQuickCorporate({ ...quickCorporate, symbol, eligibleShares: eventShares ? String(eventShares) : holding ? String(holding.shares) : quickCorporate.eligibleShares, resultingShares: "", cashReceived: "" });
                  }}><option value="">Chọn mã</option>{stockStats.holdings.map((holding) => <option key={holding.symbol} value={holding.symbol}>{holding.symbol} · {holding.shares.toLocaleString("vi-VN")} cp</option>)}</select></label>
                <label>Loại sự kiện<select value={quickCorporate.type} onChange={(event) => {
                  const type = event.target.value as CorporateAction["type"];
                  setQuickCorporate({
                    ...quickCorporate,
                    type,
                    ratioFrom: "100",
                    ratioTo: "10",
                    cashDividendPercent: type === "cash_dividend" ? quickCorporate.cashDividendPercent || "10" : quickCorporate.cashDividendPercent,
                    taxRate: type === "cash_dividend" ? quickCorporate.taxRate || "5" : "",
                    subscriptionPrice: type === "rights_issue" ? quickCorporate.subscriptionPrice || "10" : quickCorporate.subscriptionPrice,
                    resultingShares: "",
                    cashReceived: "",
                  });
                }}>{quickCorporateActionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                <label>Ngày nhận<input type="date" value={quickCorporate.receiveDate} onChange={(event) => {
                  const receiveDate = event.target.value;
                  const eventShares = stockSharesAtDate(state, quickCorporate.symbol, receiveDate);
                  setQuickCorporate({ ...quickCorporate, receiveDate, eligibleShares: eventShares ? String(eventShares) : quickCorporate.eligibleShares, resultingShares: "", cashReceived: "" });
                }} /></label>
                <label>Số cổ đủ quyền<input value={quickCorporate.eligibleShares} onChange={(event) => setQuickCorporate({ ...quickCorporate, eligibleShares: event.target.value.replace(/\D/g, "") })} placeholder="1000" /></label>
                {quickCorporate.type !== "cash_dividend" && <>
                  <label>Tỷ lệ từ<input value={quickCorporate.ratioFrom} onChange={(event) => setQuickCorporate({ ...quickCorporate, ratioFrom: formatDecimalChange(event) })} placeholder="100" /></label>
                  <label>Tỷ lệ đến<input value={quickCorporate.ratioTo} onChange={(event) => setQuickCorporate({ ...quickCorporate, ratioTo: formatDecimalChange(event) })} placeholder="10" /></label>
                </>}
                {quickCorporate.type === "cash_dividend" && <>
                  <label>Cổ tức %<input value={quickCorporate.cashDividendPercent} onChange={(event) => setQuickCorporate({ ...quickCorporate, cashDividendPercent: formatDecimalChange(event), cashPerShare: "", cashReceived: "" })} placeholder="10" /></label>
                  <label>Tiền/cp<input value={quickCorporate.cashPerShare || quickEffectiveCashPerShare.toLocaleString("vi-VN")} onChange={(event) => setQuickCorporate({ ...quickCorporate, cashPerShare: formatMoneyChange(event), cashReceived: "" })} placeholder="1.000" /></label>
                  <label>Tiền nhận<input value={quickCashDividendGross ? quickCashDividendGross.toLocaleString("vi-VN") : ""} readOnly placeholder="Tự tính" /></label>
                  <label>Thuế %<input value={quickCorporate.taxRate} onChange={(event) => setQuickCorporate({ ...quickCorporate, taxRate: formatDecimalChange(event), cashReceived: "" })} placeholder="5" /></label>
                  <label>Kết quả dự kiến<input value={quickCorporate.cashReceived || (quickEffectiveCashDividendResult ? quickEffectiveCashDividendResult.toLocaleString("vi-VN") : "")} onChange={(event) => setQuickCorporate({ ...quickCorporate, cashReceived: formatMoneyChange(event) })} placeholder="Tự tính" /></label>
                </>}
                {quickCorporate.type === "stock_dividend" && <label>Số cổ nhận<input value={quickCorporate.resultingShares || (quickComputedCorporateShares ? String(quickComputedCorporateShares) : "")} onChange={(event) => setQuickCorporate({ ...quickCorporate, resultingShares: event.target.value.replace(/\D/g, "") })} placeholder="Tự tính" /></label>}
                {quickCorporate.type === "rights_issue" && <>
                  <label>Giá quyền mua<input value={quickCorporate.subscriptionPrice} onChange={(event) => setQuickCorporate({ ...quickCorporate, subscriptionPrice: formatDecimalChange(event) })} placeholder="10,0" /></label>
                  <label>Số cổ được mua<input value={quickCorporate.resultingShares || (quickComputedCorporateShares ? String(quickComputedCorporateShares) : "")} onChange={(event) => setQuickCorporate({ ...quickCorporate, resultingShares: event.target.value.replace(/\D/g, "") })} placeholder="Tự tính" /></label>
                  <label>Thực trả<input value={quickRightsIssueAmount ? quickRightsIssueAmount.toLocaleString("vi-VN") : ""} readOnly placeholder="Tự tính" /></label>
                </>}
              </>}
              {kind === "deposit" && <>
                <label>Quỹ<select value={deposit.fund} onChange={(event) => updateQuickDepositFund(event.target.value as DepositFund)}><option value="saving">Tiết kiệm</option><option value="emergency">dự phòng</option><option value="accumulation">Tích lũy</option></select></label>
                {deposit.fund === "accumulation" && <label>Mục tích lũy<select value={deposit.accumulationGoalId} onChange={(event) => updateQuickDepositAccumulationGoal(event.target.value)}><option value="">Chọn mục</option>{activeAccumulationGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label>}
                <label>Số tiền<input value={deposit.amount} onChange={(event) => updateQuickDepositAmount(formatMoneyChange(event))} placeholder="6.000.000" /></label>
                <label>Đã thanh toán<input value={deposit.certificatePurchaseAmount || (!deposit.certificatePurchaseTouched && deposit.amount ? deposit.amount : "")} onChange={(event) => setDeposit({ ...deposit, certificatePurchaseAmount: formatMoneyChange(event), certificatePurchaseTouched: true })} placeholder={deposit.amount || "2.000.055"} /></label>
                <label>Giá trị cuối kỳ<input value={deposit.certificateMaturityValue || (!deposit.certificateMaturityTouched ? formatQuickDepositMaturityEstimate(deposit) : "")} onChange={(event) => setDeposit({ ...deposit, certificateMaturityValue: formatMoneyChange(event), certificateMaturityTouched: true })} placeholder={formatQuickDepositMaturityEstimate(deposit) || "2.035.288"} /></label>
                <label>Lãi suất %<input value={deposit.rate} onChange={(event) => updateQuickDepositRate(formatDecimalChange(event))} /></label>
                <label>Kỳ hạn tháng<input value={deposit.term} onChange={(event) => updateQuickDepositTerm(event.target.value)} /></label>
                <label>Ngày gửi<input type="date" value={deposit.date} onChange={(event) => updateQuickDepositDate(event.target.value)} /></label>
                <label>4 s? MB<input value={deposit.mbLast4} onChange={(event) => setDeposit({ ...deposit, mbLast4: event.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" maxLength={4} /></label>
                <label>Note<input value={deposit.note} onChange={(event) => setDeposit({ ...deposit, note: event.target.value })} /></label>
              </>}
              {kind === "sol-buy" && <>
                <label>Số SOL<input value={sol.amount} onChange={(event) => updateQuickSolBuyAmount(formatSolChange(event))} placeholder="0,5" /></label>
                <label>Giá mua USDT<input value={sol.price} onChange={(event) => updateQuickSolBuyPrice(formatDecimalChange(event))} placeholder={formatDecimalInput(String(state.market.solUsd || 0))} /></label>
                <label>Giá trị<input value={sol.valueUsdt || (quickSolBuyValueUsdt ? formatQuickSolDecimal(quickSolBuyValueUsdt) : "")} onChange={(event) => updateQuickSolBuyValueUsdt(formatDecimalChange(event))} placeholder={formatQuickSolDecimal(quickSolBuyValueUsdt)} /></label>
                <label>Giá tiền VND<input value={sol.valueVnd || (quickSolBuyValueVnd ? formatMoneyInput(String(quickSolBuyValueVnd)) : "")} onChange={(event) => updateQuickSolBuyValueVnd(formatMoneyChange(event))} placeholder={quickSolBuyValueVnd ? formatMoneyInput(String(quickSolBuyValueVnd)) : ""} /></label>
                <label>Ngày<input type="date" value={sol.date} onChange={(event) => setSol({ ...sol, date: event.target.value })} /></label>
                <button className="primary btc-form-submit" onClick={save} type="button"><Plus size={17} /> Thêm SOL</button>
              </>}
              {kind === "sol-transfer" && <>
                <label>Số SOL<InputWithMax value={solTransfer.amount} onChange={(event) => updateQuickSolTransferAmount(formatSolChange(event))} onMax={fillMaxQuickSolTransfer} placeholder="0,1" /></label>
                <label>Giá SOL/USDT<input value={solTransfer.price} onChange={(event) => updateQuickSolTransferPrice(formatDecimalChange(event))} /></label>
                <label>Số tiền nhận<input value={solTransfer.vnd} onChange={(event) => setSolTransfer({ ...solTransfer, vnd: formatMoneyChange(event) })} /></label>
                {solTransfer.destination === "btc-direct" && <label>Số BTC nhận<input value={solTransfer.btc} onChange={(event) => { setSolTransferBtcTouched(true); setSolTransfer({ ...solTransfer, btc: formatDecimalChange(event) }); }} placeholder="0,0001234" /></label>}
                <label>Nơi nhận<select value={solTransfer.destination} onChange={(event) => updateQuickSolTransferDestination(event.target.value as SolDestination)}>{solDestinationOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
                <label>Ngày<input type="date" value={solTransfer.date} onChange={(event) => setSolTransfer({ ...solTransfer, date: event.target.value })} /></label>
                <label>Note<input value={solTransfer.note} onChange={(event) => setSolTransfer({ ...solTransfer, note: event.target.value })} /></label>
              </>}
            </div>
            {error && <span className="form-error">{error}</span>}
            {kind !== "undo" && kind !== "stock-buy" && kind !== "stock-transfer" && kind !== "sol-buy" && <button className="primary full" onClick={save} type="button"><Save size={17} /> Lưu nhanh</button>}
          </section>
        </div>
      )}
    </>
  );
}

export function App() {
  const [state, setState] = useStoredState();
  const [unlocked, setUnlocked] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [assetTab, setAssetTab] = useState<InvestmentTab>("crypto");
  const [month, setMonth] = useState(currentMonth);
  const [activePin, setActivePin] = useState("");
  const [cloudStatus, setCloudStatus] = useState("");
  const [marketStatus, setMarketStatus] = useState("");
  const [btcCloudAccountId, setBtcCloudAccountId] = useState("");
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState("");
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [visibleUndoId, setVisibleUndoId] = useState<string | null>(null);
  const [investmentAction, setInvestmentAction] = useState<InvestmentActionIntent | null>(null);
  const [mbbDepositIntent, setMbbDepositIntent] = useState<MbbDepositIntent | null>(null);
  const cloudLoaded = useRef(false);
  const lastCloudSnapshot = useRef("");
  const lastCloudUpdatedAt = useRef("");
  const cloudPullInFlight = useRef(false);
  const stateRef = useRef(state);
  const marketRef = useRef(state.market);
  const btcCloudMergePausedUntil = useRef(0);
  const cloudSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const cloudWritesPending = useRef(0);
  const localMutationRevision = useRef(0);
  const undoToastTimer = useRef<number | null>(null);
  const cloudConfigured = isCloudSyncConfigured();
  const cloudAccountKey = activePin ? cloudAccountKeyForPin(activePin) : "";
  const stateForCloud = (): AppState => (activePin ? stateForAccountPin(state, activePin) : state);
  const saveCloudStateQueued = (syncKey: string, snapshot: AppState) => {
    cloudWritesPending.current += 1;
    const queuedSave = cloudSaveQueue.current
      .catch(() => undefined)
      .then(() => saveCloudState(syncKey, snapshot));
    cloudSaveQueue.current = queuedSave.then(
      () => { cloudWritesPending.current = Math.max(cloudWritesPending.current - 1, 0); },
      () => { cloudWritesPending.current = Math.max(cloudWritesPending.current - 1, 0); }
    );
    return queuedSave;
  };
  const autoStockSymbols = useMemo(
    () => stockPortfolioStats(state).holdings.map((item) => item.symbol).join("|"),
    [state.stockPurchases, state.stockSales]
  );
  const navigateToPage = (nextPage: Page) => {
    if (page === "investment" && nextPage !== "investment" && assetTab === "mbb") setAssetTab("crypto");
    setPage(nextPage);
    if (nextPage === "dashboard") setMonth(currentMonth());
  };
  const normalizeCloudStateForActivePin = (cloudState: AppState) =>
    normalizeStateWithMigrationSafety({
      ...initialState,
      ...cloudState,
      settings: { ...initialState.settings, ...cloudState.settings, hasPin: true, pin: activePin },
    }, { backupBeforeMigration: true });
  const markCloudSnapshotSynced = (syncedState: AppState, updatedAt = "", pin = activePin || syncedState.settings.pin) => {
    lastCloudSnapshot.current = JSON.stringify(stateForAccountPin(syncedState, pin));
    lastCloudUpdatedAt.current = updatedAt;
    if (updatedAt) setLastCloudSyncAt(updatedAt);
  };
  const pullCloudState = async (force = false) => {
    if (!cloudConfigured || !cloudAccountKey || !activePin || cloudPullInFlight.current || cloudWritesPending.current > 0) return false;
    const revisionAtPullStart = localMutationRevision.current;
    cloudPullInFlight.current = true;
    try {
      if (force) setCloudStatus("Đang tải dữ liệu cloud...");
      const cloudSnapshot = await loadCloudSnapshot<AppState>(cloudAccountKey);
      if (localMutationRevision.current !== revisionAtPullStart) return false;
      if (!cloudSnapshot) {
        if (force) setCloudStatus("Chưa có dữ liệu cloud cho PIN này.");
        return false;
      }

      const nextState = normalizeCloudStateForActivePin(cloudSnapshot.state);
      const cloudNeedsMigration = Number(cloudSnapshot.state.schemaVersion ?? 1) < FINANCIAL_SCHEMA_VERSION;
      const snapshot = JSON.stringify(stateForAccountPin(nextState, activePin));
      const remoteTime = Date.parse(cloudSnapshot.updatedAt);
      const localTime = Date.parse(lastCloudUpdatedAt.current);
      const remoteIsNewer =
        !lastCloudUpdatedAt.current ||
        !Number.isFinite(localTime) ||
        (Number.isFinite(remoteTime) && remoteTime > localTime + 500);

      if (force || (remoteIsNewer && snapshot !== lastCloudSnapshot.current)) {
        stateRef.current = nextState;
        setState(nextState);
        lastCloudSnapshot.current = snapshot;
        lastCloudUpdatedAt.current = cloudSnapshot.updatedAt;
        if (cloudSnapshot.updatedAt) setLastCloudSyncAt(cloudSnapshot.updatedAt);
        cloudLoaded.current = true;
        if (cloudNeedsMigration) {
          const syncedAt = await saveCloudStateQueued(cloudAccountKey, stateForAccountPin(nextState, activePin));
          markCloudSnapshotSynced(nextState, syncedAt);
        }
        setCloudStatus(cloudSnapshot.updatedAt ? `Đã tải dữ liệu cloud ${formatDateTime(cloudSnapshot.updatedAt)}.` : "Đã tải dữ liệu cloud.");
        return true;
      }

      lastCloudUpdatedAt.current = cloudSnapshot.updatedAt || lastCloudUpdatedAt.current;
      if (cloudSnapshot.updatedAt) setLastCloudSyncAt(cloudSnapshot.updatedAt);
      cloudLoaded.current = true;
      if (force) setCloudStatus("Dữ liệu trên thiết bị đã mới nhất.");
      return false;
    } catch {
      if (force) setCloudStatus("Không tải được dữ liệu cloud.");
      return false;
    } finally {
      cloudPullInFlight.current = false;
    }
  };
  const openAccumulationMbbDeposits = (accumulationGoalId: string) => {
    setPage("investment");
    setAssetTab("mbb");
    setMbbDepositIntent({ id: uid(), fund: "accumulation", accumulationGoalId });
  };

  useEffect(() => {
    stateRef.current = state;
    marketRef.current = state.market;
  }, [state]);

  useEffect(() => () => {
    if (undoToastTimer.current) window.clearTimeout(undoToastTimer.current);
  }, []);

  useEffect(() => {
    if (unlocked || !state.settings.hasPin || !state.settings.pin || !isPinLoginBypassActive(state.settings.pinLoginDisabledUntil)) return;
    setActivePin(state.settings.pin);
    setUnlocked(true);
    if (cloudConfigured) {
      cloudLoaded.current = false;
      setCloudStatus("Đang tải dữ liệu cloud...");
    } else {
      cloudLoaded.current = true;
      lastCloudSnapshot.current = JSON.stringify(stateForAccountPin(state, state.settings.pin));
    }
  }, [cloudConfigured, state.settings.hasPin, state.settings.pin, state.settings.pinLoginDisabledUntil, unlocked]);

  useEffect(() => {
    const value = state.settings.pinLoginDisabledUntil;
    if (!value || value === "manual") return;
    const expiresAt = new Date(value).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, pinLoginDisabledUntil: undefined } }));
      return;
    }
    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, pinLoginDisabledUntil: undefined } }));
    }, expiresAt - Date.now() + 100);
    return () => window.clearTimeout(timer);
  }, [setState, state.settings.pinLoginDisabledUntil]);

  useEffect(() => {
    if (!unlocked || !state.settings.autoLockEnabled || isPinLoginBypassActive(state.settings.pinLoginDisabledUntil)) return;
    let timer: number | null = null;
    const lockApp = () => {
      setUnlocked(false);
      setActivePin("");
      setBtcCloudAccountId("");
      cloudLoaded.current = false;
      lastCloudUpdatedAt.current = "";
    };
    const resetTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(lockApp, AUTO_LOCK_MS);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [state.settings.autoLockEnabled, state.settings.pinLoginDisabledUntil, unlocked]);

  const commitWithUndo: CommitWithUndo = (label, updater, meta) => {
    const previous = stateRef.current;
    const rawNext = typeof updater === "function" ? (updater as (prev: AppState) => AppState)(previous) : updater;
    if (rawNext === previous) return;
    localMutationRevision.current += 1;
    const log = makeAuditLog(label, previous, rawNext, meta);
    const next = withAuditLog(rawNext, log);
    const entry: UndoEntry = { id: uid(), label, state: previous, createdAt: new Date().toISOString() };
    setUndoStack((prev) => [...prev, entry].slice(-10));
    setVisibleUndoId(entry.id);
    if (undoToastTimer.current) window.clearTimeout(undoToastTimer.current);
    undoToastTimer.current = window.setTimeout(() => setVisibleUndoId((current) => (current === entry.id ? null : current)), 5000);
    stateRef.current = next;
    setState(next);
  };

  const syncBtcLedgerToCloudState = async (target: AppState, current: AppState) => {
    if (!btcCloudAccountId) return;
    const syncRows = <T extends { id: string }>(
      table: string,
      targetRows: T[],
      currentRows: T[],
      columns: (row: T) => Record<string, unknown> = () => ({})
    ) => {
      const targetIds = new Set(targetRows.map((item) => item.id));
      const deletes = currentRows
        .filter((item) => !targetIds.has(item.id))
        .map((item) => deleteCloudPayloadRow(table, btcCloudAccountId, item.id));
      const upserts = targetRows.map((item) => upsertCloudPayloadRow(table, btcCloudAccountId, item.id, item, columns(item)));
      return [...deletes, ...upserts];
    };

    const results = await Promise.allSettled([
      ...syncRows("btc_usdt_topups", target.btcUsdtTopups, current.btcUsdtTopups),
      ...syncRows("btc_dca_plans", target.btcDcaPlans, current.btcDcaPlans, (item) => ({ is_active: item.isActive, next_run_at: item.nextRunAt, status: item.status })),
      ...syncRows("btc_trades", target.btcTrades, current.btcTrades, (item) => ({ executed_at: item.executedAt, plan_id: item.planId ?? null })),
      ...syncRows("btc_transfers", target.btcTransfers, current.btcTransfers, (item) => ({ transfer_at: item.occurredAt ?? `${item.date}T00:00:00` })),
    ]);
    if (results.some((result) => result.status === "rejected")) throw new Error("Không đồng bộ được BTC ledger sau undo.");
  };

  const mergeBtcCloudLedger = async (accountId: string) => {
    if (Date.now() < btcCloudMergePausedUntil.current) return;
    const ledger = await loadBtcCloudLedger(accountId);
    if (Date.now() < btcCloudMergePausedUntil.current) return;
    setState((prev) => {
      const next = {
        ...prev,
        btcUsdtTopups: mergeById(prev.btcUsdtTopups, ledger.topups),
        btcDcaPlans: mergeById(prev.btcDcaPlans, ledger.dcaPlans).map(normalizeDcaPlan),
        btcTrades: mergeById(prev.btcTrades, ledger.trades),
        btcTransfers: mergeById(prev.btcTransfers, ledger.transfers),
      };
      const normalized = normalizeFinancialMetadata(next);
      return JSON.stringify(btcCloudLedgerFromState(normalized)) === JSON.stringify(btcCloudLedgerFromState(prev)) ? prev : normalized;
    });
  };

  const undoToEntry = (entryId: string) => {
    const entryIndex = undoStack.findIndex((entry) => entry.id === entryId);
    if (entryIndex < 0) return;
    const entry = undoStack[entryIndex];
    const currentState = stateRef.current;
    const undoLog = makeAuditLog(`Đã hoàn tác: ${entry.label}`, currentState, entry.state, {
      action: "undo",
      entityType: "general",
    });
    const targetState = withAuditLog({ ...entry.state, auditLogs: currentState.auditLogs }, undoLog);
    localMutationRevision.current += 1;
    btcCloudMergePausedUntil.current = Date.now() + 60_000;
    setState(targetState);
    stateRef.current = targetState;
    if (cloudAccountKey && activePin) {
      lastCloudSnapshot.current = JSON.stringify(stateForAccountPin(targetState, activePin));
    }
    setUndoStack((prev) => prev.slice(0, entryIndex));
    setVisibleUndoId(null);
    if (undoToastTimer.current) {
      window.clearTimeout(undoToastTimer.current);
      undoToastTimer.current = null;
    }
    void (async () => {
      try {
        await syncBtcLedgerToCloudState(targetState, currentState);
        if (cloudAccountKey && activePin) {
          const snapshot = stateForAccountPin(targetState, activePin);
          const syncedAt = await saveCloudStateQueued(cloudAccountKey, snapshot);
          markCloudSnapshotSynced(targetState, syncedAt);
        }
        if (btcCloudAccountId) setDataStatus(await loadDataStatus(btcCloudAccountId));
      } catch {
        setCloudStatus("Đã hoàn tác local, nhưng chưa đồng bộ được cloud.");
      }
    })();
  };

  const syncBtcLedgerNow = async () => {
    if (!btcCloudAccountId) return false;
    try {
      setCloudStatus("Đang đồng bộ BTC ledger...");
      await Promise.all([
        ...state.btcUsdtTopups.map((item) => upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, item.id, item)),
        ...state.btcDcaPlans.map((item) => upsertCloudPayloadRow("btc_dca_plans", btcCloudAccountId, item.id, item, { is_active: item.isActive, next_run_at: item.nextRunAt, status: item.status })),
        ...state.btcTrades.map((item) => upsertCloudPayloadRow("btc_trades", btcCloudAccountId, item.id, item, { executed_at: item.executedAt, plan_id: item.planId ?? null })),
        ...state.btcTransfers.map((item) => upsertCloudPayloadRow("btc_transfers", btcCloudAccountId, item.id, item, { transfer_at: item.occurredAt ?? `${item.date}T00:00:00` })),
      ]);
      setLastCloudSyncAt(new Date().toISOString());
      setCloudStatus("Đã đồng bộ BTC ledger.");
      setDataStatus(await loadDataStatus(btcCloudAccountId));
      return true;
    } catch {
      setCloudStatus("Không đồng bộ được BTC ledger.");
      return false;
    }
  };

  const reloadBtcLedgerNow = async () => {
    if (!btcCloudAccountId) return false;
    try {
      setCloudStatus("Đang tải lại BTC ledger...");
      await mergeBtcCloudLedger(btcCloudAccountId);
      setDataStatus(await loadDataStatus(btcCloudAccountId));
      setCloudStatus("Đã tải lại BTC ledger.");
      return true;
    } catch {
      setCloudStatus("Không tải lại được BTC ledger.");
      return false;
    }
  };

  const exportBackupJson = () => {
    const exportedAt = new Date().toISOString();
    const current = stateRef.current;
    downloadTextFile(`quan-li-chi-tieu-backup-${exportedAt.slice(0, 10)}.json`, JSON.stringify(backupPayload(current), null, 2), "application/json");
    const next = withAuditLog(
      {
        ...current,
        backupMeta: { ...(current.backupMeta ?? {}), lastExportAt: exportedAt },
      },
      makeAuditLog("Đã tạo backup JSON.", current, current, { action: "backup", entityType: "backup" })
    );
    stateRef.current = next;
    setState(next);
  };

  const exportCsv = () => {
    const exportedAt = new Date().toISOString();
    const current = stateRef.current;
    downloadTextFile(`quan-li-chi-tieu-export-${exportedAt.slice(0, 10)}.csv`, exportCsvBundle(current), "text/csv;charset=utf-8");
    const next = withAuditLog(
      {
        ...current,
        backupMeta: { ...(current.backupMeta ?? {}), lastExportAt: exportedAt },
      },
      makeAuditLog("Đã export CSV.", current, current, { action: "backup", entityType: "backup" })
    );
    stateRef.current = next;
    setState(next);
  };

  const restoreBackupFile = async (file: File) => {
    const current = stateRef.current;
    const text = await file.text();
    let parsed: { version?: number; state?: AppState };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("File backup không phải JSON hợp lệ.");
    }
    if (!parsed || ![1, BACKUP_VERSION].includes(Number(parsed.version)) || !parsed.state || typeof parsed.state !== "object") {
      throw new Error("File backup không đúng cấu trúc của app.");
    }

    localStorage.setItem(AUTO_RESTORE_BACKUP_KEY, JSON.stringify(backupPayload(current)));
    const restoredAt = new Date().toISOString();
    const normalized = normalizeStateWithMigrationSafety({
      ...initialState,
      ...parsed.state,
      settings: {
        ...initialState.settings,
        ...parsed.state.settings,
        hasPin: current.settings.hasPin || parsed.state.settings.hasPin || Boolean(activePin),
        pin: activePin || parsed.state.settings.pin || current.settings.pin,
      },
      backupMeta: {
        ...(parsed.state.backupMeta ?? {}),
        lastRestoreAt: restoredAt,
      },
    }, { backupBeforeMigration: true });
    const next = withAuditLog(
      normalized,
      makeAuditLog("Đã restore backup JSON.", current, normalized, { action: "restore", entityType: "restore" })
    );
    stateRef.current = next;
    setState(next);
    if (cloudAccountKey) {
      const syncedAt = await saveCloudStateQueued(cloudAccountKey, stateForAccountPin(next, activePin));
      markCloudSnapshotSynced(next, syncedAt);
    }
    if (btcCloudAccountId) {
      await syncBtcLedgerToCloudState(next, current);
      setDataStatus(await loadDataStatus(btcCloudAccountId));
    }
  };

  const restoreTrashItem = (trashItemId: string) => {
    const current = stateRef.current;
    const trashItem = current.trashItems.find((item) => item.id === trashItemId);
    if (!trashItem) return;
    const next = restoreTrashPayload(current, trashItem);
    stateRef.current = next;
    setState(next);
    void syncBtcLedgerToCloudState(next, current).catch(() => setCloudStatus("Đã khôi phục local, nhung chưa đồng bộ được BTC cloud."));
  };

  const permanentlyDeleteTrashItem = (trashItemId: string) => {
    const current = stateRef.current;
    const trashItem = current.trashItems.find((item) => item.id === trashItemId);
    if (!trashItem) return;
    const withoutTrash = { ...current, trashItems: current.trashItems.filter((item) => item.id !== trashItemId) };
    const next = withAuditLog(
      withoutTrash,
      makeAuditLog(`Đã xóa vĩnh viễn ${trashItem.label}.`, current, withoutTrash, {
        action: "delete",
        entityType: "trash",
        entityId: trashItem.entityId,
      })
    );
    stateRef.current = next;
    setState(next);
  };

  const runFullHealthCheck = () => {
    commitWithUndo(
      "Đã kiểm tra sức khỏe dữ liệu.",
      (prev) => ({
        ...prev,
        healthIssues: runHealthChecks(prev, buildFinancialIndex(prev)),
      }),
      { action: "update", entityType: "health" }
    );
  };

  const setHealthIssueStatus = (fingerprint: string, status: HealthIssue["status"]) => {
    commitWithUndo(
      status === "ignored" ? "Đã bỏ qua vấn đề dữ liệu." : "Đã đánh dấu vấn đề dữ liệu đã xử lý.",
      (prev) => {
        const issues = prev.healthIssues.length ? prev.healthIssues : runHealthChecks(prev, buildFinancialIndex(prev));
        return {
          ...prev,
          healthIssues: issues.map((issue) => (issue.fingerprint === fingerprint ? { ...issue, status } : issue)),
        };
      },
      { action: "update", entityType: "health", entityId: fingerprint }
    );
  };

  const cleanBrokenFinancialLinks = (target: AppState) => {
    const validEventIds = new Set(buildFinancialIndex(target).events.map((event) => event.id));
    const cleanRows = <T extends { meta?: TransactionMeta }>(rows: T[]): T[] =>
      rows.map((row) => {
        if (!row.meta) return row;
        const parentEventIds = (row.meta.parentEventIds ?? []).filter((id) => validEventIds.has(id));
        const childEventIds = (row.meta.childEventIds ?? []).filter((id) => validEventIds.has(id));
        if (parentEventIds.length === (row.meta.parentEventIds ?? []).length && childEventIds.length === (row.meta.childEventIds ?? []).length) return row;
        return {
          ...row,
          meta: {
            ...row.meta,
            parentEventIds,
            childEventIds,
            updatedAt: new Date().toISOString(),
          },
        };
      });

    return normalizeFinancialMetadata({
      ...target,
      incomeTransactions: cleanRows(target.incomeTransactions),
      monthlyExpenses: cleanRows(target.monthlyExpenses),
      accumulationGoals: cleanRows(target.accumulationGoals),
      expenseEntries: cleanRows(target.expenseEntries),
      allocations: cleanRows(target.allocations),
      fundTransactions: cleanRows(target.fundTransactions),
      stockPurchases: cleanRows(target.stockPurchases),
      stockSales: cleanRows(target.stockSales),
      btcUsdtTopups: cleanRows(target.btcUsdtTopups),
      btcDcaPlans: cleanRows(target.btcDcaPlans),
      btcTrades: cleanRows(target.btcTrades),
      btcTransfers: cleanRows(target.btcTransfers),
      bankDeposits: cleanRows(target.bankDeposits),
      solTransactions: cleanRows(target.solTransactions),
      adjustmentTransactions: cleanRows(target.adjustmentTransactions),
      corporateActions: cleanRows(target.corporateActions),
    });
  };

  const autoFixHealthIssue = (fingerprint: string) => {
    commitWithUndo(
      "Đã tự sửa liên kết nguồn tiền hàng.",
      (prev) => {
        const issues = prev.healthIssues.length ? prev.healthIssues : runHealthChecks(prev, buildFinancialIndex(prev));
        const issue = issues.find((item) => item.fingerprint === fingerprint);
        if (!issue?.canAutoFix) return prev;
        const fixed = cleanBrokenFinancialLinks(prev);
        return {
          ...fixed,
          healthIssues: runHealthChecks(fixed, buildFinancialIndex(fixed)),
        };
      },
      { action: "update", entityType: "health", entityId: fingerprint }
    );
  };

  const createAllocationPlan = (amount: number, strategyId: string) => {
    commitWithUndo(
      "Đã tạo kế hoạch phân bổ tiền.",
      (prev) => {
        const issues = runHealthChecks(prev, buildFinancialIndex(prev));
        if (issues.some((issue) => issue.status === "open" && issue.severity === "critical")) {
          return { ...prev, healthIssues: issues };
        }
        const plan = buildAllocationPlanFromStrategy(prev, amount, strategyId);
        return {
          ...prev,
          allocationPlans: [plan, ...prev.allocationPlans],
          healthIssues: issues,
        };
      },
      { action: "create", entityType: "allocation-plan" }
    );
  };

  const cancelAllocationPlan = (planId: string) => {
    commitWithUndo(
      "Đã hủy kế hoạch phân bổ tiền.",
      (prev) => ({
        ...prev,
        allocationPlans: prev.allocationPlans.map((plan) => (plan.id === planId ? { ...plan, status: "cancelled" } : plan)),
      }),
      { action: "update", entityType: "allocation-plan", entityId: planId }
    );
  };

  const openAllocationPlanItem = (planId: string, itemId: string) => {
    const plan = stateRef.current.allocationPlans.find((item) => item.id === planId);
    if (!plan) return;
    const item = plan.items.find((row) => row.id === itemId);
    if (!item) return;
    const intentByAction: Partial<Record<AllocationPlan["items"][number]["actionType"], { tab: InvestmentTab; action: InvestmentActionKind }>> = {
      buy_usdt: { tab: "crypto", action: "btc-topup" },
      buy_stock: { tab: "stock", action: "stock-purchase" },
      create_mbb_book: { tab: "mbb", action: "mbb-deposit" },
    };
    const intent = intentByAction[item.actionType];
    if (!intent) return;
    setPage("investment");
    setAssetTab(intent.tab);
    setInvestmentAction({
      id: uid(),
      tab: intent.tab,
      action: intent.action,
      planLink: { allocationPlanId: planId, planItemId: itemId },
      amountVnd: item.amountVnd,
      targetFund: item.targetFund ?? "saving",
    });
  };

  const unlockAdminAccount = async (password: string): Promise<AdminActionResult> => {
    const expectedHash = await loadAdminPasswordHash(DEFAULT_ADMIN_PASSWORD_HASH);
    const passwordHash = await sha256Hex(password);
    if (passwordHash !== expectedHash) {
      return { ok: false, status: "Mật khẩu admin chưa đúng." };
    }
    return { ok: true, status: "Sẵn sàng quản lý tài khoản PIN." };
  };

  const createAdminAccount = async (alias: string, pin: string): Promise<AdminActionResult> => {
    const accountKey = cloudAccountKeyForPin(pin);
    const existing = await loadCloudState<AppState>(accountKey);
    if (existing) {
      return { ok: false, status: "PIN này đã có tài khoản. Hãy chọn PIN khác hoặc đổi PIN." };
    }

    await saveCloudStateQueued(accountKey, stateForAccountPin(initialState, pin));
    await upsertAdminAccountProfile({
      accountId: await cloudAccountIdForKey(accountKey),
      alias,
      pin,
    });
    return { ok: true, status: "Đã tạo tài khoản mới. Bạn có thể quay lại app và đăng nhập bằng PIN này." };
  };

  const changeAdminAccountPin = async (account: AdminAccountProfile, replacementPin: string): Promise<AdminActionResult> => {
    const oldKey = cloudAccountKeyForPin(account.pin);
    const oldState = await loadCloudState<AppState>(oldKey);
    if (!oldState) {
      return { ok: false, status: "Không tìm thấy tài khoản với PIN hiện tại." };
    }

    const nextKey = cloudAccountKeyForPin(replacementPin);
    const existingNext = await loadCloudState<AppState>(nextKey);
    if (existingNext) {
      return { ok: false, status: "PIN mới đã có tài khoản khác. Hãy chọn PIN khác." };
    }

    const nextState = normalizeStateWithMigrationSafety({
      ...initialState,
      ...oldState,
      settings: { ...initialState.settings, ...oldState.settings, hasPin: true, pin: replacementPin },
    });
    await saveCloudStateQueued(nextKey, nextState);
    await deleteCloudState(oldKey);
    await deleteAdminAccountProfile(account.accountId);
    await upsertAdminAccountProfile({
      accountId: await cloudAccountIdForKey(nextKey),
      alias: account.alias,
      pin: replacementPin,
    });
    return { ok: true, status: "Đã đổi PIN. Từ giờ hãy đăng nhập bằng PIN mới." };
  };

  const deleteAdminAccount = async (account: AdminAccountProfile): Promise<AdminActionResult> => {
    await deleteCloudState(cloudAccountKeyForPin(account.pin));
    await deleteAdminAccountProfile(account.accountId);
    return { ok: true, status: `Đã xóa tài khoản ${account.alias}.` };
  };

  const unlockWithPin = async (pin: string) => {
    if (!cloudConfigured) {
      if (!state.settings.hasPin) {
        setState((prev) => ({ ...prev, settings: { ...prev.settings, pin, hasPin: true } }));
        setActivePin(pin);
        setUnlocked(true);
        return null;
      }
      if (pin !== state.settings.pin) return "PIN chưa dúng.";
      setActivePin(pin);
      setUnlocked(true);
      return null;
    }

    try {
      setCloudStatus("Đang mở tài khoản...");
      const accountKey = cloudAccountKeyForPin(pin);
      const cloudSnapshot = await loadCloudSnapshot<AppState>(accountKey);
      if (!cloudSnapshot) return "Tài khoản chưa tồn tại. Vào /admin để tạo PIN.";
      const cloudNeedsMigration = Number(cloudSnapshot.state.schemaVersion ?? 1) < FINANCIAL_SCHEMA_VERSION;

      const nextState = normalizeStateWithMigrationSafety({
        ...initialState,
        ...cloudSnapshot.state,
        settings: { ...initialState.settings, ...cloudSnapshot.state.settings, hasPin: true, pin },
      });
      setState(nextState);
      stateRef.current = nextState;
      setActivePin(pin);
      if (cloudNeedsMigration) {
        const syncedAt = await saveCloudStateQueued(accountKey, stateForAccountPin(nextState, pin));
        markCloudSnapshotSynced(nextState, syncedAt, pin);
      } else {
        markCloudSnapshotSynced(nextState, cloudSnapshot.updatedAt, pin);
      }
      cloudLoaded.current = true;
      setCloudStatus("Đã mở dữ liệu cloud.");
      setUnlocked(true);
      return null;
    } catch {
      cloudLoaded.current = false;
      setCloudStatus("Không mở được dữ liệu cloud.");
      return "Không mở được tài khoản. Kiểm tra PIN, Supabase hoặc mạng.";
    }
  };

  const changePin = async (pin: string) => {
    if (!activePin) return;
    const previousKey = cloudAccountKeyForPin(activePin);
    const nextKey = cloudAccountKeyForPin(pin);
    const nextState = stateForAccountPin(state, pin);
    const previousAccountId = cloudConfigured ? await cloudAccountIdForKey(previousKey) : "";
    setCloudStatus("Đang đổi PIN...");
    setState(nextState);
    stateRef.current = nextState;
    setActivePin(pin);
    lastCloudSnapshot.current = JSON.stringify(nextState);
    cloudLoaded.current = true;

    if (!cloudConfigured) {
      setCloudStatus("Đã đổi PIN trên thiết bị này.");
      return;
    }

    try {
      const syncedAt = await saveCloudStateQueued(nextKey, nextState);
      if (previousKey !== nextKey) {
        const nextAccountId = await cloudAccountIdForKey(nextKey);
        const profile = (await listAdminAccounts()).find((account) => account.accountId === previousAccountId);
        await upsertAdminAccountProfile({
          accountId: nextAccountId,
          alias: profile?.alias ?? "Tài khoản",
          pin,
        });
        await deleteAdminAccountProfile(previousAccountId);
        await deleteCloudState(previousKey);
      }
      markCloudSnapshotSynced(nextState, syncedAt, pin);
      setCloudStatus("Đã đổi PIN và đồng bộ cloud.");
    } catch {
      setCloudStatus("Không đổi được PIN cloud. Vào /admin để đổi PIN lại.");
    }
  };

  const syncCloudNow = async () => {
    if (!cloudConfigured) {
      setCloudStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!cloudAccountKey) {
      setCloudStatus("Hãy mở app bằng mã PIN trước.");
      return;
    }
    try {
      setCloudStatus("Đang đồng bộ...");
      const nextSnapshot = stateForCloud();
      const syncedAt = await saveCloudStateQueued(cloudAccountKey, nextSnapshot);
      markCloudSnapshotSynced(nextSnapshot, syncedAt);
      cloudLoaded.current = true;
      setCloudStatus(`Đã đồng bộ ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch {
      setCloudStatus("Không lưu được dữ liệu cloud.");
    }
  };

  const refreshMarket = async (silent = false) => {
    if (!silent) setMarketStatus("Đang cập nhật giá BTC/SOL...");
    try {
      const market = await fetchMarket(marketRef.current);
      setState((prev) => ({ ...prev, market }));
      const time = new Date(market.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setMarketStatus(silent ? `Tự động cập nhật BTC/SOL lúc ${time}.` : `Đã cập nhật giá BTC/SOL lúc ${time}.`);
      return true;
    } catch {
      if (!silent) setMarketStatus("Không cập nhật được giá BTC/SOL.");
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadMarket(silent = true) {
      try {
        const market = await fetchMarket(marketRef.current);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            market,
          }));
          const time = new Date(market.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          setMarketStatus(silent ? `Tự động cập nhật BTC/SOL lúc ${time}.` : `Đã cập nhật giá BTC/SOL lúc ${time}.`);
        }
      } catch {
        // Keep the latest saved price when the network or API is unavailable.
      }
    }
    loadMarket();
    const timer = window.setInterval(loadMarket, MARKET_PRICE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    if (!unlocked || !cloudConfigured || !cloudAccountKey) {
      setBtcCloudAccountId("");
      return () => undefined;
    }

    async function loadBtcLedger() {
      try {
        const accountId = await cloudAccountIdForKey(cloudAccountKey);
        if (cancelled) return;
        setBtcCloudAccountId(accountId);
        await mergeBtcCloudLedger(accountId);
        if (!cancelled) setDataStatus(await loadDataStatus(accountId));
      } catch {
        // BTC stays available from local cache if the cloud ledger cannot be reache?.
      }
    }

    void loadBtcLedger();
    timer = window.setInterval(loadBtcLedger, MARKET_PRICE_REFRESH_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [unlocked, cloudConfigured, cloudAccountKey]);

  useEffect(() => {
    if (!unlocked || !cloudConfigured || !cloudAccountKey || !activePin) return;

    const refreshCloud = () => {
      if (document.visibilityState === "hidden") return;
      void pullCloudState(false);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCloud();
    };

    refreshCloud();
    const timer = window.setInterval(refreshCloud, 30_000);
    window.addEventListener("focus", refreshCloud);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshCloud);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [unlocked, cloudConfigured, cloudAccountKey, activePin]);

  useEffect(() => {
    if (!unlocked || !autoStockSymbols) return;
    const symbols = autoStockSymbols.split("|").filter(Boolean);
    const refreshStocks = () => {
      if (document.visibilityState === "hidden" || !isVietnamStockTradingSession()) return;
      void refreshStockMarketPrices(symbols, setState);
    };
    refreshStocks();
    const timer = window.setInterval(refreshStocks, MARKET_PRICE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [unlocked, autoStockSymbols]);

  useEffect(() => {
    if (!cloudConfigured || !cloudAccountKey || !cloudLoaded?.current) return;

    const nextSnapshot = stateForCloud();
    const snapshot = JSON.stringify(nextSnapshot);
    if (snapshot === lastCloudSnapshot.current) return;

    setCloudStatus("Đang đồng bộ...");
    const timer = window.setTimeout(async () => {
      try {
        if (await pullCloudState(false)) return;
        const latestSnapshot = activePin ? stateForAccountPin(stateRef.current, activePin) : stateRef.current;
        const latestSnapshotJson = JSON.stringify(latestSnapshot);
        if (latestSnapshotJson === lastCloudSnapshot.current) return;
        const syncedAt = await saveCloudStateQueued(cloudAccountKey, latestSnapshot);
        lastCloudSnapshot.current = latestSnapshotJson;
        lastCloudUpdatedAt.current = syncedAt;
        setLastCloudSyncAt(syncedAt);
        setCloudStatus(`Đã đồng bộ ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
      } catch {
        setCloudStatus("Không lưu được dữ liệu cloud.");
      }
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [cloudConfigured, cloudAccountKey, state]);

  if (window.location.pathname === "/admin") {
    return (
      <AdminPage
        cloudConfigured={cloudConfigured}
        onUnlockAdmin={unlockAdminAccount}
        onListAccounts={listAdminAccounts}
        onCreateAccount={createAdminAccount}
        onChangeAccountPin={changeAdminAccountPin}
        onDeleteAccount={deleteAdminAccount}
      />
    );
  }

  if (!unlocked) return <PinGate hasPin={state.settings.hasPin} cloudConfigured={cloudConfigured} onUnlock={unlockWithPin} />;

  return (
    <div className="app-shell">
      <AppNav page={page} setPage={navigateToPage} />
      <main className="content">
        {page === "dashboard" && <UnifiedDashboardPage state={state} setState={setState} commitWithUndo={commitWithUndo} month={month} setMonth={setMonth} setPage={navigateToPage} setAssetTab={setAssetTab} setInvestmentAction={setInvestmentAction} onRefreshMarket={refreshMarket} />}
        {page === "accumulation" && <AccumulationPage state={state} setState={setState} commitWithUndo={commitWithUndo} onOpenMbbDeposits={openAccumulationMbbDeposits} />}
        {page === "investment" && <InvestmentPage state={state} setState={setState} commitWithUndo={commitWithUndo} activeTab={assetTab} setActiveTab={setAssetTab} mbbDepositIntent={mbbDepositIntent} onMbbDepositIntentHandled={() => setMbbDepositIntent(null)} investmentAction={investmentAction} onInvestmentActionHandled={() => setInvestmentAction(null)} onRefreshMarket={refreshMarket} marketStatus={marketStatus} btcCloudAccountId={btcCloudAccountId} />}
        {page === "reports" && <ReportsPage state={state} setState={setState} onRefreshMarket={refreshMarket} onOpenAccumulation={() => navigateToPage("accumulation")} onOpenInvestment={(target) => {
          setAssetTab(target.tab);
          if (target.depositFund) {
            setMbbDepositIntent({ id: uid(), fund: target.depositFund, accumulationGoalId: "all" });
          }
          navigateToPage("investment");
        }} />}
        {page === "settings" && (
          <SettingsPage
            state={state}
            setState={setState}
            cloudSync={{
              configured: cloudConfigured,
              status: cloudStatus || (lastCloudSyncAt ? `Đã sync lúc ${formatDateTime(lastCloudSyncAt)}` : "Chưa đồng bộ."),
              activePin,
              onSyncNow: () => void syncCloudNow(),
              onPullFromCloud: () => void pullCloudState(true),
              onVerifyAdminPassword: unlockAdminAccount,
              onChangePin: (pin) => changePin(pin),
            }}
            dataTools={{
              onExportBackup: exportBackupJson,
              onExportCsv: exportCsv,
              onRestoreBackup: restoreBackupFile,
              onRestoreTrash: restoreTrashItem,
              onPermanentDeleteTrash: permanentlyDeleteTrashItem,
            }}
          />
        )}
      </main>
      <QuickActionButton state={state} setState={setState} commitWithUndo={commitWithUndo} undoStack={undoStack} onUndoToEntry={undoToEntry} btcCloudAccountId={btcCloudAccountId} />
          {visibleUndoId && undoStack.some((entry) => entry.id === visibleUndoId) && (
        <div className="undo-toast" role="status">
          <span>{undoStack.find((entry) => entry.id === visibleUndoId)?.label}</span>
          <button type="button" onClick={() => undoToEntry(visibleUndoId)}>Hoàn tác</button>
        </div>
      )}
    </div>
  );
}
