import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownCircle,
  BadgeDollarSign,
  BarChart3,
  Bitcoin,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Coins,
  History,
  Pencil,
  Landmark,
  LayoutDashboard,
  LineChart,
  Lock,
  PiggyBank,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Upload,
  X,
} from "lucide-react";
import {
  DataStatus,
  cloudAccountIdForKey,
  deleteCloudState,
  deleteCloudPayloadRow,
  isCloudSyncConfigured,
  loadDataStatus,
  loadAdminPasswordHash,
  loadCloudPayloadRows,
  loadCloudState,
  saveCloudState,
  upsertCloudPayloadRow,
} from "./cloudSync";

type Page =
  | "dashboard"
  | "accumulation"
  | "investment"
  | "reports";

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
};

type ExpenseCategory = {
  id: string;
  name: string;
  kind: "fixed" | "variable";
  defaultAmount: number;
  accumulationGoalId?: string;
};

type MonthlyExpense = {
  id: string;
  categoryId: string;
  month: string;
  startAmount: number;
  endAmount: number;
  amount: number;
  checked: boolean;
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
};

type ExpenseEntry = {
  id: string;
  categoryId: string;
  month: string;
  amount: number;
  date: string;
  note: string;
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
  totalSavingAtConfirm?: number;
  savingDepositRequestedAt?: string;
  emergencyDepositRequestedAt?: string;
  savingDepositCreatedAt?: string;
  emergencyDepositCreatedAt?: string;
};

type FundKey = "btc" | "stock";
type InvestmentTab = FundKey | "mbb" | "sol";
type SolDestination = FundKey | DepositFund | "cash";
type ReportChartKey = "current-assets" | "net-accumulation" | FundKey | DepositFund;

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
};

type StockSale = {
  id: string;
  symbol: string;
  shares: number;
  sellPrice: number;
  vndAmount: number;
  destination: SolDestination;
  date: string;
  note: string;
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
};

type FundTransaction = {
  id: string;
  fund: FundKey;
  type: "deposit" | "withdraw";
  amount: number;
  date: string;
  month: string;
  note: string;
};

type DepositFund = "saving" | "emergency";
type DepositFilter = "all" | DepositFund;
type DepositStatus =
  | "active"
  | "rolled-principal"
  | "rolled-all"
  | "settled"
  | "early-settled";

type BankDeposit = {
  id: string;
  code: string;
  fund: DepositFund;
  mbLast4: string;
  principal: number;
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
};

type AllocationAmounts = {
  btc: number;
  stock: number;
  saving: number;
  emergency: number;
  savingRemainder: number;
  emergencyRemainder: number;
};

type AllocationPercentKey = "btcPercent" | "stockPercent" | "savingPercent" | "emergencyPercent";
type AllocationAmountKey = "btcAmount" | "stockAmount" | "savingAmount" | "emergencyAmount";

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
  date: string;
  note: string;
};

type SolWithdrawTransaction = {
  id: string;
  type: "withdraw";
  solAmount: number;
  sellPrice: number;
  vndAmount: number;
  destination: SolDestination;
  date: string;
  note: string;
};

type SolTransaction = SolBuyTransaction | SolWithdrawTransaction;

type BtcUsdtTopup = {
  id: string;
  vndAmount: number;
  usdtAmount: number;
  date: string;
  note: string;
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
};

type BtcTradeType = "dca" | "manual-buy";

type BtcTrade = {
  id: string;
  type: BtcTradeType;
  usdtAmount: number;
  btcAmount: number;
  btcPriceUsdt: number;
  executedAt: string;
  planId?: string;
  note: string;
};

type BtcTransferDestination = "stock" | DepositFund | "cash";
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
  note: string;
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
  dismissedStockAllocationIds: string[];
};

type AppState = {
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
};

const STORAGE_KEY = "quan-li-chi-tieu-state-v3-account-pin-reset";
const CLOUD_ACCOUNT_NAMESPACE = "quan-li-chi-tieu-account-pin-reset-v1";
const DEFAULT_ADMIN_PASSWORD_HASH = "83e9887aca4b4c1d7b8688d6392c5f20c77a1dc405c3d5406918c46c68da6063";
const DEFAULT_START_MONTH = "2026-06";
const CERTIFICATE_LOT = 100_000;
const STOCK_PRICE_UNIT = 1_000;
const STOCK_LOT = 100;
const MARKET_PRICE_REFRESH_MS = 60 * 1000;
const COLORS = ["#f97316", "#14b8a6", "#eab308", "#60a5fa", "#f43f5e", "#a78bfa"];

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

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
  return date.toISOString().slice(0, 10);
};

const daysUntil = (dateValue: string) => {
  const now = new Date(`${today()}T00:00:00`).getTime();
  const target = new Date(`${dateValue}T00:00:00`).getTime();
  return Math.ceil((target - now) / 86_400_000);
};

const dateOnlyTime = (dateValue: string) => new Date(`${dateValue}T00:00:00`).getTime();

const daysBetween = (startDate: string, endDate: string) =>
  Math.max(Math.ceil((dateOnlyTime(endDate) - dateOnlyTime(startDate)) / 86_400_000), 0);

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

const formatVnd = (value: number) =>
  `${Math.round(value).toLocaleString("vi-VN")}đ`;

const formatUsd = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} USDT`;

const formatUsdt = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} USDT`;

const formatBtc = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 7 })} BTC`;

const formatStockPrice = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const formatMoneyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};

const formatDecimalInput = (value: string) => {
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (!cleaned) return "";
  const decimalSeparator = (() => {
    const comma = cleaned.lastIndexOf(",");
    if (comma >= 0) return comma;
    const dot = cleaned.lastIndexOf(".");
    if (dot < 0) return -1;
    const parts = cleaned.split(".");
    const looksLikeThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    return looksLikeThousands ? -1 : dot;
  })();
  const integerRaw = decimalSeparator >= 0 ? cleaned.slice(0, decimalSeparator) : cleaned;
  const decimalRaw = decimalSeparator >= 0 ? cleaned.slice(decimalSeparator + 1) : "";
  const integerDigits = integerRaw.replace(/[^\d]/g, "");
  const integerPart = integerDigits ? Number(integerDigits).toLocaleString("vi-VN") : "";
  if (decimalSeparator >= 0) return `${integerPart || "0"},${decimalRaw.replace(/[^\d]/g, "")}`;
  return integerPart;
};

const parseMoney = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;
const parseDecimal = (value: string) => {
  const cleaned = value.trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  if (lastComma >= 0) {
    const integerPart = cleaned.slice(0, lastComma).replace(/[.,]/g, "");
    const decimalPart = cleaned.slice(lastComma + 1).replace(/[.,]/g, "");
    return Number(`${integerPart || "0"}.${decimalPart}`) || 0;
  }
  const parts = cleaned.split(".");
  if (parts.length > 1 && parts.slice(1).every((part) => part.length === 3)) {
    return Number(parts.join("")) || 0;
  }
  const decimalIndex = cleaned.lastIndexOf(".");
  if (decimalIndex === -1) return Number(cleaned) || 0;
  const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
  const decimalPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "");
  return Number(`${integerPart || "0"}.${decimalPart}`) || 0;
};
const cloudAccountKeyForPin = (pin: string) => `${CLOUD_ACCOUNT_NAMESPACE}:${pin}`;
const stateForAccountPin = (state: AppState, pin: string): AppState => ({
  ...state,
  settings: { ...state.settings, hasPin: true, pin },
});
const sha256Hex = async (value: string) => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const interestFor = (deposit: Pick<BankDeposit, "principal" | "rate" | "termMonths">) =>
  Math.round((deposit.principal * deposit.rate * deposit.termMonths) / 100 / 12);

function depositProgress(deposit: BankDeposit) {
  const totalDays = daysBetween(deposit.startDate, deposit.maturityDate);
  const remainingDays = deposit.status === "active" ? Math.max(daysUntil(deposit.maturityDate), 0) : 0;
  const elapsedDays = totalDays - remainingDays;
  const progressPercent = totalDays > 0 ? Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100) : 100;
  const finalInterest = interestFor(deposit);
  return {
    totalDays,
    remainingDays,
    progressPercent,
    accruedInterest: Math.round((finalInterest * progressPercent) / 100),
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
    stock: "CK",
    saving: "Tiết kiệm",
    emergency: "Dự phòng",
    cash: "Tiền mặt",
  };
  return labels[destination];
};

function solPosition(transactions: SolTransaction[]) {
  return transactions.reduce(
    (position, transaction) => {
      if (isSolWithdrawal(transaction)) {
        const currentAverageCost = position.balance > 0 ? position.cost / position.balance : 0;
        const withdrawnSol = Math.min(transaction.solAmount, position.balance);
        return {
          balance: Math.max(position.balance - transaction.solAmount, 0),
          cost: Math.max(position.cost - withdrawnSol * currentAverageCost, 0),
        };
      }

      return {
        balance: position.balance + transaction.solAmount,
        cost: position.cost + transaction.solAmount * transaction.buyPrice,
      };
    },
    { balance: 0, cost: 0 }
  );
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
  return { topups, dcaPlans: dcaPlans.map(normalizeDcaPlan), trades, transfers };
}

function mergeById<T extends { id: string }>(local: T[], remote: T[]) {
  const rows = new Map(local.map((item) => [item.id, item]));
  remote.forEach((item) => rows.set(item.id, item));
  return [...rows.values()];
}

function btcPosition(trades: BtcTrade[], transfers: BtcTransfer[], plans: BtcDcaPlan[] = []) {
  let balance = 0;
  let costUsdt = 0;
  const dcaTradesByPlan = new Map<string, BtcTrade[]>();

  trades.forEach((trade) => {
    if (trade.type === "dca" && trade.planId) {
      dcaTradesByPlan.set(trade.planId, [...(dcaTradesByPlan.get(trade.planId) ?? []), trade]);
      return;
    }
    balance += trade.btcAmount;
    costUsdt += trade.usdtAmount;
  });

  plans.forEach((plan) => {
    const planTrades = dcaTradesByPlan.get(plan.id) ?? [];
    const investedUsdt = planTrades.reduce((sum, trade) => sum + trade.usdtAmount, 0);
    const tradeBtcAmount = planTrades.reduce((sum, trade) => sum + trade.btcAmount, 0);
    const tradeAveragePriceUsdt = tradeBtcAmount ? investedUsdt / tradeBtcAmount : 0;
    const btcAmount = plan.btcAmountOverride && plan.btcAmountOverride > 0 ? plan.btcAmountOverride : tradeBtcAmount;
    const averagePriceUsdt =
      plan.averagePriceUsdtOverride && plan.averagePriceUsdtOverride > 0 ? plan.averagePriceUsdtOverride : tradeAveragePriceUsdt;
    if (!btcAmount) return;
    balance += btcAmount;
    costUsdt += averagePriceUsdt ? btcAmount * averagePriceUsdt : investedUsdt;
  });

  transfers.forEach((transfer) => {
    if (transfer.asset !== "btc") return;
    const averageCost = balance > 0 ? costUsdt / balance : 0;
    const movedBtc = Math.min(transfer.btcAmount, balance);
    balance = Math.max(balance - transfer.btcAmount, 0);
    costUsdt = Math.max(costUsdt - movedBtc * averageCost, 0);
  });

  return { balance, costUsdt };
}

function btcPortfolioStats(state: AppState, upToMonth?: string) {
  const fundCapital = state.fundTransactions
    .filter((item) => item.fund === "btc" && (!upToMonth || item.month <= upToMonth))
    .reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);
  const topups = state.btcUsdtTopups.filter((item) => !upToMonth || monthFromDate(item.date) <= upToMonth);
  const trades = state.btcTrades.filter((item) => !upToMonth || monthFromDate(item.executedAt.slice(0, 10)) <= upToMonth);
  const transfers = state.btcTransfers.filter((item) => !upToMonth || monthFromDate(item.date) <= upToMonth);
  const plans = state.btcDcaPlans.filter((item) => !upToMonth || monthFromDate(item.startDate) <= upToMonth);
  const topupVnd = topups.reduce((sum, item) => sum + item.vndAmount, 0);
  const topupUsdt = topups.reduce((sum, item) => sum + item.usdtAmount, 0);
  const spentUsdt = trades.reduce((sum, item) => sum + item.usdtAmount, 0);
  const transferredUsdt = transfers.reduce((sum, item) => sum + (item.asset === "usdt" ? item.usdtAmount : 0), 0);
  const convertedToUsdt = transfers.reduce((sum, item) => sum + (item.asset === "btc" && item.destination === "usdt" ? item.usdtAmount : 0), 0);
  const usdtBalance = Math.max(topupUsdt + convertedToUsdt - spentUsdt - transferredUsdt, 0);
  const position = btcPosition(trades, transfers, plans);
  const btcValueUsdt = position.balance * state.market.btcUsdt;
  const totalValueUsdt = usdtBalance + btcValueUsdt;
  const usdtVndRate = state.market.usdtVnd || state.market.usdVnd;
  const totalValueVnd = totalValueUsdt * usdtVndRate;
  const reportValueVnd = totalValueVnd + Math.max(fundCapital - topupVnd, 0);
  const investedValueVnd = topupVnd;
  const pnl = totalValueVnd - investedValueVnd;
  const pnlUsdt = usdtVndRate ? pnl / usdtVndRate : 0;

  return {
    capitalVnd: fundCapital,
    pendingVnd: Math.max(fundCapital - topupVnd, 0),
    topupVnd,
    topupUsdt,
    investedValueVnd,
    usdtBalance,
    btcBalance: position.balance,
    btcCostUsdt: position.costUsdt,
    btcValueUsdt,
    totalValueUsdt,
    totalValueVnd,
    reportValueVnd,
    averageCostUsdt: position.balance ? position.costUsdt / position.balance : 0,
    pnlUsdt,
    pnlVnd: pnl,
    pnlPercent: investedValueVnd ? (pnl / investedValueVnd) * 100 : 0,
  };
}

const stockLineValue = (line: Pick<StockPurchaseLine, "shares" | "buyPrice">) =>
  Math.round(line.shares * line.buyPrice * STOCK_PRICE_UNIT);

function normalizeStockPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1_000 ? value / STOCK_PRICE_UNIT : value;
}

function stockPriceFromPayload(payload: unknown) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown[] })?.data)
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

async function fetchSolMarket(fallback: Market) {
  const [solResponse, rateResponse] = await Promise.all([
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" }),
    fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }),
  ]);
  const solJson = await solResponse.json();
  const rateJson = await rateResponse.json();
  const solUsd = Number(solJson?.solana?.usd) || fallback.solUsd;
  const usdVnd = Number(rateJson?.rates?.VND) || fallback.usdVnd;
  if (!solUsd || !usdVnd) throw new Error("Không lấy được giá SOL");
  return { solUsd, usdVnd, updatedAt: new Date().toISOString() };
}

function stockMarketPrice(state: AppState, symbol: string) {
  return state.stockMarketPrices.find((item) => item.symbol === symbol.toUpperCase());
}

async function fetchMarket(fallback: Market) {
  const [cryptoResponse, btcResponse, rateResponse] = await Promise.allSettled([
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana,tether&vs_currencies=usd,vnd", { cache: "no-store" }),
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { cache: "no-store" }),
    fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }),
  ]);
  const cryptoJson = cryptoResponse.status === "fulfilled" && cryptoResponse.value.ok ? await cryptoResponse.value.json() : null;
  const btcJson = btcResponse.status === "fulfilled" && btcResponse.value.ok ? await btcResponse.value.json() : null;
  const rateJson = rateResponse.status === "fulfilled" && rateResponse.value.ok ? await rateResponse.value.json() : null;
  const solUsd = Number(cryptoJson?.solana?.usd) || fallback.solUsd;
  const btcUsdt = Number(btcJson?.price) || fallback.btcUsdt;
  const usdtVnd = Number(cryptoJson?.tether?.vnd) || fallback.usdtVnd || Number(rateJson?.rates?.VND) || fallback.usdVnd;
  const usdVnd = Number(rateJson?.rates?.VND) || fallback.usdVnd || usdtVnd;
  if (!solUsd && !btcUsdt && !usdtVnd && !usdVnd) throw new Error("Khong lay duoc gia thi truong");
  const isFallback = !cryptoJson?.solana?.usd || !btcJson?.price || !cryptoJson?.tether?.vnd || !rateJson?.rates?.VND;
  return {
    solUsd,
    btcUsdt,
    usdtVnd,
    usdVnd,
    updatedAt: new Date().toISOString(),
    btcSource: btcJson?.price ? "Binance" : fallback.btcSource ?? "Fallback",
    solSource: cryptoJson?.solana?.usd ? "CoinGecko" : fallback.solSource ?? "Fallback",
    usdtSource: cryptoJson?.tether?.vnd ? "CoinGecko" : rateJson?.rates?.VND ? "ExchangeRate" : fallback.usdtSource ?? "Fallback",
    isFallback,
    lastError: isFallback ? "Một phần giá đang dùng dữ liệu lưu gần nhất." : "",
  };
}

function stockPortfolioStats(state: AppState, upToMonth?: string) {
  const fundCash = state.fundTransactions
    .filter((item) => item.fund === "stock" && (!upToMonth || item.month <= upToMonth))
    .reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);
  const purchases = state.stockPurchases.filter((purchase) => !upToMonth || purchase.month <= upToMonth);
  const sales = state.stockSales.filter((sale) => !upToMonth || monthFromDate(sale.date) <= upToMonth);
  const invested = purchases.reduce((sum, purchase) => sum + purchase.lines.reduce((lineSum, line) => lineSum + stockLineValue(line), 0), 0);
  const soldToCashBalance = sales
    .filter((sale) => sale.destination === "stock")
    .reduce((sum, sale) => sum + sale.vndAmount, 0);
  const holdings = new Map<string, { symbol: string; shares: number; cost: number; lastBuyPrice: number }>();

  purchases.forEach((purchase) => {
    purchase.lines.forEach((line) => {
      const symbol = line.symbol.toUpperCase();
      const existing = holdings.get(symbol) ?? { symbol, shares: 0, cost: 0, lastBuyPrice: line.buyPrice };
      existing.shares += line.shares;
      existing.cost += stockLineValue(line);
      existing.lastBuyPrice = line.buyPrice;
      holdings.set(symbol, existing);
    });
  });

  sales.forEach((sale) => {
    const symbol = sale.symbol.toUpperCase();
    const existing = holdings.get(symbol);
    if (!existing) return;
    const soldShares = Math.min(sale.shares, existing.shares);
    const averageCost = existing.shares ? existing.cost / existing.shares : 0;
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
      const marketPrice = market?.price || averageCost || item.lastBuyPrice;
      const marketValue = stockLineValue({ shares: item.shares, buyPrice: marketPrice });
      const pnl = marketValue - item.cost;
      return {
        ...item,
        averageCost,
        marketPrice,
        marketValue,
        pnl,
        pnlPercent: item.cost ? (pnl / item.cost) * 100 : 0,
        updatedAt: market?.updatedAt ?? "",
        source: market?.source ?? "fallback",
        hasMarketPrice: Boolean(market),
      };
    });
  const stockValue = rows.reduce((sum, item) => sum + item.marketValue, 0);
  const totalCost = rows.reduce((sum, item) => sum + item.cost, 0);
  const pnl = stockValue - totalCost;
  const cash = Math.max(fundCash - invested + soldToCashBalance, 0);

  return {
    fundCash,
    cash,
    invested,
    stockValue,
    totalValue: cash + stockValue,
    totalCost,
    pnl,
    pnlPercent: totalCost ? (pnl / totalCost) * 100 : 0,
    holdings: rows,
  };
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

function pendingSolDepositTotal(state: AppState, fund: DepositFund) {
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

function pendingStockSaleDepositTotal(state: AppState, fund: DepositFund) {
  return state.stockSales
    .filter(
      (sale) =>
        sale.destination === fund &&
        !state.bankDeposits.some((deposit) => deposit.note.includes(stockSaleDepositMarker(sale.id)))
    )
    .reduce((sum, sale) => sum + sale.vndAmount, 0);
}

function pendingBtcTransferDepositTotal(state: AppState, fund: DepositFund) {
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
  const preservedIds = new Set(preservedUnpaid.map((item) => item.id));
  const preservedMonths = new Set(preservedUnpaid.map((item) => item.month));
  const other = state.monthlyExpenses.filter((item) => item.categoryId !== goal.categoryId);
  const progress = checked.reduce((sum, item) => sum + item.amount, 0);
  const preservedTotal = preservedUnpaid.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(goal.targetAmount - progress - preservedTotal, 0);
  if (goal.status !== "active" || remaining <= 0) return [...other, ...checked, ...preservedUnpaid];
  const blockedMonths = new Set([...checked.map((item) => item.month), ...preservedMonths]);
  const remainingMonths = Math.max(goal.months - checked.length - preservedUnpaid.length, 0);
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
  if (record.checked) return true;
  if (goal.status === "deleted") return false;
  if (goal.status === "ended") return goal.endedAt ? month <= monthFromDate(goal.endedAt) : false;
  return accumulationProgress(state, goal) < goal.targetAmount;
}

function normalizeState(state: AppState): AppState {
  const expenseCategories = state.expenseCategories.map((category: ExpenseCategory & { kind?: string }) => {
    const migratedKind: ExpenseCategory["kind"] = category.kind === "variable" ? "variable" : "fixed";
    if (category.id === "chi-tieu") {
      return { ...category, kind: "fixed" as const, defaultAmount: category.defaultAmount || 3_000_000 };
    }
    if (category.id === "phat-sinh") {
      return { ...category, kind: "variable" as const, defaultAmount: 0 };
    }
    return { ...category, kind: migratedKind, defaultAmount: category.defaultAmount ?? 0 };
  });

  const bankDeposits = state.bankDeposits.map((deposit) => ({
    ...deposit,
    mbLast4: deposit.mbLast4 ?? "",
  }));

  const solTransactions = state.solTransactions.map((transaction) =>
    isSolWithdrawal(transaction)
      ? {
          ...transaction,
          sellPrice: transaction.sellPrice ?? state.market.solUsd ?? 0,
          vndAmount: transaction.vndAmount ?? 0,
          destination: transaction.destination ?? "cash",
        }
      : {
          ...transaction,
          type: "buy" as const,
        }
  );

  return {
    ...state,
    settings: {
      ...state.settings,
      dismissedStockAllocationIds: state.settings?.dismissedStockAllocationIds ?? [],
    },
    expenseCategories,
    bankDeposits,
    solTransactions,
    accumulationGoals: state.accumulationGoals ?? [],
    stockPurchases: state.stockPurchases ?? [],
    stockSales: state.stockSales ?? [],
    stockMarketPrices: state.stockMarketPrices ?? [],
    btcUsdtTopups: state.btcUsdtTopups ?? [],
    btcDcaPlans: (state.btcDcaPlans ?? []).map(normalizeDcaPlan),
    btcTrades: state.btcTrades ?? [],
    btcTransfers: state.btcTransfers ?? [],
    market: {
      ...state.market,
      btcUsdt: state.market?.btcUsdt ?? 0,
      usdtVnd: state.market?.usdtVnd ?? state.market?.usdVnd ?? 0,
      usdVnd: state.market?.usdVnd ?? state.market?.usdtVnd ?? 0,
    },
  };
}

function calculateAllocationAmounts(totalSaving: number, allocation: Allocation): AllocationAmounts {
  const total = Math.max(totalSaving, 0);
  const rawBtc = (total * allocation.btcPercent) / 100;
  const rawStock = (total * allocation.stockPercent) / 100;
  const rawSaving = (total * allocation.savingPercent) / 100;
  const rawEmergency = (total * allocation.emergencyPercent) / 100;
  const saving = roundDownToCertificateLot(rawSaving);
  const emergency = roundDownToCertificateLot(rawEmergency);
  const savingRemainder = rawSaving - saving;
  const emergencyRemainder = rawEmergency - emergency;

  return {
    btc: allocationAmountOrDefault(allocation.btcAmount, rawBtc + savingRemainder + emergencyRemainder),
    stock: allocationAmountOrDefault(allocation.stockAmount, rawStock),
    saving: allocationAmountOrDefault(allocation.savingAmount, saving),
    emergency: allocationAmountOrDefault(allocation.emergencyAmount, emergency),
    savingRemainder,
    emergencyRemainder,
  };
}

const initialState: AppState = {
  incomeCategories: [
    { id: "pt-valley", name: "PT Valley", kind: "fixed" },
    { id: "fishing", name: "Fishing", kind: "variable" },
    { id: "other-income", name: "Thu nhập khác", kind: "variable" },
  ],
  incomeTransactions: [],
  expenseCategories: [
    { id: "chi-tieu", name: "Chi tiêu", kind: "fixed", defaultAmount: 3000000 },
    { id: "phat-sinh", name: "Phát sinh", kind: "variable", defaultAmount: 0 },
    { id: "me", name: "Mẹ", kind: "fixed", defaultAmount: 3000000 },
    { id: "du-lich", name: "Du lịch", kind: "fixed", defaultAmount: 1500000 },
    { id: "hoc-phi", name: "Học phí", kind: "fixed", defaultAmount: 2000000 },
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
    dismissedStockAllocationIds: [],
  },
};

function useStoredState() {
  const [state, setState] = useState<AppState>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    try {
      return normalizeState({ ...initialState, ...JSON.parse(raw) });
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
    const base = category.kind === "fixed" && record.checked ? record.amount : 0;
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
  while (cursor.parentId && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const parent = deposits.find((item) => item.id === cursor.parentId);
    if (!parent) break;
    cursor = parent;
  }
  return cursor.principal;
}

function depositFundPnl(state: AppState, fund?: DepositFund) {
  const activeDeposits = state.bankDeposits.filter((item) => item.status === "active" && (!fund || item.fund === fund));
  const pending =
    fund
      ? pendingSolDepositTotal(state, fund) + pendingStockSaleDepositTotal(state, fund) + pendingBtcTransferDepositTotal(state, fund)
      : 0;
  const principal = activeDeposits.reduce((sum, item) => sum + originalDepositPrincipal(item, state.bankDeposits), 0) + pending;
  const current = activeDeposits.reduce((sum, item) => sum + item.principal, 0) + pending;
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

function assetPnlRows(state: AppState) {
  const btcStats = btcPortfolioStats(state);
  const stockStats = stockPortfolioStats(state);
  const sol = solPosition(state.solTransactions);
  const solPrincipal = sol.cost * state.market.usdVnd;
  const solCurrent = sol.balance * state.market.solUsd * state.market.usdVnd;
  const saving = depositFundPnl(state, "saving");
  const emergency = depositFundPnl(state, "emergency");
  const rows = [
    makeAssetPnlRow("btc", "BTC", btcStats.capitalVnd, btcStats.reportValueVnd),
    makeAssetPnlRow("stock", "CK", stockStats.fundCash, stockStats.totalValue),
    makeAssetPnlRow("sol", "SOL", solPrincipal, solCurrent),
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
  tone?: "warning" | "danger";
  page?: Page;
  tab?: InvestmentTab;
};

function dashboardTasks(state: AppState, month: string): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  const btcStats = btcPortfolioStats(state);
  const stockStats = stockPortfolioStats(state);
  const summary = monthlySummary(state, month);

  if (summary.saving > 0 && !summary.allocation.confirmedAt) {
    tasks.push({ id: "allocation", title: "Tháng này chưa chia quỹ", detail: `Có thể chia ${formatVnd(summary.saving)}`, action: "Chia quỹ", page: "dashboard" });
  }

  const pendingAllocationDeposits = state.allocations
    .filter((allocation) => allocation.confirmedAt)
    .flatMap((allocation) =>
      (["saving", "emergency"] as DepositFund[]).map((fund) => ({
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
    tasks.push({ id: "allocation-deposit-pending", title: "Sổ MBB chưa tạo từ chia quỹ", detail: formatVnd(pendingAllocationDepositTotal), action: "Tạo sổ", page: "investment", tab: "mbb" });
  }

  const pendingSolDeposits = pendingSolDepositTotal(state, "saving") + pendingSolDepositTotal(state, "emergency");
  if (pendingSolDeposits > 0) {
    tasks.push({ id: "sol-deposit-pending", title: "SOL chuyển về chưa tạo sổ", detail: formatVnd(pendingSolDeposits), action: "Tạo sổ", page: "investment", tab: "mbb" });
  }

  const pendingStockDeposits = pendingStockSaleDepositTotal(state, "saving") + pendingStockSaleDepositTotal(state, "emergency");
  if (pendingStockDeposits > 0) {
    tasks.push({ id: "stock-deposit-pending", title: "CK chuyển về chưa tạo sổ", detail: formatVnd(pendingStockDeposits), action: "Tạo sổ", page: "investment", tab: "mbb" });
  }

  const pendingBtcDeposits = pendingBtcTransferDepositTotal(state, "saving") + pendingBtcTransferDepositTotal(state, "emergency");
  if (pendingBtcDeposits > 0) {
    tasks.push({ id: "btc-deposit-pending", title: "BTC chuyển về chưa tạo sổ", detail: formatVnd(pendingBtcDeposits), action: "Tạo sổ", page: "investment", tab: "mbb" });
  }

  const dueDeposit = state.bankDeposits
    .filter((item) => item.status === "active")
    .map((item) => ({ ...item, dueDays: daysUntil(item.maturityDate) }))
    .filter((item) => item.dueDays <= 30)
    .sort((a, b) => a.dueDays - b.dueDays)[0];
  if (dueDeposit) {
    tasks.push({
      id: "deposit-due",
      title: dueDeposit.dueDays <= 0 ? "Sổ MBB đã đáo hạn" : "Sổ MBB sắp đáo hạn",
      detail: `${formatVnd(dueDeposit.principal)} · ${dueDeposit.dueDays <= 0 ? "cần xử lý" : `${dueDeposit.dueDays} ngày nữa`}`,
      action: "Xem sổ",
      tone: dueDeposit.dueDays <= 7 ? "warning" : undefined,
      page: "investment",
      tab: "mbb",
    });
  }

  if (btcStats.pendingVnd > 0) {
    tasks.push({ id: "btc-pending", title: "BTC đã chia quỹ chưa mua USDT", detail: `Còn ${formatVnd(btcStats.pendingVnd)} chờ đổi sang USDT`, action: "Mua USDT", page: "investment", tab: "btc" });
  }

  const pendingSolStockCash = pendingStockCashFromTransfer(state, "SOL", stockStats.cash);
  if (pendingSolStockCash > 0) {
    tasks.push({ id: "sol-stock-cash", title: "SOL chuyển về CK chưa mua cổ phiếu", detail: `Còn ${formatVnd(pendingSolStockCash)} trong số dư CK`, action: "Mua CK", page: "investment", tab: "stock" });
  }

  const pendingBtcStockCash = pendingStockCashFromTransfer(state, "BTC", stockStats.cash - pendingSolStockCash);
  if (pendingBtcStockCash > 0) {
    tasks.push({ id: "btc-stock-cash", title: "BTC chuyển về CK chưa mua cổ phiếu", detail: `Còn ${formatVnd(pendingBtcStockCash)} trong số dư CK`, action: "Mua CK", page: "investment", tab: "stock" });
  }

  const pendingAllocationStockCash = Math.max(stockStats.cash - pendingSolStockCash - pendingBtcStockCash, 0);
  if (pendingAllocationStockCash > 0) {
    tasks.push({ id: "stock-cash", title: "CK đã chia quỹ chưa mua cổ phiếu", detail: `Còn ${formatVnd(pendingAllocationStockCash)} trong số dư CK`, action: "Mua CK", page: "investment", tab: "stock" });
  }

  const activePlans = state.btcDcaPlans.filter((plan) => plan.isActive);
  const dailyNeed = activePlans.reduce((sum, plan) => sum + (plan.frequency === "daily" ? plan.amountUsdt : 0), 0);
  if (dailyNeed > 0) {
    const daysLeft = Math.floor(btcStats.usdtBalance / dailyNeed);
    if (daysLeft < 5) tasks.push({ id: "usdt-days", title: "USDT cho DCA sắp hết", detail: `Còn đủ khoảng ${daysLeft} ngày với lịch hiện tại`, action: "Mua USDT", tone: daysLeft <= 2 ? "danger" : "warning", page: "investment", tab: "btc" });
  }

  const marketAgeMs = state.market.updatedAt ? Date.now() - new Date(state.market.updatedAt).getTime() : Infinity;
  if (marketAgeMs > 5 * MARKET_PRICE_REFRESH_MS || state.market.isFallback) tasks.push({ id: "market-stale", title: "Giá thị trường cần kiểm tra", detail: state.market.isFallback ? "Đang dùng một phần giá fallback" : "Giá đã quá 5 phút", action: "Cập nhật giá", tone: "warning" });

  return tasks.slice(0, 12);
}

const depositCreatedField = (fund: DepositFund) =>
  fund === "saving" ? "savingDepositCreatedAt" : "emergencyDepositCreatedAt";
const depositRequestedField = (fund: DepositFund) =>
  fund === "saving" ? "savingDepositRequestedAt" : "emergencyDepositRequestedAt";

function AppNav({
  page,
  setPage,
}: {
  page: Page;
  setPage: (page: Page) => void;
}) {
  const items: Array<{ id: Page; label: string; icon: JSX.Element }> = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "reports", label: "Báo cáo", icon: <BarChart3 size={18} /> },
    { id: "investment", label: "Tài sản", icon: <LineChart size={18} /> },
    { id: "accumulation", label: "Tích lũy", icon: <PiggyBank size={18} /> },
  ];

  return (
    <nav className="app-nav">
      <div className="brand">
        <img className="brand-mark" src="/logo.png" alt="Quản Lí" />
        <div>
          <strong>Quản Lí</strong>
          <small>Chi tiêu cá nhân</small>
        </div>
      </div>
      <div className="nav-list">
        {items.map((item) => (
          <button
            className={page === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setPage(item.id)}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function PinKeypad({
  disabled,
  onDigit,
  onBackspace,
  onClear,
}: {
  disabled: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="pin-keypad" aria-label="Bàn phím PIN">
      {digits.map((digit) => (
        <button key={digit} type="button" disabled={disabled} onClick={() => onDigit(digit)}>
          {digit}
        </button>
      ))}
      <button className="pin-keypad-action" type="button" disabled={disabled} onClick={onClear} aria-label="Xóa toàn bộ PIN">
        <X size={18} />
      </button>
      <button type="button" disabled={disabled} onClick={() => onDigit("0")}>
        0
      </button>
      <button className="pin-keypad-action" type="button" disabled={disabled} onClick={onBackspace} aria-label="Xóa một số">
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}

function PinGate({
  state,
  setState,
  cloudConfigured,
  onUnlock,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  cloudConfigured: boolean;
  onUnlock: (pin: string) => Promise<string | null>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSetup = !state.settings.hasPin;
  const addDigit = (digit: string) => {
    setError("");
    setPin((current) => `${current}${digit}`.slice(0, 12));
  };

  const submit = async () => {
    if (pin.length < 4) {
      setError("PIN cần tối thiểu 4 số.");
      return;
    }
    if (cloudConfigured) {
      setLoading(true);
      setError("");
      const loginError = await onUnlock(pin);
      setLoading(false);
      if (loginError) setError(loginError);
      return;
    }
    if (isSetup) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, pin, hasPin: true } }));
      await onUnlock(pin);
      return;
    }
    if (pin === state.settings.pin) await onUnlock(pin);
    else setError("PIN chưa đúng.");
  };

  return (
    <main className="pin-screen">
      <section className="pin-card">
        <div className="pin-icon">
          <Lock size={26} />
        </div>
        <h1>Nhập mã PIN</h1>
        <p>Mở dữ liệu tài khoản của bạn. Tạo hoặc đổi PIN tại /admin.</p>
        <input
          className="pin-display"
          type="text"
          value={pin ? "•".repeat(pin.length) : ""}
          placeholder="Nhập PIN"
          readOnly
          aria-label="PIN đã nhập"
        />
        <PinKeypad
          disabled={loading}
          onDigit={addDigit}
          onBackspace={() => setPin((current) => current.slice(0, -1))}
          onClear={() => setPin("")}
        />
        {error && <span className="form-error">{error}</span>}
        <button className="primary full" disabled={loading} onClick={submit}>
          {loading ? "Đang mở..." : "Mở app"}
        </button>
        <a className="admin-link" href="/admin">Tạo hoặc đổi PIN</a>
      </section>
    </main>
  );
}

function MonthPicker({ month, setMonth }: { month: string; setMonth: (month: string) => void }) {
  return (
    <div className="month-picker">
      <button title="Tháng trước" onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft size={18} />
      </button>
      <input
        className="month-picker-input"
        type="month"
        value={month}
        onChange={(event) => {
          if (event.target.value) setMonth(event.target.value);
        }}
        aria-label="Chọn tháng"
      />
      <strong>Tháng {formatMonth(month)}</strong>
      <button title="Tháng sau" onClick={() => setMonth(shiftMonth(month, 1))}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  icon,
  tone,
  percent,
  onClick,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: JSX.Element;
  tone?: string;
  percent?: number;
  onClick?: () => void;
}) {
  return (
    <article className={`metric ${tone ?? ""} ${onClick ? "clickable" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={(event) => {
      if (!onClick) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    }}>
      <span>{icon}</span>
      <div>
        <small>{label} {typeof percent === "number" && <b>{percent}%</b>}</small>
        <strong>{value}</strong>
        {subValue && <em>{subValue}</em>}
      </div>
    </article>
  );
}

function BreakdownPie({ data }: { data: Array<{ name: string; value: number }> }) {
  const rows = data.filter((item) => item.value > 0);
  if (rows.length === 0) return <div className="empty-chart">Chưa có dữ liệu</div>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
          {rows.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatVnd(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

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
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const dueSoon = state.bankDeposits
    .filter((item) => item.status === "active")
    .map((item) => ({ ...item, dueDays: daysUntil(item.maturityDate) }))
    .filter((item) => item.dueDays <= 30)
    .sort((a, b) => a.dueDays - b.dueDays)
    .slice(0, 3);

  useEffect(() => {
    setSelectedIncomeId((current) => {
      if (current && summary.incomeRows.some((row) => row.id === current)) return current;
      return summary.incomeRows.find((row) => row.value > 0)?.id ?? summary.incomeRows[0]?.id ?? null;
    });
    setSelectedExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return summary.expenseRows.find((row) => row.id === "phat-sinh" && row.value > 0)?.id ?? summary.expenseRows.find((row) => row.value > 0)?.id ?? summary.expenseRows[0]?.id ?? null;
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const selectedIncome = summary.incomeRows.find((row) => row.id === selectedIncomeId) ?? null;
  const selectedExpense = summary.expenseRows.find((row) => row.id === selectedExpenseId) ?? null;

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
                  <div key={category.id} className={record.checked ? "done" : ""}>
                    <CheckCircle2 size={18} />
                    <span>Chuyển {category.name}</span>
                    <strong>{formatVnd(record.amount)}</strong>
                  </div>
                );
              })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Sổ sắp đáo hạn</h2>
            <button className="ghost" onClick={() => {
              setAssetTab("mbb");
              setPage("investment");
            }}>
              Xem
            </button>
          </div>
          {dueSoon.length === 0 ? (
            <p className="muted">Chưa có sổ nào cần xử lý trong 30 ngày tới.</p>
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
  month,
  setMonth,
  setPage,
  setAssetTab,
  onRefreshMarket,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  month: string;
  setMonth: (month: string) => void;
  setPage: (page: Page) => void;
  setAssetTab: (tab: InvestmentTab) => void;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
}) {
  const summary = monthlySummary(state, month);
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [entryModal, setEntryModal] = useState<"income" | "expense" | null>(null);
  const [showNewIncomeCategory, setShowNewIncomeCategory] = useState(false);
  const [showNewExpenseCategory, setShowNewExpenseCategory] = useState(false);
  const [allocationEditing, setAllocationEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allocationAmountInputs, setAllocationAmountInputs] = useState<Partial<Record<AllocationAmountKey, string>>>({});
  const [editingFixed, setEditingFixed] = useState<{ categoryId: string; amount: string } | null>(null);
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
      return summary.incomeRows.find((row) => row.value > 0)?.id ?? summary.incomeRows[0]?.id ?? null;
    });
    setSelectedExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return summary.expenseRows.find((row) => row.id === "phat-sinh" && row.value > 0)?.id ?? summary.expenseRows.find((row) => row.value > 0)?.id ?? summary.expenseRows[0]?.id ?? null;
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const selectedIncome = summary.incomeRows.find((row) => row.id === selectedIncomeId) ?? null;
  const selectedExpense = summary.expenseRows.find((row) => row.id === selectedExpenseId) ?? null;
  const fixedCategories = state.expenseCategories.filter((category) => isFixedCategoryVisibleInMonth(state, category, month));
  const percentTotal =
    summary.allocation.btcPercent +
    summary.allocation.stockPercent +
    summary.allocation.savingPercent +
    summary.allocation.emergencyPercent;
  const allocationAmountRows: Array<{ percentKey: AllocationPercentKey; amountKey: AllocationAmountKey; label: string; amount: number }> = [
    { percentKey: "btcPercent", amountKey: "btcAmount", label: "BTC", amount: summary.allocationAmounts.btc },
    { percentKey: "stockPercent", amountKey: "stockAmount", label: "CK", amount: summary.allocationAmounts.stock },
    { percentKey: "savingPercent", amountKey: "savingAmount", label: "Quỹ tiết kiệm", amount: summary.allocationAmounts.saving },
    { percentKey: "emergencyPercent", amountKey: "emergencyAmount", label: "Dự phòng", amount: summary.allocationAmounts.emergency },
  ];
  const allocationAmountTotal = allocationAmountRows.reduce((sum, item) => sum + Math.round(item.amount), 0);
  const availableAllocationAmount = Math.round(Math.max(summary.saving, 0));
  const amountTotalMatchesSaving = Math.abs(allocationAmountTotal - availableAllocationAmount) <= 1;
  const hasCustomAllocationAmounts = allocationAmountRows.some((item) => typeof summary.allocation[item.amountKey] === "number");
  const monthAlreadyConfirmed = Boolean(summary.allocation.confirmedAt);
  const tasks = dashboardTasks(state, month);

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
    if (task.page) setPage(task.page);
  };

  const updateMonthlyExpense = (category: ExpenseCategory, patch: Partial<MonthlyExpense>) => {
    setState((prev) => {
      const existing = prev.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
      const next = existing ? { ...existing, ...patch } : { ...getMonthlyExpense(prev, category, month), ...patch };
      return {
        ...prev,
        monthlyExpenses: existing ? prev.monthlyExpenses.map((item) => (item.id === existing.id ? next : item)) : [...prev.monthlyExpenses, next],
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

  const updateAllocationAmount = (key: AllocationAmountKey, value: string) => {
    const formattedValue = formatMoneyInput(value);
    if (key === "savingAmount" || key === "emergencyAmount") {
      const otherKey: AllocationAmountKey = key === "savingAmount" ? "emergencyAmount" : "savingAmount";
      if (!formattedValue) {
        setAllocationAmountInputs((prev) => {
          const next = { ...prev, [key]: "" };
          delete next[otherKey];
          return next;
        });
        updateAllocation({ [key]: undefined, [otherKey]: undefined } as Partial<Allocation>);
        return;
      }
      const pairBudget = Math.max(
        availableAllocationAmount - Math.round(summary.allocationAmounts.btc) - Math.round(summary.allocationAmounts.stock),
        0
      );
      const amount = Math.min(Math.max(parseMoney(formattedValue), 0), pairBudget);
      const otherAmount = Math.max(pairBudget - amount, 0);
      setAllocationAmountInputs((prev) => ({ ...prev, [key]: formattedValue, [otherKey]: otherAmount.toLocaleString("vi-VN") }));
      updateAllocation({ [key]: amount, [otherKey]: otherAmount } as Partial<Allocation>);
      return;
    }
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

  const addIncome = () => {
    const amount = parseMoney(incomeForm.amount);
    if (!amount || !incomeForm.categoryId || !incomeForm.date) return;
    setState((prev) => ({
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
    setState((prev) => ({
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
    const category: ExpenseCategory = { id: uid(), name: newExpense.name.trim(), kind: newExpense.kind, defaultAmount: newExpense.kind === "fixed" ? parseMoney(newExpense.amount) : 0 };
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
    setState((prev) => {
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
    setState((prev) => ({ ...prev, incomeTransactions: prev.incomeTransactions.filter((item) => item.id !== transaction.id) }));
  };

  const deleteExpenseTransaction = (transaction: { id: string }) => {
    if (!window.confirm("Xóa khoản chi này?")) return;
    setState((prev) => ({ ...prev, expenseEntries: prev.expenseEntries.filter((item) => item.id !== transaction.id) }));
  };

  const deleteExpenseCategory = (category: ExpenseCategory) => {
    if (!window.confirm(`Xóa mục ${category.name}?`)) return;
    setState((prev) => ({
      ...prev,
      expenseCategories: prev.expenseCategories.filter((item) => item.id !== category.id),
      monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId !== category.id),
      expenseEntries: prev.expenseEntries.filter((item) => item.categoryId !== category.id),
    }));
    if (selectedExpenseId === category.id) setSelectedExpenseId(null);
  };

  const saveFixedAmount = () => {
    if (!editingFixed) return;
    const category = state.expenseCategories.find((item) => item.id === editingFixed.categoryId);
    if (!category) return;
    const amount = parseMoney(editingFixed.amount);
    const goal = accumulationGoalForCategory(state, category.id);
    if (goal) {
      setState((prev) => {
        const currentGoal = accumulationGoalForCategory(prev, category.id);
        if (!currentGoal) return prev;
        const existing = prev.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
        const edited = existing ? { ...existing, amount } : { ...getMonthlyExpense(prev, category, month), amount };
        const withoutFutureUnpaid = prev.monthlyExpenses.filter((item) => item.categoryId !== category.id || item.checked || item.id === edited.id);
        const withEdited = {
          ...prev,
          monthlyExpenses: withoutFutureUnpaid.some((item) => item.id === edited.id)
            ? withoutFutureUnpaid.map((item) => (item.id === edited.id ? edited : item))
            : [...withoutFutureUnpaid, edited],
        };
        const preservedUnpaid = edited.checked ? [] : [edited];
        const checked = withEdited.monthlyExpenses.filter((item) => item.categoryId === category.id && item.checked);
        const checkedTotal = checked.reduce((sum, item) => sum + item.amount, 0);
        const preservedTotal = preservedUnpaid.reduce((sum, item) => sum + item.amount, 0);
        const remainingMonths = Math.max(currentGoal.months - checked.length - preservedUnpaid.length, 0);
        const remainingAmount = Math.max(currentGoal.targetAmount - checkedTotal - preservedTotal, 0);
        const nextMonthlyAmount = remainingMonths > 0 && remainingAmount > 0 ? Math.ceil(remainingAmount / remainingMonths) : currentGoal.monthlyAmount;
        const nextGoal = { ...currentGoal, monthlyAmount: nextMonthlyAmount, updatedAt: new Date().toISOString() };
        const withGoal = {
          ...withEdited,
          accumulationGoals: withEdited.accumulationGoals.map((item) => (item.id === nextGoal.id ? nextGoal : item)),
          expenseCategories: withEdited.expenseCategories.map((item) =>
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
    if (existingAllocation?.confirmedAt || percentTotal !== 100 || !amountTotalMatchesSaving || summary.saving <= 0) return;
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

      <section className="metrics-grid">
        <MetricCard label="Thu nhập" value={formatVnd(summary.income)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Chi tiêu" value={formatVnd(summary.expense)} icon={<ArrowDownCircle size={20} />} />
        <MetricCard label="Tiết kiệm" value={formatVnd(summary.saving)} icon={<PiggyBank size={20} />} tone="highlight" />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-title">
            <h2>Thu nhập</h2>
            <button className="icon-button" title="Thêm thu nhập" onClick={() => setEntryModal("income")}>
              <Plus size={18} />
            </button>
          </div>
          <BreakdownPie data={summary.incomeRows} />
          <DetailList rows={summary.incomeRows} selectedId={selectedIncomeId} onSelect={setSelectedIncomeId} />
          <CategoryHistoryPanel title={selectedIncome?.name ?? "Thu nhập"} rows={selectedIncome?.transactions ?? []} emptyText="Chưa có khoản thu nào trong tháng này." itemTone="income" onEdit={(item) => openIncomeEdit(item as IncomeTransaction)} onDelete={deleteIncomeTransaction} />
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Chi tiêu</h2>
            <button className="icon-button" title="Thêm khoản chi" onClick={() => setEntryModal("expense")}>
              <Plus size={18} />
            </button>
          </div>
          <BreakdownPie data={summary.expenseRows} />
          <DetailList rows={summary.expenseRows} selectedId={selectedExpenseId} onSelect={setSelectedExpenseId} />
          <CategoryHistoryPanel title={selectedExpense?.name ?? "Chi tiêu"} rows={selectedExpense?.transactions ?? []} emptyText="Chưa có khoản phát sinh nào trong tháng này." itemTone="expense" onEdit={(item) => openExpenseEdit(item as ExpenseEntry)} onDelete={deleteExpenseTransaction} />
        </article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Tiền được chia</h2>
          <button className="icon-button" title="Chỉnh chia quỹ" onClick={() => setAllocationEditing((current) => !current)}>
            <Pencil size={17} />
          </button>
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
                <small className={percentTotal === 100 ? "ok" : "bad"}>Tỷ lệ: {percentTotal}%</small>
                <small className={amountTotalMatchesSaving ? "ok" : "bad"}>Tổng tiền: {formatVnd(allocationAmountTotal)} / {formatVnd(availableAllocationAmount)}</small>
              </div>
            </div>
            <div className="allocation-editor">
              {allocationAmountRows.map((item) => (
                <div className="allocation-field" key={item.percentKey}>
                  <span>{item.label}</span>
                  <input type="number" min="0" max="100" value={summary.allocation[item.percentKey]} onChange={(event) => updateAllocation({ [item.percentKey]: Number(event.target.value) } as Partial<Allocation>)} aria-label={`${item.label} tỷ lệ phần trăm`} placeholder="%" />
                  <input className="amount-input" inputMode="numeric" value={allocationAmountInputs[item.amountKey] ?? Math.round(item.amount).toLocaleString("vi-VN")} onChange={(event) => updateAllocationAmount(item.amountKey, event.target.value)} onBlur={() => commitAllocationAmount(item.amountKey)} aria-label={`${item.label} số tiền`} placeholder="Số tiền" />
                </div>
              ))}
            </div>
            <div className="deposit-confirm allocation-confirm-row">
              <label>
                Tháng chia quỹ
                <input type="month" value={depositForm.month} onChange={(event) => setDepositForm({ ...depositForm, month: event.target.value })} />
              </label>
              <button className="primary" onClick={() => setConfirmOpen(true)} disabled={percentTotal !== 100 || !amountTotalMatchesSaving || summary.saving <= 0 || monthAlreadyConfirmed}>
                <CheckCircle2 size={17} /> Chia quỹ
              </button>
              {monthAlreadyConfirmed && <small className="ok">Tháng này đã xác nhận chia quỹ.</small>}
            </div>
          </div>
        )}
      </section>

      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Checklist khoản cố định</h2>
            <small>Tick mới tính vào chi tiêu</small>
          </div>
          <div className="check-list">
            {fixedCategories.map((category) => {
              const record = getMonthlyExpense(state, category, month);
              const accumulationGoal = accumulationGoalForCategory(state, category.id);
              return (
                <div key={category.id} className={record.checked ? "done fixed-check-row" : "fixed-check-row"}>
                  <button className={record.checked ? "check-icon checked" : "check-icon"} title={record.checked ? "Bỏ tick khoản cố định" : "Tick khoản cố định"} onClick={() => updateMonthlyExpense(category, { checked: !record.checked })} type="button">
                    <CheckCircle2 size={18} />
                  </button>
                  <span>{category.name}</span>
                  <strong>{formatVnd(record.amount)}</strong>
                  <button className="row-icon-button" title="Sửa số tiền tháng này" onClick={() => setEditingFixed({ categoryId: category.id, amount: record.amount.toLocaleString("vi-VN") })} type="button">
                    <Pencil size={16} />
                  </button>
                  {!accumulationGoal && (
                    <button className="row-icon-button danger-text" title="Xóa mục" onClick={() => deleteExpenseCategory(category)} type="button">
                      <X size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
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
                    <strong>{task.title}</strong>
                    <small>{task.detail}</small>
                  </div>
                  <span>{task.action}</span>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>

      {entryModal === "income" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="income-modal-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="income-modal-title">Thêm thu nhập</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEntryModal(null)}><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label>Mục thu<select value={incomeForm.categoryId} onChange={(event) => setIncomeForm({ ...incomeForm, categoryId: event.target.value })}>{state.incomeCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={incomeForm.amount} onChange={(event) => setIncomeForm({ ...incomeForm, amount: formatMoneyInput(event.target.value) })} placeholder="9.000.000" /></label>
              <label>Ngày<input type="date" value={incomeForm.date} onChange={(event) => setIncomeForm({ ...incomeForm, date: event.target.value })} /></label>
              <label>Ghi chú<input value={incomeForm.note} onChange={(event) => setIncomeForm({ ...incomeForm, note: event.target.value })} placeholder="Fishing, job..." /></label>
            </div>
            <button className="primary full" onClick={addIncome}><Plus size={17} /> Thêm thu nhập</button>
            {!showNewIncomeCategory ? (
              <button className="ghost full" onClick={() => setShowNewIncomeCategory(true)}><Plus size={17} /> Thêm mục mới</button>
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
              <label>Mục chi<select value={expenseEntry.categoryId} onChange={(event) => setExpenseEntry({ ...expenseEntry, categoryId: event.target.value })}>{state.expenseCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={expenseEntry.amount} onChange={(event) => setExpenseEntry({ ...expenseEntry, amount: formatMoneyInput(event.target.value) })} placeholder="500.000" /></label>
              <label>Ngày<input type="date" value={expenseEntry.date} onChange={(event) => setExpenseEntry({ ...expenseEntry, date: event.target.value })} /></label>
              <label>Ghi chú<input value={expenseEntry.note} onChange={(event) => setExpenseEntry({ ...expenseEntry, note: event.target.value })} placeholder="Sửa xe, mua đồ..." /></label>
            </div>
            <button className="primary full" onClick={addExpenseEntry}><Plus size={17} /> Thêm khoản chi</button>
            {!showNewExpenseCategory ? (
              <button className="ghost full" onClick={() => setShowNewExpenseCategory(true)}><Plus size={17} /> Thêm mục mới</button>
            ) : (
              <div className="inline-add modal-inline-add">
                <input value={newExpense.name} onChange={(event) => setNewExpense({ ...newExpense, name: event.target.value })} placeholder="Mục chi mới" />
                {newExpense.kind === "fixed" && <input value={newExpense.amount} onChange={(event) => setNewExpense({ ...newExpense, amount: formatMoneyInput(event.target.value) })} placeholder="Số tiền mặc định" />}
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
            <label>Số tiền tháng này<input value={editingFixed.amount} onChange={(event) => setEditingFixed({ ...editingFixed, amount: formatMoneyInput(event.target.value) })} /></label>
            <div className="modal-actions fixed-edit-actions">
              <button className="ghost" onClick={() => setEditingFixed(null)}>Hủy</button>
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
              <label>Số tiền<input value={editingTransaction.amount} onChange={(event) => setEditingTransaction({ ...editingTransaction, amount: formatMoneyInput(event.target.value) })} /></label>
              <label>Ngày<input type="date" value={editingTransaction.date} onChange={(event) => setEditingTransaction({ ...editingTransaction, date: event.target.value })} /></label>
              <label>Ghi chú<input value={editingTransaction.note} onChange={(event) => setEditingTransaction({ ...editingTransaction, note: event.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditingTransaction(null)}>Hủy</button>
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
            <p className="muted">App sẽ ghi giao dịch vào BTC/CK. Quỹ tiết kiệm và Dự phòng sẽ được đánh dấu chờ tạo sổ ở trang riêng.</p>
            {!hasCustomAllocationAmounts && (summary.allocationAmounts.savingRemainder > 0 || summary.allocationAmounts.emergencyRemainder > 0) && <p className="muted">Số lẻ sau khi làm tròn bội số {formatVnd(CERTIFICATE_LOT)} được cộng vào BTC.</p>}
            <div className="confirm-summary">
              <div><span>BTC</span><strong>{formatVnd(summary.allocationAmounts.btc)}</strong></div>
              <div><span>CK</span><strong>{formatVnd(summary.allocationAmounts.stock)}</strong></div>
              <div><span>Quỹ tiết kiệm</span><strong>{formatVnd(summary.allocationAmounts.saving)}</strong></div>
              <div><span>Dự phòng</span><strong>{formatVnd(summary.allocationAmounts.emergency)}</strong></div>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfirmOpen(false)}>Hủy</button>
              <button className="primary" onClick={confirmAllocation} disabled={percentTotal !== 100 || !amountTotalMatchesSaving || summary.saving <= 0 || monthAlreadyConfirmed}><CheckCircle2 size={17} /> Đồng ý chia quỹ</button>
            </div>
          </section>
        </div>
      )}
    </div>
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
  return (
    <div className="detail-list">
      {rows
        .filter((item) => item.value > 0)
        .map((item, index) => (
          <button
            className={selectedId === item.id ? "selected" : ""}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span style={{ "--dot": COLORS[index % COLORS.length] } as React.CSSProperties}>{item.name}</span>
            <strong>{formatVnd(item.value)}</strong>
            <small>{item.transactions.length} mục</small>
          </button>
        ))}
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
}: {
  title: string;
  rows: Array<{ id: string; categoryId?: string; amount: number; date: string; note: string }>;
  emptyText: string;
  itemTone: "income" | "expense";
  onEdit?: (item: { id: string; categoryId?: string; amount: number; date: string; note: string }) => void;
  onDelete?: (item: { id: string; categoryId?: string; amount: number; date: string; note: string }) => void;
}) {
  return (
    <div className="category-history">
      <div className="panel-title compact-title">
        <h3>{title}</h3>
        <small>{rows.length} giao dịch</small>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <div className="timeline history-timeline">
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
}: {
  label: string;
  value: number;
  percent: number;
  tone?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`fund-chip ${tone ?? ""} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <small>
        {label} <b>{percent}%</b>
      </small>
      <strong>{formatVnd(value)}</strong>
    </div>
  );
}

function AccumulationPage({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
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
  const [showHistory, setShowHistory] = useState(false);
  const [formError, setFormError] = useState("");
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
          if (unpaid.length <= remainingMonths) return;

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
    const remaining = Math.max(targetAmount - progress, 0);
    const startMonth = form.startMonth || currentMonth();
    let months = Number(form.months) || 0;
    let monthlyAmount = parseMoney(form.monthlyAmount);

    if (form.dueDate && !editingGoal) {
      months = monthsBetweenInclusive(startMonth, monthFromDate(form.dueDate));
      monthlyAmount = months ? Math.ceil(remaining / months) : 0;
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

  const resetForm = () => {
    setForm(emptyForm());
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
    setShowHistory(false);
    setForm({
      name: goal.name,
      target: goal.targetAmount.toLocaleString("vi-VN"),
      startMonth: goal.startMonth,
      dueDate: goal.dueDate ?? "",
      months: String(unpaidMonths || ""),
      monthlyAmount: unpaidMonths && remaining ? Math.ceil(remaining / unpaidMonths).toLocaleString("vi-VN") : "",
    });
    setFormError("");
  };

  const saveGoal = () => {
    const nextPlan = derivePlan();
    if (!nextPlan.valid) {
      setFormError("Nhập tên, tổng tiền và ngày cần dùng hoặc số tháng/số tiền mỗi tháng.");
      return;
    }

    setState((prev) => {
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
    });
    resetForm();
  };

  const endGoal = (goal: AccumulationGoal) => {
    if (!window.confirm(`Kết thúc mục ${goal.name}? Checklist từ tháng sau sẽ không còn hiển thị mục này.`)) return;
    setState((prev) => ({
      ...prev,
      accumulationGoals: prev.accumulationGoals.map((item) =>
        item.id === goal.id ? { ...item, status: "ended", endedAt: today(), updatedAt: new Date().toISOString() } : item
      ),
      monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId !== goal.categoryId || item.checked || item.month <= currentMonth()),
    }));
    if (editingId === goal.id) resetForm();
  };

  const deleteGoal = (goal: AccumulationGoal) => {
    if (!window.confirm(`Xóa mục ${goal.name}? Các tháng đã tick vẫn được giữ trong báo cáo cũ.`)) return;
    setState((prev) => ({
      ...prev,
      accumulationGoals: prev.accumulationGoals.map((item) =>
        item.id === goal.id ? { ...item, status: "deleted", deletedAt: today(), updatedAt: new Date().toISOString() } : item
      ),
      monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId !== goal.categoryId || item.checked),
    }));
    if (editingId === goal.id) resetForm();
  };

  const goals = state.accumulationGoals.filter((goal) => goal.status === "active");
  const historyGoals = state.accumulationGoals.filter((goal) => goal.status === "ended");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Kế hoạch chi cố định</p>
            <h1>{showHistory}</h1>
        </div>
        <div className="page-header-actions">
          <button className="ghost" onClick={() => {
            setShowHistory((value) => !value);
            setFormOpen(false);
            setEditingId(null);
          }} type="button">
            <History size={17} /> {showHistory ? "Danh sách" : "Lịch sử"}
          </button>
          {!formOpen && !showHistory && (
            <button className="primary" onClick={() => setFormOpen(true)}>
              <Plus size={17} /> Thêm
            </button>
          )}
        </div>
      </header>

      {formOpen && !showHistory && (
        <section className="panel">
          <div className="panel-title">
            <h2>{editingGoal ? "Sửa mục tích lũy" : "Tạo mục tích lũy"}</h2>
            <button className="ghost" onClick={resetForm}>Hủy</button>
          </div>
          <div className="deposit-confirm accumulation-form">
            <label>
              Tên mục
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Du lịch" />
            </label>
            <label>
              Tổng tiền cần dồn
              <input value={form.target} onChange={(event) => setForm({ ...form, target: formatMoneyInput(event.target.value) })} placeholder="9.000.000" />
            </label>
            <label>
              Tháng bắt đầu
              <input type="month" value={form.startMonth} onChange={(event) => setForm({ ...form, startMonth: event.target.value })} />
            </label>
            <label>
              Ngày cần dùng
              <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>
            <label>
              Số tháng
              <input value={form.months} onChange={(event) => setForm({ ...form, months: event.target.value, monthlyAmount: form.dueDate ? "" : form.monthlyAmount })} placeholder={plan.months ? String(plan.months) : "6"} />
            </label>
            <label>
              Tiền mỗi tháng
              <input value={form.monthlyAmount} onChange={(event) => setForm({ ...form, monthlyAmount: formatMoneyInput(event.target.value), months: form.dueDate ? "" : form.months })} placeholder={plan.monthlyAmount ? plan.monthlyAmount.toLocaleString("vi-VN") : "1.500.000"} />
            </label>
            <button className="primary" onClick={saveGoal}>
              <Save size={17} /> {editingGoal ? "Lưu thay đổi" : "Tạo quỹ"}
            </button>
            <small className="computed accumulation-computed">
              Còn cần dồn {formatVnd(plan.remaining)} · {plan.months || 0} tháng · khoảng {formatVnd(plan.monthlyAmount || 0)}/tháng
            </small>
            {formError && <span className="form-error accumulation-form-error">{formError}</span>}
          </div>
        </section>
      )}

      {showHistory ? (
        <section className="accumulation-grid">
          {historyGoals.length === 0 ? (
            <article className="panel empty-state">Chưa có mục tích lũy nào đã kết thúc.</article>
          ) : (
            historyGoals.map((goal) => {
              const progress = accumulationProgress(state, goal);
              const percent = goal.targetAmount ? Math.min((progress / goal.targetAmount) * 100, 100) : 0;
              return (
                <article className="accumulation-card ended" key={goal.id}>
                  <div className="panel-title">
                    <div>
                      <h2>{goal.name}</h2>
                      <small>{goal.endedAt ? `Kết thúc ${formatDate(goal.endedAt)}` : "Đã kết thúc"}</small>
                    </div>
                    <strong>{percent.toFixed(0)}%</strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className="accumulation-summary">
                    <span>Mục tiêu <strong>{formatVnd(goal.targetAmount)}</strong></span>
                    <span>Đã tích lũy <strong>{formatVnd(progress)}</strong></span>
                    <span>Tiến độ <strong>{formatVnd(progress)} / {formatVnd(goal.targetAmount)}</strong></span>
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        <section className="accumulation-grid">
        {goals.length === 0 ? (
          <article className="panel empty-state">Chưa có mục tích lũy nào.</article>
        ) : (
          goals.map((goal) => {
            const progress = accumulationProgress(state, goal);
            const percent = goal.targetAmount ? Math.min((progress / goal.targetAmount) * 100, 100) : 0;
            const remainingAmount = Math.max(goal.targetAmount - progress, 0);
            const nextRecord = state.monthlyExpenses
              .filter((item) => item.categoryId === goal.categoryId && !item.checked && item.month >= currentMonth())
              .sort((a, b) => a.month.localeCompare(b.month))[0];
            const paidMonths = state.monthlyExpenses.filter((item) => item.categoryId === goal.categoryId && item.checked).length;
            return (
              <article className={`accumulation-card ${goal.status}`} key={goal.id}>
                <button className="accumulation-delete-button" onClick={() => deleteGoal(goal)} title={`Xóa ${goal.name}`} type="button" aria-label={`Xóa ${goal.name}`}>
                  <X size={16} />
                </button>
                <div className="panel-title">
                  <div>
                    <h2>{goal.name}</h2>
                    <small>{goal.status === "ended" ? "Đã kết thúc" : goal.dueDate ? `Cần dùng ${formatDate(goal.dueDate)}` : `Bắt đầu ${formatMonth(goal.startMonth)}`}</small>
                  </div>
                  <strong>{percent.toFixed(0)}%</strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <div className="accumulation-summary">
                  <span>Mục tiêu <strong>{formatVnd(goal.targetAmount)}</strong></span>
                  <span>Đã dồn <strong>{formatVnd(progress)}</strong></span>
                  <span>Còn lại <strong>{formatVnd(remainingAmount)}</strong></span>
                  <span>Số tháng dồn <strong>{paidMonths}/{goal.months}</strong></span>
                  <span>Tháng kế tiếp <strong>{nextRecord ? `${formatMonth(nextRecord.month)} · ${formatVnd(nextRecord.amount)}` : "Không còn"}</strong></span>
                </div>
                <div className="card-actions accumulation-actions">
                  {goal.status === "active" && <button className="ghost accumulation-action-button" onClick={() => openEdit(goal)}><Pencil size={16} /> Sửa</button>}
                  {goal.status === "active" && <button className="ghost accumulation-action-button" onClick={() => endGoal(goal)}>Kết thúc</button>}
                </div>
              </article>
            );
          })
        )}
        </section>
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
  const [historyIncomeId, setHistoryIncomeId] = useState<string | null>(null);
  const [historyExpenseId, setHistoryExpenseId] = useState<string | null>(null);
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
      return summary.expenseRows.find((row) => row.id === "phat-sinh" && row.value > 0)?.id ?? summary.expenseRows.find((row) => row.value > 0)?.id ?? summary.expenseRows[0]?.id ?? null;
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

  const updateAllocationAmount = (key: AllocationAmountKey, value: string) => {
    const formattedValue = formatMoneyInput(value);
    if (key === "savingAmount" || key === "emergencyAmount") {
      const otherKey: AllocationAmountKey = key === "savingAmount" ? "emergencyAmount" : "savingAmount";
      if (!formattedValue) {
        setAllocationAmountInputs((prev) => {
          const next = { ...prev, [key]: "" };
          delete next[otherKey];
          return next;
        });
        updateAllocation({ [key]: undefined, [otherKey]: undefined } as Partial<Allocation>);
        return;
      }
      const pairBudget = Math.max(
        availableAllocationAmount - Math.round(summary.allocationAmounts.btc) - Math.round(summary.allocationAmounts.stock),
        0
      );
      const amount = Math.min(Math.max(parseMoney(formattedValue), 0), pairBudget);
      const otherAmount = Math.max(pairBudget - amount, 0);
      setAllocationAmountInputs((prev) => ({ ...prev, [key]: formattedValue, [otherKey]: otherAmount.toLocaleString("vi-VN") }));
      updateAllocation({ [key]: amount, [otherKey]: otherAmount } as Partial<Allocation>);
      return;
    }
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
              <input value={incomeForm.amount} onChange={(event) => setIncomeForm({ ...incomeForm, amount: formatMoneyInput(event.target.value) })} placeholder="9.000.000" />
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
              <select value={expenseEntry.categoryId} onChange={(event) => setExpenseEntry({ ...expenseEntry, categoryId: event.target.value })}>
                {state.expenseCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Số tiền
              <input value={expenseEntry.amount} onChange={(event) => setExpenseEntry({ ...expenseEntry, amount: formatMoneyInput(event.target.value) })} placeholder="500.000" />
            </label>
            <label>
              Ngày
              <input type="date" value={expenseEntry.date} onChange={(event) => setExpenseEntry({ ...expenseEntry, date: event.target.value })} />
            </label>
            <label>
              Note
              <input value={expenseEntry.note} onChange={(event) => setExpenseEntry({ ...expenseEntry, note: event.target.value })} placeholder="Sửa xe, mua đồ..." />
            </label>
          </div>
          <button className="primary" onClick={addExpenseEntry}>
            <Plus size={17} /> Thêm khoản chi
          </button>

          <div className="inline-add">
            <input value={newExpense.name} onChange={(event) => setNewExpense({ ...newExpense, name: event.target.value })} placeholder="Mục chi mới" />
            <input value={newExpense.amount} onChange={(event) => setNewExpense({ ...newExpense, amount: formatMoneyInput(event.target.value) })} placeholder="Số tiền" />
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
                      <input value={record.amount.toLocaleString("vi-VN")} onChange={(event) => updateMonthlyExpense(category, { amount: parseMoney(formatMoneyInput(event.target.value)) })} />
                    </label>
                    <button className={record.checked ? "toggle checked" : "toggle"} onClick={() => updateMonthlyExpense(category, { checked: !record.checked })}>
                      <CheckCircle2 size={17} />
                      {record.checked ? "Đã chuyển" : "Chưa chuyển"}
                    </button>
                  </>
                ) : (
                  <div className="variable-summary">
                    <strong>{formatVnd(row?.value ?? 0)}</strong>
                    <small>{row?.transactions.length ?? 0} khoản phát sinh đã lưu</small>
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
            <small>Bấm vào "Thu nhập khác" để xem chi tiết</small>
          </div>
          <DetailList rows={summary.incomeRows} selectedId={historyIncomeId} onSelect={setHistoryIncomeId} />
          <CategoryHistoryPanel
            title={historyIncome?.name ?? "Thu nhập"}
            rows={historyIncome?.transactions ?? []}
            emptyText="Chưa có khoản thu nào trong tháng này."
            itemTone="income"
            onEdit={(item) => openIncomeEdit(item as IncomeTransaction)}
            onDelete={deleteIncomeTransaction}
          />
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Lịch sử phát sinh</h2>
            <small>Bấm vào "Phát sinh" để xem từng khoản</small>
          </div>
          <DetailList rows={summary.expenseRows} selectedId={historyExpenseId} onSelect={setHistoryExpenseId} />
          <CategoryHistoryPanel
            title={historyExpense?.name ?? "Phát sinh"}
            rows={historyExpense?.transactions ?? []}
            emptyText="Chưa có khoản phát sinh nào trong tháng này."
            itemTone="expense"
            onEdit={(item) => openExpenseEdit(item as ExpenseEntry)}
            onDelete={deleteExpenseTransaction}
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
                  onChange={(event) => setEditingTransaction({ ...editingTransaction, amount: formatMoneyInput(event.target.value) })}
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
              <button className="ghost" onClick={() => setEditingTransaction(null)}>
                Hủy
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
          <div className="allocation-title-meta">
            <small className={percentTotal === 100 ? "ok" : "bad"}>Tổng tỷ lệ {percentTotal}%</small>
            <small className={amountTotalMatchesSaving ? "ok" : "bad"}>
              Tổng tiền {formatVnd(allocationAmountTotal)} / {formatVnd(availableAllocationAmount)}
            </small>
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
                onChange={(event) => updateAllocationAmount(item.amountKey, event.target.value)}
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
              App sẽ ghi giao dịch vào BTC/CK. Quỹ tiết kiệm và Dự phòng sẽ được đánh dấu chờ tạo sổ ở trang riêng.
            </p>
            {!hasCustomAllocationAmounts && (summary.allocationAmounts.savingRemainder > 0 || summary.allocationAmounts.emergencyRemainder > 0) && (
              <p className="muted">
                Số lẻ sau khi làm tròn bội số {formatVnd(CERTIFICATE_LOT)} được cộng vào BTC.
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
                <span>Dự phòng</span>
                <strong>{formatVnd(summary.allocationAmounts.emergency)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfirmOpen(false)}>
                Hủy
              </button>
              <button className="primary" onClick={confirmAllocation} disabled={percentTotal !== 100 || !amountTotalMatchesSaving || summary.saving <= 0 || monthAlreadyConfirmed}>
                <CheckCircle2 size={17} /> Đồng ý chia quỹ
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function nextDepositCode(deposits: BankDeposit[], fund: DepositFund) {
  const prefix = fund === "saving" ? "TK" : "DP";
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
  amount: number,
  rate: number,
  termMonths: number,
  startDate: string,
  maturityDate: string,
  month: string,
  note: string,
  parentId?: string,
  createdFromSolWithdrawalId?: string
): BankDeposit {
  const id = uid();
  return {
    id,
    code: nextDepositCode(existingDeposits, fund),
    fund,
    mbLast4: "",
    principal: Math.round(amount),
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
  onRefreshMarket,
  marketStatus,
  btcCloudAccountId,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  marketStatus: string;
  btcCloudAccountId: string;
  embedded?: boolean;
}) {
  const stats = btcPortfolioStats(state);
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

  useEffect(() => {
    const price = transferPriceFor(transferForm.asset, transferForm.destination);
    if (!price) return;
    setTransferForm((prev) => ({ ...prev, price: formatDecimalInput(String(price)) }));
  }, [state.market.btcUsdt, state.market.usdtVnd, state.market.usdVnd, transferForm.asset, transferForm.destination]);

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
    const topup: BtcUsdtTopup = { id: uid(), vndAmount, usdtAmount, date: topupForm.date, note: topupForm.note.trim() };
    setState((prev) => ({ ...prev, btcUsdtTopups: [...prev.btcUsdtTopups, topup] }));
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
    setState((prev) => ({
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
      setBtcError("Nhap du so ky, BTC tich luy, gia gan nhat va gia trung binh.");
      return;
    }

    const totalInvestedUsdt = amountUsdt * activeRuns;
    if (totalInvestedUsdt - stats.usdtBalance > 0.000001) {
      setBtcError(`So du USDT khong du de import DCA nay. Can khoang ${formatUsdt(totalInvestedUsdt)}, hien co ${formatUsdt(stats.usdtBalance)}.`);
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
        executedAt: localDateTimeIso(shiftDcaDate(legacyDcaForm.nextDate, legacyDcaForm.frequency, -1), legacyDcaForm.time),
        planId,
        note: totalNote,
      }];
    } else {
      const latestBtc = perRunUsdt / latestPriceUsdt;
      const remainingBtc = btcAmount - latestBtc;
      const remainingUsdt = perRunUsdt * (activeRuns - 1);
      const previousPriceUsdt = remainingBtc > 0 ? remainingUsdt / remainingBtc : 0;
      if (!previousPriceUsdt) {
        setBtcError("Du lieu gia khong hop le de tao lich su DCA.");
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
          executedAt: localDateTimeIso(shiftDcaDate(legacyDcaForm.nextDate, legacyDcaForm.frequency, index - activeRuns), legacyDcaForm.time),
          planId,
          note: totalNote,
        };
      });
    }

    setState((prev) => ({
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
    setState((prev) => ({ ...prev, btcDcaPlans: prev.btcDcaPlans.map((item) => (item.id === plan.id ? next : item)) }));
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
      setBtcError("Nhap BTC tich luy va gia trung binh hop le.");
      return;
    }
    const next: BtcDcaPlan = {
      ...plan,
      btcAmountOverride,
      averagePriceUsdtOverride,
    };
    setState((prev) => ({ ...prev, btcDcaPlans: prev.btcDcaPlans.map((item) => (item.id === plan.id ? next : item)) }));
    syncBtcRow("btc_dca_plans", next.id, next, { is_active: next.isActive, next_run_at: next.nextRunAt, status: next.status });
    setEditingDcaAssetPlanId(null);
    setDcaAssetForm({ btcAmount: "", averagePriceUsdt: "" });
    setBtcError("");
  };

  const deletePlan = (plan: BtcDcaPlan) => {
    setState((prev) => ({ ...prev, btcDcaPlans: prev.btcDcaPlans.filter((item) => item.id !== plan.id) }));
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
        executedAt: new Date(`${transferForm.date}T00:00:00`).toISOString(),
        note: transferForm.note.trim() || "Chuyển USDT sang BTC",
      };
      setState((prev) => ({ ...prev, btcTrades: [...prev.btcTrades, trade] }));
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
        ? 0
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
    setState((prev) => ({
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
    syncBtcRow("btc_transfers", transfer.id, transfer, { transfer_at: `${transfer.date}T00:00:00` });
    resetTransferForm();
    setTransferFormOpen(false);
    setBtcError("");
  };

  const estimatedTransferReceive = transferEstimatedReceive();
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
      latestPriceUsdt: latestTrade?.btcPriceUsdt || 0,
      pnlPercent,
      pnlUsdt,
      startAt,
      tradeCount: trades.length,
    };
  };
  const rows = [
    ...state.btcUsdtTopups.map((item) => ({ kind: "topup" as const, date: item.date, item })),
    ...state.btcTrades.filter((item) => item.type !== "dca").map((item) => ({ kind: "trade" as const, date: item.executedAt.slice(0, 10), item })),
    ...state.btcTransfers.map((item) => ({ kind: "transfer" as const, date: item.date, item })),
  ].sort((a, b) => b.date.localeCompare(a.date));

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
            {topupFormOpen && <button className="ghost" onClick={() => setTopupFormOpen(false)} type="button">Hủy</button>}
          </div>
          {!topupFormOpen ? (
            <button className="primary asset-open-button" onClick={() => setTopupFormOpen(true)} type="button"><Plus size={16} /> Mua USDT</button>
          ) : (
            <div className="form-grid btc-form-grid">
              <label>VND dùng mua<input value={topupForm.vnd} onChange={(event) => setTopupForm({ ...topupForm, vnd: formatMoneyInput(event.target.value) })} placeholder="1.000.000" /></label>
              <label>USDT thực nhận<input value={topupForm.usdt} onChange={(event) => setTopupForm({ ...topupForm, usdt: formatDecimalInput(event.target.value) })} placeholder="39,250" /></label>
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
            {planFormOpen && <button className="ghost" onClick={() => {
              setPlanFormOpen(false);
              setEditingPlanId(null);
            }} type="button">Hủy</button>}
            {legacyDcaFormOpen && <button className="ghost" onClick={() => setLegacyDcaFormOpen(false)} type="button">Hủy import</button>}
          </div>
          {!planFormOpen && !legacyDcaFormOpen && (
            <div className="btc-form-open-actions">
              <button className="primary asset-open-button" onClick={() => setPlanFormOpen(true)} type="button"><CalendarClock size={16} /> Mở form DCA</button>
              <button className="ghost asset-open-button" onClick={() => setLegacyDcaFormOpen(true)} type="button"><Upload size={16} /> Nhập DCA cũ</button>
            </div>
          )}
          {planFormOpen && (
            <div className="form-grid btc-form-grid">
              <label>USDT mỗi kỳ<input value={planForm.amountUsdt} onChange={(event) => setPlanForm({ ...planForm, amountUsdt: formatDecimalInput(event.target.value) })} placeholder="2" /></label>
              <label>Tần suất<select value={planForm.frequency} onChange={(event) => setPlanForm({ ...planForm, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
              <label>Giờ chạy<input type="time" value={planForm.time} onChange={(event) => setPlanForm({ ...planForm, time: event.target.value })} /></label>
              <label>Ngày bắt đầu<input type="date" value={planForm.startDate} onChange={(event) => setPlanForm({ ...planForm, startDate: event.target.value })} /></label>
              <label>Note<input value={planForm.note} onChange={(event) => setPlanForm({ ...planForm, note: event.target.value })} placeholder="DCA Binance" /></label>
              <button className="primary btc-form-submit" onClick={savePlan} type="button"><CalendarClock size={17} /> Lưu kế hoạch</button>
            </div>
          )}
          {legacyDcaFormOpen && (
            <div className="form-grid btc-form-grid">
              <label>USDT mỗi kỳ<input value={legacyDcaForm.amountUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, amountUsdt: formatDecimalInput(event.target.value) })} placeholder="2" /></label>
              <label>Tần suất<select value={legacyDcaForm.frequency} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
              <label>Giờ chạy<input type="time" value={legacyDcaForm.time} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, time: event.target.value })} /></label>
              <label>Ngày bắt đầu<input type="date" value={legacyDcaForm.startDate} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, startDate: event.target.value })} /></label>
              <label>Ngày giao dịch tiếp theo<input type="date" value={legacyDcaForm.nextDate} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, nextDate: event.target.value })} /></label>
              <label>Số kỳ đã kích hoạt<input value={legacyDcaForm.activeRuns} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, activeRuns: event.target.value })} placeholder="14" /></label>
              <label>BTC tích lũy<input value={legacyDcaForm.btcAmount} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, btcAmount: formatDecimalInput(event.target.value) })} placeholder="0,00043251" /></label>
              <label>Giá gần nhất (USDT)<input value={legacyDcaForm.latestPriceUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, latestPriceUsdt: formatDecimalInput(event.target.value) })} placeholder="64.337,674905" /></label>
              <label>Giá trung bình (USDT)<input value={legacyDcaForm.averagePriceUsdt} onChange={(event) => setLegacyDcaForm({ ...legacyDcaForm, averagePriceUsdt: formatDecimalInput(event.target.value) })} placeholder="64.565,25594748" /></label>
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
                      <span className={`btc-plan-status ${plan.isActive ? "active" : "paused"}`}>{plan.isActive ? "Đang tiến hành" : "Đã tạm dừng"}</span>
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
                          <label>Số lượng tích lũy<input value={dcaAssetForm.btcAmount} onChange={(event) => setDcaAssetForm({ ...dcaAssetForm, btcAmount: formatDecimalInput(event.target.value) })} placeholder="0,00043251" /></label>
                          <label>Giá trung bình (USDT)<input value={dcaAssetForm.averagePriceUsdt} onChange={(event) => setDcaAssetForm({ ...dcaAssetForm, averagePriceUsdt: formatDecimalInput(event.target.value) })} placeholder="64.565,25594748" /></label>
                          <button className="primary btc-form-submit" onClick={() => saveDcaAsset(plan)} type="button"><Save size={16} /> Lưu BTC</button>
                          <button className="ghost btc-form-submit" onClick={() => {
                            setEditingDcaAssetPlanId(null);
                            setDcaAssetForm({ btcAmount: "", averagePriceUsdt: "" });
                          }} type="button"><X size={16} /> Hủy</button>
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
            {transferFormOpen && <button className="ghost" onClick={() => setTransferFormOpen(false)} type="button">Hủy</button>}
          </div>
          {!transferFormOpen ? (
            <button className="primary asset-open-button" onClick={() => setTransferFormOpen(true)} type="button"><ArrowDownCircle size={16} /> Rút / chuyển</button>
          ) : (
            <div className="form-grid btc-form-grid">
              <label>Tài sản nguồn<select value={transferForm.asset} onChange={(event) => {
                const asset = event.target.value as "btc" | "usdt";
                const destination: BtcTransferTarget = asset === "btc" ? "usdt" : "btc";
                setTransferForm({ ...transferForm, asset, destination, price: formatDecimalInput(String(transferPriceFor(asset, destination) || "")), vnd: "" });
              }}><option value="btc">BTC</option><option value="usdt">USDT</option></select></label>
              {transferForm.asset === "btc" ? <label>Số BTC<input value={transferForm.btc} onChange={(event) => setTransferForm({ ...transferForm, btc: formatDecimalInput(event.target.value) })} placeholder="0,0001" /></label> : <label>Số USDT<input value={transferForm.usdt} onChange={(event) => setTransferForm({ ...transferForm, usdt: formatDecimalInput(event.target.value) })} placeholder="10" /></label>}
              <label>{transferForm.asset === "usdt" && transferForm.destination !== "btc" ? "Giá USDT/VND" : "Giá BTC/USDT"}<input value={transferForm.price} onChange={(event) => setTransferForm({ ...transferForm, price: formatDecimalInput(event.target.value) })} placeholder={formatDecimalInput(String(transferPriceFor(transferForm.asset, transferForm.destination) || 0))} /></label>
              <label>Số tiền nhận<input value={transferForm.vnd} onChange={(event) => setTransferForm({ ...transferForm, vnd: transferReceiveUnit() === "VND" ? formatMoneyInput(event.target.value) : formatDecimalInput(event.target.value) })} placeholder={formatTransferReceive(estimatedTransferReceive)} /></label>
              <label>Nơi nhận<select value={transferForm.destination} disabled={transferForm.asset === "btc"} onChange={(event) => {
                const destination = event.target.value as BtcTransferTarget;
                setTransferForm({ ...transferForm, destination, price: formatDecimalInput(String(transferPriceFor(transferForm.asset, destination) || "")), vnd: "" });
              }}>
                {transferForm.asset === "btc" ? <option value="usdt">USDT</option> : <option value="btc">BTC</option>}
                {transferForm.asset === "usdt" && <>
                  <option value="stock">CK</option>
                  <option value="saving">Tiết kiệm</option>
                  <option value="emergency">Dự phòng</option>
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
        <div className="timeline">
          {rows.map((row) => (
            <div key={`${row.kind}-${row.item.id}`}>
              <span className={row.kind === "transfer" ? "withdraw" : "deposit"}>{row.kind === "transfer" ? "-" : "+"}</span>
              <div>
                {row.kind === "topup" && <><strong>{formatUsdt(row.item.usdtAmount)} · {formatVnd(row.item.vndAmount)}</strong><small>{formatDate(row.item.date)} · Giá USDT {row.item.usdtAmount ? formatVnd(row.item.vndAmount / row.item.usdtAmount) : "0đ"} · Mua USDT · {row.item.note || "Không ghi chú"}</small></>}
                {row.kind === "trade" && <><strong>{formatBtc(row.item.btcAmount)} · {formatUsdt(row.item.usdtAmount)}</strong><small>{formatDate(row.item.executedAt.slice(0, 10))} · {row.item.type === "dca" ? "DCA" : "Mua thêm"} @ {formatUsdt(row.item.btcPriceUsdt)} · {row.item.note || "Không ghi chú"}</small></>}
                {row.kind === "transfer" && <><strong>{row.item.destination === "usdt" ? formatUsdt(row.item.usdtAmount) : formatVnd(row.item.vndAmount)}</strong><small>{formatDate(row.item.date)} · {row.item.destination === "usdt" ? "Chuyển" : "Rút"} {row.item.asset.toUpperCase()} về {btcTransferDestinationLabel(row.item.destination)} · {row.item.note || "Không ghi chú"}</small></>}
              </div>
            </div>
          ))}
        </div>
      </section>
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
  embedded?: boolean;
}) {
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
              <input value={amount} onChange={(event) => setAmount(formatMoneyInput(event.target.value))} placeholder="5.000.000" />
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
        <HistoryPanel rows={rows} />
      </section>
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function StockPage({
  state,
  setState,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  embedded?: boolean;
}) {
  const stats = stockPortfolioStats(state);
  const defaultBuyRows = (): StockBuyRow[] => [{ id: uid(), symbol: "", percent: "100", shares: "", buyPrice: "" }];
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [purchaseNote, setPurchaseNote] = useState("");
  const [buyRows, setBuyRows] = useState<StockBuyRow[]>(defaultBuyRows);
  const [sellingSymbol, setSellingSymbol] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState({
    shares: "",
    price: "",
    destination: "stock" as SolDestination,
    date: today(),
    note: "",
  });
  const [stockSuggestions, setStockSuggestions] = useState<Record<string, StockLookupSuggestion[]>>({});
  const [activeSuggestionRow, setActiveSuggestionRow] = useState<string | null>(null);
  const [stockError, setStockError] = useState("");
  const [refreshStatus, setRefreshStatus] = useState("");

  const stockAllocatedCapital = state.allocations
    .filter((allocation) => allocation.confirmedAt)
    .reduce((sum, allocation) => sum + (allocation.stockAmount ?? 0), 0);
  const plannedValue = buyRows.reduce((sum, row) => sum + stockLineValue({ shares: Number(row.shares) || 0, buyPrice: parseDecimal(row.buyPrice) }), 0);
  const plannedPercent = stats.cash ? Math.round((plannedValue / stats.cash) * 100) : 0;
  const saleVndAmount = Math.round((Number(saleForm.shares) || 0) * parseDecimal(saleForm.price) * STOCK_PRICE_UNIT);
  const latestStockAllocationNotice = [...state.fundTransactions]
    .reverse()
    .find(
      (transaction) =>
        transaction.fund === "stock" &&
        transaction.type === "deposit" &&
        transaction.note === "Chia quỹ cuối tháng" &&
        !state.settings.dismissedStockAllocationIds.includes(transaction.id)
    );

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

  const autoShares = (percentInput: string, priceInput: string) => {
    const percent = Number(percentInput) || 0;
    const price = parseDecimal(priceInput);
    if (!stats.cash || !percent || !price) return "";
    const rawShares = Math.floor((stats.cash * percent) / 100 / (price * STOCK_PRICE_UNIT));
    const shares = rawShares >= STOCK_LOT ? Math.floor(rawShares / STOCK_LOT) * STOCK_LOT : rawShares;
    return shares > 0 ? String(shares) : "";
  };

  const recalculateShares = (row: StockBuyRow): StockBuyRow => ({
    ...row,
    shares: autoShares(row.percent, row.buyPrice),
  });

  const fetchPrice = fetchStockQuote;

  const extractStockSuggestions = (payload: unknown, fallbackSymbol: string) => {
    const root = payload as { data?: unknown; symbol?: string; code?: string; ticker?: string; companyName?: string; shortName?: string; floor?: string; exchange?: string };
    const rows = Array.isArray(root?.data) ? root.data : Array.isArray(payload) ? payload : root?.data ? [root.data] : [root];
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

  const updateBuyRow = (id: string, patch: Partial<Omit<StockBuyRow, "id">>) => {
    setBuyRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if ("percent" in patch || "buyPrice" in patch) return recalculateShares(next);
        return next;
      })
    );
  };

  const updateBuyPercent = (id: string, value: string) => {
    const nextPercent = Math.max(Math.min(Number(value) || 0, 100), 0);
    setBuyRows((prev) => {
      const others = prev.filter((row) => row.id !== id);
      if (others.length === 0) {
        return prev.map((row) => (row.id === id ? recalculateShares({ ...row, percent: String(nextPercent) }) : row));
      }
      const remaining = Math.max(100 - nextPercent, 0);
      const otherCurrentTotal = others.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      let assigned = 0;
      return prev.map((row) => {
        if (row.id === id) return recalculateShares({ ...row, percent: String(nextPercent) });
        const isLastOther = others[others.length - 1]?.id === row.id;
        const percent = isLastOther
          ? remaining - assigned
          : Math.round((otherCurrentTotal ? ((Number(row.percent) || 0) / otherCurrentTotal) * remaining : remaining / others.length) * 100) / 100;
        assigned += percent;
        return recalculateShares({ ...row, percent: String(Math.max(percent, 0)) });
      });
    });
  };

  const selectSuggestion = (rowId: string, suggestion: StockLookupSuggestion) => {
    updateBuyRow(rowId, {
      symbol: suggestion.symbol,
      buyPrice: suggestion.price ? formatStockPrice(suggestion.price) : undefined,
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
        return [
          recalculateShares({ ...prev[0], percent: firstPercent }),
          { id: uid(), symbol: "", percent: String(Math.max(100 - (Number(firstPercent) || 0), 0)), shares: "", buyPrice: "" },
        ];
      }
      return [...prev, { id: uid(), symbol: "", percent: "0", shares: "", buyPrice: "" }];
    });
  };

  const removeBuyRow = (id: string) => {
    setBuyRows((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((row) => row.id !== id);
      if (next.length === 1) return [recalculateShares({ ...next[0], percent: "100" })];
      const total = next.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      if (!total) return next;
      let assigned = 0;
      return next.map((row, index) => {
        const percent = index === next.length - 1 ? 100 - assigned : Math.round(((Number(row.percent) || 0) / total) * 10000) / 100;
        assigned += percent;
        return recalculateShares({ ...row, percent: String(Math.max(percent, 0)) });
      });
    });
  };

  const resetPurchaseForm = () => {
    setBuyRows(defaultBuyRows());
    setPurchaseDate(today());
    setPurchaseNote("");
    setStockSuggestions({});
    setActiveSuggestionRow(null);
    setStockError("");
  };

  const savePurchase = () => {
    const lines = buyRows
      .map((row) => ({
        symbol: row.symbol.trim().toUpperCase(),
        shares: Number(row.shares) || 0,
        buyPrice: parseDecimal(row.buyPrice),
      }))
      .filter((line) => line.symbol && line.shares > 0 && line.buyPrice > 0);
    const total = lines.reduce((sum, line) => sum + stockLineValue(line), 0);
    if (!lines.length) {
      setStockError("Nhập ít nhất một mã cổ phiếu hợp lệ.");
      return;
    }
    if (total > stats.cash) {
      setStockError("Tổng giá trị mua đang vượt quá tiền dư CK.");
      return;
    }
    setState((prev) => ({
      ...prev,
      stockPurchases: [
        ...prev.stockPurchases,
        { id: uid(), date: purchaseDate, month: monthFromDate(purchaseDate), note: purchaseNote, lines },
      ],
    }));
    resetPurchaseForm();
    setPurchaseFormOpen(false);
  };

  const openSaleForm = (holding: ReturnType<typeof stockPortfolioStats>["holdings"][number]) => {
    setSellingSymbol(holding.symbol);
    setSaleForm({
      shares: "",
      price: formatStockPrice(holding.marketPrice),
      destination: "stock",
      date: today(),
      note: "",
    });
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
    const note = saleForm.note.trim();
    const transferNote = note ? `Rút từ CK ${holding.symbol} · ${note}` : `Rút từ CK ${holding.symbol}`;
    const sale: StockSale = {
      id: uid(),
      symbol: holding.symbol,
      shares,
      sellPrice,
      vndAmount,
      destination: saleForm.destination,
      date: saleForm.date,
      note,
    };
    setState((prev) => ({
      ...prev,
      stockSales: [...prev.stockSales, sale],
      fundTransactions:
        sale.destination === "stock" || sale.destination === "btc"
          ? [
              ...prev.fundTransactions,
              {
                id: uid(),
                fund: sale.destination,
                type: "deposit",
                amount: vndAmount,
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
                amount: vndAmount,
                date: sale.date,
                month: monthFromDate(sale.date),
                note: transferNote,
              },
            ]
          : prev.incomeTransactions,
    }));
    setSellingSymbol(null);
    setSaleForm({ shares: "", price: "", destination: "stock", date: today(), note: "" });
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
          : `Cập nhật được ${updated}/${total} mã. Có thể nhập tay mã lỗi.`
    );
  };

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
            <small>Bấm dấu tick để ẩn thông báo</small>
          </div>
          <CheckCircle2 size={20} />
        </button>
      )}
      <section className="metrics-grid stock-metrics-grid">
        <MetricCard label="Tổng vốn" value={formatVnd(stockAllocatedCapital)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Tổng tài sản CK" value={formatVnd(stats.totalValue)} icon={<LineChart size={20} />} tone="highlight" />
        <MetricCard label="Lãi/lỗ" value={`${formatVnd(stats.pnl)} · ${stats.pnlPercent.toFixed(1)}%`} icon={<BarChart3 size={20} />} tone={stats.pnl < 0 ? "loss" : undefined} />
        <div className="stock-cash-mobile">
          <MetricCard label="Tiền dư" value={formatVnd(stats.cash)} icon={<CircleDollarSign size={20} />} />
        </div>
      </section>
      <section className="stock-action-grid stock-mobile-compact">
        <div className="stock-cash-desktop">
          <MetricCard label="Tiền dư" value={formatVnd(stats.cash)} icon={<CircleDollarSign size={20} />} />
        </div>
        <article className="panel stock-buy-panel">
          <div className="panel-title">
            <h2>Mua cổ phiếu</h2>
            {purchaseFormOpen && <button className="ghost" onClick={() => {
              resetPurchaseForm();
              setPurchaseFormOpen(false);
            }} type="button">Hủy</button>}
          </div>
          {!purchaseFormOpen ? (
            <button className="primary asset-open-button" onClick={() => setPurchaseFormOpen(true)} type="button">
              <Plus size={16} /> Mua cổ phiếu
            </button>
          ) : (
            <>
              <div className="confirm-summary stock-confirm-summary">
                <div>
                  <span>Tỷ lệ</span>
                  <strong>{plannedPercent}%</strong>
                </div>
                <div>
                  <span>Tổng tiền</span>
                  <strong>{formatVnd(plannedValue)} / {formatVnd(stats.cash)}</strong>
                </div>
              </div>
              <div className="stock-buy-list">
                {buyRows.map((row, index) => {
                  const value = stockLineValue({ shares: Number(row.shares) || 0, buyPrice: parseDecimal(row.buyPrice) });
                  return (
                    <div className="stock-buy-row" key={row.id}>
                      <label>
                        Cổ phiếu
                        <div className="stock-symbol-field">
                          <input
                            value={row.symbol}
                            onChange={(event) => {
                              updateBuyRow(row.id, { symbol: event.target.value.toUpperCase() });
                              setActiveSuggestionRow(row.id);
                            }}
                            onFocus={() => setActiveSuggestionRow(row.id)}
                            placeholder="MBB"
                            autoComplete="off"
                          />
                          {activeSuggestionRow === row.id && (stockSuggestions[row.id]?.length ?? 0) > 0 && (
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
                        <input value={row.buyPrice} onChange={(event) => updateBuyRow(row.id, { buyPrice: formatDecimalInput(event.target.value) })} placeholder="27,5" />
                      </label>
                      <label>
                        Số cổ phiếu
                        <input value={row.shares} onChange={(event) => updateBuyRow(row.id, { shares: event.target.value.replace(/\D/g, "") })} placeholder="100" />
                      </label>
                      <div className="stock-row-value">
                        <span>Giá trị</span>
                        <strong>{formatVnd(value)}</strong>
                      </div>
                      <button className="row-icon-button danger-text" onClick={() => removeBuyRow(row.id)} title="Xóa dòng" type="button">
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="stock-form-actions">
                <button className="ghost" onClick={addBuyRow} type="button"><Plus size={17} /> Thêm cổ phiếu</button>
                <button className="primary" onClick={savePurchase} type="button"><Save size={17} /> Lưu lệnh mua</button>
              </div>
              <div className="form-grid stock-buy-meta-grid">
                <label>
                  Ngày mua
                  <input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
                </label>
                <label>
                  Note
                  <input value={purchaseNote} onChange={(event) => setPurchaseNote(event.target.value)} placeholder="Mua trên MBS" />
                </label>
              </div>
              {stockError && <span className="form-error">{stockError}</span>}
            </>
          )}
        </article>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Danh mục cổ phiếu</h2>
          <button className="ghost report-refresh-button" onClick={() => refreshPrices()} type="button" aria-label="Cập nhật giá"><LineChart size={17} /></button>
        </div>
        {refreshStatus && <p className="muted">{refreshStatus}</p>}
        {stats.holdings.length === 0 ? (
          <p className="muted">Chưa có cổ phiếu nào.</p>
        ) : (
          <div className="stock-holding-list">
            {stats.holdings.map((holding) => (
              <article className="stock-holding-card" key={holding.symbol}>
                {sellingSymbol !== holding.symbol && (
                  <button className="stock-card-withdraw-button" onClick={() => openSaleForm(holding)} type="button">
                    <ArrowDownCircle size={16} /> Rút
                  </button>
                )}
                <div>
                  <h3>{holding.symbol}</h3>
                  <small>{holding.hasMarketPrice ? `${holding.source} · ${holding.updatedAt ? formatDateTime(holding.updatedAt) : "mới cập nhật"}` : "Chưa cập nhật giá, đang dùng giá vốn"}</small>
                </div>
                <div className="stock-holding-grid">
                  <span>Số cổ <strong>{holding.shares.toLocaleString("vi-VN")}</strong></span>
                  <label className="stock-price-pair">
                    <span>Giá TT / Giá TB</span>
                    <div>
                      <input key={`${holding.symbol}-${holding.marketPrice}`} defaultValue={formatStockPrice(holding.marketPrice)} onBlur={(event) => saveManualPrice(holding.symbol, event.target.value)} />
                      <strong>{formatStockPrice(holding.averageCost)}</strong>
                    </div>
                  </label>
                  <span className="stock-value-pair">
                    Vốn / Thị trường
                    <strong>{formatVnd(holding.cost)}</strong>
                    <b>{formatVnd(holding.marketValue)}</b>
                  </span>
                  <span>Lãi/lỗ <strong className={holding.pnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{formatVnd(holding.pnl)} · {holding.pnlPercent.toFixed(1)}%</strong></span>
                </div>
                {sellingSymbol === holding.symbol ? (
                  <div className="stock-sale-form">
                    <label>
                      Số cổ phiếu rút
                      <div className="stock-sale-shares">
                        <input value={saleForm.shares} onChange={(event) => setSaleForm({ ...saleForm, shares: event.target.value.replace(/\D/g, "") })} placeholder="100" />
                        <button className="ghost" onClick={() => setSaleForm({ ...saleForm, shares: String(holding.shares) })} type="button">Max</button>
                      </div>
                    </label>
                    <label>
                      Giá rút
                      <input value={saleForm.price} onChange={(event) => setSaleForm({ ...saleForm, price: formatDecimalInput(event.target.value) })} placeholder={formatStockPrice(holding.marketPrice)} />
                    </label>
                    <label>
                      Nơi nhận
                      <select value={saleForm.destination} onChange={(event) => setSaleForm({ ...saleForm, destination: event.target.value as SolDestination })}>
                        <option value="stock">Số dư CK</option>
                        <option value="btc">BTC</option>
                        <option value="saving">Tiết kiệm</option>
                        <option value="emergency">Dự phòng</option>
                        <option value="cash">Tiền mặt</option>
                      </select>
                    </label>
                    <label>
                      Ngày
                      <input type="date" value={saleForm.date} onChange={(event) => setSaleForm({ ...saleForm, date: event.target.value })} />
                    </label>
                    <label>
                      Note
                      <input value={saleForm.note} onChange={(event) => setSaleForm({ ...saleForm, note: event.target.value })} placeholder="Rút từ CK" />
                    </label>
                    <div className="stock-sale-summary">
                      <span>Giá trị rút</span>
                      <strong>{formatVnd(saleVndAmount)}</strong>
                    </div>
                    <div className="stock-sale-actions">
                      <button className="ghost" onClick={() => setSellingSymbol(null)} type="button">Hủy</button>
                      <button className="primary" onClick={saveStockSale} type="button"><ArrowDownCircle size={17} /> Rút</button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Lịch sử mua</h2>
          <small>{state.stockPurchases.length} lệnh</small>
        </div>
        <div className="timeline">
          {[...state.stockPurchases].reverse().map((purchase) => (
            <div key={purchase.id}>
              <span className="deposit">+</span>
              <div>
                <strong>{formatVnd(purchase.lines.reduce((sum, line) => sum + stockLineValue(line), 0))}</strong>
                <small>
                  {formatDate(purchase.date)} · {purchase.lines.map((line) => `${line.symbol} ${line.shares.toLocaleString("vi-VN")}cp @ ${formatStockPrice(line.buyPrice)}`).join(" · ")} · {purchase.note || "Không ghi chú"}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function InvestmentPage({
  state,
  setState,
  activeTab,
  setActiveTab,
  onRefreshMarket,
  marketStatus,
  btcCloudAccountId,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeTab: InvestmentTab;
  setActiveTab: (tab: InvestmentTab) => void;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  marketStatus: string;
  btcCloudAccountId: string;
}) {
  const tabs: Array<{ id: InvestmentTab; label: string }> = [
    { id: "btc", label: "BTC" },
    { id: "stock", label: "CK" },
    { id: "mbb", label: "Sổ MB" },
    { id: "sol", label: "SOL" },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
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
      {activeTab === "btc" && <BtcPage state={state} setState={setState} onRefreshMarket={onRefreshMarket} marketStatus={marketStatus} btcCloudAccountId={btcCloudAccountId} embedded />}
      {activeTab === "stock" && <StockPage state={state} setState={setState} embedded />}
      {activeTab === "mbb" && <BankDepositPage state={state} setState={setState} embedded fixedFilter="all" />}
      {activeTab === "sol" && <SolPage state={state} setState={setState} onRefreshMarket={onRefreshMarket} marketStatus={marketStatus} btcCloudAccountId={btcCloudAccountId} embedded />}
    </div>
  );
}

function HistoryPanel({ rows }: { rows: FundTransaction[] }) {
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
            <div>
              <strong>{formatVnd(item.amount)}</strong>
              <small>{formatDate(item.date)} · {item.note || "Không ghi chú"}</small>
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
  embedded = false,
  fixedFilter,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  embedded?: boolean;
  fixedFilter?: DepositFilter;
}) {
  type PendingDepositRequest = {
    source: "allocation" | "sol" | "stock" | "btc";
    fund: DepositFund;
    month: string;
    amount: number;
    title: string;
    note: string;
    solWithdrawalId?: string;
  };

  const defaultDepositForm = (fund: DepositFund = "saving") => ({
    fund,
    amount: "",
    date: today(),
    maturityDate: addMonths(today(), 12),
    term: "12",
    rate: "6",
    note: "",
    sourceMonth: "",
    allocationSource: false,
    sourceSolWithdrawalId: "",
  });
  const [form, setForm] = useState(() => defaultDepositForm());
  const [activeFilter, setActiveFilter] = useState<DepositFilter>(fixedFilter ?? "all");
  const [embeddedFilter, setEmbeddedFilter] = useState<DepositFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [pendingSource, setPendingSource] = useState<BankDeposit | null>(null);
  const [earlySettlementDates, setEarlySettlementDates] = useState<Record<string, string>>({});
  const fundLabel = (fund: DepositFund) => (fund === "saving" ? "Tiết kiệm" : "Dự phòng");
  const filterOptions: Array<{ id: DepositFilter; label: string }> = [
    { id: "all", label: "Tổng" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
  ];
  const fundOptions: Array<{ id: DepositFund; label: string }> = [
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
  ];
  const effectiveFilter = fixedFilter === "all" ? embeddedFilter : fixedFilter ?? activeFilter;
  const rows = state.bankDeposits
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => effectiveFilter === "all" || item.fund === effectiveFilter)
    .sort((left, right) => right.item.startDate.localeCompare(left.item.startDate) || right.index - left.index)
    .map(({ item }) => item);
  const savingActiveTotal = state.bankDeposits.filter((item) => item.fund === "saving").reduce((sum, item) => sum + activePrincipal(item), 0);
  const emergencyActiveTotal = state.bankDeposits.filter((item) => item.fund === "emergency").reduce((sum, item) => sum + activePrincipal(item), 0);
  const activeTotal = effectiveFilter === "saving" ? savingActiveTotal : effectiveFilter === "emergency" ? emergencyActiveTotal : savingActiveTotal + emergencyActiveTotal;
  const pendingAllocations = state.allocations
    .filter((allocation) => allocation.confirmedAt)
    .flatMap((allocation) =>
      fundOptions.map(({ id }) => ({
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
      const fund = withdrawal.destination as DepositFund;
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
      const fund = sale.destination as DepositFund;
      return {
        source: "stock" as const,
        fund,
        month: monthFromDate(sale.date),
        amount: sale.vndAmount,
        title: `${fundLabel(fund)} · Rút từ CK chưa tạo sổ`,
        note: sale.note ? `Rút từ CK ${sale.symbol} · ${sale.note} ${stockSaleDepositMarker(sale.id)}` : `Rút từ CK ${sale.symbol} ${stockSaleDepositMarker(sale.id)}`,
      };
    });
  const pendingBtcTransferDeposits = state.btcTransfers
    .filter(
      (transfer) =>
        (transfer.destination === "saving" || transfer.destination === "emergency") &&
        !state.bankDeposits.some((deposit) => deposit.note.includes(btcTransferDepositMarker(transfer.id)))
    )
    .map((transfer) => {
      const fund = transfer.destination as DepositFund;
      return {
        source: "btc" as const,
        fund,
        month: monthFromDate(transfer.date),
        amount: transfer.vndAmount,
        title: `${fundLabel(fund)} · Rút từ BTC chưa tạo sổ`,
        note: transfer.note ? `Rút từ BTC · ${transfer.note} ${btcTransferDepositMarker(transfer.id)}` : `Rút từ BTC ${btcTransferDepositMarker(transfer.id)}`,
      };
    });
  const pendingDepositRequests: PendingDepositRequest[] = [...pendingAllocations, ...pendingSolDeposits, ...pendingStockSaleDeposits, ...pendingBtcTransferDeposits].sort((a, b) => a.month.localeCompare(b.month));

  const updateDepositDate = (date: string) => {
    setForm((prev) => ({ ...prev, date, maturityDate: addMonths(date, Number(prev.term) || 0) }));
  };

  const updateDepositTerm = (term: string) => {
    setForm((prev) => ({ ...prev, term, maturityDate: addMonths(prev.date, Number(term) || 0) }));
  };

  const openDepositForm = (nextForm: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...nextForm }));
    setFormOpen(true);
  };

  const openManualDepositForm = () => {
    setPendingSource(null);
    openDepositForm({ fund: effectiveFilter === "all" ? form.fund : effectiveFilter, allocationSource: false, sourceMonth: "", sourceSolWithdrawalId: "" });
  };

  const prefillPendingDeposit = (allocation: PendingDepositRequest) => {
    setPendingSource(null);
    openDepositForm({
      fund: allocation.fund,
      amount: allocation.amount.toLocaleString("vi-VN"),
      date: today(),
      maturityDate: addMonths(today(), Number(form.term) || 0),
      sourceMonth: allocation.month,
      allocationSource: allocation.source === "allocation",
      sourceSolWithdrawalId: allocation.solWithdrawalId ?? "",
      note: allocation.note,
    });
  };

  const addDeposit = () => {
    const amount = parseMoney(form.amount);
    if (!amount) return;
    setState((prev) => {
      const sourceMonth = form.sourceMonth || monthFromDate(form.date);
      const nextDeposit = makeDeposit(
        prev.bankDeposits,
        form.fund,
        amount,
        Number(form.rate),
        Number(form.term),
        form.date,
        form.maturityDate,
        sourceMonth,
        form.note,
        pendingSource?.id,
        form.sourceSolWithdrawalId || undefined
      );

      const bankDeposits = pendingSource
        ? prev.bankDeposits.map((item) =>
            item.id === pendingSource.id
              ? {
                  ...item,
                  status: "settled" as DepositStatus,
                  childId: nextDeposit.id,
                  settledAt: pendingSource.maturityDate,
                  settledAmount: nextDeposit.principal,
                }
              : item
          )
        : prev.bankDeposits;

      return {
        ...prev,
        bankDeposits: [...bankDeposits, nextDeposit],
        allocations: form.allocationSource
          ? prev.allocations.map((allocation) =>
              allocation.month === sourceMonth
                ? { ...allocation, [depositCreatedField(form.fund)]: new Date().toISOString() }
                : allocation
            )
          : prev.allocations,
      };
    });
    setForm(defaultDepositForm());
    setFormOpen(false);
    setPendingSource(null);
  };

  const settleEarly = (id: string, settlementDate: string) => {
    setState((prev) => ({
      ...prev,
      bankDeposits: prev.bankDeposits.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "early-settled",
              settledAt: settlementDate || today(),
              settledAmount: item.principal,
            }
          : item
      ),
    }));
    setEarlySettlementDates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const createNewFromMatured = (item: BankDeposit) => {
    const nextPrincipal = item.principal + interestFor(item);
    setPendingSource(item);
    openDepositForm({
      fund: item.fund,
      amount: nextPrincipal.toLocaleString("vi-VN"),
      date: item.maturityDate,
      maturityDate: addMonths(item.maturityDate, item.termMonths),
      term: String(item.termMonths),
      rate: String(item.rate),
      sourceMonth: monthFromDate(item.maturityDate),
      allocationSource: false,
      sourceSolWithdrawalId: "",
      note: `Tạo mới từ ${item.code}`,
    });
  };

  const settleMatured = (id: string) => {
    setState((prev) => ({
      ...prev,
      bankDeposits: prev.bankDeposits.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "settled",
              settledAt: today(),
              settledAmount: item.principal + interestFor(item),
            }
          : item
      ),
    }));
  };

  const deleteDeposit = (item: BankDeposit) => {
    if (!window.confirm(`Xóa sổ ${item.code}? Thao tác này sẽ xóa sổ khỏi lịch sử và bảng tăng trưởng tài sản.`)) return;

    setState((prev) => ({
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
      allocations: item.createdFromMonth && !item.createdFromSolWithdrawalId
        ? prev.allocations.map((allocation) =>
            allocation.month === item.createdFromMonth
              ? { ...allocation, [depositCreatedField(item.fund)]: allocation[depositCreatedField(item.fund)] ?? new Date().toISOString() }
              : allocation
          )
        : prev.allocations,
    }));
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
            <p className="eyebrow">Quỹ MBB</p>
            <h1>Sổ MBB</h1>
          </div>
        </header>
      )}
      {!fixedFilter && (
        <div className="deposit-tabs" role="tablist" aria-label="Lọc sổ MBB">
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
      <section className="metrics-grid">
        <MetricCard label="Tổng gốc đang gửi" value={formatVnd(savingActiveTotal + emergencyActiveTotal)} icon={<Landmark size={20} />} tone={effectiveFilter === "all" ? "highlight" : undefined} onClick={fixedFilter === "all" ? () => setEmbeddedFilter("all") : undefined} />
        <MetricCard label="Tổng quỹ tiết kiệm" value={formatVnd(savingActiveTotal)} icon={<PiggyBank size={20} />} tone={effectiveFilter === "saving" ? "highlight" : undefined} onClick={fixedFilter === "all" ? () => setEmbeddedFilter("saving") : undefined} />
        <MetricCard label="Tổng quỹ dự phòng" value={formatVnd(emergencyActiveTotal)} icon={<Landmark size={20} />} tone={effectiveFilter === "emergency" ? "highlight" : undefined} onClick={fixedFilter === "all" ? () => setEmbeddedFilter("emergency") : undefined} />
      </section>
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
            <button className="ghost asset-open-button" onClick={openManualDepositForm}>
              Mở form
            </button>
          ) : (
            <button className="icon-button" title="Lưu sổ" onClick={addDeposit}>
              <Save size={18} />
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
                    onClick={() => setForm({ ...form, fund: option.id })}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Số tiền
              <input value={form.amount} onChange={(event) => setForm({ ...form, amount: formatMoneyInput(event.target.value) })} placeholder="6.000.000" />
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
              <input type="date" value={form.maturityDate} onChange={(event) => setForm({ ...form, maturityDate: event.target.value })} />
            </label>
            <label>
              Lãi suất %
              <input value={form.rate} onChange={(event) => setForm({ ...form, rate: formatDecimalInput(event.target.value) })} />
            </label>
            <label>
              Note
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </label>
            <button className="primary" onClick={addDeposit}>
              <Plus size={17} /> Thêm sổ
            </button>
          </div>
        )}
      </section>

      <section className="deposit-list">
        {rows.map((item) => {
          const due = daysUntil(item.maturityDate);
          const matured = due <= 0 && item.status === "active";
          const interest = interestFor(item);
          const progress = depositProgress(item);
          return (
            <article className={`deposit-card ${due <= 7 && item.status === "active" ? "danger" : due <= 30 && item.status === "active" ? "warning" : ""}`} key={item.id}>
              <button className="deposit-delete-button" onClick={() => deleteDeposit(item)} title={`Xóa sổ ${item.code}`} type="button" aria-label={`Xóa sổ ${item.code}`}>
                <X size={16} />
              </button>
              <div className="deposit-head">
                <div>
                  <div className="deposit-code-row">
                    <small>{item.code}</small>
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
                      aria-label={`4 số cuối sổ ${item.code}`}
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
                <span>Lãi {item.rate}%/năm</span>
                <span>Lãi cuối kỳ {formatVnd(interest)}</span>
                {item.status === "early-settled" && item.settledAt && <span>Tất toán trước hạn {formatDate(item.settledAt)}</span>}
              </div>
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
              {item.parentId && <p className="muted">Tạo mới từ sổ trước.</p>}
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
                    Tất toán trước hạn
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function statusLabel(status: DepositStatus) {
  const labels: Record<DepositStatus, string> = {
    active: "Đang gửi",
    "rolled-principal": "Đã quay vòng gốc",
    "rolled-all": "Đã quay vòng gốc + lãi",
    settled: "Đã tất toán",
    "early-settled": "Tất toán trước hạn",
  };
  return labels[status];
}

function SolPage({
  state,
  setState,
  onRefreshMarket,
  marketStatus,
  btcCloudAccountId,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
  marketStatus: string;
  btcCloudAccountId: string;
  embedded?: boolean;
}) {
  type SolFormMode = "buy" | "withdraw";

  const [form, setForm] = useState({ sol: "", price: "", date: today(), note: "" });
  const [formMode, setFormMode] = useState<SolFormMode>("buy");
  const [withdrawForm, setWithdrawForm] = useState({
    sol: "",
    price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "",
    vnd: "",
    destination: "cash" as SolDestination,
    date: today(),
    note: "",
  });
  const [withdrawError, setWithdrawError] = useState("");
  const solStats = solPosition(state.solTransactions);
  const totalSol = solStats.balance;
  const cost = solStats.cost;
  const currentUsd = totalSol * state.market.solUsd;
  const pnl = currentUsd - cost;
  const pnlPercent = cost ? (pnl / cost) * 100 : 0;
  const currentVnd = currentUsd * state.market.usdVnd;
  const pnlVnd = pnl * state.market.usdVnd;
  const destinationOptions: Array<{ id: SolDestination; label: string }> = [
    { id: "btc", label: "BTC" },
    { id: "stock", label: "CK" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "cash", label: "Tiền mặt" },
  ];

  useEffect(() => {
    setWithdrawForm((prev) => {
      if (prev.price || !state.market.solUsd) return prev;
      return { ...prev, price: formatDecimalInput(String(state.market.solUsd)) };
    });
  }, [state.market.solUsd]);

  const estimatedWithdrawVnd = (solInput: string, priceInput: string) =>
    Math.round(parseDecimal(solInput) * parseDecimal(priceInput) * state.market.usdVnd);

  const updateWithdrawSol = (sol: string) => {
    const nextSol = formatDecimalInput(sol);
    const estimate = estimatedWithdrawVnd(nextSol, withdrawForm.price);
    setWithdrawForm((prev) => ({ ...prev, sol: nextSol, vnd: estimate ? estimate.toLocaleString("vi-VN") : "" }));
    setWithdrawError("");
  };

  const updateWithdrawPrice = (price: string) => {
    const nextPrice = formatDecimalInput(price);
    const estimate = estimatedWithdrawVnd(withdrawForm.sol, nextPrice);
    setWithdrawForm((prev) => ({ ...prev, price: nextPrice, vnd: estimate ? estimate.toLocaleString("vi-VN") : "" }));
    setWithdrawError("");
  };

  const updateWithdrawVnd = (vnd: string) => {
    const nextVnd = formatMoneyInput(vnd);
    const sol = parseDecimal(withdrawForm.sol);
    const vndAmount = parseMoney(nextVnd);
    const price = sol && state.market.usdVnd ? vndAmount / sol / state.market.usdVnd : 0;
    setWithdrawForm((prev) => ({ ...prev, vnd: nextVnd, price: price ? formatDecimalInput(price.toFixed(2)) : prev.price }));
    setWithdrawError("");
  };

  const addSol = () => {
    const sol = parseDecimal(form.sol);
    const price = parseDecimal(form.price);
    if (!sol || !price) return;
    setState((prev) => ({
      ...prev,
      solTransactions: [...prev.solTransactions, { id: uid(), type: "buy", solAmount: sol, buyPrice: price, date: form.date, note: form.note }],
    }));
    setForm({ sol: "", price: "", date: today(), note: "" });
  };

  const withdrawSol = () => {
    const sol = parseDecimal(withdrawForm.sol);
    const sellPrice = parseDecimal(withdrawForm.price);
    const vndAmount = parseMoney(withdrawForm.vnd);
    if (!sol || !sellPrice || !vndAmount) return;
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
      vndAmount,
      destination: withdrawForm.destination,
      date: withdrawForm.date,
      note,
    };
    const btcTopup: BtcUsdtTopup | null =
      withdrawal.destination === "btc"
        ? {
            id: uid(),
            vndAmount,
            usdtAmount: sol * sellPrice,
            date: withdrawal.date,
            note: `${transferNote} · USDT từ SOL`,
          }
        : null;

    setState((prev) => ({
      ...prev,
      solTransactions: [...prev.solTransactions, withdrawal],
      btcUsdtTopups: btcTopup ? [...prev.btcUsdtTopups, btcTopup] : prev.btcUsdtTopups,
      fundTransactions:
        withdrawal.destination === "btc" || withdrawal.destination === "stock"
          ? [
              ...prev.fundTransactions,
              {
                id: uid(),
                fund: withdrawal.destination,
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

    setWithdrawForm({
      sol: "",
      price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "",
      vnd: "",
      destination: "cash",
      date: today(),
      note: "",
    });
    setWithdrawError("");
  };

  const content = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">SOL</p>
        </div>
      </header>
      <section className="metrics-grid">
        <MetricCard label="Tổng SOL" value={totalSol.toLocaleString("vi-VN", { maximumFractionDigits: 4 })} icon={<Coins size={20} />} />
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
              <small>SOL</small>
              <strong>{state.market.solUsd ? formatUsd(state.market.solUsd) : "Đang chờ"}</strong>
            </div>
            <div>
              <small>USD/VND</small>
              <strong>{state.market.usdVnd ? formatVnd(state.market.usdVnd) : "Đang chờ"}</strong>
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
                  <input value={form.sol} onChange={(event) => setForm({ ...form, sol: formatDecimalInput(event.target.value) })} placeholder="0,61" />
                </label>
                <label>
                  Giá mua
                  <input value={form.price} onChange={(event) => setForm({ ...form, price: formatDecimalInput(event.target.value) })} placeholder="77,58" />
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
                  <input value={withdrawForm.sol} onChange={(event) => updateWithdrawSol(event.target.value)} placeholder="0,25" />
                </label>
                <label>
                  Giá SOL lúc rút
                  <input value={withdrawForm.price} onChange={(event) => updateWithdrawPrice(event.target.value)} placeholder={state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "76,43"} />
                </label>
                <label>
                  Tiền VND nhận
                  <input value={withdrawForm.vnd} onChange={(event) => updateWithdrawVnd(event.target.value)} placeholder="5.000.000" />
                </label>
                <label>
                  Nơi nhận
                  <select value={withdrawForm.destination} onChange={(event) => setWithdrawForm({ ...withdrawForm, destination: event.target.value as SolDestination })}>
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
        <div className="timeline">
          {[...state.solTransactions].reverse().map((item) => (
            <div key={item.id}>
              <span className={isSolWithdrawal(item) ? "withdraw" : "deposit"}>{isSolWithdrawal(item) ? "-" : "+"}</span>
              <div>
                {isSolWithdrawal(item) ? (
                  <>
                    <strong>-{item.solAmount} SOL · {formatVnd(item.vndAmount)}</strong>
                    <small>{formatDate(item.date)} · Rút về {solDestinationLabel(item.destination)} · Giá rút {formatUsd(item.sellPrice)} · {item.note || "Không ghi chú"}</small>
                  </>
                ) : (
                  <>
                    <strong>{item.solAmount} SOL · {formatUsd(item.solAmount * item.buyPrice)}</strong>
                    <small>{formatDate(item.date)} · Giá mua {formatUsd(item.buyPrice)} · {item.note || "Không ghi chú"}</small>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function ReportsPage({
  state,
  setState,
  onRefreshMarket,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onRefreshMarket: (silent?: boolean) => Promise<boolean>;
}) {
  const [activeReportChart, setActiveReportChart] = useState<ReportChartKey>("current-assets");
  const [reportRefreshSuccess, setReportRefreshSuccess] = useState(false);
  const reportRefreshTimer = useRef<number | null>(null);
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

  const btc = btcPortfolioStats(state).reportValueVnd;
  const stock = stockPortfolioStats(state).totalValue;
  const savingActive = state.bankDeposits.filter((item) => item.fund === "saving").reduce((sum, item) => sum + activePrincipal(item), 0);
  const emergencyActive = state.bankDeposits.filter((item) => item.fund === "emergency").reduce((sum, item) => sum + activePrincipal(item), 0);
  const saving = savingActive + pendingSolDepositTotal(state, "saving") + pendingStockSaleDepositTotal(state, "saving") + pendingBtcTransferDepositTotal(state, "saving");
  const emergency = emergencyActive + pendingSolDepositTotal(state, "emergency") + pendingStockSaleDepositTotal(state, "emergency") + pendingBtcTransferDepositTotal(state, "emergency");
  const solVnd = solPosition(state.solTransactions).balance * state.market.solUsd * state.market.usdVnd;
  const totalAssets = btc + stock + saving + emergency + solVnd;
  const assetPercent = (value: number) => totalAssets ? Math.round((value / totalAssets) * 100) : 0;
  const reportChartLabels: Record<ReportChartKey, string> = {
    "current-assets": "Tổng tài sản hiện tại",
    "net-accumulation": "Tổng số tiền tích lũy",
    btc: "BTC",
    stock: "CK",
    saving: "Quỹ tiết kiệm",
    emergency: "Quỹ dự phòng",
  };
  const fundRows = [
    { id: "btc" as const, label: "BTC", value: btc },
    { id: "stock" as const, label: "CK", value: stock },
    { id: "saving" as const, label: "Quỹ tiết kiệm", value: saving },
    { id: "emergency" as const, label: "Quỹ dự phòng", value: emergency },
  ];
  const pnlRows = assetPnlRows(state);
  const activeAccumulationGoals = state.accumulationGoals.filter((goal) => goal.status === "active");

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
  const depositBalanceAtMonth = (fund: DepositFund, month: string) =>
    state.bankDeposits
      .filter((item) =>
        item.fund === fund &&
        monthFromDate(item.startDate) <= month &&
        (!item.settledAt || monthFromDate(item.settledAt) > month)
      )
      .reduce((sum, item) => sum + item.principal, 0);
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
      .reduce((sum, sale) => sum + sale.vndAmount, 0);
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
  const solValueAtMonth = (month: string) =>
    solPosition(state.solTransactions.filter((item) => monthFromDate(item.date) <= month)).balance * state.market.solUsd * state.market.usdVnd;
  const withdrawalAtMonth = (key: ReportChartKey, month: string) => {
    if (key === "btc" || key === "stock") {
      return state.fundTransactions
        .filter((item) => item.fund === key && item.type === "withdraw" && item.month === month)
        .reduce((sum, item) => sum + item.amount, 0);
    }
    if (key === "saving" || key === "emergency") {
      return state.bankDeposits
        .filter((item) => item.fund === key && item.settledAt && monthFromDate(item.settledAt) === month)
        .reduce((sum, item) => sum + (item.settledAmount ?? item.principal), 0);
    }
    return monthlyWithdrawal(state, month);
  };

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
      const rowBtc = btcPortfolioStats(state, month).reportValueVnd;
      const rowStock = stockPortfolioStats(state, month).totalValue;
      const rowSaving = depositFundBalanceAtMonth("saving", month);
      const rowEmergency = depositFundBalanceAtMonth("emergency", month);
      const rowSol = solValueAtMonth(month);
      const currentAssets = rowBtc + rowStock + rowSaving + rowEmergency + rowSol;
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
  const netAccumulationTotal = reportRows[reportRows.length - 1]?.netAccumulation ?? 0;

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
        <MetricCard label="SOL" value={formatVnd(solVnd)} percent={assetPercent(solVnd)} icon={<Coins size={20} />} />
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>{reportChartLabels[activeReportChart]}</h2>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={reportRows}>
            <defs>
              <linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2520" />
            <XAxis dataKey="month" stroke="#a59b91" />
            <YAxis stroke="#a59b91" tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}M`} />
            <Tooltip content={<GrowthTooltip chartKey={activeReportChart} label={reportChartLabels[activeReportChart]} />} />
            <Area type="monotone" dataKey="value" stroke="#f97316" fill="url(#assetFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <section className="asset-grid">
        {fundRows.map((fund) => (
          <FundChip
            key={fund.label}
            label={fund.label}
            value={fund.value}
            percent={assetPercent(fund.value)}
            tone={activeReportChart === fund.id ? "highlight" : undefined}
            onClick={() => setActiveReportChart(fund.id)}
          />
        ))}
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Lãi/lỗ theo gốc</h2>
        </div>
        <div className="asset-pnl-table">
          <div>
            <strong>Tên quỹ</strong>
            <strong>Gốc đầu tư</strong>
            <strong>Giá trị hiện tại</strong>
            <strong>Lãi/lỗ</strong>
            <strong>%</strong>
          </div>
          {pnlRows.map((row) => (
            <div className={row.id === "total" ? "total" : ""} key={row.id}>
              <span>{row.label}</span>
              <span>{formatVnd(row.principal)}</span>
              <span>{formatVnd(row.current)}</span>
              <span className={row.pnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{formatVnd(row.pnl)}</span>
              <span className={row.pnl < 0 ? "stock-pnl loss" : "stock-pnl gain"}>{row.principal ? `${row.pnlPercent.toFixed(1)}%` : "0.0%"}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Tích lũy</h2>
          <small>Các mục đang dồn tiền</small>
        </div>
        {activeAccumulationGoals.length === 0 ? (
          <p className="muted">Chưa có mục tích lũy đang hoạt động.</p>
        ) : (
          <div className="accumulation-grid">
            {activeAccumulationGoals.map((goal) => {
              const progress = accumulationProgress(state, goal);
              const percent = goal.targetAmount ? Math.min((progress / goal.targetAmount) * 100, 100) : 0;
              const paidMonths = accumulationPaidMonths(state, goal);
              const endMonth = goal.dueDate ? monthFromDate(goal.dueDate) : shiftMonth(goal.startMonth, Math.max(goal.months - 1, 0));
              return (
                <article className="accumulation-card" key={goal.id}>
                  <div className="panel-title">
                    <div>
                      <h2>{goal.name}</h2>
                      <small>{formatMonth(goal.startMonth)} - {formatMonth(endMonth)}</small>
                    </div>
                    <strong>{percent.toFixed(0)}%</strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className="accumulation-summary">
                    <span>Mục tiêu <strong>{formatVnd(progress)} / {formatVnd(goal.targetAmount)}</strong></span>
                    <span>Số tháng dồn <strong>{paidMonths}/{goal.months}</strong></span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function monthlyWithdrawal(state: AppState, month: string) {
  const fundWithdrawals = state.fundTransactions
    .filter((item) => item.type === "withdraw" && item.month === month)
    .reduce((sum, item) => sum + item.amount, 0);

  const depositSettlements = state.bankDeposits
    .filter((item) => item.settledAt ? monthFromDate(item.settledAt) === month : false)
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
    { label: "BTC", value: point.btc },
    { label: "CK", value: point.stock },
    { label: "Tiết kiệm", value: point.saving },
    { label: "Dự phòng", value: point.emergency },
    { label: "SOL", value: point.sol },
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

function AdminPage() {
  const cloudConfigured = isCloudSyncConfigured();
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [replacementPin, setReplacementPin] = useState("");
  const [status, setStatus] = useState(cloudConfigured ? "Nhập mật khẩu admin để tiếp tục." : "Thiếu cấu hình Supabase.");
  const [loading, setLoading] = useState(false);

  const unlockAdmin = async () => {
    if (!adminPassword) {
      setStatus("Nhập mật khẩu admin.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang kiểm tra mật khẩu admin...");
      const expectedHash = await loadAdminPasswordHash(DEFAULT_ADMIN_PASSWORD_HASH);
      const passwordHash = await sha256Hex(adminPassword);
      if (passwordHash !== expectedHash) {
        setStatus("Mật khẩu admin chưa đúng.");
        return;
      }

      setAdminUnlocked(true);
      setAdminPassword("");
      setStatus("Sẵn sàng quản lý tài khoản PIN.");
    } catch {
      setStatus("Không kiểm tra được mật khẩu admin.");
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    if (!cloudConfigured) {
      setStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (newPin.length < 4) {
      setStatus("PIN mới cần tối thiểu 4 số.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang kiểm tra tài khoản...");
      const accountKey = cloudAccountKeyForPin(newPin);
      const existing = await loadCloudState<AppState>(accountKey);
      if (existing) {
        setStatus("PIN này đã có tài khoản. Hãy chọn PIN khác hoặc đổi PIN.");
        return;
      }

      await saveCloudState(accountKey, stateForAccountPin(initialState, newPin));
      setNewPin("");
      setStatus("Đã tạo tài khoản mới. Bạn có thể quay lại app và đăng nhập bằng PIN này.");
    } catch {
      setStatus("Không tạo được tài khoản. Kiểm tra Supabase hoặc kết nối mạng.");
    } finally {
      setLoading(false);
    }
  };

  const changeAccountPin = async () => {
    if (!cloudConfigured) {
      setStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (oldPin.length < 4 || replacementPin.length < 4) {
      setStatus("PIN cũ và PIN mới cần tối thiểu 4 số.");
      return;
    }
    if (oldPin === replacementPin) {
      setStatus("PIN mới phải khác PIN cũ.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang tải dữ liệu tài khoản cũ...");
      const oldKey = cloudAccountKeyForPin(oldPin);
      const oldState = await loadCloudState<AppState>(oldKey);
      if (!oldState) {
        setStatus("Không tìm thấy tài khoản với PIN cũ.");
        return;
      }

      const nextKey = cloudAccountKeyForPin(replacementPin);
      const existingNext = await loadCloudState<AppState>(nextKey);
      if (existingNext) {
        setStatus("PIN mới đã có tài khoản khác. Hãy chọn PIN khác.");
        return;
      }

      const nextState = normalizeState({
        ...initialState,
        ...oldState,
        settings: { ...initialState.settings, ...oldState.settings, hasPin: true, pin: replacementPin },
      });
      await saveCloudState(nextKey, nextState);
      await deleteCloudState(oldKey);
      setOldPin("");
      setReplacementPin("");
      setStatus("Đã đổi PIN. Từ giờ hãy đăng nhập bằng PIN mới.");
    } catch {
      setStatus("Không đổi được PIN. Nếu bạn đã tạo bảng trước đó, hãy chạy lại supabase-schema.sql rồi thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pin-screen">
      <section className="pin-card admin-card">
        <div className="pin-icon">
          <Settings size={26} />
        </div>
        <h1>Admin tài khoản</h1>
        <p>{adminUnlocked ? "Tạo tài khoản PIN mới hoặc đổi PIN cho tài khoản hiện có." : "Đăng nhập admin để quản lý tài khoản PIN."}</p>

        {!adminUnlocked ? (
          <div className="admin-stack">
            <article>
              <h2>Đăng nhập admin</h2>
              <label>
                Mật khẩu admin
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") unlockAdmin();
                  }}
                />
              </label>
              <button className="primary full" disabled={loading} onClick={unlockAdmin}>
                {loading ? "Đang kiểm tra..." : "Đăng nhập admin"}
              </button>
            </article>
          </div>
        ) : (
          <div className="admin-stack">
            <article>
              <h2>Tạo tài khoản</h2>
            <label>
              PIN mới
              <input
                className="pin-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="primary full" disabled={loading || !cloudConfigured} onClick={createAccount}>
              Tạo tài khoản
            </button>
            </article>

            <article>
              <h2>Đổi PIN</h2>
            <label>
              PIN cũ
              <input
                className="pin-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={oldPin}
                onChange={(event) => setOldPin(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label>
              PIN mới
              <input
                className="pin-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={replacementPin}
                onChange={(event) => setReplacementPin(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="primary full" disabled={loading || !cloudConfigured} onClick={changeAccountPin}>
              Đổi PIN
            </button>
            </article>
          </div>
        )}

        <small className={cloudConfigured ? "ok" : "form-error"}>{status}</small>
        <a className="admin-link" href="/">Về app</a>
      </section>
    </main>
  );
}

function SettingsPage({
  state,
  setState,
  cloudSync,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  cloudSync: {
    configured: boolean;
    status: string;
    onSyncNow: () => void;
    onChangePin: (pin: string) => void;
  };
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cài đặt</p>
          <h1>Bảo mật và dữ liệu</h1>
        </div>
      </header>
      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Mã PIN</h2>
            <small>{state.settings.hasPin ? "Đang bật" : "Chưa bật"}</small>
          </div>
          <div className="form-grid">
            <label>
              PIN mới
              <input className="pin-input" type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (pin.length < 4) return;
              cloudSync.onChangePin(pin);
              setPin("");
            }}
          >
            <Save size={17} /> Lưu PIN
          </button>
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>Dữ liệu</h2>
            <small>{cloudSync.configured ? "Supabase" : "Chưa cấu hình"}</small>
          </div>
          <div className="cloud-sync-box">
            <p className="muted">
              Đồng bộ laptop và iPhone bằng Supabase. Mã PIN chính là khóa mở dữ liệu tài khoản trên mọi thiết bị.
            </p>
            <small className={cloudSync.configured ? "ok" : "muted"}>{cloudSync.status}</small>
            <div className="card-actions">
              <button className="primary" disabled={!cloudSync.configured} onClick={cloudSync.onSyncNow}>
                Đồng bộ ngay
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

type QuickActionGroup = "income" | "expense" | "btc" | "stock" | "mbb" | "sol";
type QuickActionKind =
  | "income"
  | "expense"
  | "btc-usdt"
  | "btc-dca"
  | "btc-transfer"
  | "stock-buy"
  | "stock-transfer"
  | "deposit"
  | "sol-buy"
  | "sol-transfer";

function QuickActionButton({
  state,
  setState,
  btcCloudAccountId,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  btcCloudAccountId: string;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<QuickActionGroup>("income");
  const [kind, setKind] = useState<QuickActionKind>("income");
  const [error, setError] = useState("");
  const [income, setIncome] = useState({ categoryId: state.incomeCategories[0]?.id ?? "", amount: "", date: today(), note: "" });
  const [expense, setExpense] = useState({ categoryId: state.expenseCategories[0]?.id ?? "", amount: "", date: today(), note: "" });
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
  const [quickStockRows, setQuickStockRows] = useState<StockBuyRow[]>(() => [{ id: uid(), symbol: "", percent: "100", shares: "", buyPrice: "" }]);
  const [quickStockMeta, setQuickStockMeta] = useState({ date: today(), note: "" });
  const [stockTransfer, setStockTransfer] = useState({ symbol: "", shares: "", price: "", destination: "stock" as SolDestination, date: today(), note: "" });
  const [deposit, setDeposit] = useState({ fund: "saving" as DepositFund, amount: "", rate: "6", term: "12", date: today(), mbLast4: "", note: "" });
  const [sol, setSol] = useState({ amount: "", price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "", date: today(), note: "" });
  const [solTransfer, setSolTransfer] = useState({ amount: "", price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "", vnd: "", destination: "cash" as SolDestination, date: today(), note: "" });
  const groups: Array<{ id: QuickActionGroup; label: string; defaultKind: QuickActionKind }> = [
    { id: "income", label: "Thu nhập", defaultKind: "income" },
    { id: "expense", label: "Chi tiêu", defaultKind: "expense" },
    { id: "btc", label: "BTC", defaultKind: "btc-usdt" },
    { id: "stock", label: "CK", defaultKind: "stock-buy" },
    { id: "mbb", label: "Sổ MBB", defaultKind: "deposit" },
    { id: "sol", label: "SOL", defaultKind: "sol-buy" },
  ];
  const subActions: Record<QuickActionGroup, Array<{ id: QuickActionKind; label: string }>> = {
    income: [{ id: "income", label: "Thêm thu nhập" }],
    expense: [{ id: "expense", label: "Thêm chi tiêu" }],
    btc: [
      { id: "btc-usdt", label: "Mua USDT" },
      { id: "btc-dca", label: "Tạo DCA" },
      { id: "btc-transfer", label: "Rút / chuyển" },
    ],
    stock: [
      { id: "stock-buy", label: "Mua CK" },
      { id: "stock-transfer", label: "Rút / chuyển" },
    ],
    mbb: [{ id: "deposit", label: "Tạo sổ" }],
    sol: [
      { id: "sol-buy", label: "Mua SOL" },
      { id: "sol-transfer", label: "Rút / chuyển" },
    ],
  };
  const btcStats = btcPortfolioStats(state);
  const stockStats = stockPortfolioStats(state);
  const solStats = solPosition(state.solTransactions);
  const quickStockPlannedValue = quickStockRows.reduce((sum, row) => sum + stockLineValue({ shares: Number(row.shares) || 0, buyPrice: parseDecimal(row.buyPrice) }), 0);
  const quickStockPlannedPercent = stockStats.cash ? Math.round((quickStockPlannedValue / stockStats.cash) * 100) : 0;
  const stockDestinationOptions: Array<{ id: SolDestination; label: string }> = [
    { id: "stock", label: "CK" },
    { id: "btc", label: "BTC" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "cash", label: "Tiền mặt" },
  ];
  const solDestinationOptions: Array<{ id: SolDestination; label: string }> = [
    { id: "btc", label: "BTC" },
    { id: "stock", label: "CK" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
    { id: "cash", label: "Tiền mặt" },
  ];

  const close = () => {
    setOpen(false);
    setError("");
  };

  const selectGroup = (next: (typeof groups)[number]) => {
    setGroup(next.id);
    setKind(next.defaultKind);
    setError("");
  };

  const btcTransferPriceFor = (asset: "btc" | "usdt", destination: BtcTransferTarget) => {
    if (asset === "btc" || destination === "btc") return state.market.btcUsdt;
    return state.market.usdtVnd || state.market.usdVnd;
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

  const quickStockAutoShares = (percentInput: string, priceInput: string) => {
    const percent = Number(percentInput) || 0;
    const price = parseDecimal(priceInput);
    if (!stockStats.cash || !percent || !price) return "";
    const rawShares = Math.floor((stockStats.cash * percent) / 100 / (price * STOCK_PRICE_UNIT));
    const shares = rawShares >= STOCK_LOT ? Math.floor(rawShares / STOCK_LOT) * STOCK_LOT : rawShares;
    return shares > 0 ? String(shares) : "";
  };

  const recalculateQuickStockShares = (row: StockBuyRow): StockBuyRow => ({
    ...row,
    shares: quickStockAutoShares(row.percent, row.buyPrice),
  });

  const updateQuickStockRow = (id: string, patch: Partial<Omit<StockBuyRow, "id">>) => {
    setQuickStockRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if ("percent" in patch || "buyPrice" in patch) return recalculateQuickStockShares(next);
        return next;
      })
    );
  };

  const updateQuickStockPercent = (id: string, value: string) => {
    const nextPercent = Math.max(Math.min(Number(value) || 0, 100), 0);
    setQuickStockRows((prev) => {
      const others = prev.filter((row) => row.id !== id);
      if (others.length === 0) {
        return prev.map((row) => (row.id === id ? recalculateQuickStockShares({ ...row, percent: String(nextPercent) }) : row));
      }
      const remaining = Math.max(100 - nextPercent, 0);
      const otherCurrentTotal = others.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      let assigned = 0;
      return prev.map((row) => {
        if (row.id === id) return recalculateQuickStockShares({ ...row, percent: String(nextPercent) });
        const isLastOther = others[others.length - 1]?.id === row.id;
        const percent = isLastOther
          ? remaining - assigned
          : Math.round((otherCurrentTotal ? ((Number(row.percent) || 0) / otherCurrentTotal) * remaining : remaining / others.length) * 100) / 100;
        assigned += percent;
        return recalculateQuickStockShares({ ...row, percent: String(Math.max(percent, 0)) });
      });
    });
  };

  const addQuickStockRow = () => {
    setQuickStockRows((prev) => {
      if (prev.length === 1) {
        const firstPercent = prev[0].percent === "100" ? "50" : prev[0].percent;
        return [
          recalculateQuickStockShares({ ...prev[0], percent: firstPercent }),
          { id: uid(), symbol: "", percent: String(Math.max(100 - (Number(firstPercent) || 0), 0)), shares: "", buyPrice: "" },
        ];
      }
      return [...prev, { id: uid(), symbol: "", percent: "0", shares: "", buyPrice: "" }];
    });
  };

  const removeQuickStockRow = (id: string) => {
    setQuickStockRows((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((row) => row.id !== id);
      if (next.length === 1) return [recalculateQuickStockShares({ ...next[0], percent: "100" })];
      const total = next.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
      if (!total) return next;
      let assigned = 0;
      return next.map((row, index) => {
        const percent = index === next.length - 1 ? 100 - assigned : Math.round(((Number(row.percent) || 0) / total) * 10000) / 100;
        assigned += percent;
        return recalculateQuickStockShares({ ...row, percent: String(Math.max(percent, 0)) });
      });
    });
  };

  const resetQuickStockForm = () => {
    setQuickStockRows([{ id: uid(), symbol: "", percent: "100", shares: "", buyPrice: "" }]);
    setQuickStockMeta({ date: today(), note: "" });
  };

  const save = () => {
    setError("");
    if (kind === "income") {
      const amount = parseMoney(income.amount);
      if (!amount || !income.categoryId) return setError("Nhập thu nhập hợp lệ.");
      setState((prev) => ({ ...prev, incomeTransactions: [...prev.incomeTransactions, { id: uid(), categoryId: income.categoryId, amount, date: income.date, month: monthFromDate(income.date), note: income.note.trim() }] }));
      setIncome((prev) => ({ ...prev, amount: "", note: "" }));
      close();
      return;
    }
    if (kind === "expense") {
      const amount = parseMoney(expense.amount);
      if (!amount || !expense.categoryId) return setError("Nhập khoản chi hợp lệ.");
      setState((prev) => ({ ...prev, expenseEntries: [...prev.expenseEntries, { id: uid(), categoryId: expense.categoryId, amount, date: expense.date, month: monthFromDate(expense.date), note: expense.note.trim() }] }));
      setExpense((prev) => ({ ...prev, amount: "", note: "" }));
      close();
      return;
    }
    if (kind === "btc-usdt") {
      const vndAmount = parseMoney(usdt.vnd);
      const usdtAmount = parseDecimal(usdt.amount);
      if (!vndAmount || !usdtAmount) return setError("Nhập VND và USDT hợp lệ.");
      const topup: BtcUsdtTopup = { id: uid(), vndAmount, usdtAmount, date: usdt.date, note: usdt.note.trim() };
      setState((prev) => ({ ...prev, btcUsdtTopups: [...prev.btcUsdtTopups, topup] }));
      if (btcCloudAccountId) void upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, topup.id, topup);
      setUsdt((prev) => ({ ...prev, vnd: "", amount: "" }));
      close();
      return;
    }
    if (kind === "btc-dca") {
      const amountUsdt = parseDecimal(dca.amount);
      if (!amountUsdt) return setError("Nhập số USDT mỗi kỳ hợp lệ.");
      const plan = normalizeDcaPlan({ id: uid(), amountUsdt, frequency: dca.frequency, time: dca.time, startDate: dca.startDate, nextRunAt: nextDcaRunAt(dca), isActive: true, status: "active", note: dca.note.trim() });
      setState((prev) => ({ ...prev, btcDcaPlans: [...prev.btcDcaPlans, plan] }));
      if (btcCloudAccountId) void upsertCloudPayloadRow("btc_dca_plans", btcCloudAccountId, plan.id, plan, { is_active: plan.isActive, next_run_at: plan.nextRunAt, status: plan.status });
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
          executedAt: new Date(`${btcTransfer.date}T00:00:00`).toISOString(),
          note: btcTransfer.note.trim() || "Chuyển USDT sang BTC",
        };
        setState((prev) => ({ ...prev, btcTrades: [...prev.btcTrades, trade] }));
        if (btcCloudAccountId) void upsertCloudPayloadRow("btc_trades", btcCloudAccountId, trade.id, trade, { executed_at: trade.executedAt, plan_id: null });
        resetBtcTransfer();
        close();
        return;
      }

      const btcAmount = btcTransfer.asset === "btc" ? source : 0;
      const usdtAmount = btcTransfer.asset === "btc" ? received : source;
      const vndAmount = btcTransfer.destination === "usdt" ? 0 : unit === "VND" ? Math.round(received) : Math.round(usdtAmount * (state.market.usdtVnd || state.market.usdVnd));
      const transfer: BtcTransfer = {
        id: uid(),
        asset: btcTransfer.asset,
        btcAmount,
        usdtAmount,
        btcPriceUsdt: btcTransfer.asset === "btc" ? price : state.market.btcUsdt,
        vndAmount,
        destination: btcTransfer.destination,
        date: btcTransfer.date,
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
      setState((prev) => ({
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
      if (btcCloudAccountId) void upsertCloudPayloadRow("btc_transfers", btcCloudAccountId, transfer.id, transfer, { transfer_at: `${transfer.date}T00:00:00` });
      resetBtcTransfer();
      close();
      return;
    }
    if (kind === "stock-buy") {
      const lines = quickStockRows
        .map((row) => ({
          symbol: row.symbol.trim().toUpperCase(),
          shares: Number(row.shares) || 0,
          buyPrice: parseDecimal(row.buyPrice),
        }))
        .filter((line) => line.symbol && line.shares > 0 && line.buyPrice > 0);
      const total = lines.reduce((sum, line) => sum + stockLineValue(line), 0);
      if (!lines.length) return setError("Nhập ít nhất một mã cổ phiếu hợp lệ.");
      if (total > stockStats.cash) return setError("Tổng giá trị mua đang vượt quá tiền dư CK.");
      const purchase: StockPurchase = { id: uid(), date: quickStockMeta.date, month: monthFromDate(quickStockMeta.date), note: quickStockMeta.note.trim(), lines };
      setState((prev) => ({ ...prev, stockPurchases: [...prev.stockPurchases, purchase] }));
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
      const note = stockTransfer.note.trim();
      const transferNote = note ? `Rút từ CK ${holding.symbol} · ${note}` : `Rút từ CK ${holding.symbol}`;
      const sale: StockSale = {
        id: uid(),
        symbol: holding.symbol,
        shares,
        sellPrice,
        vndAmount,
        destination: stockTransfer.destination,
        date: stockTransfer.date,
        note,
      };
      setState((prev) => ({
        ...prev,
        stockSales: [...prev.stockSales, sale],
        fundTransactions:
          sale.destination === "stock" || sale.destination === "btc"
            ? [...prev.fundTransactions, { id: uid(), fund: sale.destination, type: "deposit", amount: vndAmount, date: sale.date, month: monthFromDate(sale.date), note: transferNote }]
            : prev.fundTransactions,
        incomeTransactions:
          sale.destination === "cash"
            ? [...prev.incomeTransactions, { id: uid(), categoryId: "other-income", amount: vndAmount, date: sale.date, month: monthFromDate(sale.date), note: transferNote }]
            : prev.incomeTransactions,
      }));
      setStockTransfer({ symbol: "", shares: "", price: "", destination: "stock", date: today(), note: "" });
      close();
      return;
    }
    if (kind === "sol-buy") {
      const solAmount = parseDecimal(sol.amount);
      const buyPrice = parseDecimal(sol.price);
      if (!solAmount || !buyPrice) return setError("Nhập số SOL và giá mua hợp lệ.");
      setState((prev) => ({ ...prev, solTransactions: [...prev.solTransactions, { id: uid(), type: "buy", solAmount, buyPrice, date: sol.date, note: sol.note.trim() }] }));
      setSol((prev) => ({ ...prev, amount: "", note: "" }));
      close();
      return;
    }
    if (kind === "sol-transfer") {
      const solAmount = parseDecimal(solTransfer.amount);
      const sellPrice = parseDecimal(solTransfer.price);
      const vndAmount = parseMoney(solTransfer.vnd) || Math.round(solAmount * sellPrice * state.market.usdVnd);
      if (!solAmount || !sellPrice || !vndAmount) return setError("Nhập số SOL, giá và số tiền nhận hợp lệ.");
      if (solAmount - solStats.balance > 0.00000001) return setError("Số SOL rút lớn hơn số SOL đang có.");
      const userNote = solTransfer.note.trim();
      const note = userNote || "Rút từ SOL";
      const transferNote = userNote ? `Rút từ SOL · ${userNote}` : "Rút từ SOL";
      const withdrawal: SolWithdrawTransaction = {
        id: uid(),
        type: "withdraw",
        solAmount,
        sellPrice,
        vndAmount,
        destination: solTransfer.destination,
        date: solTransfer.date,
        note,
      };
      const btcTopup: BtcUsdtTopup | null =
        withdrawal.destination === "btc"
          ? { id: uid(), vndAmount, usdtAmount: solAmount * sellPrice, date: withdrawal.date, note: `${transferNote} · USDT từ SOL` }
          : null;
      setState((prev) => ({
        ...prev,
        solTransactions: [...prev.solTransactions, withdrawal],
        btcUsdtTopups: btcTopup ? [...prev.btcUsdtTopups, btcTopup] : prev.btcUsdtTopups,
        fundTransactions:
          withdrawal.destination === "btc" || withdrawal.destination === "stock"
            ? [...prev.fundTransactions, { id: uid(), fund: withdrawal.destination, type: "deposit", amount: vndAmount, date: withdrawal.date, month: monthFromDate(withdrawal.date), note: transferNote }]
            : prev.fundTransactions,
        incomeTransactions:
          withdrawal.destination === "cash"
            ? [...prev.incomeTransactions, { id: uid(), categoryId: "other-income", amount: vndAmount, date: withdrawal.date, month: monthFromDate(withdrawal.date), note: transferNote }]
            : prev.incomeTransactions,
      }));
      if (btcTopup && btcCloudAccountId) void upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, btcTopup.id, btcTopup);
      setSolTransfer({ amount: "", price: state.market.solUsd ? formatDecimalInput(String(state.market.solUsd)) : "", vnd: "", destination: "cash", date: today(), note: "" });
      close();
      return;
    }
    const amount = parseMoney(deposit.amount);
    const term = Number(deposit.term) || 0;
    if (!amount || !term) return setError("Nhập sổ MBB hợp lệ.");
    const next = {
      ...makeDeposit(state.bankDeposits, deposit.fund, amount, Number(deposit.rate) || 0, term, deposit.date, addMonths(deposit.date, term), monthFromDate(deposit.date), deposit.note.trim()),
      mbLast4: deposit.mbLast4.replace(/\D/g, "").slice(0, 4),
    };
    setState((prev) => ({ ...prev, bankDeposits: [...prev.bankDeposits, next] }));
    setDeposit((prev) => ({ ...prev, amount: "", note: "" }));
    close();
  };

  return (
    <>
      <button className="quick-action-fab" onClick={() => setOpen(true)} title="Thêm nhanh" type="button"><Plus size={24} /></button>
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
              {kind === "income" && <>
                <label>Mục thu<select value={income.categoryId} onChange={(event) => setIncome({ ...income, categoryId: event.target.value })}>{state.incomeCategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                <label>Số tiền<input value={income.amount} onChange={(event) => setIncome({ ...income, amount: formatMoneyInput(event.target.value) })} placeholder="9.000.000" /></label>
                <label>Ngày<input type="date" value={income.date} onChange={(event) => setIncome({ ...income, date: event.target.value })} /></label>
                <label>Note<input value={income.note} onChange={(event) => setIncome({ ...income, note: event.target.value })} /></label>
              </>}
              {kind === "expense" && <>
                <label>Mục chi<select value={expense.categoryId} onChange={(event) => setExpense({ ...expense, categoryId: event.target.value })}>{state.expenseCategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
                <label>Số tiền<input value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: formatMoneyInput(event.target.value) })} placeholder="500.000" /></label>
                <label>Ngày<input type="date" value={expense.date} onChange={(event) => setExpense({ ...expense, date: event.target.value })} /></label>
                <label>Note<input value={expense.note} onChange={(event) => setExpense({ ...expense, note: event.target.value })} /></label>
              </>}
              {kind === "btc-usdt" && <>
                <label>VND dùng mua<input value={usdt.vnd} onChange={(event) => setUsdt({ ...usdt, vnd: formatMoneyInput(event.target.value) })} placeholder="1.000.000" /></label>
                <label>USDT nhận<input value={usdt.amount} onChange={(event) => setUsdt({ ...usdt, amount: formatDecimalInput(event.target.value) })} placeholder="39,25" /></label>
                <label>Ngày<input type="date" value={usdt.date} onChange={(event) => setUsdt({ ...usdt, date: event.target.value })} /></label>
                <label>Note<input value={usdt.note} onChange={(event) => setUsdt({ ...usdt, note: event.target.value })} /></label>
              </>}
              {kind === "btc-dca" && <>
                <label>USDT mỗi kỳ<input value={dca.amount} onChange={(event) => setDca({ ...dca, amount: formatDecimalInput(event.target.value) })} /></label>
                <label>Tần suất<select value={dca.frequency} onChange={(event) => setDca({ ...dca, frequency: event.target.value as BtcDcaFrequency })}><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select></label>
                <label>Giờ chạy<input type="time" value={dca.time} onChange={(event) => setDca({ ...dca, time: event.target.value })} /></label>
                <label>Ngày bắt đầu<input type="date" value={dca.startDate} onChange={(event) => setDca({ ...dca, startDate: event.target.value })} /></label>
                <label>Note<input value={dca.note} onChange={(event) => setDca({ ...dca, note: event.target.value })} /></label>
              </>}
              {kind === "btc-transfer" && <>
                <label>Tài sản nguồn<select value={btcTransfer.asset} onChange={(event) => updateBtcTransferAsset(event.target.value as "btc" | "usdt")}><option value="usdt">USDT</option><option value="btc">BTC</option></select></label>
                {btcTransfer.asset === "btc" ? <label>Số BTC<input value={btcTransfer.btc} onChange={(event) => setBtcTransfer({ ...btcTransfer, btc: formatDecimalInput(event.target.value) })} placeholder="0,0001" /></label> : <label>Số USDT<input value={btcTransfer.usdt} onChange={(event) => setBtcTransfer({ ...btcTransfer, usdt: formatDecimalInput(event.target.value) })} placeholder="10" /></label>}
                <label>Nơi nhận<select value={btcTransfer.destination} disabled={btcTransfer.asset === "btc"} onChange={(event) => updateBtcTransferDestination(event.target.value as BtcTransferTarget)}>
                  {btcTransfer.asset === "btc" ? <option value="usdt">USDT</option> : <option value="btc">BTC</option>}
                  {btcTransfer.asset === "usdt" && <><option value="stock">CK</option><option value="saving">Tiết kiệm</option><option value="emergency">Dự phòng</option><option value="cash">Tiền mặt</option></>}
                </select></label>
                <label>{btcTransfer.asset === "usdt" && btcTransfer.destination !== "btc" ? "Giá USDT/VND" : "Giá BTC/USDT"}<input value={btcTransfer.price} onChange={(event) => setBtcTransfer({ ...btcTransfer, price: formatDecimalInput(event.target.value) })} placeholder={formatDecimalInput(String(btcTransferPriceFor(btcTransfer.asset, btcTransfer.destination) || 0))} /></label>
                <label>Số tiền nhận<input value={btcTransfer.received} onChange={(event) => setBtcTransfer({ ...btcTransfer, received: btcTransferReceiveUnit() === "VND" ? formatMoneyInput(event.target.value) : formatDecimalInput(event.target.value) })} placeholder={formatBtcTransferEstimate()} /></label>
                <label>Ngày<input type="date" value={btcTransfer.date} onChange={(event) => setBtcTransfer({ ...btcTransfer, date: event.target.value })} /></label>
                <label>Note<input value={btcTransfer.note} onChange={(event) => setBtcTransfer({ ...btcTransfer, note: event.target.value })} /></label>
              </>}
              {kind === "stock-buy" && <>
                <div className="confirm-summary stock-confirm-summary">
                  <div>
                    <span>Tỷ lệ</span>
                    <strong>{quickStockPlannedPercent}%</strong>
                  </div>
                  <div>
                    <span>Tổng tiền</span>
                    <strong>{formatVnd(quickStockPlannedValue)} / {formatVnd(stockStats.cash)}</strong>
                  </div>
                </div>
                <div className="stock-buy-list">
                  {quickStockRows.map((row, index) => {
                    const value = stockLineValue({ shares: Number(row.shares) || 0, buyPrice: parseDecimal(row.buyPrice) });
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
                          <input value={row.buyPrice} onChange={(event) => updateQuickStockRow(row.id, { buyPrice: formatDecimalInput(event.target.value) })} placeholder="27,5" />
                        </label>
                        <label>
                          Số cổ phiếu
                          <input value={row.shares} onChange={(event) => updateQuickStockRow(row.id, { shares: event.target.value.replace(/\D/g, "") })} placeholder="100" />
                        </label>
                        <div className="stock-row-value">
                          <span>Giá trị</span>
                          <strong>{formatVnd(value)}</strong>
                        </div>
                        <button className="row-icon-button danger-text" onClick={() => removeQuickStockRow(row.id)} title="Xóa dòng" type="button">
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="stock-form-actions">
                  <button className="ghost" onClick={addQuickStockRow} type="button"><Plus size={17} /> Thêm cổ phiếu</button>
                </div>
                <div className="form-grid stock-buy-meta-grid">
                  <label>Ngày mua<input type="date" value={quickStockMeta.date} onChange={(event) => setQuickStockMeta({ ...quickStockMeta, date: event.target.value })} /></label>
                  <label>Note<input value={quickStockMeta.note} onChange={(event) => setQuickStockMeta({ ...quickStockMeta, note: event.target.value })} placeholder="Mua trên MBS" /></label>
                </div>
              </>}
              {kind === "stock-transfer" && <>
                <label>Mã đang giữ<select value={stockTransfer.symbol} onChange={(event) => {
                  const holding = stockStats.holdings.find((item) => item.symbol === event.target.value);
                  setStockTransfer({ ...stockTransfer, symbol: event.target.value, price: holding ? formatStockPrice(holding.marketPrice) : stockTransfer.price });
                }}><option value="">Chọn mã</option>{stockStats.holdings.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.shares.toLocaleString("vi-VN")}</option>)}</select></label>
                <label>Số lượng<input value={stockTransfer.shares} onChange={(event) => setStockTransfer({ ...stockTransfer, shares: event.target.value.replace(/\D/g, "") })} /></label>
                <label>Giá rút<input value={stockTransfer.price} onChange={(event) => setStockTransfer({ ...stockTransfer, price: formatDecimalInput(event.target.value) })} /></label>
                <label>Nơi nhận<select value={stockTransfer.destination} onChange={(event) => setStockTransfer({ ...stockTransfer, destination: event.target.value as SolDestination })}>{stockDestinationOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
                <label>Ngày<input type="date" value={stockTransfer.date} onChange={(event) => setStockTransfer({ ...stockTransfer, date: event.target.value })} /></label>
                <label>Note<input value={stockTransfer.note} onChange={(event) => setStockTransfer({ ...stockTransfer, note: event.target.value })} /></label>
              </>}
              {kind === "deposit" && <>
                <label>Quỹ<select value={deposit.fund} onChange={(event) => setDeposit({ ...deposit, fund: event.target.value as DepositFund })}><option value="saving">Tiết kiệm</option><option value="emergency">Dự phòng</option></select></label>
                <label>Số tiền<input value={deposit.amount} onChange={(event) => setDeposit({ ...deposit, amount: formatMoneyInput(event.target.value) })} placeholder="6.000.000" /></label>
                <label>Lãi suất %<input value={deposit.rate} onChange={(event) => setDeposit({ ...deposit, rate: formatDecimalInput(event.target.value) })} /></label>
                <label>Kỳ hạn tháng<input value={deposit.term} onChange={(event) => setDeposit({ ...deposit, term: event.target.value })} /></label>
                <label>Ngày gửi<input type="date" value={deposit.date} onChange={(event) => setDeposit({ ...deposit, date: event.target.value })} /></label>
                <label>4 số MB<input value={deposit.mbLast4} onChange={(event) => setDeposit({ ...deposit, mbLast4: event.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" maxLength={4} /></label>
                <label>Note<input value={deposit.note} onChange={(event) => setDeposit({ ...deposit, note: event.target.value })} /></label>
              </>}
              {kind === "sol-buy" && <>
                <label>Số SOL<input value={sol.amount} onChange={(event) => setSol({ ...sol, amount: formatDecimalInput(event.target.value) })} placeholder="0,5" /></label>
                <label>Giá mua USDT<input value={sol.price} onChange={(event) => setSol({ ...sol, price: formatDecimalInput(event.target.value) })} placeholder={formatDecimalInput(String(state.market.solUsd || 0))} /></label>
                <label>Ngày<input type="date" value={sol.date} onChange={(event) => setSol({ ...sol, date: event.target.value })} /></label>
                <label>Note<input value={sol.note} onChange={(event) => setSol({ ...sol, note: event.target.value })} /></label>
              </>}
              {kind === "sol-transfer" && <>
                <label>Số SOL<input value={solTransfer.amount} onChange={(event) => {
                  const amount = formatDecimalInput(event.target.value);
                  const estimate = Math.round(parseDecimal(amount) * parseDecimal(solTransfer.price) * state.market.usdVnd);
                  setSolTransfer({ ...solTransfer, amount, vnd: estimate ? estimate.toLocaleString("vi-VN") : "" });
                }} placeholder="0,1" /></label>
                <label>Giá SOL/USDT<input value={solTransfer.price} onChange={(event) => {
                  const price = formatDecimalInput(event.target.value);
                  const estimate = Math.round(parseDecimal(solTransfer.amount) * parseDecimal(price) * state.market.usdVnd);
                  setSolTransfer({ ...solTransfer, price, vnd: estimate ? estimate.toLocaleString("vi-VN") : "" });
                }} /></label>
                <label>Số tiền nhận<input value={solTransfer.vnd} onChange={(event) => setSolTransfer({ ...solTransfer, vnd: formatMoneyInput(event.target.value) })} /></label>
                <label>Nơi nhận<select value={solTransfer.destination} onChange={(event) => setSolTransfer({ ...solTransfer, destination: event.target.value as SolDestination })}>{solDestinationOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
                <label>Ngày<input type="date" value={solTransfer.date} onChange={(event) => setSolTransfer({ ...solTransfer, date: event.target.value })} /></label>
                <label>Note<input value={solTransfer.note} onChange={(event) => setSolTransfer({ ...solTransfer, note: event.target.value })} /></label>
              </>}
            </div>
            {error && <span className="form-error">{error}</span>}
            <button className="primary full" onClick={save} type="button"><Save size={17} /> Lưu nhanh</button>
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
  const [assetTab, setAssetTab] = useState<InvestmentTab>("btc");
  const [month, setMonth] = useState(currentMonth);
  const [activePin, setActivePin] = useState("");
  const [cloudStatus, setCloudStatus] = useState("");
  const [marketStatus, setMarketStatus] = useState("");
  const [btcCloudAccountId, setBtcCloudAccountId] = useState("");
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState("");
  const cloudLoaded = useRef(false);
  const lastCloudSnapshot = useRef("");
  const marketRef = useRef(state.market);
  const cloudConfigured = isCloudSyncConfigured();
  const cloudAccountKey = activePin ? cloudAccountKeyForPin(activePin) : "";
  const stateForCloud = (): AppState => (activePin ? stateForAccountPin(state, activePin) : state);
  const autoStockSymbols = useMemo(
    () => stockPortfolioStats(state).holdings.map((item) => item.symbol).join("|"),
    [state.stockPurchases, state.stockSales]
  );
  const navigateToPage = (nextPage: Page) => {
    if (page === "investment" && nextPage !== "investment" && assetTab === "mbb") setAssetTab("btc");
    setPage(nextPage);
    if (nextPage === "dashboard") setMonth(currentMonth());
  };

  useEffect(() => {
    marketRef.current = state.market;
  }, [state.market]);

  const mergeBtcCloudLedger = async (accountId: string) => {
    const ledger = await loadBtcCloudLedger(accountId);
    setState((prev) => {
      const next = {
        ...prev,
        btcUsdtTopups: mergeById(prev.btcUsdtTopups, ledger.topups),
        btcDcaPlans: mergeById(prev.btcDcaPlans, ledger.dcaPlans).map(normalizeDcaPlan),
        btcTrades: mergeById(prev.btcTrades, ledger.trades),
        btcTransfers: mergeById(prev.btcTransfers, ledger.transfers),
      };
      return JSON.stringify(btcCloudLedgerFromState(next)) === JSON.stringify(btcCloudLedgerFromState(prev)) ? prev : next;
    });
  };

  const syncBtcLedgerNow = async () => {
    if (!btcCloudAccountId) return false;
    try {
      setCloudStatus("Đang đồng bộ BTC ledger...");
      await Promise.all([
        ...state.btcUsdtTopups.map((item) => upsertCloudPayloadRow("btc_usdt_topups", btcCloudAccountId, item.id, item)),
        ...state.btcDcaPlans.map((item) => upsertCloudPayloadRow("btc_dca_plans", btcCloudAccountId, item.id, item, { is_active: item.isActive, next_run_at: item.nextRunAt, status: item.status })),
        ...state.btcTrades.map((item) => upsertCloudPayloadRow("btc_trades", btcCloudAccountId, item.id, item, { executed_at: item.executedAt, plan_id: item.planId ?? null })),
        ...state.btcTransfers.map((item) => upsertCloudPayloadRow("btc_transfers", btcCloudAccountId, item.id, item, { transfer_at: `${item.date}T00:00:00` })),
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

  const unlockWithPin = async (pin: string) => {
    if (!cloudConfigured) {
      if (!state.settings.hasPin) {
        setState((prev) => ({ ...prev, settings: { ...prev.settings, pin, hasPin: true } }));
        setActivePin(pin);
        setUnlocked(true);
        return null;
      }
      if (pin !== state.settings.pin) return "PIN chưa đúng.";
      setActivePin(pin);
      setUnlocked(true);
      return null;
    }

    try {
      setCloudStatus("Đang mở tài khoản...");
      const accountKey = cloudAccountKeyForPin(pin);
      const cloudState = await loadCloudState<AppState>(accountKey);
      if (!cloudState) return "Tài khoản chưa tồn tại. Vào /admin để tạo PIN.";

      const nextState = normalizeState({
        ...initialState,
        ...cloudState,
        settings: { ...initialState.settings, ...cloudState.settings, hasPin: true, pin },
      });
      setState(nextState);
      setActivePin(pin);
      lastCloudSnapshot.current = JSON.stringify(nextState);
      cloudLoaded.current = true;
      setCloudStatus("Đã mở dữ liệu cloud.");
      setLastCloudSyncAt(new Date().toISOString());
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
    setCloudStatus("Đang đổi PIN...");
    setState(nextState);
    setActivePin(pin);
    lastCloudSnapshot.current = JSON.stringify(nextState);
    cloudLoaded.current = true;

    if (!cloudConfigured) {
      setCloudStatus("Đã đổi PIN trên thiết bị này.");
      return;
    }

    try {
      await saveCloudState(nextKey, nextState);
      if (previousKey !== nextKey) await deleteCloudState(previousKey);
      setLastCloudSyncAt(new Date().toISOString());
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
      await saveCloudState(cloudAccountKey, nextSnapshot);
      lastCloudSnapshot.current = JSON.stringify(nextSnapshot);
      cloudLoaded.current = true;
      setLastCloudSyncAt(new Date().toISOString());
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
        // BTC stays available from local cache if the cloud ledger cannot be reached.
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
    if (!cloudConfigured || !cloudAccountKey || !cloudLoaded.current) return;

    const nextSnapshot = stateForCloud();
    const snapshot = JSON.stringify(nextSnapshot);
    if (snapshot === lastCloudSnapshot.current) return;

    setCloudStatus("Đang đồng bộ...");
    const timer = window.setTimeout(async () => {
      try {
        await saveCloudState(cloudAccountKey, nextSnapshot);
        lastCloudSnapshot.current = snapshot;
        setLastCloudSyncAt(new Date().toISOString());
        setCloudStatus(`Đã đồng bộ ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
      } catch {
        setCloudStatus("Không lưu được dữ liệu cloud.");
      }
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [cloudConfigured, cloudAccountKey, state]);

  if (window.location.pathname === "/admin") return <AdminPage />;

  if (!unlocked) return <PinGate state={state} setState={setState} cloudConfigured={cloudConfigured} onUnlock={unlockWithPin} />;

  return (
    <div className="app-shell">
      <AppNav page={page} setPage={navigateToPage} />
      <main className="content">
        {page === "dashboard" && <UnifiedDashboardPage state={state} setState={setState} month={month} setMonth={setMonth} setPage={navigateToPage} setAssetTab={setAssetTab} onRefreshMarket={refreshMarket} />}
        {page === "accumulation" && <AccumulationPage state={state} setState={setState} />}
        {page === "investment" && <InvestmentPage state={state} setState={setState} activeTab={assetTab} setActiveTab={setAssetTab} onRefreshMarket={refreshMarket} marketStatus={marketStatus} btcCloudAccountId={btcCloudAccountId} />}
        {page === "reports" && <ReportsPage state={state} setState={setState} onRefreshMarket={refreshMarket} />}
      </main>
      <QuickActionButton state={state} setState={setState} btcCloudAccountId={btcCloudAccountId} />
    </div>
  );
}
