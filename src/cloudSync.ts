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
