import type { FinancialEvent, MoneyFlowAsset, MoneyFlowEdge, TransactionMeta } from "./financialTypes";
import { stableEventId } from "./financialTypes";

type AnyRow = {
  id?: string;
  month?: string;
  date?: string;
  startDate?: string;
  maturityDate?: string;
  executedAt?: string;
  note?: string;
  meta?: TransactionMeta;
  [key: string]: unknown;
};

type FinancialIndexState = {
  incomeTransactions?: AnyRow[];
  expenseEntries?: AnyRow[];
  monthlyExpenses?: AnyRow[];
  allocations?: AnyRow[];
  fundTransactions?: AnyRow[];
  btcUsdtTopups?: AnyRow[];
  btcDcaPlans?: AnyRow[];
  btcTrades?: AnyRow[];
  btcTransfers?: AnyRow[];
  solTransactions?: AnyRow[];
  stockPurchases?: AnyRow[];
  stockSales?: AnyRow[];
  corporateActions?: AnyRow[];
  bankDeposits?: AnyRow[];
  accumulationGoals?: AnyRow[];
  adjustmentTransactions?: AnyRow[];
  moneyFlowEdges?: MoneyFlowEdge[];
};

export type FinancialIndex = {
  events: FinancialEvent[];
  edges: MoneyFlowEdge[];
  eventsById: Map<string, FinancialEvent>;
  eventsByGroupId: Map<string, FinancialEvent[]>;
  childrenByEventId: Map<string, FinancialEvent[]>;
  parentsByEventId: Map<string, FinancialEvent[]>;
  eventsByAccountId: Map<string, FinancialEvent[]>;
  eventsByAsset: Map<string, FinancialEvent[]>;
  stockEventsBySymbol: Map<string, FinancialEvent[]>;
};

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const stringValue = (value: unknown) => (typeof value === "string" ? value : "");
const STOCK_PRICE_UNIT = 1000;
const STOCK_BUY_BROKERAGE_FEE_RATE = 0.0008;
const estimatedStockSaleFee = (value: number, shares = 0) =>
  Math.round(Math.max(value, 0) * 0.0008) +
  Math.round(Math.max(value, 0) * 0.001) +
  Math.round(Math.max(shares, 0) * 0.3);
const stockPurchaseGrossValue = (row: AnyRow) => {
  const lines = Array.isArray(row.lines) ? row.lines as AnyRow[] : [];
  return lines.reduce((sum, line) => sum + Math.round(numberValue(line.shares) * numberValue(line.buyPrice) * STOCK_PRICE_UNIT), 0);
};
const stockPurchaseCostValue = (row: AnyRow) => {
  const grossValue = stockPurchaseGrossValue(row);
  return grossValue + Math.round(Math.max(grossValue, 0) * STOCK_BUY_BROKERAGE_FEE_RATE);
};
const stockPurchaseQuantity = (row: AnyRow) => {
  const lines = Array.isArray(row.lines) ? row.lines as AnyRow[] : [];
  return lines.reduce((sum, line) => sum + numberValue(line.shares), 0);
};
const stockSaleNetValue = (row: AnyRow) =>
  Math.max(
    Math.round(
      numberValue(row.netVndAmount) ||
        numberValue(row.vndAmount) -
          (row.fee === undefined ? estimatedStockSaleFee(numberValue(row.vndAmount), numberValue(row.shares)) : numberValue(row.fee)) -
          numberValue(row.tax)
    ),
    0
  );

function eventId(row: AnyRow, entityType: string, fallbackId: string) {
  return row.meta?.eventId || stableEventId(entityType, String(row.id || row.month || fallbackId));
}

function occurredAt(row: AnyRow) {
  return stringValue(row.executedAt) || stringValue(row.date) || stringValue(row.startDate) || (stringValue(row.month) ? `${row.month}-01` : "") || row.meta?.createdAt || "";
}

function eventFrom(row: AnyRow, entityType: string, label: string, fallbackId: string, patch: Partial<FinancialEvent> = {}): FinancialEvent {
  const entityId = String(row.id || row.month || fallbackId);
  return {
    id: eventId(row, entityType, fallbackId),
    entityType,
    entityId,
    label,
    occurredAt: occurredAt(row),
    accountFromId: row.meta?.accountFromId,
    accountToId: row.meta?.accountToId,
    groupId: row.meta?.groupId,
    parentEventIds: row.meta?.parentEventIds ?? [],
    childEventIds: row.meta?.childEventIds ?? [],
    source: "state",
    ...patch,
  };
}

export function buildFinancialIndex(state: FinancialIndexState): FinancialIndex {
  const events: FinancialEvent[] = [];
  const edges: MoneyFlowEdge[] = [...(state.moneyFlowEdges ?? [])];

  const addRows = (rows: AnyRow[] | undefined, entityType: string, label: (row: AnyRow) => string, patch: (row: AnyRow) => Partial<FinancialEvent>) => {
    (rows ?? []).forEach((row, index) => events.push(eventFrom(row, entityType, label(row), String(index), patch(row))));
  };

  addRows(state.incomeTransactions, "income", () => "Thu nhập", (row) => ({ amountVnd: numberValue(row.amount), asset: "VND" }));
  addRows(state.expenseEntries, "expense", () => "Chi tiêu phát sinh", (row) => ({ amountVnd: numberValue(row.amount), asset: "VND" }));
  addRows(state.monthlyExpenses, "monthly-expense", () => "Khoản cố định", (row) => ({ amountVnd: numberValue(row.amount), asset: "VND" }));
  addRows(state.allocations, "allocation", (row) => `Chia quỹ ${stringValue(row.month)}`, (row) => ({
    amountVnd: numberValue(row.totalSavingAtConfirm),
    asset: "VND",
  }));
  addRows(state.fundTransactions, "fund-transaction", (row) => `Giao dịch quỹ ${stringValue(row.fund)}`, (row) => ({
    amountVnd: numberValue(row.amount),
    asset: "VND",
  }));
  addRows(state.btcUsdtTopups, "btc-topup", () => "Mua USDT", (row) => ({
    amountVnd: numberValue(row.vndAmount),
    asset: "USDT",
    quantity: numberValue(row.usdtAmount),
  }));
  addRows(state.btcDcaPlans, "btc-dca", () => "Kế hoạch DCA BTC", (row) => ({
    asset: "USDT",
    quantity: numberValue(row.amountUsdt),
  }));
  addRows(state.btcTrades, "btc-trade", () => "Mua BTC", (row) => ({
    amountVnd: numberValue(row.costVnd),
    asset: "BTC",
    quantity: numberValue(row.btcAmount),
  }));
  addRows(state.btcTransfers, "btc-transfer", () => "Rút/chuyển BTC-USDT", (row) => ({
    amountVnd: numberValue(row.vndAmount),
    asset: stringValue(row.asset).toUpperCase() as MoneyFlowAsset,
    quantity: stringValue(row.asset) === "btc" ? numberValue(row.btcAmount) : numberValue(row.usdtAmount),
  }));
  addRows(state.solTransactions, "sol", (row) => (row.type === "withdraw" ? "Rút/chuyển SOL" : "Mua SOL"), (row) => ({
    amountVnd: numberValue(row.vndAmount),
    asset: "SOL",
    quantity: numberValue(row.solAmount),
  }));
  addRows(state.stockPurchases, "stock-purchase", () => "Mua cổ phiếu", (row) => {
    const lines = Array.isArray(row.lines) ? row.lines as AnyRow[] : [];
    return {
      amountVnd: stockPurchaseCostValue(row),
      asset: "STOCK",
      quantity: stockPurchaseQuantity(row),
      stockSymbol: lines.length === 1 ? stringValue(lines[0].symbol) : undefined,
    };
  });
  addRows(state.stockSales, "stock-sale", () => "Rút/bán cổ phiếu", (row) => ({
    amountVnd: stockSaleNetValue(row),
    asset: "STOCK",
    quantity: numberValue(row.shares),
    stockSymbol: stringValue(row.symbol),
  }));
  addRows(state.corporateActions, "corporate-action", () => "Sự kiện cổ phiếu", (row) => {
    const isCashDividend = row.type === "cash_dividend";
    return {
      amountVnd: isCashDividend ? cashDividendValue(row) : numberValue(row.cashReceived),
      asset: (isCashDividend ? "VND" : "STOCK") as MoneyFlowAsset,
      quantity: isCashDividend ? undefined : numberValue(row.resultingShares) || numberValue(row.eligibleShares),
      stockSymbol: stringValue(row.symbol),
      accountToId: isCashDividend ? "vps" : row.meta?.accountToId,
    };
  });
  addRows(state.bankDeposits, "deposit", () => "Sổ MBB", (row) => ({ amountVnd: numberValue(row.principal), asset: "VND" }));
  addRows(state.accumulationGoals, "accumulation", () => "Mục tích lũy", (row) => ({ amountVnd: numberValue(row.targetAmount), asset: "VND" }));
  addRows(state.adjustmentTransactions, "adjustment", () => "Điều chỉnh đối soát", (row) => ({
    amountVnd: numberValue(row.amountVnd),
    asset: stringValue(row.asset) as MoneyFlowAsset,
    quantity: numberValue(row.quantity),
    stockSymbol: stringValue(row.stockSymbol),
  }));
  addDepositInterestEvents(state.bankDeposits, events);

  const eventsById = new Map(events.map((event) => [event.id, event]));
  const rowsByType = rowsByEntityType(state);
  deriveGroupEdges(events, edges);
  deriveParentChildEdges(events, edges);
  deriveMarkerEdges(rowsByType, eventsById, edges);
  deriveRolloverAndInterestEdges(rowsByType, eventsById, edges);
  derivePurchaseAndDividendEdges(events, edges);

  const index: FinancialIndex = {
    events,
    edges,
    eventsById,
    eventsByGroupId: groupBy(events, (event) => event.groupId),
    childrenByEventId: new Map(),
    parentsByEventId: new Map(),
    eventsByAccountId: new Map(),
    eventsByAsset: groupBy(events, (event) => event.asset),
    stockEventsBySymbol: groupBy(events, (event) => event.stockSymbol),
  };

  events.forEach((event) => {
    [event.accountFromId, event.accountToId].filter(Boolean).forEach((accountId) => addToMap(index.eventsByAccountId, accountId as string, event));
  });
  edges.forEach((edge) => {
    const from = eventsById.get(edge.fromEventId);
    const to = eventsById.get(edge.toEventId);
    if (from && to) {
      addToMap(index.childrenByEventId, from.id, to);
      addToMap(index.parentsByEventId, to.id, from);
    }
  });

  return index;
}

function rowsByEntityType(state: FinancialIndexState) {
  return {
    income: state.incomeTransactions ?? [],
    fundTransaction: state.fundTransactions ?? [],
    btcTransfer: state.btcTransfers ?? [],
    btcTrade: state.btcTrades ?? [],
    sol: state.solTransactions ?? [],
    stockSale: state.stockSales ?? [],
    deposit: state.bankDeposits ?? [],
  };
}

function addDepositInterestEvents(rows: AnyRow[] | undefined, events: FinancialEvent[]) {
  (rows ?? []).forEach((deposit) => {
    const principal = numberValue(deposit.principal);
    const rate = numberValue(deposit.rate);
    const termMonths = numberValue(deposit.termMonths);
    const interest = Math.round((principal * rate * termMonths) / 1200);
    if (!interest) return;
    events.push({
      id: stableEventId("deposit-interest", String(deposit.id)),
      entityType: "deposit-interest",
      entityId: String(deposit.id),
      label: "Lãi dự kiến Sổ MBB",
      occurredAt: stringValue(deposit.maturityDate) || occurredAt(deposit),
      amountVnd: interest,
      asset: "VND",
      accountFromId: "mbb-books",
      accountToId: "mbb-books",
      groupId: deposit.meta?.groupId,
      parentEventIds: [eventId(deposit, "deposit", String(deposit.id))],
      childEventIds: [],
      source: "derived",
    });
  });
}

function cashDividendValue(row: AnyRow) {
  const explicitCash = numberValue(row.cashReceived);
  if (explicitCash) return explicitCash;
  const grossCash = numberValue(row.eligibleShares) * numberValue(row.cashPerShare);
  const taxRate = numberValue(row.taxRate);
  const fee = numberValue(row.fee);
  return Math.max(Math.round(grossCash * (1 - taxRate / 100) - fee), 0);
}

function deriveGroupEdges(events: FinancialEvent[], edges: MoneyFlowEdge[]) {
  const existing = new Set(edges.map((edge) => edge.id));
  const groups = groupBy(events, (event) => event.groupId);
  groups.forEach((groupEvents, groupId) => {
    const sorted = [...groupEvents].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const allocation = sorted.find((event) => event.entityType === "allocation");
    if (allocation) {
      sorted.filter((event) => event.id !== allocation.id).forEach((event) => {
        pushEdge(edges, existing, {
          id: `edge:allocation:${allocation.id}->${event.id}`,
          fromEventId: allocation.id,
          toEventId: event.id,
          amountVnd: event.amountVnd,
          asset: event.asset,
          quantity: event.quantity,
          stockSymbol: event.stockSymbol,
          relationType: "allocation",
          method: "direct",
          confidence: "exact",
        });
      });
      return;
    }

    for (let index = 1; index < sorted.length; index += 1) {
      const from = sorted[index - 1];
      const to = sorted[index];
      pushEdge(edges, existing, {
        id: `edge:${groupId}:${from.id}->${to.id}`,
        fromEventId: from.id,
        toEventId: to.id,
        amountVnd: to.amountVnd || from.amountVnd,
        asset: to.asset || from.asset,
        quantity: to.quantity || from.quantity,
        stockSymbol: to.stockSymbol || from.stockSymbol,
        relationType: relationTypeForPair(from, to),
        method: "direct",
        confidence: "derived",
      });
    }
  });
}

function deriveParentChildEdges(events: FinancialEvent[], edges: MoneyFlowEdge[]) {
  const existing = new Set(edges.map((edge) => edge.id));
  const ids = new Set(events.map((event) => event.id));
  events.forEach((event) => {
    event.parentEventIds.filter((id) => ids.has(id)).forEach((parentId) => {
      pushEdge(edges, existing, {
        id: `edge:parent:${parentId}->${event.id}`,
        fromEventId: parentId,
        toEventId: event.id,
        amountVnd: event.amountVnd,
        asset: event.asset,
        quantity: event.quantity,
        stockSymbol: event.stockSymbol,
        relationType: relationTypeForPair({ entityType: "unknown" } as FinancialEvent, event),
        method: "direct",
        confidence: "exact",
      });
    });
  });
}

function deriveMarkerEdges(rows: ReturnType<typeof rowsByEntityType>, eventsById: Map<string, FinancialEvent>, edges: MoneyFlowEdge[]) {
  const existing = new Set(edges.map((edge) => edge.id));
  rows.btcTransfer.forEach((transfer) => {
    const fromId = eventId(transfer, "btc-transfer", String(transfer.id));
    addMarkedTargets(rows.fundTransaction, `[btc-transfer:${transfer.id}]`, fromId, "fund-transaction", "transfer", eventsById, edges, existing);
    addMarkedTargets(rows.income, `[btc-transfer:${transfer.id}]`, fromId, "income", "withdrawal", eventsById, edges, existing);
    addMarkedTargets(rows.deposit, `[btc-transfer:${transfer.id}]`, fromId, "deposit", "transfer", eventsById, edges, existing);
  });
  rows.stockSale.forEach((sale) => {
    const fromId = eventId(sale, "stock-sale", String(sale.id));
    addMarkedTargets(rows.deposit, `[stock-sale:${sale.id}]`, fromId, "deposit", "transfer", eventsById, edges, existing);
  });
  rows.sol.forEach((sol) => {
    if (sol.type !== "withdraw") return;
    const fromId = eventId(sol, "sol", String(sol.id));
    addMarkedTargets(rows.btcTrade, `[sol-btc:${sol.id}]`, fromId, "btc-trade", "conversion", eventsById, edges, existing);
  });
}

function addMarkedTargets(
  rows: AnyRow[],
  marker: string,
  fromEventId: string,
  targetEntityType: string,
  relationType: MoneyFlowEdge["relationType"],
  eventsById: Map<string, FinancialEvent>,
  edges: MoneyFlowEdge[],
  existing: Set<string>
) {
  rows.filter((row) => stringValue(row.note).includes(marker)).forEach((row) => {
    const toEventId = eventId(row, targetEntityType, String(row.id));
    const to = eventsById.get(toEventId);
    pushEdge(edges, existing, {
      id: `edge:marker:${fromEventId}->${toEventId}`,
      fromEventId,
      toEventId,
      amountVnd: to?.amountVnd,
      asset: to?.asset,
      quantity: to?.quantity,
      stockSymbol: to?.stockSymbol,
      relationType,
      method: "direct",
      confidence: "exact",
    });
  });
}

function deriveRolloverAndInterestEdges(rows: ReturnType<typeof rowsByEntityType>, eventsById: Map<string, FinancialEvent>, edges: MoneyFlowEdge[]) {
  const existing = new Set(edges.map((edge) => edge.id));
  rows.deposit.forEach((deposit) => {
    const depositId = eventId(deposit, "deposit", String(deposit.id));
    const interestId = stableEventId("deposit-interest", String(deposit.id));
    if (eventsById.has(interestId)) {
      pushEdge(edges, existing, {
        id: `edge:interest:${depositId}->${interestId}`,
        fromEventId: depositId,
        toEventId: interestId,
        amountVnd: eventsById.get(interestId)?.amountVnd,
        asset: "VND",
        relationType: "interest",
        method: "direct",
        confidence: "estimated",
      });
    }
    if (!deposit.childId) return;
    const childId = stableEventId("deposit", String(deposit.childId));
    if (!eventsById.has(childId)) return;
    pushEdge(edges, existing, {
      id: `edge:rollover:${depositId}->${childId}`,
      fromEventId: depositId,
      toEventId: childId,
      amountVnd: eventsById.get(childId)?.amountVnd,
      asset: "VND",
      relationType: "rollover",
      method: "direct",
      confidence: "exact",
    });
  });
}

function derivePurchaseAndDividendEdges(events: FinancialEvent[], edges: MoneyFlowEdge[]) {
  const existing = new Set(edges.map((edge) => edge.id));
  const sorted = [...events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const fundingByAccount = new Map<string, FinancialEvent[]>();
  sorted.forEach((event) => {
    if (event.entityType === "fund-transaction" && event.accountToId) addToMap(fundingByAccount, event.accountToId, event);
    if (event.entityType === "btc-topup") addFromFundingPool(fundingByAccount.get("binance"), event, "purchase", edges, existing);
    if (event.entityType === "btc-trade") addFromFundingPool([...events.filter((item) => item.entityType === "btc-topup" || item.entityType === "btc-transfer")], event, "purchase", edges, existing);
    if (event.entityType === "stock-purchase") addFromFundingPool(fundingByAccount.get("vps"), event, "purchase", edges, existing);
    if (event.entityType === "deposit") addFromFundingPool([...events.filter((item) => item.entityType === "fund-transaction" || item.entityType === "btc-transfer" || item.entityType === "stock-sale")], event, "transfer", edges, existing);
    if (event.entityType === "corporate-action") addDividendSources(events, event, edges, existing);
  });
}

function addFromFundingPool(
  candidates: FinancialEvent[] | undefined,
  target: FinancialEvent,
  relationType: MoneyFlowEdge["relationType"],
  edges: MoneyFlowEdge[],
  existing: Set<string>
) {
  const pool = [...(candidates ?? [])]
    .filter((event) => event.id !== target.id && event.occurredAt <= target.occurredAt)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const targetAmount = Math.abs(target.amountVnd ?? 0);
  if (!targetAmount) {
    addFromLatest(pool, target, relationType, edges, existing);
    return;
  }

  let remaining = targetAmount;
  pool.forEach((source) => {
    if (remaining <= 0) return;
    const sourceAmount = Math.abs(source.amountVnd ?? 0);
    if (!sourceAmount) return;
    const amountVnd = Math.min(sourceAmount, remaining);
    remaining -= amountVnd;
    pushEdge(edges, existing, {
      id: `edge:fifo:${relationType}:${source.id}->${target.id}`,
      fromEventId: source.id,
      toEventId: target.id,
      amountVnd,
      asset: target.asset || source.asset,
      quantity: target.quantity,
      stockSymbol: target.stockSymbol,
      relationType,
      method: pool.length > 1 ? "fifo" : "direct",
      confidence: remaining > 0 ? "estimated" : "derived",
    });
  });

  if (remaining === targetAmount) addFromLatest(pool, target, relationType, edges, existing);
}

function addFromLatest(
  candidates: FinancialEvent[] | undefined,
  target: FinancialEvent,
  relationType: MoneyFlowEdge["relationType"],
  edges: MoneyFlowEdge[],
  existing: Set<string>
) {
  const source = [...(candidates ?? [])]
    .filter((event) => event.id !== target.id && event.occurredAt <= target.occurredAt)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  if (!source) return;
  pushEdge(edges, existing, {
    id: `edge:derived:${relationType}:${source.id}->${target.id}`,
    fromEventId: source.id,
    toEventId: target.id,
    amountVnd: target.amountVnd || source.amountVnd,
    asset: target.asset || source.asset,
    quantity: target.quantity,
    stockSymbol: target.stockSymbol,
    relationType,
    method: "proportional",
    confidence: "estimated",
  });
}

function addDividendSources(events: FinancialEvent[], target: FinancialEvent, edges: MoneyFlowEdge[], existing: Set<string>) {
  const source = events
    .filter((event) => event.entityType === "stock-purchase" && event.occurredAt <= target.occurredAt)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  if (!source) return;
  pushEdge(edges, existing, {
    id: `edge:dividend:${source.id}->${target.id}`,
    fromEventId: source.id,
    toEventId: target.id,
    amountVnd: target.amountVnd,
    asset: target.asset,
    quantity: target.quantity,
    stockSymbol: target.stockSymbol,
    relationType: "dividend",
    method: "proportional",
    confidence: "derived",
  });
}

function relationTypeForPair(from: FinancialEvent, to: FinancialEvent): MoneyFlowEdge["relationType"] {
  if (from.entityType === "allocation" || to.entityType === "allocation") return "allocation";
  if (to.entityType === "btc-topup" || to.entityType === "btc-trade" || to.entityType === "stock-purchase") return "purchase";
  if (to.entityType === "deposit-interest") return "interest";
  if (to.entityType === "corporate-action") return "dividend";
  if (from.asset && to.asset && from.asset !== to.asset) return "conversion";
  return "transfer";
}

function pushEdge(edges: MoneyFlowEdge[], existing: Set<string>, edge: MoneyFlowEdge) {
  if (existing.has(edge.id)) return;
  edges.push(edge);
  existing.add(edge.id);
}

function groupBy<T>(rows: T[], key: (row: T) => string | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const value = key(row);
    if (!value) return;
    addToMap(map, value, row);
  });
  return map;
}

function addToMap<T>(map: Map<string, T[]>, key: string, value: T) {
  map.set(key, [...(map.get(key) ?? []), value]);
}
