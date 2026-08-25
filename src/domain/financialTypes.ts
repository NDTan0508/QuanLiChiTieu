export type TransactionMeta = {
  eventId: string;
  groupId?: string;
  parentEventIds?: string[];
  childEventIds?: string[];
  allocationPlanId?: string;
  planItemId?: string;
  accountFromId?: string;
  accountToId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: "user" | "system" | "import" | "migration";
  schemaVersion: number;
};

export type FinancialAccount = {
  id: string;
  name: string;
  type: "cash" | "bank" | "securities" | "crypto_exchange" | "crypto_wallet" | "saving" | "other";
  currency?: string;
  isActive: boolean;
};

export type MoneyFlowAsset = "VND" | "USDT" | "BTC" | "SOL" | "STOCK" | "STOCK_TOTAL";

export type FinancialEvent = {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  occurredAt: string;
  amountVnd?: number;
  asset?: MoneyFlowAsset;
  quantity?: number;
  stockSymbol?: string;
  accountFromId?: string;
  accountToId?: string;
  groupId?: string;
  parentEventIds: string[];
  childEventIds: string[];
  source: "state" | "derived";
};

export type MoneyFlowEdge = {
  id: string;
  fromEventId: string;
  toEventId: string;
  amountVnd?: number;
  asset?: MoneyFlowAsset;
  quantity?: number;
  stockSymbol?: string;
  relationType: "transfer" | "conversion" | "allocation" | "purchase" | "withdrawal" | "dividend" | "interest" | "rollover" | "adjustment";
  method: "direct" | "proportional" | "fifo" | "manual";
  confidence: "exact" | "derived" | "estimated";
};

export type HealthIssue = {
  id: string;
  ruleId: string;
  fingerprint: string;
  severity: "critical" | "error" | "warning" | "info";
  scope: "income" | "expense" | "fund" | "crypto" | "stock" | "mbb" | "saving_goal" | "cloud" | "system";
  title: string;
  description: string;
  relatedEventIds: string[];
  relatedEntityIds: string[];
  canAutoFix: boolean;
  detectedAt: string;
  status: "open" | "ignored" | "resolved";
};

export type ReconciliationBalance = {
  asset: string;
  stockSymbol?: string;
  amountVnd?: number;
  quantity?: number;
};

export type ReconciliationDifference = {
  asset: string;
  stockSymbol?: string;
  expectedAmount?: number;
  actualAmount?: number;
  differenceAmount?: number;
  expectedQuantity?: number;
  actualQuantity?: number;
  differenceQuantity?: number;
  reason?: "missing_transaction" | "fee" | "interest" | "dividend" | "rounding" | "wrong_price" | "manual_adjustment" | "unknown";
  resolutionStatus: "unresolved" | "transaction_created" | "adjusted" | "accepted";
};

export type ReconciliationSession = {
  id: string;
  accountId: string;
  reconciliationDate: string;
  status: "draft" | "completed" | "reopened";
  expectedBalances: ReconciliationBalance[];
  actualBalances: ReconciliationBalance[];
  differences: ReconciliationDifference[];
  notes?: string;
  createdAt: string;
  completedAt?: string;
};

export type AdjustmentTransaction = {
  id: string;
  reconciliationSessionId: string;
  accountId: string;
  asset: string;
  stockSymbol?: string;
  amountVnd?: number;
  quantity?: number;
  reason?: ReconciliationDifference["reason"];
  date: string;
  note: string;
  createdAt: string;
  meta?: TransactionMeta;
};

export type CorporateAction = {
  id: string;
  symbol: string;
  newSymbol?: string;
  type: "cash_dividend" | "stock_dividend" | "bonus_issue" | "stock_split" | "reverse_split" | "rights_issue" | "symbol_change";
  exDate?: string;
  recordDate?: string;
  paymentDate?: string;
  receiveDate?: string;
  ratioFrom?: number;
  ratioTo?: number;
  cashPerShare?: number;
  subscriptionPrice?: number;
  taxRate?: number;
  fee?: number;
  eligibleShares: number;
  resultingShares?: number;
  cashReceived?: number;
  status: "draft" | "announced" | "eligible" | "pending" | "applied" | "cancelled";
  linkedEventIds: string[];
  appliedAt?: string;
  meta?: TransactionMeta;
};

export type AllocationStrategy = {
  id: string;
  name: string;
  targetWeights: {
    crypto: number;
    stock: number;
    saving: number;
    emergency: number;
  };
  emergencyFundMonths: number;
  minimumDcaCoverageDays: number;
  minimumAmounts: {
    crypto?: number;
    stock?: number;
    saving?: number;
    emergency?: number;
  };
  maximumMonthlyAllocation?: {
    crypto?: number;
    stock?: number;
  };
  fallbackFund: "crypto" | "stock" | "saving" | "emergency" | "keep_cash";
};

export type AllocationSnapshot = {
  totalAssets: number;
  crypto: number;
  stock: number;
  saving: number;
  emergency: number;
  emergencyMonths?: number;
  dcaCoverageDays?: number;
};

export type AllocationPlanItem = {
  id: string;
  actionType: "transfer_fund" | "buy_usdt" | "buy_stock" | "create_mbb_book" | "fund_saving_goal" | "keep_cash";
  amountVnd: number;
  stockSymbol?: string;
  estimatedQuantity?: number;
  targetFund?: string;
  targetAccountId?: string;
  reason: string;
  priority: number;
  status: "pending" | "ready" | "completed" | "skipped" | "blocked";
  executedEventIds: string[];
};

export type AllocationPlan = {
  id: string;
  sourceEventId?: string;
  availableAmount: number;
  strategyId: string;
  status: "draft" | "confirmed" | "in_progress" | "completed" | "cancelled";
  currentSnapshot: AllocationSnapshot;
  projectedSnapshot: AllocationSnapshot;
  items: AllocationPlanItem[];
  createdAt: string;
};

export const FINANCIAL_SCHEMA_VERSION = 4;

export const DEFAULT_FINANCIAL_ACCOUNTS: FinancialAccount[] = [
  { id: "cash", name: "Tiền mặt", type: "cash", currency: "VND", isActive: true },
  { id: "mb-payment", name: "MB thanh toán", type: "bank", currency: "VND", isActive: true },
  { id: "vps", name: "VPS", type: "securities", currency: "VND", isActive: true },
  { id: "binance", name: "Binance", type: "crypto_exchange", isActive: true },
  { id: "btc-wallet", name: "Ví BTC", type: "crypto_wallet", currency: "BTC", isActive: true },
  { id: "sol-wallet", name: "Ví SOL", type: "crypto_wallet", currency: "SOL", isActive: true },
  { id: "mbb-books", name: "Sổ MBB", type: "saving", currency: "VND", isActive: true },
  { id: "adjustment", name: "Tài khoản điều chỉnh", type: "other", isActive: true },
];

export const DEFAULT_ALLOCATION_STRATEGIES: AllocationStrategy[] = [
  {
    id: "safe",
    name: "An toàn",
    targetWeights: { crypto: 15, stock: 15, saving: 45, emergency: 25 },
    emergencyFundMonths: 9,
    minimumDcaCoverageDays: 45,
    minimumAmounts: { saving: 1_000_000, emergency: 1_000_000 },
    fallbackFund: "saving",
  },
  {
    id: "balanced",
    name: "Cân bằng",
    targetWeights: { crypto: 25, stock: 25, saving: 30, emergency: 20 },
    emergencyFundMonths: 6,
    minimumDcaCoverageDays: 30,
    minimumAmounts: { crypto: 500_000, stock: 500_000, saving: 1_000_000, emergency: 1_000_000 },
    fallbackFund: "crypto",
  },
  {
    id: "growth",
    name: "Tăng trưởng",
    targetWeights: { crypto: 35, stock: 35, saving: 20, emergency: 10 },
    emergencyFundMonths: 4,
    minimumDcaCoverageDays: 21,
    minimumAmounts: { crypto: 500_000, stock: 500_000 },
    fallbackFund: "stock",
  },
];

type RowWithMeta = {
  id?: string;
  month?: string;
  date?: string;
  startDate?: string;
  createdAt?: string;
  executedAt?: string;
  occurredAt?: string;
  updatedAt?: string;
  note?: string;
  fund?: string;
  type?: string;
  destination?: string;
  asset?: string;
  accountId?: string;
  meta?: TransactionMeta;
};

type FinancialStateShape = {
  schemaVersion?: number;
  incomeTransactions?: RowWithMeta[];
  expenseEntries?: RowWithMeta[];
  monthlyExpenses?: RowWithMeta[];
  allocations?: RowWithMeta[];
  fundTransactions?: RowWithMeta[];
  btcUsdtTopups?: RowWithMeta[];
  btcDcaPlans?: RowWithMeta[];
  btcTrades?: RowWithMeta[];
  btcTransfers?: RowWithMeta[];
  solTransactions?: RowWithMeta[];
  stockPurchases?: RowWithMeta[];
  stockSales?: RowWithMeta[];
  corporateActions?: RowWithMeta[];
  bankDeposits?: RowWithMeta[];
  accumulationGoals?: RowWithMeta[];
  financialAccounts?: FinancialAccount[];
  moneyFlowEdges?: MoneyFlowEdge[];
  healthIssues?: HealthIssue[];
  reconciliationSessions?: ReconciliationSession[];
  adjustmentTransactions?: RowWithMeta[];
  allocationStrategies?: AllocationStrategy[];
  allocationPlans?: AllocationPlan[];
};

export function stableEventId(entityType: string, entityId: string) {
  return `evt:${entityType}:${entityId}`;
}

export function stableGroupId(kind: string, id: string) {
  return `grp:${kind}:${id}`;
}

function markerGroupId(note?: string) {
  const marker = note?.match(/\[(btc-transfer|stock-sale|sol-btc):([^\]]+)\]/);
  return marker ? stableGroupId(marker[1], marker[2]) : undefined;
}

function accountHints(row: RowWithMeta, entityType: string) {
  if (entityType === "income") return { accountToId: "mb-payment" };
  if (entityType === "expense" || entityType === "monthly-expense") return { accountFromId: "mb-payment" };
  if (entityType === "fund-transaction") {
    if (row.fund === "btc") return row.type === "withdraw" ? { accountFromId: "binance" } : { accountToId: "binance" };
    if (row.fund === "stock") return row.type === "withdraw" ? { accountFromId: "vps" } : { accountToId: "vps" };
  }
  if (entityType.startsWith("btc-")) return { accountFromId: "binance", accountToId: "binance" };
  if (entityType === "sol") return row.type === "withdraw" ? { accountFromId: "sol-wallet" } : { accountToId: "sol-wallet" };
  if (entityType.startsWith("stock-")) return { accountFromId: "vps", accountToId: "vps" };
  if (entityType === "deposit") return { accountToId: "mbb-books" };
  if (entityType === "adjustment") return { accountFromId: "adjustment", accountToId: row.accountId };
  return {};
}

function metaFor(row: RowWithMeta, entityType: string, entityId: string): TransactionMeta {
  const occurredAt = row.createdAt || row.executedAt || row.occurredAt || row.updatedAt || row.date || row.startDate || (row.month ? `${row.month}-01` : "") || new Date().toISOString();
  const hints = accountHints(row, entityType);
  const groupId =
    row.meta?.groupId ||
    markerGroupId(row.note) ||
    (entityType === "allocation" && row.month ? stableGroupId("allocation", row.month) : undefined) ||
    (entityType === "fund-transaction" && row.note === "Chia quỹ cuối tháng" && row.month ? stableGroupId("allocation", row.month) : undefined);
  return {
    eventId: row.meta?.eventId || stableEventId(entityType, entityId),
    groupId,
    parentEventIds: row.meta?.parentEventIds ?? [],
    childEventIds: row.meta?.childEventIds ?? [],
    allocationPlanId: row.meta?.allocationPlanId,
    planItemId: row.meta?.planItemId,
    accountFromId: row.meta?.accountFromId ?? hints.accountFromId,
    accountToId: row.meta?.accountToId ?? hints.accountToId,
    createdAt: row.meta?.createdAt || occurredAt,
    updatedAt: row.meta?.updatedAt || occurredAt,
    createdBy: row.meta?.createdBy || "migration",
    schemaVersion: FINANCIAL_SCHEMA_VERSION,
  };
}

function withMeta<T extends RowWithMeta>(row: T, entityType: string, fallbackId: string): T {
  const entityId = String(row.id || row.month || fallbackId);
  return { ...row, meta: metaFor(row, entityType, entityId) };
}

function normalizeRows<T extends RowWithMeta>(rows: T[] | undefined, entityType: string): T[] {
  return (rows ?? []).map((row, index) => withMeta(row, entityType, String(index)));
}

export function normalizeFinancialMetadata<T extends FinancialStateShape>(state: T): T {
  return {
    ...state,
    schemaVersion: FINANCIAL_SCHEMA_VERSION,
    incomeTransactions: normalizeRows(state.incomeTransactions, "income"),
    expenseEntries: normalizeRows(state.expenseEntries, "expense"),
    monthlyExpenses: normalizeRows(state.monthlyExpenses, "monthly-expense"),
    allocations: normalizeRows(state.allocations, "allocation"),
    fundTransactions: normalizeRows(state.fundTransactions, "fund-transaction"),
    btcUsdtTopups: normalizeRows(state.btcUsdtTopups, "btc-topup"),
    btcDcaPlans: normalizeRows(state.btcDcaPlans, "btc-dca"),
    btcTrades: normalizeRows(state.btcTrades, "btc-trade"),
    btcTransfers: normalizeRows(state.btcTransfers, "btc-transfer"),
    solTransactions: normalizeRows(state.solTransactions, "sol"),
    stockPurchases: normalizeRows(state.stockPurchases, "stock-purchase"),
    stockSales: normalizeRows(state.stockSales, "stock-sale"),
    corporateActions: normalizeRows(state.corporateActions, "corporate-action"),
    bankDeposits: normalizeRows(state.bankDeposits, "deposit"),
    accumulationGoals: normalizeRows(state.accumulationGoals, "accumulation"),
    financialAccounts: mergeDefaultAccounts(state.financialAccounts),
    moneyFlowEdges: state.moneyFlowEdges ?? [],
    healthIssues: state.healthIssues ?? [],
    reconciliationSessions: state.reconciliationSessions ?? [],
    adjustmentTransactions: normalizeRows(state.adjustmentTransactions, "adjustment"),
    allocationStrategies: state.allocationStrategies?.length ? state.allocationStrategies : DEFAULT_ALLOCATION_STRATEGIES,
    allocationPlans: state.allocationPlans ?? [],
  } as T;
}

function mergeDefaultAccounts(accounts: FinancialAccount[] | undefined) {
  const existing = accounts ?? [];
  const existingIds = new Set(existing.map((account) => account.id));
  return [...existing, ...DEFAULT_FINANCIAL_ACCOUNTS.filter((account) => !existingIds.has(account.id))];
}
