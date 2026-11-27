import AsyncStorage from '@react-native-async-storage/async-storage';

export type Guardian = { id: string; name: string; phone: string };
export type Proof = { id: string; scheduleId: string; date: string; title: string; savedAt: number;
  scheduledAt?: string; confirmedAt?: number; uploadedAt?: number; messageStatus?: 'opened' | 'failed' };
export type Records = { guardians: Guardian[]; proofs: Proof[] };
const key = 'allit:android-care:v1';
export const emptyRecords: Records = { guardians: [], proofs: [] };
let queue: Promise<unknown> = Promise.resolve();

export function primaryGuardianKey(accountId?: string, project?: string) {
  return `allit:primary-guardian:${accountId ? `${project ?? ''}:${accountId}` : 'device'}`;
}

export function loadPrimaryGuardian(accountId?: string, project?: string) {
  return AsyncStorage.getItem(primaryGuardianKey(accountId, project));
}

export function savePrimaryGuardian(id: string, accountId?: string, project?: string) {
  return AsyncStorage.setItem(primaryGuardianKey(accountId, project), id);
}

export function clearPrimaryGuardian(accountId: string, project?: string) {
  return AsyncStorage.removeItem(primaryGuardianKey(accountId, project));
}

export async function loadRecords(): Promise<Records> {
  const stored = await AsyncStorage.getItem(key);
  if (stored === null) return emptyRecords;
  const records = JSON.parse(stored) as Records;
  if (!Array.isArray(records?.guardians) || !Array.isArray(records?.proofs)) throw new Error('저장된 보호자와 인증 기록을 읽지 못했어요.');
  return records;
}

export function updateRecords(update: (records: Records) => Records): Promise<Records> {
  const operation = queue.then(async () => {
    const records = update(await loadRecords());
    await AsyncStorage.setItem(key, JSON.stringify(records));
    return records;
  });
  queue = operation.catch(() => {});
  return operation;
}
