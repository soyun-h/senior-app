import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homeDialogue } from '../src/features/avatar/homeDialoguePresentation.ts';

// 허소윤 preview/schedules의 homeSchedules()가 홈 카드로 넘기는 형식과 같다.
// time: `${hour}:${분 두 자리}` (예: '9:00', '14:05', '0:30'), completed: 오늘 완료 여부
const fromSchedule = (hour, minute, completed = false) => ({ time: `${hour}:${String(minute).padStart(2, '0')}`, completed });
const at = (hour, minute = 0) => new Date(2026, 10, 24, hour, minute);

test('real schedules from the schedule screen drive the pending and complete dialogue', () => {
  const schedules = [fromSchedule(9, 0, true), fromSchedule(14, 5)];
  assert.equal(homeDialogue('char2', { now: at(14, 4), schedules }).situation, 'greeting');
  const due = homeDialogue('char2', { now: at(14, 5), schedules });
  assert.equal(due.situation, 'schedulePending');
  assert.equal(due.pose, 'encourage');

  const done = homeDialogue('char2', { now: at(15), schedules: [fromSchedule(9, 0, true), fromSchedule(14, 5, true)] });
  assert.equal(done.situation, 'scheduleComplete');
  assert.equal(done.pose, 'ok');
});

test('single-digit and midnight hours are understood', () => {
  assert.equal(homeDialogue('char4', { now: at(7, 30), schedules: [fromSchedule(7, 30)] }).situation, 'schedulePending');
  assert.equal(homeDialogue('char4', { now: at(23), schedules: [fromSchedule(0, 30)] }).situation, 'night');
});

test('home shows at most two cards, and an empty day is not treated as completed', () => {
  const twoCards = [fromSchedule(8, 0, true), fromSchedule(21, 0)];
  assert.equal(homeDialogue('char5', { now: at(12), schedules: twoCards }).situation, 'greeting');
  assert.equal(homeDialogue('char5', { now: at(12), schedules: [] }).situation, 'greeting');
});
