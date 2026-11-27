import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLegacyData, legacyProofs, testScheduleId } from '../src/features/account/legacyData.ts';

const valid = { id: '83873703-fd80-435a-81bc-84710a102699', scheduleId: 'schedule-legacy',
  date: '2026-11-26', title: '일정 사진', savedAt: Date.parse('2026-11-26T09:00:00+09:00') };

test('legacy import includes confirmed Android photo records and excludes test, malformed and unavailable-origin records', () => {
  const candidates = [valid, { ...valid, scheduleId: testScheduleId }, { ...valid, id: '../image' },
    { ...valid, date: '2026-02-30' }, { ...valid, savedAt: NaN }, { ...valid, title: '' }, null];
  assert.deepEqual(legacyProofs(candidates, true), [valid]);
  assert.deepEqual(legacyProofs(candidates, false), []);
});

test('legacy prompt has no content on a new device and detects each supported record type', () => {
  const empty = { schedules: [], guardians: [], proofs: [] };
  assert.equal(hasLegacyData(empty), false);
  for (const field of ['schedules', 'guardians', 'proofs']) assert.equal(hasLegacyData({ ...empty, [field]: [{}] }), true);
});
