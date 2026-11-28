import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createAlarmSync, reservationOutcome } from '../src/features/android/alarmSync.ts';

const bridgeSrc = readFileSync(new URL('../src/features/android/bridge.ts', import.meta.url), 'utf8');
const bridgeJs = ts.transpileModule(bridgeSrc, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function bridgeFixture(platform) {
  let ready = false, registrations = 0;
  const native = { status: async () => 'ready' };
  const context = {
    exports: {},
    require: () => ({
      Capacitor: { getPlatform: () => platform, isPluginAvailable: () => ready },
      registerPlugin: () => { registrations++; return native; },
    }),
    setTimeout: queueMicrotask, console: { warn() {} },
  };
  vm.runInNewContext(bridgeJs, context);
  return {
    api: context.exports.android, ready: () => { ready = true; }, count: () => registrations,
  };
}

test('Web and iOS leave the Android bridge inactive', () => {
  for (const platform of ['web', 'ios']) {
    const fixture = bridgeFixture(platform);
    assert.equal(fixture.api, null);
    assert.equal(fixture.count(), 0);
  }
});

test('the Android bridge times out, then recovers concurrent calls with one registration', async () => {
  const fixture = bridgeFixture('android');
  await assert.rejects(fixture.api.status(), /PLUGIN_UNAVAILABLE/);
  const calls = [fixture.api.status(), fixture.api.status()];
  queueMicrotask(fixture.ready);
  assert.deepEqual(await Promise.all(calls), ['ready', 'ready']);
  assert.equal(fixture.count(), 1);
});

test('event subscribers recover from plugin timeout and failed native listener registration', async () => {
  const timers = [];
  const context = {
    exports: {},
    require: () => ({ Capacitor: { getPlatform: () => 'web' } }),
    console: { warn() {} },
  };
  vm.runInNewContext(bridgeJs, context);
  let ready = false, registrations = 0, attempts = 0, first = 0, second = 0;
  let emit;
  const api = context.exports.createAndroidBridge('android', () => ready, () => {
    registrations++;
    return { addListener: async (_event, callback) => {
      if (++attempts === 1) throw new Error('temporary failure');
      emit = callback;
      return { remove() {} };
    } };
  }, ms => ms === 100 ? Promise.resolve() : new Promise(resolve => timers.push(resolve)));
  const a = await api.addListener('changed', () => first++);
  const b = await api.addListener('changed', () => second++);
  await turn();
  assert.equal(registrations, 0);
  assert.equal(timers.length, 1);
  ready = true;
  timers.shift()();
  await turn();
  assert.equal(attempts, 1);
  timers.shift()();
  await turn();
  assert.deepEqual([registrations, attempts, first, second], [1, 2, 1, 1]);
  await a.remove();
  emit();
  assert.deepEqual([first, second], [1, 2]);
  await b.remove();
  const c = await api.addListener('changed', () => second++);
  emit();
  assert.deepEqual([registrations, attempts, first, second], [1, 2, 1, 3]);
  await c.remove();
});

test('permission completion reads the latest saved list instead of the captured list', async () => {
  const sent = [];
  let current = ['before-dialog'];
  const sync = createAlarmSync(async () => current, async (items, force) => { sent.push({ items, force }); return { scheduled: 1 }; }, () => {});
  const permission = deferred();
  const completion = permission.promise.then(() => sync.request(true));
  current = ['after-dialog'];
  permission.resolve();
  await completion;
  assert.deepEqual(sent, [{ items: ['after-dialog'], force: true }]);
});

test('changes during a read skip the obsolete send, and changes during a send suppress its result', async () => {
  const firstRead = deferred();
  const firstSend = deferred();
  const sent = [], published = [];
  let reads = 0, current = ['initial'];
  const sync = createAlarmSync(() => ++reads === 1 ? firstRead.promise : Promise.resolve(current),
    async items => { sent.push(items); return sent.length === 1 ? firstSend.promise : { scheduled: 2 }; },
    result => published.push(result));
  const settled = sync.request();
  current = ['middle'];
  void sync.request();
  firstRead.resolve(['initial']);
  await turn();
  assert.deepEqual(sent, [['middle']]);
  current = ['latest'];
  void sync.request();
  firstSend.resolve({ scheduled: 1 });
  assert.deepEqual(await settled, { scheduled: 2 });
  assert.deepEqual(sent, [['middle'], ['latest']]);
  assert.deepEqual(published, [{ scheduled: 2 }]);
});

test('disposing a schedule scope discards the outstanding result and stops subsequent work', async () => {
  const sent = deferred();
  const published = [];
  const sync = createAlarmSync(async () => [], () => sent.promise, result => published.push(result));
  const pending = sync.request();
  await turn();
  sync.dispose();
  sent.resolve({ scheduled: 1 });
  assert.equal(await pending, undefined);
  assert.equal(await sync.request(), undefined);
  assert.deepEqual(published, []);
});

const date = '2026-11-29';
const due = Date.parse(date + 'T11:00:00+09:00');
const now = due - 60_000;
const schedule = { id: 'a', recurrence: { mode: 'once', date }, hour: 11, minute: 0,
  completedDates: [], notificationMethod: 'alarm', notificationsEnabled: true };
const result = overrides => ({ scheduled: 10, reservations: [{ id: 'a', date, due, outcome: 'scheduled', ...overrides }] });

test('a reservation is confirmed only by its matching ID, date and due time', () => {
  for (const outcome of ['scheduled', 'blocked', 'failed']) {
    assert.equal(reservationOutcome(schedule, result({ outcome }), now), outcome);
  }
  for (const different of [{ id: 'b' }, { date: '2026-11-30' }, { due: due + 60_000 }]) {
    assert.equal(reservationOutcome(schedule, result(different), now), 'unconfirmed');
  }
  assert.equal(reservationOutcome(schedule, { scheduled: 10 }, now), 'unconfirmed');
  assert.equal(reservationOutcome(schedule, undefined, now), 'unconfirmed');
});

test('disabled, completed and elapsed occurrences do not report reservation failure', () => {
  for (const overrides of [{ notificationsEnabled: false }, { notificationMethod: 'none' }, { completedDates: [date] }]) {
    assert.equal(reservationOutcome({ ...schedule, ...overrides }, undefined, now), 'notNeeded');
  }
  assert.equal(reservationOutcome(schedule, undefined, due), 'notNeeded');
  const nextDay = '2026-12-06';
  const recurring = { ...schedule, recurrence: { mode: 'weekly', startDate: date, weekdays: [7] }, completedDates: [date] };
  assert.equal(reservationOutcome(recurring, result({ date: nextDay, due: due + 7 * 86_400_000 }), now), 'scheduled');
});
