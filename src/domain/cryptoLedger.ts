export type CryptoLedgerTopup = {
  id: string;
  vndAmount: number;
  usdtAmount: number;
  date: string;
  occurredAt?: string;
  costVnd?: number;
};

export type CryptoLedgerTrade = {
  id: string;
  type: "dca" | "manual-buy";
  usdtAmount: number;
  btcAmount: number;
  costVnd?: number;
  executedAt: string;
  planId?: string;
};

export type CryptoLedgerPlan = {
  id: string;
  startDate: string;
  time?: string;
  btcAmountOverride?: number;
  averagePriceUsdtOverride?: number;
};

export type CryptoLedgerTransfer = {
  id: string;
  asset: "btc" | "usdt";
  btcAmount: number;
  usdtAmount: number;
  vndAmount: number;
  destination: string;
  date: string;
  occurredAt?: string;
  closesPosition?: boolean;
};

export type CryptoLedgerAdjustment = {
  id: string;
  asset: "BTC" | "USDT";
  quantity: number;
  date: string;
  createdAt?: string;
};

export type CryptoLedgerInput = {
  topups: CryptoLedgerTopup[];
  trades: CryptoLedgerTrade[];
  plans?: CryptoLedgerPlan[];
  transfers: CryptoLedgerTransfer[];
  adjustments?: CryptoLedgerAdjustment[];
  fallbackUsdtVndRate: number;
};

export type CryptoRealizedWithdrawal = {
  transferId: string;
  proceedsVnd: number;
  releasedCostVnd: number;
  pnlVnd: number;
};

export type CryptoCoinSalePnl = {
  proceedsUsdt: number;
  releasedCostUsdt: number;
  pnlUsdt: number;
  proceedsVnd: number;
  releasedCostVnd: number;
  pnlVnd: number;
};

export type CryptoLedgerResult = {
  btcBalance: number;
  btcCostUsdt: number;
  btcCostVnd: number;
  usdtBalance: number;
  usdtCostVnd: number;
  averageBtcCostUsdt: number;
  realizedByTransferId: Record<string, CryptoRealizedWithdrawal>;
  coinSaleByTransferId: Record<string, CryptoCoinSalePnl>;
  closedTransferIds: string[];
};

export type SolCostBasisEvent = {
  withdrawalId: string;
  date: string;
  usdtAmount: number;
  costVnd: number;
};

export function findSolDerivedTopupCostEventIndex(
  events: SolCostBasisEvent[],
  topup: { sourceSolWithdrawalId?: string; date: string; usdtAmount: number }
) {
  if (topup.sourceSolWithdrawalId) {
    const linkedIndex = events.findIndex((event) => event.withdrawalId === topup.sourceSolWithdrawalId);
    if (linkedIndex >= 0) return linkedIndex;
  }

  const tolerance = Math.max(0.01, Math.abs(topup.usdtAmount) * 0.000001);
  return events.findIndex(
    (event) => event.date === topup.date && Math.abs(event.usdtAmount - topup.usdtAmount) <= tolerance
  );
}

type BuyEvent = {
  kind: "trade";
  id: string;
  at: string;
  btcAmount: number;
  usdtSpent: number;
  btcCostUsdt: number;
  directCostVnd: number;
};

type LedgerEvent =
  | { kind: "topup"; id: string; at: string; usdtAmount: number; costVnd: number }
  | BuyEvent
  | { kind: "transfer"; id: string; at: string; transfer: CryptoLedgerTransfer }
  | { kind: "adjustment"; id: string; at: string; adjustment: CryptoLedgerAdjustment };

const BTC_EPSILON = 0.00000001;
const USDT_EPSILON = 0.000001;
const FULL_CLOSE_RATIO = 0.0001;

const finite = (value: number | undefined) => Number.isFinite(value) ? value ?? 0 : 0;
const nonNegative = (value: number | undefined) => Math.max(finite(value), 0);

function eventAt(date: string, timestamp?: string) {
  if (timestamp && Number.isFinite(Date.parse(timestamp))) return timestamp;
  return `${date}T00:00:00.000`;
}

function adjustedTradeEvents(trades: CryptoLedgerTrade[], plans: CryptoLedgerPlan[]) {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const tradesByPlan = new Map<string, CryptoLedgerTrade[]>();
  trades.forEach((trade) => {
    if (trade.type === "dca" && trade.planId) {
      tradesByPlan.set(trade.planId, [...(tradesByPlan.get(trade.planId) ?? []), trade]);
    }
  });

  const events: BuyEvent[] = trades.map((trade) => {
    const plan = trade.planId ? planById.get(trade.planId) : undefined;
    const siblings = trade.planId ? tradesByPlan.get(trade.planId) ?? [] : [];
    const rawQuantity = siblings.reduce((sum, item) => sum + nonNegative(item.btcAmount), 0);
    const rawCost = siblings.reduce((sum, item) => sum + nonNegative(item.usdtAmount), 0);
    const targetQuantity = plan?.btcAmountOverride && plan.btcAmountOverride > 0 ? plan.btcAmountOverride : rawQuantity;
    const targetAverage = plan?.averagePriceUsdtOverride && plan.averagePriceUsdtOverride > 0
      ? plan.averagePriceUsdtOverride
      : rawQuantity > 0
        ? rawCost / rawQuantity
        : 0;
    const quantityFactor = plan && rawQuantity > 0 ? targetQuantity / rawQuantity : 1;
    const costFactor = plan && rawCost > 0 ? (targetQuantity * targetAverage) / rawCost : 1;
    return {
      kind: "trade" as const,
      id: trade.id,
      at: eventAt(trade.executedAt.slice(0, 10), trade.executedAt),
      btcAmount: nonNegative(trade.btcAmount) * quantityFactor,
      usdtSpent: nonNegative(trade.usdtAmount),
      btcCostUsdt: nonNegative(trade.usdtAmount) * costFactor,
      directCostVnd: nonNegative(trade.costVnd),
    };
  });

  plans.forEach((plan) => {
    if ((tradesByPlan.get(plan.id) ?? []).length) return;
    const quantity = nonNegative(plan.btcAmountOverride);
    const average = nonNegative(plan.averagePriceUsdtOverride);
    if (!quantity || !average) return;
    events.push({
      kind: "trade",
      id: `plan:${plan.id}`,
      at: eventAt(plan.startDate, `${plan.startDate}T${plan.time || "12:00"}:00`),
      btcAmount: quantity,
      usdtSpent: 0,
      btcCostUsdt: quantity * average,
      directCostVnd: 0,
    });
  });

  return events;
}

function eventPriority(event: LedgerEvent) {
  if (event.kind === "topup") return 0;
  if (event.kind === "transfer" && event.transfer.asset === "btc") return 1;
  if (event.kind === "trade") return 2;
  if (event.kind === "transfer") return 3;
  return 4;
}

export function buildCryptoLedger(input: CryptoLedgerInput): CryptoLedgerResult {
  const events: LedgerEvent[] = [
    ...input.topups.map((topup) => ({
      kind: "topup" as const,
      id: topup.id,
      at: eventAt(topup.date, topup.occurredAt),
      usdtAmount: nonNegative(topup.usdtAmount),
      costVnd: nonNegative(topup.costVnd ?? topup.vndAmount),
    })),
    ...adjustedTradeEvents(input.trades, input.plans ?? []),
    ...input.transfers.map((transfer) => ({
      kind: "transfer" as const,
      id: transfer.id,
      at: eventAt(transfer.date, transfer.occurredAt),
      transfer,
    })),
    ...(input.adjustments ?? []).map((adjustment) => ({
      kind: "adjustment" as const,
      id: adjustment.id,
      at: eventAt(adjustment.date, adjustment.createdAt),
      adjustment,
    })),
  ].sort((left, right) => left.at.localeCompare(right.at) || eventPriority(left) - eventPriority(right) || left.id.localeCompare(right.id));

  let btcBalance = 0;
  let btcCostUsdt = 0;
  let btcCostVnd = 0;
  let usdtBalance = 0;
  let usdtCostVnd = 0;
  const realizedByTransferId: Record<string, CryptoRealizedWithdrawal> = {};
  const coinSaleByTransferId: Record<string, CryptoCoinSalePnl> = {};
  const closedTransferIds = new Set<string>();

  const canApply = (event: LedgerEvent) => {
    if (event.kind === "topup" || event.kind === "adjustment") return true;
    if (event.kind === "trade") return event.directCostVnd > 0 || event.usdtSpent <= usdtBalance + USDT_EPSILON;
    if (event.transfer.asset === "btc") return event.transfer.btcAmount <= btcBalance + BTC_EPSILON;
    return event.transfer.usdtAmount <= usdtBalance + USDT_EPSILON;
  };

  const apply = (event: LedgerEvent) => {
    if (event.kind === "topup") {
      usdtBalance += event.usdtAmount;
      usdtCostVnd += event.costVnd;
      return;
    }

    if (event.kind === "trade") {
      const averageUsdtCostVnd = usdtBalance > USDT_EPSILON ? usdtCostVnd / usdtBalance : nonNegative(input.fallbackUsdtVndRate);
      const sourceCostVnd = event.directCostVnd || event.usdtSpent * averageUsdtCostVnd;
      const spent = event.directCostVnd ? 0 : Math.min(event.usdtSpent, usdtBalance);
      const releasedUsdtCostVnd = event.directCostVnd ? 0 : spent * averageUsdtCostVnd;
      usdtBalance = Math.max(usdtBalance - spent, 0);
      usdtCostVnd = Math.max(usdtCostVnd - releasedUsdtCostVnd, 0);
      btcBalance += event.btcAmount;
      btcCostUsdt += event.btcCostUsdt;
      btcCostVnd += sourceCostVnd || event.btcCostUsdt * nonNegative(input.fallbackUsdtVndRate);
      return;
    }

    if (event.kind === "adjustment") {
      const quantity = finite(event.adjustment.quantity);
      if (event.adjustment.asset === "BTC") {
        if (quantity < 0 && btcBalance > BTC_EPSILON) {
          const removed = Math.min(-quantity, btcBalance);
          const ratio = removed / btcBalance;
          btcCostUsdt = Math.max(btcCostUsdt * (1 - ratio), 0);
          btcCostVnd = Math.max(btcCostVnd * (1 - ratio), 0);
        }
        btcBalance = Math.max(btcBalance + quantity, 0);
        if (btcBalance <= BTC_EPSILON) {
          btcBalance = 0;
          btcCostUsdt = 0;
          btcCostVnd = 0;
        }
      } else {
        if (quantity < 0 && usdtBalance > USDT_EPSILON) {
          const removed = Math.min(-quantity, usdtBalance);
          usdtCostVnd = Math.max(usdtCostVnd * (1 - removed / usdtBalance), 0);
        }
        usdtBalance = Math.max(usdtBalance + quantity, 0);
        if (usdtBalance <= USDT_EPSILON) {
          usdtBalance = 0;
          usdtCostVnd = 0;
        }
      }
      return;
    }

    const transfer = event.transfer;
    if (transfer.asset === "btc") {
      const requested = nonNegative(transfer.btcAmount);
      const remainingRatio = btcBalance > BTC_EPSILON ? Math.max(btcBalance - requested, 0) / btcBalance : 0;
      const closesPosition = Boolean(transfer.closesPosition) || remainingRatio <= FULL_CLOSE_RATIO || btcBalance - requested <= BTC_EPSILON;
      if (closesPosition) closedTransferIds.add(transfer.id);
      const moved = closesPosition ? btcBalance : Math.min(requested, btcBalance);
      const ratio = btcBalance > BTC_EPSILON ? moved / btcBalance : 0;
      const movedCostUsdt = btcCostUsdt * ratio;
      const movedCostVnd = btcCostVnd * ratio;
      const proceedsUsdt = nonNegative(transfer.usdtAmount);
      const proceedsVnd = nonNegative(transfer.vndAmount) || proceedsUsdt * nonNegative(input.fallbackUsdtVndRate);
      coinSaleByTransferId[transfer.id] = {
        proceedsUsdt,
        releasedCostUsdt: movedCostUsdt,
        pnlUsdt: proceedsUsdt - movedCostUsdt,
        proceedsVnd,
        releasedCostVnd: movedCostVnd,
        pnlVnd: proceedsVnd - movedCostVnd,
      };
      btcBalance = closesPosition ? 0 : Math.max(btcBalance - requested, 0);
      btcCostUsdt = closesPosition ? 0 : Math.max(btcCostUsdt - movedCostUsdt, 0);
      btcCostVnd = closesPosition ? 0 : Math.max(btcCostVnd - movedCostVnd, 0);
      if (transfer.destination === "usdt") {
        usdtBalance += nonNegative(transfer.usdtAmount);
        usdtCostVnd += movedCostVnd;
      } else {
        const proceedsVnd = nonNegative(transfer.vndAmount);
        realizedByTransferId[transfer.id] = {
          transferId: transfer.id,
          proceedsVnd,
          releasedCostVnd: movedCostVnd,
          pnlVnd: proceedsVnd - movedCostVnd,
        };
      }
      return;
    }

    const requested = nonNegative(transfer.usdtAmount);
    const moved = Math.min(requested, usdtBalance);
    const averageCostVnd = usdtBalance > USDT_EPSILON ? usdtCostVnd / usdtBalance : 0;
    const movedCostVnd = moved * averageCostVnd;
    usdtBalance = Math.max(usdtBalance - requested, 0);
    usdtCostVnd = Math.max(usdtCostVnd - movedCostVnd, 0);
    if (usdtBalance <= USDT_EPSILON) {
      usdtBalance = 0;
      usdtCostVnd = 0;
    }
    const proceedsVnd = nonNegative(transfer.vndAmount);
    realizedByTransferId[transfer.id] = {
      transferId: transfer.id,
      proceedsVnd,
      releasedCostVnd: movedCostVnd,
      pnlVnd: proceedsVnd - movedCostVnd,
    };
  };

  for (let index = 0; index < events.length;) {
    const at = events[index].at;
    const group: LedgerEvent[] = [];
    while (index < events.length && events[index].at === at) group.push(events[index++]);
    while (group.length) {
      const runnableIndex = group.findIndex(canApply);
      apply(group.splice(runnableIndex >= 0 ? runnableIndex : 0, 1)[0]);
    }
  }

  return {
    btcBalance,
    btcCostUsdt,
    btcCostVnd,
    usdtBalance,
    usdtCostVnd,
    averageBtcCostUsdt: btcBalance > BTC_EPSILON ? btcCostUsdt / btcBalance : 0,
    realizedByTransferId,
    coinSaleByTransferId,
    closedTransferIds: [...closedTransferIds],
  };
}

export type SolLedgerTransaction =
  | {
      id: string;
      type: "buy";
      solAmount: number;
      priceUsdt: number;
      costVnd: number;
      date: string;
      occurredAt?: string;
    }
  | {
      id: string;
      type: "withdraw";
      solAmount: number;
      proceedsUsdt: number;
      proceedsVnd: number;
      destination: string;
      date: string;
      occurredAt?: string;
      closesPosition?: boolean;
    };

export type SolLedgerResult = {
  balance: number;
  costUsdt: number;
  costVnd: number;
  realizedByTransactionId: Record<string, { proceedsVnd: number; releasedCostVnd: number; pnlVnd: number }>;
  releasedByTransactionId: Record<string, number>;
  coinSaleByTransactionId: Record<string, CryptoCoinSalePnl>;
};

export function buildSolLedger(input: {
  transactions: SolLedgerTransaction[];
  adjustments?: Array<{ id: string; quantity: number; date: string; createdAt?: string }>;
}): SolLedgerResult {
  const events = [
    ...input.transactions.map((item) => ({
      kind: "transaction" as const,
      date: item.date,
      at: eventAt(item.date, item.occurredAt),
      hasExactTime: Boolean(item.occurredAt),
      priority: item.type === "withdraw" ? 2 : 1,
      item,
    })),
    ...(input.adjustments ?? []).map((item) => ({
      kind: "adjustment" as const,
      date: item.date,
      at: eventAt(item.date, item.createdAt),
      hasExactTime: Boolean(item.createdAt),
      priority: 0,
      item,
    })),
  ].sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder) return dateOrder;
    if (left.hasExactTime && right.hasExactTime) return left.at.localeCompare(right.at) || left.priority - right.priority;
    return left.priority - right.priority || left.at.localeCompare(right.at);
  });

  let balance = 0;
  let costUsdt = 0;
  let costVnd = 0;
  const realizedByTransactionId: SolLedgerResult["realizedByTransactionId"] = {};
  const releasedByTransactionId: SolLedgerResult["releasedByTransactionId"] = {};
  const coinSaleByTransactionId: SolLedgerResult["coinSaleByTransactionId"] = {};

  events.forEach((event) => {
    if (event.kind === "adjustment") {
      const quantity = finite(event.item.quantity);
      if (quantity < 0 && balance > BTC_EPSILON) {
        const removed = Math.min(-quantity, balance);
        const remainingRatio = 1 - removed / balance;
        costUsdt = Math.max(costUsdt * remainingRatio, 0);
        costVnd = Math.max(costVnd * remainingRatio, 0);
      }
      balance = Math.max(balance + quantity, 0);
      if (balance <= BTC_EPSILON) {
        balance = 0;
        costUsdt = 0;
        costVnd = 0;
      }
      return;
    }

    const transaction = event.item;
    if (transaction.type === "buy") {
      balance += nonNegative(transaction.solAmount);
      costUsdt += nonNegative(transaction.solAmount) * nonNegative(transaction.priceUsdt);
      costVnd += nonNegative(transaction.costVnd);
      return;
    }

    const requested = nonNegative(transaction.solAmount);
    const remainingRatio = balance > BTC_EPSILON ? Math.max(balance - requested, 0) / balance : 0;
    const closesPosition = Boolean(transaction.closesPosition) || remainingRatio <= FULL_CLOSE_RATIO || balance - requested <= BTC_EPSILON;
    const withdrawn = closesPosition ? balance : Math.min(requested, balance);
    const ratio = balance > BTC_EPSILON ? withdrawn / balance : 0;
    const releasedCostUsdt = costUsdt * ratio;
    const releasedCostVnd = costVnd * ratio;
    releasedByTransactionId[transaction.id] = releasedCostVnd;
    const proceedsUsdt = nonNegative(transaction.proceedsUsdt);
    const proceedsVnd = nonNegative(transaction.proceedsVnd);
    coinSaleByTransactionId[transaction.id] = {
      proceedsUsdt,
      releasedCostUsdt,
      pnlUsdt: proceedsUsdt - releasedCostUsdt,
      proceedsVnd,
      releasedCostVnd,
      pnlVnd: proceedsVnd - releasedCostVnd,
    };
    balance = closesPosition ? 0 : Math.max(balance - requested, 0);
    costUsdt = closesPosition ? 0 : Math.max(costUsdt - releasedCostUsdt, 0);
    costVnd = closesPosition ? 0 : Math.max(costVnd - releasedCostVnd, 0);
    if (transaction.destination !== "btc" && transaction.destination !== "btc-direct") {
      const proceedsVnd = nonNegative(transaction.proceedsVnd);
      realizedByTransactionId[transaction.id] = {
        proceedsVnd,
        releasedCostVnd,
        pnlVnd: proceedsVnd - releasedCostVnd,
      };
    }
  });

  return { balance, costUsdt, costVnd, realizedByTransactionId, releasedByTransactionId, coinSaleByTransactionId };
}
