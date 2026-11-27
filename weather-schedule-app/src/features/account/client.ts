import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { android } from '../android/bridge';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
export const releaseBuild = process.env.EXPO_PUBLIC_ALLIT_ENVIRONMENT === 'release';
export const cloudRequested = !!(rawUrl || publicKey) || process.env.EXPO_PUBLIC_ALLIT_ACCOUNT_REQUIRED === '1';
export const cloudOrigin = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(rawUrl) ? rawUrl.replace(/\/$/, '') : undefined;
const STORAGE_KEY = 'allit-auth';
export const pendingAuthKey = `${STORAGE_KEY}-pending`;

let database: Promise<IDBDatabase> | undefined;
function store(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const name = releaseBuild && cloudOrigin ? `allit-account-v1:${new URL(cloudOrigin).hostname}` : 'allit-account-v1';
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('values');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('브라우저 저장 공간을 열 수 없어요.')); };
  });
}
async function browserValue<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await store();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('values', mode);
    const request = run(transaction.objectStore('values'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(new Error('브라우저에 데이터를 저장하지 못했어요.'));
  });
}

export const browserStore = {
  async getItem(key: string) { return await browserValue('readonly', records => records.get(key)) as string | undefined ?? null; },
  async setItem(key: string, value: string) { await browserValue('readwrite', records => records.put(value, key)); },
  async removeItem(key: string) { await browserValue('readwrite', records => records.delete(key)); },
};

function safeSession(key: string, value: string) {
  if (key !== STORAGE_KEY) return value;
  const session = JSON.parse(value);
  delete session.provider_token;
  delete session.provider_refresh_token;
  return JSON.stringify(session);
}
export const authStorage: SupportedStorage = {
  async getItem(key) {
    const stored = android ? (await android.authGet({ key })).value ?? null : await browserStore.getItem(key);
    if (key !== STORAGE_KEY || !stored) return stored;
    try {
      const token = JSON.parse(stored).access_token as string;
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload)).iss === `${cloudOrigin}/auth/v1` ? stored : null;
    } catch { return null; }
  },
  async setItem(key, value) {
    const stored = safeSession(key, value);
    if (android) await android.authSet({ key, value: stored }); else await browserStore.setItem(key, stored);
  },
  async removeItem(key) {
    if (android) await android.authSet({ key }); else await browserStore.removeItem(key);
  },
};

async function timedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const caller = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort();
  if (caller?.aborted) abort(); else caller?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12_000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); caller?.removeEventListener('abort', abort); }
}

export const supabase = typeof window !== 'undefined' && typeof window.document !== 'undefined' && cloudOrigin && /^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)
  ? createClient(cloudOrigin, publicKey, { global: { fetch: timedFetch }, auth: { storage: authStorage, storageKey: STORAGE_KEY, flowType: 'pkce',
    detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } }) : null;

export function newId(): string { return crypto.randomUUID(); }

export function readableCloudError(error: unknown, fallback: string) {
  const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
  if (code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883') {
    return '서버의 데이터 저장소 설정이 필요해요. 설정이 끝난 뒤 다시 시도해 주세요.';
  }
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
  if (status === 429) return '잠시 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요.';
  if (status === 413 || status === 507) return '사진 크기 또는 저장 공간 한도를 확인해 주세요.';
  return fallback;
}
