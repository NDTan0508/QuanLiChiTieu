type EncryptedPayload = {
  version: 1;
  salt: string;
  iv: string;
  data: string;
};

type SnapshotRow = {
  payload: EncryptedPayload;
  updated_at?: string;
};

type AdminSettingsRow = {
  password_hash: string;
};

type AdminAccountProfileRow = {
  account_id: string;
  alias: string;
  pin: string;
  created_at: string;
  updated_at: string;
};

export type AdminAccountProfile = {
  accountId: string;
  alias: string;
  pin: string;
  createdAt: string;
  updatedAt: string;
};

export type BtcLedgerStatus = {
  topups: number;
  dcaPlans: number;
  trades: number;
  transfers: number;
  activePlans: number;
  btcBalance: number;
  usdtBalance: number;
  latestTradeAt: string;
  latestTopupAt: string;
};

export type DataStatus = {
  btcLedger: BtcLedgerStatus | null;
  lastJobRun: {
    jobName: string;
    lastRunAt: string;
    processed: number;
    created: number;
    skipped: number;
    error: string;
  } | null;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isCloudSyncConfigured() {
  return Boolean(getSupabaseConfig());
}

export async function loadCloudState<T>(syncKey: string): Promise<T | null> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thiếu cấu hình Supabase.");

  const id = await syncKeyId(syncKey);
  const response = await fetch(`${config.url}/rest/v1/app_snapshots?id=eq.${encodeURIComponent(id)}&select=payload,updated_at`, {
    headers: supabaseHeaders(config),
  });

  if (!response.ok) throw new Error("Không tải được dữ liệu cloud.");

  const rows = (await response.json()) as SnapshotRow[];
  const row = rows[0];
  if (!row) return null;

  return decryptJson<T>(syncKey, row.payload);
}

export async function saveCloudState(syncKey: string, state: unknown) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thiếu cấu hình Supabase.");

  const id = await syncKeyId(syncKey);
  const payload = await encryptJson(syncKey, state);
  const response = await fetch(`${config.url}/rest/v1/app_snapshots`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id,
      payload,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) throw new Error("Không lưu được dữ liệu cloud.");
}

export async function deleteCloudState(syncKey: string) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thiếu cấu hình Supabase.");

  const id = await syncKeyId(syncKey);
  const response = await fetch(`${config.url}/rest/v1/app_snapshots?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: supabaseHeaders(config),
  });

  if (!response.ok) throw new Error("Không xóa được dữ liệu cloud cũ.");
}

export async function loadAdminPasswordHash(fallbackHash: string) {
  const config = getSupabaseConfig();
  if (!config) return fallbackHash;

  const response = await fetch(`${config.url}/rest/v1/app_admin_settings?id=eq.default&select=password_hash`, {
    headers: supabaseHeaders(config),
  });

  if (!response.ok) return fallbackHash;

  const rows = (await response.json()) as AdminSettingsRow[];
  return rows[0]?.password_hash || fallbackHash;
}

export async function listAdminAccounts(): Promise<AdminAccountProfile[]> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thieu cau hinh Supabase.");

  const response = await fetch(`${config.url}/rest/v1/app_account_profiles?select=account_id,alias,pin,created_at,updated_at&order=updated_at.desc`, {
    headers: supabaseHeaders(config),
  });

  if (!response.ok) throw new Error("Khong tai duoc danh sach tai khoan.");

  const rows = (await response.json()) as AdminAccountProfileRow[];
  return rows.map((row) => ({
    accountId: row.account_id,
    alias: row.alias,
    pin: row.pin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function upsertAdminAccountProfile(profile: {
  accountId: string;
  alias: string;
  pin: string;
  updatedAt?: string;
}) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thieu cau hinh Supabase.");

  const now = profile.updatedAt ?? new Date().toISOString();
  const response = await fetch(`${config.url}/rest/v1/app_account_profiles`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      account_id: profile.accountId,
      alias: profile.alias,
      pin: profile.pin,
      updated_at: now,
    }),
  });

  if (!response.ok) throw new Error("Khong luu duoc thong tin tai khoan.");
}

export async function deleteAdminAccountProfile(accountId: string) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thieu cau hinh Supabase.");

  const response = await fetch(`${config.url}/rest/v1/app_account_profiles?account_id=eq.${encodeURIComponent(accountId)}`, {
    method: "DELETE",
    headers: supabaseHeaders(config),
  });

  if (!response.ok) throw new Error("Khong xoa duoc thong tin tai khoan.");
}

export async function cloudAccountIdForKey(syncKey: string) {
  return syncKeyId(syncKey);
}

export async function loadCloudPayloadRows<T>(table: string, accountId: string): Promise<T[]> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thieu cau hinh Supabase.");

  const response = await fetch(
    `${config.url}/rest/v1/${encodeURIComponent(table)}?account_id=eq.${encodeURIComponent(accountId)}&select=payload&order=updated_at.asc`,
    {
      headers: supabaseHeaders(config),
    }
  );

  if (!response.ok) throw new Error("Khong tai duoc du lieu cloud.");

  const rows = (await response.json()) as Array<{ payload: T }>;
  return rows.map((row) => row.payload);
}

export async function upsertCloudPayloadRow(
  table: string,
  accountId: string,
  id: string,
  payload: unknown,
  columns: Record<string, unknown> = {}
) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thieu cau hinh Supabase.");

  const response = await fetch(`${config.url}/rest/v1/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id,
      account_id: accountId,
      payload: withBtcPayloadMeta(table, id, payload),
      updated_at: new Date().toISOString(),
      ...columns,
    }),
  });

  if (!response.ok) throw new Error("Khong luu duoc du lieu cloud.");
}

function withBtcPayloadMeta(table: string, id: string, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const entityTypeByTable: Record<string, string | undefined> = {
    btc_usdt_topups: "btc-topup",
    btc_dca_plans: "btc-dca",
    btc_trades: "btc-trade",
    btc_transfers: "btc-transfer",
  };
  const entityType = entityTypeByTable[table];
  if (!entityType) return payload;
  const row = payload as Record<string, unknown>;
  if ((row.meta as { eventId?: string } | undefined)?.eventId) return payload;
  const now = new Date().toISOString();
  const occurredAt =
    typeof row.createdAt === "string" ? row.createdAt :
      typeof row.executedAt === "string" ? row.executedAt :
        typeof row.date === "string" ? row.date :
          typeof row.startDate === "string" ? row.startDate :
            now;
  return {
    ...row,
    meta: {
      eventId: `evt:${entityType}:${id}`,
      parentEventIds: [],
      childEventIds: [],
      accountFromId: "binance",
      accountToId: "binance",
      createdAt: occurredAt,
      updatedAt: now,
      createdBy: "system",
      schemaVersion: 2,
    },
  };
}

export async function deleteCloudPayloadRow(table: string, accountId: string, id: string) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thieu cau hinh Supabase.");

  const response = await fetch(
    `${config.url}/rest/v1/${encodeURIComponent(table)}?account_id=eq.${encodeURIComponent(accountId)}&id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: supabaseHeaders(config),
    }
  );

  if (!response.ok) throw new Error("Khong xoa duoc du lieu cloud.");
}

export async function loadDataStatus(accountId: string): Promise<DataStatus> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Thieu cau hinh Supabase.");

  const query = `account_id=eq.${encodeURIComponent(accountId)}&select=payload&order=updated_at.asc`;
  const fetchRows = async <T>(table: string): Promise<T[]> => {
    const response = await fetch(`${config.url}/rest/v1/${encodeURIComponent(table)}?${query}`, {
      headers: supabaseHeaders(config),
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as Array<{ payload: T }>;
    return rows.map((row) => row.payload);
  };

  const [topups, plans, trades, transfers] = await Promise.all([
    fetchRows<{ usdtAmount: number; date: string }>("btc_usdt_topups"),
    fetchRows<{ isActive?: boolean }>("btc_dca_plans"),
    fetchRows<{ usdtAmount: number; btcAmount: number; executedAt: string }>("btc_trades"),
    fetchRows<{ asset: "btc" | "usdt"; btcAmount: number; usdtAmount: number; destination?: string }>("btc_transfers"),
  ]);
  const topupUsdt = topups.reduce((sum, item) => sum + (Number(item.usdtAmount) || 0), 0);
  const spentUsdt = trades.reduce((sum, item) => sum + (Number(item.usdtAmount) || 0), 0);
  const transferredUsdt = transfers.reduce((sum, item) => sum + (item.asset === "usdt" ? Number(item.usdtAmount) || 0 : 0), 0);
  const convertedToUsdt = transfers.reduce((sum, item) => sum + (item.asset === "btc" && item.destination === "usdt" ? Number(item.usdtAmount) || 0 : 0), 0);
  const btcBought = trades.reduce((sum, item) => sum + (Number(item.btcAmount) || 0), 0);
  const btcMoved = transfers.reduce((sum, item) => sum + (item.asset === "btc" ? Number(item.btcAmount) || 0 : 0), 0);
  const tradeDates = trades.map((item) => item.executedAt).filter(Boolean).sort();
  const topupDates = topups.map((item) => item.date).filter(Boolean).sort();

  let lastJobRun: DataStatus["lastJobRun"] = null;
  const jobResponse = await fetch(
    `${config.url}/rest/v1/app_job_runs?job_name=eq.btc-dca-runner&select=job_name,last_run_at,processed,created,skipped,error&order=last_run_at.desc&limit=1`,
    { headers: supabaseHeaders(config) }
  );
  if (jobResponse.ok) {
    const jobRows = (await jobResponse.json()) as Array<{ job_name: string; last_run_at: string; processed: number; created: number; skipped: number; error: string | null }>;
    const job = jobRows[0];
    if (job) {
      lastJobRun = {
        jobName: job.job_name,
        lastRunAt: job.last_run_at,
        processed: job.processed,
        created: job.created,
        skipped: job.skipped,
        error: job.error ?? "",
      };
    }
  }

  return {
    btcLedger: {
      topups: topups.length,
      dcaPlans: plans.length,
      trades: trades.length,
      transfers: transfers.length,
      activePlans: plans.filter((item) => item.isActive).length,
      btcBalance: Math.max(btcBought - btcMoved, 0),
      usdtBalance: Math.max(topupUsdt + convertedToUsdt - spentUsdt - transferredUsdt, 0),
      latestTradeAt: tradeDates[tradeDates.length - 1] ?? "",
      latestTopupAt: topupDates[topupDates.length - 1] ?? "",
    },
    lastJobRun,
  };
}

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function supabaseHeaders(config: { anonKey: string }) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
  };
}

async function syncKeyId(syncKey: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(syncKey));
  return bytesToHex(new Uint8Array(hash));
}

async function encryptJson(syncKey: string, value: unknown): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(syncKey, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, encoder.encode(JSON.stringify(value)));

  return {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptJson<T>(syncKey: string, payload: EncryptedPayload): Promise<T> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveEncryptionKey(syncKey, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(base64ToBytes(payload.data))
  );
  return JSON.parse(decoder.decode(decrypted)) as T;
}

async function deriveEncryptionKey(syncKey: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(syncKey), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 210_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
