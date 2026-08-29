import type { FinancialIndex } from "./financialIndex";
import type { HealthIssue, TransactionMeta } from "./financialTypes";

type AnyRow = {
  id?: string;
  month?: string;
  date?: string;
  startDate?: string;
  maturityDate?: string;
  executedAt?: string;
  settledAt?: string;
  status?: string;
  note?: string;
  fund?: string;
  type?: string;
  destination?: string;
  asset?: string;
  symbol?: string;
  newSymbol?: string;
  meta?: TransactionMeta;
  [key: string]: unknown;
};

type HealthState = {
  allocations?: AnyRow[];
  fundTransactions?: AnyRow[];
  btcUsdtTopups?: AnyRow[];
  btcTrades?: AnyRow[];
  btcTransfers?: AnyRow[];
  solTransactions?: AnyRow[];
  stockPurchases?: AnyRow[];
  stockSales?: AnyRow[];
  corporateActions?: AnyRow[];
  bankDeposits?: AnyRow[];
  healthIssues?: HealthIssue[];
};

type IssueInput = Omit<HealthIssue, "id" | "detectedAt" | "status">;

const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const s = (value: unknown) => (typeof value === "string" ? value : "");
const dateOf = (row: AnyRow) => s(row.executedAt) || s(row.date) || s(row.appliedAt) || s(row.receiveDate) || s(row.paymentDate) || s(row.recordDate) || s(row.exDate) || "";
const STOCK_PRICE_UNIT = 1000;
const STOCK_BUY_BROKERAGE_FEE_RATE = 0.0008;
const stockPurchaseCost = (shares: number, buyPrice: number) => {
  const grossValue = Math.round(shares * buyPrice * STOCK_PRICE_UNIT);
  return grossValue + Math.round(Math.max(grossValue, 0) * STOCK_BUY_BROKERAGE_FEE_RATE);
};

export function runHealthChecks(state: HealthState, index: FinancialIndex, detectedAt = new Date().toISOString()): HealthIssue[] {
  const previousByFingerprint = new Map((state.healthIssues ?? []).map((issue) => [issue.fingerprint, issue]));
  return [
    ...negativeBalanceIssues(state),
    ...overspendIssues(state),
    ...missingCounterpartyIssues(state),
    ...brokenLinkIssues(index),
    ...allocationIssues(state),
    ...mbbIssues(state),
  ].map((issue) => {
    const previous = previousByFingerprint.get(issue.fingerprint);
    return {
      ...issue,
      id: previous?.id ?? `health:${issue.fingerprint}`,
      detectedAt,
      status: previous?.status === "ignored" || previous?.status === "resolved" ? previous.status : "open",
    };
  });
}

function makeIssue(input: IssueInput): IssueInput {
  return input;
}

function negativeBalanceIssues(state: HealthState): IssueInput[] {
  const issues: IssueInput[] = [];
  const btc = btcBalances(state);
  if (btc.usdt < -0.000001) issues.push(balanceIssue("usdt-negative", "crypto", "USDT âm", `Số dư USDT đang âm ${btc.usdt.toFixed(6)}.`));
  if (btc.btc < -0.00000001) issues.push(balanceIssue("btc-negative", "crypto", "BTC âm", `Số dư BTC đang âm ${btc.btc.toFixed(8)}.`));
  const sol = solBalance(state);
  if (sol < -0.00000001) issues.push(balanceIssue("sol-negative", "crypto", "SOL âm", `Số dư SOL đang âm ${sol.toFixed(8)}.`));
  const stock = stockBalances(state);
  if (stock.cash < -1) issues.push(balanceIssue("stock-cash-negative", "stock", "Tiền dư CK âm", `Tiền dư CK đang âm ${Math.round(stock.cash).toLocaleString("vi-VN")}đ.`));
  stock.holdings.forEach((shares, symbol) => {
    if (shares < -0.000001) issues.push(balanceIssue(`stock-shares-negative:${symbol}`, "stock", `Số cổ ${symbol} âm`, `${symbol} đang âm ${shares} cổ.`));
  });
  return issues;
}

function balanceIssue(fingerprint: string, scope: HealthIssue["scope"], title: string, description: string): IssueInput {
  return makeIssue({
    ruleId: "negative-balance",
    fingerprint,
    severity: "critical",
    scope,
    title,
    description,
    relatedEventIds: [],
    relatedEntityIds: [],
    canAutoFix: false,
  });
}

function overspendIssues(state: HealthState): IssueInput[] {
  return [
    ...btcTimelineOverspendIssues(state),
    ...solTimelineOverspendIssues(state),
    ...stockTimelineOverspendIssues(state),
  ];
}

function btcTimelineOverspendIssues(state: HealthState): IssueInput[] {
  const issues: IssueInput[] = [];
  let usdt = 0;
  let btc = 0;
  const events = [
    ...(state.btcUsdtTopups ?? []).map((row) => ({ kind: "topup" as const, row, date: dateOf(row) })),
    ...(state.btcTrades ?? []).map((row) => ({ kind: "trade" as const, row, date: dateOf(row) })),
    ...(state.btcTransfers ?? []).map((row) => ({ kind: "transfer" as const, row, date: dateOf(row) })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  events.forEach((event) => {
    const row = event.row;
    if (event.kind === "topup") {
      usdt += n(row.usdtAmount);
      return;
    }
    if (event.kind === "trade") {
      if (n(row.usdtAmount) - usdt > 0.000001) {
        issues.push(overspendIssue(`btc-trade-over-usdt:${row.id}`, "crypto", "Mua BTC vượt số dư USDT", `Lệnh ${row.id} dùng ${n(row.usdtAmount)} USDT trong khi trước đó chỉ có ${usdt}.`, row));
      }
      usdt -= n(row.usdtAmount);
      btc += n(row.btcAmount);
      return;
    }
    if (row.asset === "usdt") {
      if (n(row.usdtAmount) - usdt > 0.000001) {
        issues.push(overspendIssue(`btc-transfer-over-usdt:${row.id}`, "crypto", "Rút/chuyển USDT vượt số dư", `Transfer ${row.id} dùng ${n(row.usdtAmount)} USDT trong khi trước đó chỉ có ${usdt}.`, row));
      }
      usdt -= n(row.usdtAmount);
      return;
    }
    if (n(row.btcAmount) - btc > 0.00000001) {
      issues.push(overspendIssue(`btc-transfer-over-btc:${row.id}`, "crypto", "Rút/chuyển BTC vượt số dư", `Transfer ${row.id} dùng ${n(row.btcAmount)} BTC trong khi trước đó chỉ có ${btc}.`, row));
    }
    btc -= n(row.btcAmount);
    if (row.destination === "usdt") usdt += n(row.usdtAmount);
  });
  return issues;
}

function solTimelineOverspendIssues(state: HealthState): IssueInput[] {
  const issues: IssueInput[] = [];
  let sol = 0;
  [...(state.solTransactions ?? [])].sort((a, b) => dateOf(a).localeCompare(dateOf(b))).forEach((row) => {
    if (row.type === "withdraw") {
      if (n(row.solAmount) - sol > 0.00000001) {
        issues.push(overspendIssue(`sol-withdraw-over-balance:${row.id}`, "crypto", "Rút/chuyển SOL vượt số dư", `Lệnh ${row.id} rút ${n(row.solAmount)} SOL trong khi trước đó chỉ có ${sol}.`, row));
      }
      sol -= n(row.solAmount);
      return;
    }
    sol += n(row.solAmount);
  });
  return issues;
}

function stockTimelineOverspendIssues(state: HealthState): IssueInput[] {
  const issues: IssueInput[] = [];
  const holdings = new Map<string, number>();
  const events = [
    ...(state.stockPurchases ?? []).flatMap((purchase, purchaseIndex) => {
      const lines = Array.isArray(purchase.lines) ? purchase.lines as AnyRow[] : [];
      return lines.map((line, lineIndex) => ({ kind: "buy" as const, row: purchase, line, date: dateOf(purchase), order: purchaseIndex * 100 + lineIndex }));
    }),
    ...(state.stockSales ?? []).map((row, order) => ({ kind: "sale" as const, row, date: dateOf(row), order })),
    ...(state.corporateActions ?? [])
      .filter((row) => row.status === "applied")
      .map((row, order) => ({ kind: "corporate-action" as const, row, date: dateOf(row), order })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.order - right.order);

  events.forEach((event) => {
    if (event.kind === "buy") {
      const symbol = s(event.line.symbol).toUpperCase();
      holdings.set(symbol, (holdings.get(symbol) ?? 0) + n(event.line.shares));
      return;
    }
    if (event.kind === "corporate-action") {
      applyCorporateActionToHoldings(holdings, event.row);
      return;
    }
    const symbol = s(event.row.symbol).toUpperCase();
    const before = holdings.get(symbol) ?? 0;
    if (n(event.row.shares) - before > 0.000001) {
      issues.push(overspendIssue(`stock-sale-over-holding:${event.row.id}`, "stock", `Bán/rút ${symbol} vượt số đang giữ`, `Lệnh ${event.row.id} rút ${n(event.row.shares)} cổ trong khi trước đó chỉ có ${before}.`, event.row));
    }
    holdings.set(symbol, before - n(event.row.shares));
  });
  return issues;
}

function overspendIssue(fingerprint: string, scope: HealthIssue["scope"], title: string, description: string, row: AnyRow): IssueInput {
  return makeIssue({
    ruleId: "overspend",
    fingerprint,
    severity: "error",
    scope,
    title,
    description,
    relatedEventIds: [row.meta?.eventId].filter(Boolean) as string[],
    relatedEntityIds: [String(row.id ?? "")],
    canAutoFix: false,
  });
}

function missingCounterpartyIssues(state: HealthState): IssueInput[] {
  const issues: IssueInput[] = [];
  (state.btcTransfers ?? []).forEach((transfer) => {
    if (transfer.destination !== "stock") return;
    const hasDeposit = (state.fundTransactions ?? []).some((row) =>
      row.fund === "stock" &&
      row.type === "deposit" &&
      Math.abs(n(row.amount) - n(transfer.vndAmount)) <= 1 &&
      s(row.note).includes(`[btc-transfer:${transfer.id}]`)
    );
    if (!hasDeposit) {
      issues.push(makeIssue({
        ruleId: "missing-counterparty",
        fingerprint: `btc-transfer-stock-missing:${transfer.id}`,
        severity: "error",
        scope: "fund",
        title: "Chuyển Crypto sang CK thiếu giao dịch đối ứng",
        description: `Transfer ${transfer.id} chuyển sang CK nhưng không tìm thấy giao dịch nạp CK tương ứng.`,
        relatedEventIds: [transfer.meta?.eventId].filter(Boolean) as string[],
        relatedEntityIds: [String(transfer.id ?? "")],
        canAutoFix: false,
      }));
    }
  });
  return issues;
}

function brokenLinkIssues(index: FinancialIndex): IssueInput[] {
  const issues: IssueInput[] = [];
  index.events.forEach((event) => {
    event.parentEventIds.forEach((parentId) => {
      if (index.eventsById.has(parentId)) return;
      issues.push(makeIssue({
        ruleId: "broken-link",
        fingerprint: `missing-parent:${event.id}:${parentId}`,
        severity: "warning",
        scope: "system",
        title: "Liên kết nguồn tiền bị mất",
        description: `${event.label} đang trỏ tới parentEventId không tồn tại.`,
        relatedEventIds: [event.id],
        relatedEntityIds: [event.entityId],
        canAutoFix: true,
      }));
    });
    event.childEventIds.forEach((childId) => {
      if (index.eventsById.has(childId)) return;
      issues.push(makeIssue({
        ruleId: "broken-link",
        fingerprint: `missing-child:${event.id}:${childId}`,
        severity: "warning",
        scope: "system",
        title: "Liên kết giao dịch con bị mất",
        description: `${event.label} đang trỏ tới childEventId không tồn tại.`,
        relatedEventIds: [event.id],
        relatedEntityIds: [event.entityId],
        canAutoFix: true,
      }));
    });
  });
  return issues;
}

function allocationIssues(state: HealthState): IssueInput[] {
  const issues: IssueInput[] = [];
  (state.allocations ?? []).forEach((allocation) => {
    const totalPercent = n(allocation.btcPercent) + n(allocation.stockPercent) + n(allocation.savingPercent) + n(allocation.emergencyPercent);
    if (totalPercent !== 100) {
      issues.push(makeIssue({
        ruleId: "allocation-invalid",
        fingerprint: `allocation-percent:${allocation.month}`,
        severity: "error",
        scope: "fund",
        title: "Tổng tỷ lệ chia quỹ không bằng 100%",
        description: `Tháng ${allocation.month} có tổng tỷ lệ ${totalPercent}%.`,
        relatedEventIds: [allocation.meta?.eventId].filter(Boolean) as string[],
        relatedEntityIds: [String(allocation.month ?? "")],
        canAutoFix: false,
      }));
    }
    if (!allocation.confirmedAt) return;
    const hasBtc = hasAllocationFundTransaction(state, "btc", allocation.month, n(allocation.btcAmount));
    const hasStock = hasAllocationFundTransaction(state, "stock", allocation.month, n(allocation.stockAmount));
    if (!hasBtc || !hasStock) {
      issues.push(makeIssue({
        ruleId: "allocation-invalid",
        fingerprint: `allocation-missing-fund-transaction:${allocation.month}`,
        severity: "error",
        scope: "fund",
        title: "Chia quỹ thiếu giao dịch quỹ",
        description: `Tháng ${allocation.month} đã xác nhận chia quỹ nhưng thiếu giao dịch nạp BTC hoặc CK.`,
        relatedEventIds: [allocation.meta?.eventId].filter(Boolean) as string[],
        relatedEntityIds: [String(allocation.month ?? "")],
        canAutoFix: false,
      }));
    }
  });
  return issues;
}

function mbbIssues(state: HealthState): IssueInput[] {
  const issues: IssueInput[] = [];
  const today = new Date().toISOString().slice(0, 10);
  (state.bankDeposits ?? []).forEach((deposit) => {
    if (s(deposit.maturityDate) && s(deposit.startDate) && s(deposit.maturityDate) < s(deposit.startDate)) {
      issues.push(makeIssue({
        ruleId: "mbb-invalid",
        fingerprint: `deposit-maturity-before-start:${deposit.id}`,
        severity: "error",
        scope: "mbb",
        title: "Ngày đáo hạn nhỏ hơn ngày gửi",
        description: `Sổ ${deposit.code ?? deposit.id} có ngày đáo hạn trước ngày gửi.`,
        relatedEventIds: [deposit.meta?.eventId].filter(Boolean) as string[],
        relatedEntityIds: [String(deposit.id ?? "")],
        canAutoFix: false,
      }));
    }
    if (deposit.status === "active" && s(deposit.maturityDate) && s(deposit.maturityDate) < today) {
      issues.push(makeIssue({
        ruleId: "mbb-invalid",
        fingerprint: `deposit-overdue-active:${deposit.id}`,
        severity: "warning",
        scope: "mbb",
        title: "Sổ MBB quá hạn vẫn đang gửi",
        description: `Sổ ${deposit.code ?? deposit.id} đã quá ngày đáo hạn nhưng trạng thái vẫn là Đang gửi.`,
        relatedEventIds: [deposit.meta?.eventId].filter(Boolean) as string[],
        relatedEntityIds: [String(deposit.id ?? "")],
        canAutoFix: false,
      }));
    }
    if (deposit.product === "certificate" && n(deposit.certificateMaturityValue) && n(deposit.certificatePurchaseAmount) && n(deposit.certificateMaturityValue) < n(deposit.certificatePurchaseAmount)) {
      issues.push(makeIssue({
        ruleId: "mbb-invalid",
        fingerprint: `certificate-maturity-less-than-purchase:${deposit.id}`,
        severity: "warning",
        scope: "mbb",
        title: "CCTG có giá trị cuối kỳ thấp hơn tiền thanh toán",
        description: `Sổ ${deposit.code ?? deposit.id} có giá trị cuối kỳ nhỏ hơn số tiền đã thanh toán.`,
        relatedEventIds: [deposit.meta?.eventId].filter(Boolean) as string[],
        relatedEntityIds: [String(deposit.id ?? "")],
        canAutoFix: false,
      }));
    }
  });
  return issues;
}

function hasAllocationFundTransaction(state: HealthState, fund: "btc" | "stock", month: unknown, amount: number) {
  if (!amount) return true;
  return (state.fundTransactions ?? []).some((transaction) =>
    transaction.fund === fund &&
    transaction.type === "deposit" &&
    transaction.month === month &&
    transaction.note === "Chia quỹ cuối tháng" &&
    Math.abs(n(transaction.amount) - amount) <= 1
  );
}

function fundBalance(state: HealthState, fund: "btc" | "stock") {
  return (state.fundTransactions ?? [])
    .filter((transaction) => transaction.fund === fund)
    .reduce((sum, transaction) => sum + (transaction.type === "withdraw" ? -n(transaction.amount) : n(transaction.amount)), 0);
}

function btcBalances(state: HealthState) {
  const capital = fundBalance(state, "btc");
  const topupVnd = (state.btcUsdtTopups ?? []).reduce((sum, row) => sum + n(row.vndAmount), 0);
  const topupUsdt = (state.btcUsdtTopups ?? []).reduce((sum, row) => sum + n(row.usdtAmount), 0);
  const spentUsdt = (state.btcTrades ?? []).reduce((sum, row) => sum + n(row.usdtAmount), 0);
  const btcBought = (state.btcTrades ?? []).reduce((sum, row) => sum + n(row.btcAmount), 0);
  const transferredUsdt = (state.btcTransfers ?? []).reduce((sum, row) => sum + (row.asset === "usdt" ? n(row.usdtAmount) : 0), 0);
  const convertedToUsdt = (state.btcTransfers ?? []).reduce((sum, row) => sum + (row.asset === "btc" && row.destination === "usdt" ? n(row.usdtAmount) : 0), 0);
  const movedBtc = (state.btcTransfers ?? []).reduce((sum, row) => sum + (row.asset === "btc" ? n(row.btcAmount) : 0), 0);
  return {
    pendingVnd: capital - topupVnd,
    usdt: topupUsdt + convertedToUsdt - spentUsdt - transferredUsdt,
    btc: btcBought - movedBtc,
  };
}

function solBalance(state: HealthState) {
  return (state.solTransactions ?? []).reduce((sum, transaction) => {
    if (transaction.type === "withdraw") return sum - n(transaction.solAmount);
    return sum + n(transaction.solAmount);
  }, 0);
}

function stockBalances(state: HealthState) {
  const fundCash = fundBalance(state, "stock");
  let invested = 0;
  let soldToCash = 0;
  let corporateCash = 0;
  const holdings = new Map<string, number>();
  (state.stockPurchases ?? []).forEach((purchase) => {
    const lines = Array.isArray(purchase.lines) ? purchase.lines as AnyRow[] : [];
    lines.forEach((line) => {
      const symbol = s(line.symbol).toUpperCase();
      const shares = n(line.shares);
      invested += stockPurchaseCost(shares, n(line.buyPrice));
      holdings.set(symbol, (holdings.get(symbol) ?? 0) + shares);
    });
  });
  (state.corporateActions ?? []).filter((action) => action.status === "applied").forEach((action) => {
    if (action.type === "cash_dividend") {
      const grossCash = n(action.cashReceived) || n(action.eligibleShares) * n(action.cashPerShare);
      corporateCash += Math.max(grossCash * (1 - n(action.taxRate) / 100) - n(action.fee), 0);
      return;
    }
    applyCorporateActionToHoldings(holdings, action);
  });
  (state.stockSales ?? []).forEach((sale) => {
    const symbol = s(sale.symbol).toUpperCase();
    const shares = n(sale.shares);
    holdings.set(symbol, (holdings.get(symbol) ?? 0) - shares);
    if (sale.destination === "stock") {
      const gross = n(sale.vndAmount);
      const fee =
        sale.fee === undefined
          ? Math.round(Math.max(gross, 0) * 0.0008) + Math.round(Math.max(gross, 0) * 0.001) + Math.round(Math.max(shares, 0) * 0.3)
          : n(sale.fee);
      soldToCash += n(sale.netVndAmount) || Math.max(gross - fee - n(sale.tax), 0);
    }
  });
  return { cash: fundCash - invested + soldToCash + corporateCash, holdings };
}

function applyCorporateActionToHoldings(holdings: Map<string, number>, action: AnyRow) {
  const symbol = s(action.symbol).toUpperCase();
  const current = holdings.get(symbol) ?? 0;
  if (!current) return;
  const ratioFrom = n(action.ratioFrom) || 1;
  const ratioTo = n(action.ratioTo) || 1;
  if (action.type === "stock_dividend" || action.type === "bonus_issue" || action.type === "rights_issue") {
    const addedShares = n(action.resultingShares) || Math.floor((n(action.eligibleShares) * ratioTo) / ratioFrom);
    holdings.set(symbol, current + addedShares);
    return;
  }
  if (action.type === "stock_split" || action.type === "reverse_split") {
    holdings.set(symbol, Math.floor((current * ratioTo) / ratioFrom));
    return;
  }
  if (action.type === "symbol_change" && action.newSymbol) {
    holdings.delete(symbol);
    holdings.set(s(action.newSymbol).toUpperCase(), current);
  }
}
