import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

let domainPromise;

async function loadDomain() {
  if (domainPromise) return domainPromise;
  domainPromise = (async () => {
    const dir = path.join(process.cwd(), "tests", ".tmp");
    await mkdir(dir, { recursive: true });
    const entry = path.join(dir, "entry.ts");
    const outfile = path.join(dir, "domain.mjs");
    await writeFile(
      entry,
      `
        export { buildFinancialIndex } from "../../src/domain/financialIndex.ts";
        export { runHealthChecks } from "../../src/domain/healthCheck.ts";
        export { normalizeFinancialMetadata, stableEventId, stableGroupId, DEFAULT_FINANCIAL_ACCOUNTS } from "../../src/domain/financialTypes.ts";
        export { appendMbbSettlementIncome, isIncomeGeneratingMbbSettlement, migrateMbbSettlementIncome, realizedMbbDepositInterest, mbbSettlementIncomeId, MBB_SETTLEMENT_INCOME_CATEGORY_ID } from "../../src/domain/bankDepositSettlement.ts";
        export { buildCryptoLedger, buildSolLedger, findSolDerivedTopupCostEventIndex } from "../../src/domain/cryptoLedger.ts";
        export { realizedStockSalePnl, stockOpenPositionSnapshot } from "../../src/domain/stockPnl.ts";
      `
    );
    await build({
      entryPoints: [entry],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile,
      logLevel: "silent",
    });
    return import(pathToFileURL(outfile).href);
  })();
  return domainPromise;
}

test("migration metadata adds stable event ids and default accounts", async () => {
  const { normalizeFinancialMetadata, stableEventId, DEFAULT_FINANCIAL_ACCOUNTS } = await loadDomain();
  const migrated = normalizeFinancialMetadata({
    incomeTransactions: [{ id: "income-1", amount: 1_000_000, date: "2026-07-01", month: "2026-07", note: "" }],
    financialAccounts: [],
  });

  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.incomeTransactions[0].meta.eventId, stableEventId("income", "income-1"));
  assert.equal(migrated.financialAccounts.length, DEFAULT_FINANCIAL_ACCOUNTS.length);
});

test("early MBB settlement creates principal income with zero realized interest", async () => {
  const {
    appendMbbSettlementIncome,
    realizedMbbDepositInterest,
    mbbSettlementIncomeId,
    MBB_SETTLEMENT_INCOME_CATEGORY_ID,
  } = await loadDomain();
  const deposit = {
    id: "deposit-early",
    code: "5508",
    principal: 1_300_000,
    status: "early-settled",
    settledAt: "2026-08-24",
    settledAmount: 1_300_000,
  };
  const result = appendMbbSettlementIncome([], [], deposit);

  assert.equal(realizedMbbDepositInterest(deposit), 0);
  assert.equal(result.incomeCategories[0].id, MBB_SETTLEMENT_INCOME_CATEGORY_ID);
  assert.equal(result.incomeTransactions[0].id, mbbSettlementIncomeId(deposit.id));
  assert.equal(result.incomeTransactions[0].amount, 1_300_000);
  assert.equal(result.incomeTransactions[0].month, "2026-08");
});

test("mature MBB settlement records total received and exact realized interest", async () => {
  const { appendMbbSettlementIncome, realizedMbbDepositInterest } = await loadDomain();
  const deposit = {
    id: "deposit-mature",
    code: "1403",
    principal: 2_000_000,
    status: "settled",
    settledAt: "2026-10-22",
    settledAmount: 2_035_993,
  };
  const result = appendMbbSettlementIncome([], [], deposit);

  assert.equal(realizedMbbDepositInterest(deposit), 35_993);
  assert.equal(result.incomeTransactions[0].amount, 2_035_993);
});

test("MBB settlement migration backfills once and skips rollover deposits", async () => {
  const { isIncomeGeneratingMbbSettlement, migrateMbbSettlementIncome, mbbSettlementIncomeId } = await loadDomain();
  const settled = {
    id: "deposit-old",
    code: "5508",
    principal: 1_300_000,
    status: "early-settled",
    settledAt: "2026-08-24",
    settledAmount: 1_300_000,
  };
  const rollover = {
    id: "deposit-rollover",
    code: "1403",
    principal: 2_000_000,
    status: "settled",
    settledAt: "2026-10-22",
    settledAmount: 2_035_993,
    childId: "deposit-child",
  };
  const first = migrateMbbSettlementIncome([], [], [settled, rollover]);
  const second = migrateMbbSettlementIncome(first.incomeCategories, first.incomeTransactions, [settled, rollover]);

  assert.equal(first.incomeTransactions.length, 1);
  assert.equal(first.incomeTransactions[0].id, mbbSettlementIncomeId(settled.id));
  assert.equal(second.incomeTransactions.length, 1);
  assert.equal(isIncomeGeneratingMbbSettlement(settled), true);
  assert.equal(isIncomeGeneratingMbbSettlement(rollover), false);
});

test("financial index omits early-settlement interest and uses mature realized interest", async () => {
  const { buildFinancialIndex, stableEventId } = await loadDomain();
  const index = buildFinancialIndex({
    bankDeposits: [
      { id: "early", principal: 1_000_000, rate: 7, termMonths: 6, status: "early-settled", settledAt: "2026-08-01", settledAmount: 1_000_000 },
      { id: "mature", principal: 2_000_000, rate: 7, termMonths: 6, status: "settled", settledAt: "2026-08-02", settledAmount: 2_070_000 },
      { id: "rollover", principal: 3_000_000, rate: 7, termMonths: 6, status: "rolled-all", settledAt: "2026-08-03", settledAmount: 3_105_000, childId: "next-deposit" },
    ],
  });

  assert.equal(index.eventsById.has(stableEventId("deposit-interest", "early")), false);
  assert.equal(index.eventsById.get(stableEventId("deposit-interest", "mature")).amountVnd, 70_000);
  assert.equal(index.eventsById.get(stableEventId("deposit-interest", "mature")).occurredAt, "2026-08-02");
  assert.equal(index.eventsById.get(stableEventId("deposit-interest", "rollover")).amountVnd, 105_000);
});

test("financial index creates allocation group edges", async () => {
  const { buildFinancialIndex, stableEventId, stableGroupId } = await loadDomain();
  const groupId = stableGroupId("allocation", "2026-07");
  const index = buildFinancialIndex({
    allocations: [{ month: "2026-07", totalSavingAtConfirm: 1_000_000, meta: { eventId: stableEventId("allocation", "2026-07"), groupId } }],
    fundTransactions: [{ id: "fund-btc", fund: "btc", type: "deposit", amount: 200_000, date: "2026-07-31", month: "2026-07", note: "Chia quỹ cuối tháng", meta: { eventId: stableEventId("fund-transaction", "fund-btc"), groupId } }],
  });

  assert.ok(index.edges.some((edge) => edge.relationType === "allocation" && edge.confidence === "exact"));
});

test("financial index creates exact marker transfer edge", async () => {
  const { buildFinancialIndex, stableEventId } = await loadDomain();
  const index = buildFinancialIndex({
    btcTransfers: [{ id: "bt-1", asset: "usdt", usdtAmount: 10, vndAmount: 250_000, destination: "stock", date: "2026-07-10", note: "", meta: { eventId: stableEventId("btc-transfer", "bt-1") } }],
    fundTransactions: [{ id: "ft-1", fund: "stock", type: "deposit", amount: 250_000, date: "2026-07-10", month: "2026-07", note: "Rút từ BTC [btc-transfer:bt-1]", meta: { eventId: stableEventId("fund-transaction", "ft-1") } }],
  });

  assert.ok(index.edges.some((edge) => edge.id.includes("edge:marker") && edge.method === "direct" && edge.confidence === "exact"));
});

test("financial index creates FIFO edges for grouped funding", async () => {
  const { buildFinancialIndex, stableEventId } = await loadDomain();
  const index = buildFinancialIndex({
    fundTransactions: [
      { id: "ft-1", fund: "btc", type: "deposit", amount: 100_000, date: "2026-07-01", month: "2026-07", note: "", meta: { eventId: stableEventId("fund-transaction", "ft-1"), accountToId: "binance" } },
      { id: "ft-2", fund: "btc", type: "deposit", amount: 200_000, date: "2026-07-02", month: "2026-07", note: "", meta: { eventId: stableEventId("fund-transaction", "ft-2"), accountToId: "binance" } },
    ],
    btcUsdtTopups: [{ id: "topup-1", vndAmount: 250_000, usdtAmount: 10, date: "2026-07-03", note: "", meta: { eventId: stableEventId("btc-topup", "topup-1"), accountToId: "binance" } }],
  });

  const fifoEdges = index.edges.filter((edge) => edge.toEventId === stableEventId("btc-topup", "topup-1") && edge.method === "fifo");
  assert.equal(fifoEdges.length, 2);
  assert.equal(fifoEdges.reduce((sum, edge) => sum + edge.amountVnd, 0), 250_000);
});

test("cash dividend is a VND event into VPS", async () => {
  const { buildFinancialIndex, stableEventId } = await loadDomain();
  const index = buildFinancialIndex({
    corporateActions: [{ id: "ca-1", symbol: "MBB", type: "cash_dividend", eligibleShares: 100, cashPerShare: 1_000, taxRate: 5, fee: 0, status: "applied", meta: { eventId: stableEventId("corporate-action", "ca-1") } }],
  });
  const event = index.eventsById.get(stableEventId("corporate-action", "ca-1"));

  assert.equal(event.asset, "VND");
  assert.equal(event.accountToId, "vps");
  assert.equal(event.amountVnd, 95_000);
});

test("stock purchase includes 0.08 percent buy fee in amount and cash balance", async () => {
  const { buildFinancialIndex, runHealthChecks, stableEventId } = await loadDomain();
  const stockPurchase = {
    id: "sp-1",
    date: "2026-07-01",
    month: "2026-07",
    note: "",
    lines: [{ symbol: "MBB", shares: 100, buyPrice: 27.5 }],
    meta: { eventId: stableEventId("stock-purchase", "sp-1") },
  };
  const index = buildFinancialIndex({
    stockPurchases: [stockPurchase],
    fundTransactions: [{ id: "ft-1", fund: "stock", type: "deposit", amount: 2_752_200, date: "2026-07-01", month: "2026-07", note: "", meta: { eventId: stableEventId("fund-transaction", "ft-1"), accountToId: "vps" } }],
  });
  const purchaseEvent = index.eventsById.get(stableEventId("stock-purchase", "sp-1"));
  const issues = runHealthChecks({
    stockPurchases: [stockPurchase],
    fundTransactions: [{ id: "ft-1", fund: "stock", type: "deposit", amount: 2_752_200, date: "2026-07-01", month: "2026-07", note: "" }],
  }, index, "2026-07-02T00:00:00.000Z");

  assert.equal(purchaseEvent.amountVnd, 2_752_200);
  assert.equal(issues.some((item) => item.fingerprint === "stock-cash-negative"), false);
});

test("health check detects overspend and preserves ignored fingerprints", async () => {
  const { buildFinancialIndex, runHealthChecks, stableEventId } = await loadDomain();
  const state = {
    btcTrades: [{ id: "trade-1", type: "manual-buy", usdtAmount: 5, btcAmount: 0.00005, btcPriceUsdt: 100_000, executedAt: "2026-07-01T00:00:00.000Z", note: "", meta: { eventId: stableEventId("btc-trade", "trade-1") } }],
    healthIssues: [{ id: "health:btc-trade-over-usdt:trade-1", ruleId: "overspend", fingerprint: "btc-trade-over-usdt:trade-1", severity: "error", scope: "crypto", title: "", description: "", relatedEventIds: [], relatedEntityIds: [], canAutoFix: false, detectedAt: "2026-07-01T00:00:00.000Z", status: "ignored" }],
  };
  const issues = runHealthChecks(state, buildFinancialIndex(state), "2026-07-02T00:00:00.000Z");
  const issue = issues.find((item) => item.fingerprint === "btc-trade-over-usdt:trade-1");

  assert.equal(issue.status, "ignored");
  assert.equal(issue.ruleId, "overspend");
});

test("health check allows USDT topup without pending crypto capital", async () => {
  const { buildFinancialIndex, runHealthChecks, stableEventId } = await loadDomain();
  const state = {
    btcUsdtTopups: [{ id: "topup-1", vndAmount: 250_000, usdtAmount: 10, date: "2026-07-03", note: "", meta: { eventId: stableEventId("btc-topup", "topup-1") } }],
    fundTransactions: [],
  };
  const issues = runHealthChecks(state, buildFinancialIndex(state), "2026-07-04T00:00:00.000Z");

  assert.equal(issues.some((item) => item.fingerprint === "topup-over-capital:topup-1"), false);
  assert.equal(issues.some((item) => item.fingerprint === "crypto-vnd-negative"), false);
});

test("financial index includes reconciliation adjustment events", async () => {
  const { buildFinancialIndex, stableEventId } = await loadDomain();
  const index = buildFinancialIndex({
    adjustmentTransactions: [{
      id: "adj-1",
      reconciliationSessionId: "rec-1",
      accountId: "vps",
      asset: "VND",
      amountVnd: 12_000,
      date: "2026-07-05",
      note: "Điều chỉnh",
      createdAt: "2026-07-05T00:00:00.000Z",
      meta: { eventId: stableEventId("adjustment", "adj-1") },
    }],
  });
  const event = index.eventsById.get(stableEventId("adjustment", "adj-1"));

  assert.equal(event.entityType, "adjustment");
  assert.equal(event.amountVnd, 12_000);
  assert.equal(event.asset, "VND");
});

test("allocation plans survive financial metadata migration", async () => {
  const { normalizeFinancialMetadata, DEFAULT_FINANCIAL_ACCOUNTS } = await loadDomain();
  const state = normalizeFinancialMetadata({
    allocationPlans: [{
      id: "plan-1",
      availableAmount: 1_000_000,
      strategyId: "balanced",
      status: "draft",
      currentSnapshot: { totalAssets: 0, crypto: 0, stock: 0, saving: 0, emergency: 0 },
      projectedSnapshot: { totalAssets: 1_000_000, crypto: 250_000, stock: 250_000, saving: 300_000, emergency: 200_000 },
      items: [{ id: "item-1", actionType: "buy_usdt", amountVnd: 250_000, targetFund: "crypto", reason: "test", priority: 1, status: "ready", executedEventIds: [] }],
      createdAt: "2026-07-01T00:00:00.000Z",
    }],
  });

  assert.equal(state.allocationPlans[0].items[0].actionType, "buy_usdt");
  assert.equal(state.financialAccounts.length, DEFAULT_FINANCIAL_ACCOUNTS.length);
});

test("crypto ledger resets BTC average cost after a full sale and same-day rebuy", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const oldAverage = 65_555.612;
  const newAverage = 79_811.99;
  const initialBtc = 10 / oldAverage;
  const reboughtBtc = 12 / newAverage;
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 250_000, usdtAmount: 10, date: "2026-08-24" }],
    trades: [
      { id: "old-buy", type: "manual-buy", usdtAmount: 10, btcAmount: initialBtc, executedAt: "2026-08-24T00:00:00.000Z" },
      { id: "rebuy", type: "manual-buy", usdtAmount: 12, btcAmount: reboughtBtc, executedAt: "2026-08-25T00:00:00.000Z" },
    ],
    transfers: [{ id: "sell-all", asset: "btc", btcAmount: initialBtc, usdtAmount: 12, vndAmount: 0, destination: "usdt", date: "2026-08-25" }],
  });

  assert.ok(Math.abs(ledger.btcBalance - reboughtBtc) < 1e-12);
  assert.ok(Math.abs(ledger.averageBtcCostUsdt - newAverage) < 0.000001);
  assert.equal(ledger.usdtBalance, 0);
});

test("crypto ledger keeps average cost unchanged after a partial BTC sale", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01", occurredAt: "2026-08-01T08:00:00.000Z" }],
    trades: [{ id: "buy", type: "manual-buy", usdtAmount: 100, btcAmount: 0.002, executedAt: "2026-08-01T09:00:00.000Z" }],
    transfers: [{ id: "sell-part", asset: "btc", btcAmount: 0.0005, usdtAmount: 30, vndAmount: 0, destination: "usdt", date: "2026-08-02", occurredAt: "2026-08-02T09:00:00.000Z" }],
  });

  assert.ok(Math.abs(ledger.btcBalance - 0.0015) < 1e-12);
  assert.ok(Math.abs(ledger.btcCostUsdt - 75) < 1e-9);
  assert.ok(Math.abs(ledger.averageBtcCostUsdt - 50_000) < 0.000001);
});

test("crypto ledger closes BTC dust and starts the next position from zero", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01" }],
    trades: [{ id: "buy", type: "manual-buy", usdtAmount: 100, btcAmount: 0.002, executedAt: "2026-08-01T00:00:00.000Z" }],
    transfers: [{ id: "near-full", asset: "btc", btcAmount: 0.0019999, usdtAmount: 120, vndAmount: 0, destination: "usdt", date: "2026-08-02" }],
  });

  assert.equal(ledger.btcBalance, 0);
  assert.equal(ledger.btcCostUsdt, 0);
  assert.equal(ledger.btcCostVnd, 0);
  assert.deepEqual(ledger.closedTransferIds, ["near-full"]);
});

test("internal BTC to USDT conversion preserves portfolio VND cost basis", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01" }],
    trades: [{ id: "buy", type: "manual-buy", usdtAmount: 100, btcAmount: 0.002, executedAt: "2026-08-01T00:00:00.000Z" }],
    transfers: [{ id: "convert", asset: "btc", btcAmount: 0.0005, usdtAmount: 30, vndAmount: 0, destination: "usdt", date: "2026-08-02" }],
  });

  assert.ok(Math.abs(ledger.btcCostVnd + ledger.usdtCostVnd - 2_500_000) < 0.01);
});

test("partial BTC sale records realized PnL while preserving the remaining average cost", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01" }],
    trades: [{ id: "buy", type: "manual-buy", usdtAmount: 100, btcAmount: 0.002, executedAt: "2026-08-01T08:00:00.000Z" }],
    transfers: [{ id: "sell-part", asset: "btc", btcAmount: 0.0005, usdtAmount: 30, vndAmount: 750_000, destination: "usdt", date: "2026-08-02" }],
  });

  assert.equal(ledger.averageBtcCostUsdt, 50_000);
  assert.equal(ledger.coinSaleByTransferId["sell-part"].releasedCostUsdt, 25);
  assert.equal(ledger.coinSaleByTransferId["sell-part"].pnlUsdt, 5);
  assert.equal(ledger.coinSaleByTransferId["sell-part"].releasedCostVnd, 625_000);
  assert.equal(ledger.coinSaleByTransferId["sell-part"].pnlVnd, 125_000);
  assert.equal(ledger.btcCostVnd + ledger.usdtCostVnd, 2_500_000);
});

test("rounded SOL proceeds still match the linked USDT topup cost basis", async () => {
  const { findSolDerivedTopupCostEventIndex } = await loadDomain();
  const events = [{ withdrawalId: "sol-sale", date: "2026-08-25", usdtAmount: 203.655, costVnd: 3_900_000 }];

  assert.equal(findSolDerivedTopupCostEventIndex(events, { date: "2026-08-25", usdtAmount: 203.656 }), 0);
  assert.equal(findSolDerivedTopupCostEventIndex(events, { sourceSolWithdrawalId: "sol-sale", date: "2026-08-26", usdtAmount: 999 }), 0);
});

test("external USDT withdrawal releases proportional basis and records realized PnL", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01" }],
    trades: [],
    transfers: [{ id: "withdraw", asset: "usdt", btcAmount: 0, usdtAmount: 40, vndAmount: 1_200_000, destination: "cash", date: "2026-08-02" }],
  });

  assert.equal(ledger.usdtBalance, 60);
  assert.equal(ledger.usdtCostVnd, 1_500_000);
  assert.equal(ledger.realizedByTransferId.withdraw.releasedCostVnd, 1_000_000);
  assert.equal(ledger.realizedByTransferId.withdraw.pnlVnd, 200_000);
});

test("same-day legacy events buy before selling when the opening BTC balance is zero", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01" }],
    trades: [{ id: "buy", type: "manual-buy", usdtAmount: 100, btcAmount: 0.002, executedAt: "2026-08-01T00:00:00.000" }],
    transfers: [{ id: "sell", asset: "btc", btcAmount: 0.002, usdtAmount: 110, vndAmount: 0, destination: "usdt", date: "2026-08-01" }],
  });

  assert.equal(ledger.btcBalance, 0);
  assert.equal(ledger.usdtBalance, 110);
  assert.equal(ledger.usdtCostVnd, 2_500_000);
});

test("DCA overrides keep entered BTC quantity and average cost aligned", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 500_000, usdtAmount: 20, date: "2026-08-01" }],
    plans: [{ id: "plan", startDate: "2026-08-01", btcAmountOverride: 0.00025, averagePriceUsdtOverride: 80_000 }],
    trades: [
      { id: "dca-1", type: "dca", planId: "plan", usdtAmount: 10, btcAmount: 0.0001, executedAt: "2026-08-01T08:00:00.000Z" },
      { id: "dca-2", type: "dca", planId: "plan", usdtAmount: 10, btcAmount: 0.0001, executedAt: "2026-08-02T08:00:00.000Z" },
    ],
    transfers: [],
  });

  assert.ok(Math.abs(ledger.btcBalance - 0.00025) < 1e-12);
  assert.ok(Math.abs(ledger.averageBtcCostUsdt - 80_000) < 0.000001);
  assert.equal(ledger.btcCostVnd, 500_000);
});

test("deleting a DCA plan removes its BTC and returns spent USDT", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const topups = [{ id: "topup", vndAmount: 500_000, usdtAmount: 20, date: "2026-08-01" }];
  const dcaTrade = { id: "dca-1", type: "dca", planId: "plan", usdtAmount: 2, btcAmount: 0.00002561, executedAt: "2026-08-30T05:00:00.000Z" };
  const withDca = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups,
    plans: [{ id: "plan", startDate: "2026-08-30", btcAmountOverride: dcaTrade.btcAmount, averagePriceUsdtOverride: 78_109.74 }],
    trades: [dcaTrade],
    transfers: [],
  });
  const afterDelete = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups,
    plans: [],
    trades: [],
    transfers: [],
  });

  assert.equal(withDca.usdtBalance, 18);
  assert.equal(afterDelete.usdtBalance, 20);
  assert.ok(Math.abs(withDca.btcBalance - dcaTrade.btcAmount) < 1e-12);
  assert.equal(afterDelete.btcBalance, 0);
  assert.equal(afterDelete.averageBtcCostUsdt, 0);
});

test("positive crypto adjustments preserve average cost instead of creating zero-cost assets", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01" }],
    trades: [{ id: "buy", type: "manual-buy", usdtAmount: 50, btcAmount: 0.001, executedAt: "2026-08-02T08:00:00.000Z" }],
    transfers: [],
    adjustments: [
      { id: "btc-adjust", asset: "BTC", quantity: 0.001, date: "2026-08-03" },
      { id: "usdt-adjust", asset: "USDT", quantity: 50, date: "2026-08-03" },
    ],
  });

  assert.equal(ledger.btcBalance, 0.002);
  assert.equal(ledger.usdtBalance, 100);
  assert.equal(ledger.averageBtcCostUsdt, 50_000);
  assert.equal(ledger.usdtCostVnd / ledger.usdtBalance, 25_000);
});

test("withdrawing the complete USDT balance clears active cost basis", async () => {
  const { buildCryptoLedger } = await loadDomain();
  const ledger = buildCryptoLedger({
    fallbackUsdtVndRate: 25_000,
    topups: [{ id: "topup", vndAmount: 2_500_000, usdtAmount: 100, date: "2026-08-01" }],
    trades: [],
    transfers: [{ id: "withdraw-all", asset: "usdt", btcAmount: 0, usdtAmount: 100, vndAmount: 2_400_000, destination: "cash", date: "2026-08-02" }],
  });

  assert.equal(ledger.usdtBalance, 0);
  assert.equal(ledger.usdtCostVnd, 0);
  assert.equal(ledger.btcBalance, 0);
  assert.equal(ledger.btcCostVnd, 0);
  assert.equal(ledger.realizedByTransferId["withdraw-all"].pnlVnd, -100_000);
});

test("SOL max withdrawal consumes a prior balance adjustment instead of leaving it behind", async () => {
  const { buildSolLedger } = await loadDomain();
  const ledger = buildSolLedger({
    transactions: [
      { id: "buy", type: "buy", solAmount: 2, priceUsdt: 100, costVnd: 5_000_000, date: "2026-08-25" },
      { id: "withdraw-max", type: "withdraw", solAmount: 2.00184, proceedsVnd: 5_100_000, destination: "cash", date: "2026-08-25" },
    ],
    adjustments: [{ id: "adjust", quantity: 0.00184, date: "2026-08-25", createdAt: "2026-08-25T08:00:00.000Z" }],
  });

  assert.equal(ledger.balance, 0);
  assert.equal(ledger.costUsdt, 0);
  assert.equal(ledger.costVnd, 0);
});

test("SOL max withdrawal closes rounding dust at eight decimal places", async () => {
  const { buildSolLedger } = await loadDomain();
  const ledger = buildSolLedger({
    transactions: [
      { id: "buy", type: "buy", solAmount: 1.234567891, priceUsdt: 100, costVnd: 3_000_000, date: "2026-08-24", occurredAt: "2026-08-24T08:00:00.000Z" },
      { id: "withdraw-max", type: "withdraw", solAmount: 1.23456789, proceedsVnd: 3_100_000, destination: "cash", date: "2026-08-25", occurredAt: "2026-08-25T08:00:00.000Z", closesPosition: true },
    ],
  });

  assert.equal(ledger.balance, 0);
  assert.equal(ledger.costUsdt, 0);
  assert.equal(ledger.costVnd, 0);
});

test("positive SOL adjustments preserve average cost", async () => {
  const { buildSolLedger } = await loadDomain();
  const ledger = buildSolLedger({
    transactions: [{ id: "buy", type: "buy", solAmount: 2, priceUsdt: 100, costVnd: 5_000_000, date: "2026-08-25" }],
    adjustments: [{ id: "sol-adjust", quantity: 1, date: "2026-08-26" }],
  });

  assert.equal(ledger.balance, 3);
  assert.equal(ledger.costUsdt / ledger.balance, 100);
  assert.equal(ledger.costVnd / ledger.balance, 2_500_000);
});

test("partial SOL sale records realized PnL and only releases proportional cost", async () => {
  const { buildSolLedger } = await loadDomain();
  const ledger = buildSolLedger({
    transactions: [
      { id: "buy", type: "buy", solAmount: 2, priceUsdt: 75, costVnd: 3_750_000, date: "2026-08-24" },
      { id: "sell-part", type: "withdraw", solAmount: 1, proceedsUsdt: 100, proceedsVnd: 2_500_000, destination: "btc", date: "2026-08-25" },
    ],
  });

  assert.equal(ledger.balance, 1);
  assert.equal(ledger.costUsdt, 75);
  assert.equal(ledger.costVnd, 1_875_000);
  assert.equal(ledger.coinSaleByTransactionId["sell-part"].pnlUsdt, 25);
  assert.equal(ledger.coinSaleByTransactionId["sell-part"].pnlVnd, 625_000);
});

test("stock open PnL only uses cash and holdings that remain in the portfolio", async () => {
  const { stockOpenPositionSnapshot } = await loadDomain();
  const snapshot = stockOpenPositionSnapshot({
    cashVnd: 1_000_000,
    holdingsCostVnd: 10_000_000,
    holdingsMarketValueVnd: 12_000_000,
  });

  assert.equal(snapshot.investedValueVnd, 11_000_000);
  assert.equal(snapshot.currentValueVnd, 13_000_000);
  assert.equal(snapshot.pnlVnd, 2_000_000);
});

test("stock metrics return to zero after every share and cash balance is withdrawn", async () => {
  const { stockOpenPositionSnapshot } = await loadDomain();
  const snapshot = stockOpenPositionSnapshot({
    cashVnd: 0,
    holdingsCostVnd: 0,
    holdingsMarketValueVnd: 0,
    totalAssetAdjustmentVnd: 49_127_000,
  });

  assert.equal(snapshot.investedValueVnd, 0);
  assert.equal(snapshot.currentValueVnd, 0);
  assert.equal(snapshot.pnlVnd, 0);
  assert.equal(snapshot.pnlPercent, 0);
});

test("stock sale history keeps realized PnL after proceeds leave the portfolio", async () => {
  const { realizedStockSalePnl, stockOpenPositionSnapshot } = await loadDomain();
  const realizedPnl = realizedStockSalePnl(3_504_130, 3_551_489);
  const emptyPortfolio = stockOpenPositionSnapshot({ cashVnd: 0, holdingsCostVnd: 0, holdingsMarketValueVnd: 0 });

  assert.equal(realizedPnl, -47_359);
  assert.equal(emptyPortfolio.pnlVnd, 0);
});

test("stock sale proceeds kept as broker cash have zero open PnL", async () => {
  const { stockOpenPositionSnapshot } = await loadDomain();
  const snapshot = stockOpenPositionSnapshot({
    cashVnd: 3_504_130,
    holdingsCostVnd: 0,
    holdingsMarketValueVnd: 0,
  });

  assert.equal(snapshot.investedValueVnd, 3_504_130);
  assert.equal(snapshot.currentValueVnd, 3_504_130);
  assert.equal(snapshot.pnlVnd, 0);
});
