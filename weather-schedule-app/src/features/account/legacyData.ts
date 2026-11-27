import type { Guardian, Proof } from '../android/careStorage';
import { validDate, type Schedule } from '../schedules/model.ts';

export type LegacyData = { schedules: Schedule[]; guardians: Guardian[]; proofs: Proof[] };
export const testScheduleId = 'native-alarm-diagnostic';
const photoId = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export function legacyProofs(proofs: Proof[], androidFilesAvailable: boolean): Proof[] {
  if (!androidFilesAvailable) return [];
  return proofs.filter(proof => proof && typeof proof.id === 'string' && photoId.test(proof.id) &&
    proof.scheduleId !== testScheduleId && typeof proof.title === 'string' && !!proof.title.trim() && proof.title.length <= 80 &&
    validDate(proof.date) && Number.isFinite(proof.savedAt) && proof.savedAt > 0 && proof.savedAt <= 253402300799999);
}

export function hasLegacyData(data: LegacyData) {
  return data.schedules.length + data.guardians.length + data.proofs.length > 0;
}
