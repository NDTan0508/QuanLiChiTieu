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

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.incomeTransactions[0].meta.eventId, stableEventId("income", "income-1"));
  assert.equal(migrated.financialAccounts.length, DEFAULT_FINANCIAL_ACCOUNTS.length);
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
