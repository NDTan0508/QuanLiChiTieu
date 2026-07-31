type BtcDcaFrequency = "daily" | "weekly" | "monthly";

type BtcDcaPlan = {
  id: string;
  amountUsdt: number;
  frequency: BtcDcaFrequency;
  time: string;
  startDate: string;
  nextRunAt: string;
  isActive: boolean;
  status: "active" | "paused" | "insufficient-usdt";
  statusNote?: string;
  lastRunAt?: string;
  btcAmountOverride?: number;
  averagePriceUsdtOverride?: number;
  note: string;
};

type BtcUsdtTopup = {
  id: string;
  usdtAmount: number;
};

type BtcTrade = {
  id: string;
  type: "dca";
  usdtAmount: number;
  btcAmount: number;
  btcPriceUsdt: number;
  executedAt: string;
  planId: string;
  note: string;
};

type BtcTransfer = {
  id: string;
  asset: "btc" | "usdt";
  usdtAmount: number;
  destination?: string;
};

type PayloadRow<T> = {
  id: string;
  account_id: string;
  payload: T;
  next_run_at?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function headers(extra: Record<string, string> = {}) {
  if (!SERVICE_ROLE_KEY) throw new Error("Missing service role key");
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function fetchBtcUsdt() {
  const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { cache: "no-store" });
  if (!response.ok) throw new Error("Cannot fetch BTC price");
  const json = await response.json();
  const price = Number(json?.price);
  if (!price) throw new Error("Invalid BTC price");
  return price;
}

async function recordJobRun(processed: number, created: number, skipped: number, error = "") {
  await rest("app_job_runs", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      job_name: "btc-dca-runner",
      last_run_at: new Date().toISOString(),
      processed,
      created,
      skipped,
      error,
      updated_at: new Date().toISOString(),
    }),
  });
}

function addDcaInterval(date: Date, frequency: BtcDcaFrequency) {
  const next = new Date(date);
  if (frequency === "daily") {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + 1);
  if (next.getUTCDate() !== day) next.setUTCDate(0);
  return next;
}

function nextRunAfter(plan: BtcDcaPlan, after: Date) {
  let runAt = new Date(plan.nextRunAt || `${plan.startDate}T${plan.time}:00`);
  while (runAt.getTime() <= after.getTime()) {
    runAt = addDcaInterval(runAt, plan.frequency);
  }
  return runAt.toISOString();
}

function tradeId(planId: string, scheduledAt: string) {
  return `dca_${planId}_${scheduledAt.replace(/[^0-9a-z]/gi, "")}`;
}

function applyDcaOverride(plan: BtcDcaPlan, createdBtc: number, createdUsdt: number): Pick<BtcDcaPlan, "btcAmountOverride" | "averagePriceUsdtOverride"> {
  const currentBtc = Number(plan.btcAmountOverride) || 0;
  const currentAverage = Number(plan.averagePriceUsdtOverride) || 0;
  if (!currentBtc || !currentAverage || !createdBtc) return {};

  const nextBtc = currentBtc + createdBtc;
  return {
    btcAmountOverride: nextBtc,
    averagePriceUsdtOverride: (currentBtc * currentAverage + createdUsdt) / nextBtc,
  };
}

async function tradeExists(id: string) {
  const rows = await rest<Array<{ id: string }>>(`btc_trades?id=eq.${encodeURIComponent(id)}&select=id&limit=1`);
  return rows.length > 0;
}

async function loadAccountLedger(accountId: string) {
  const query = `account_id=eq.${encodeURIComponent(accountId)}&select=payload`;
  const [topups, trades, transfers] = await Promise.all([
    rest<Array<{ payload: BtcUsdtTopup }>>(`btc_usdt_topups?${query}`),
    rest<Array<{ payload: BtcTrade }>>(`btc_trades?${query}`),
    rest<Array<{ payload: BtcTransfer }>>(`btc_transfers?${query}`),
  ]);
  const topupUsdt = topups.reduce((sum, row) => sum + (Number(row.payload.usdtAmount) || 0), 0);
  const spentUsdt = trades.reduce((sum, row) => sum + (Number(row.payload.usdtAmount) || 0), 0);
  const transferredUsdt = transfers.reduce((sum, row) => sum + (row.payload.asset === "usdt" ? Number(row.payload.usdtAmount) || 0 : 0), 0);
  const convertedToUsdt = transfers.reduce((sum, row) => sum + (row.payload.asset === "btc" && row.payload.destination === "usdt" ? Number(row.payload.usdtAmount) || 0 : 0), 0);
  return { usdtBalance: Math.max(topupUsdt + convertedToUsdt - spentUsdt - transferredUsdt, 0) };
}

Deno.serve(async () => {
  try {
    const now = new Date();
    const duePlans = await rest<Array<PayloadRow<BtcDcaPlan>>>(
      `btc_dca_plans?is_active=eq.true&next_run_at=lte.${encodeURIComponent(now.toISOString())}&select=id,account_id,payload,next_run_at&limit=100`
    );
    if (!duePlans.length) {
      await recordJobRun(0, 0, 0);
      return jsonResponse({ processed: 0, created: 0 });
    }

    let created = 0;
    let skipped = 0;
    let lastBtcPriceUsdt = 0;

    for (const row of duePlans) {
      const plan = { ...row.payload, nextRunAt: row.next_run_at ?? row.payload.nextRunAt };
      const scheduledAt = plan.nextRunAt;
      const amountUsdt = Number(plan.amountUsdt) || 0;
      if (!amountUsdt) {
        skipped += 1;
        continue;
      }

      let ledger = await loadAccountLedger(row.account_id);
      if (ledger.usdtBalance + 0.000001 < amountUsdt) {
        const payload: BtcDcaPlan = {
          ...plan,
          status: "insufficient-usdt",
          statusNote: `Thiếu USDT lúc ${now.toISOString()}`,
        };
        await rest(`btc_dca_plans?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ payload, status: payload.status, updated_at: now.toISOString() }),
        });
        skipped += 1;
        continue;
      }

      let nextRunAt = scheduledAt;
      let lastTradeAt = plan.lastRunAt ?? "";
      let createdBtc = 0;
      let createdUsdt = 0;
      let stoppedForFunds = false;
      for (let runCount = 0; runCount < 60 && new Date(nextRunAt).getTime() <= now.getTime(); runCount += 1) {
        const id = tradeId(row.id, nextRunAt);
        if (await tradeExists(id)) {
          lastTradeAt = nextRunAt;
          nextRunAt = nextRunAfter({ ...plan, nextRunAt }, new Date(nextRunAt));
          continue;
        }

        if (ledger.usdtBalance + 0.000001 < amountUsdt) {
          skipped += 1;
          stoppedForFunds = true;
          break;
        }

        const btcPriceUsdt = await fetchBtcUsdt();
        lastBtcPriceUsdt = btcPriceUsdt;
        const trade: BtcTrade = {
          id,
          type: "dca",
          usdtAmount: amountUsdt,
          btcAmount: amountUsdt / btcPriceUsdt,
          btcPriceUsdt,
          executedAt: nextRunAt,
          planId: row.id,
          note: `Auto DCA ${amountUsdt} USDT`,
        };

        const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/btc_trades`, {
          method: "POST",
          headers: headers({ "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" }),
          body: JSON.stringify({
            id: trade.id,
            account_id: row.account_id,
            payload: trade,
            plan_id: row.id,
            executed_at: trade.executedAt,
            updated_at: now.toISOString(),
          }),
        });
        if (!insertResponse.ok && insertResponse.status !== 409) {
          throw new Error(await insertResponse.text());
        }

        if (insertResponse.ok) created += 1;
        ledger = { usdtBalance: Math.max(ledger.usdtBalance - amountUsdt, 0) };
        createdBtc += trade.btcAmount;
        createdUsdt += trade.usdtAmount;
        lastTradeAt = trade.executedAt;
        nextRunAt = nextRunAfter({ ...plan, nextRunAt }, new Date(nextRunAt));
      }

      const payload: BtcDcaPlan = {
        ...plan,
        ...applyDcaOverride(plan, createdBtc, createdUsdt),
        nextRunAt,
        isActive: true,
        status: stoppedForFunds ? "insufficient-usdt" : "active",
        statusNote: stoppedForFunds ? `Thiếu USDT lúc ${now.toISOString()}` : "",
        lastRunAt: lastTradeAt,
      };
      await rest(`btc_dca_plans?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          payload,
          is_active: true,
          next_run_at: nextRunAt,
          status: payload.status,
          last_run_at: lastTradeAt || null,
          updated_at: now.toISOString(),
        }),
      });
    }

    await recordJobRun(duePlans.length, created, skipped);
    return jsonResponse({ processed: duePlans.length, created, skipped, btcPriceUsdt: lastBtcPriceUsdt });
  } catch (error) {
    try {
      await recordJobRun(0, 0, 0, error instanceof Error ? error.message : "Unknown error");
    } catch {
      // Keep the original error response if status recording also fails.
    }
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
