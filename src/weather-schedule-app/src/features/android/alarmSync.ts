import { dateKeyAt, onDate, type Schedule } from '../schedules/model.ts';
import type { AlarmSyncResult, ReservationOutcome } from './bridge';

export function createAlarmSync(read: () => Promise<Schedule[]>, send: (items: Schedule[], force: boolean) => Promise<AlarmSyncResult>,
  publish: (result?: AlarmSyncResult) => void) {
  let revision = 0;
  let pending: Promise<AlarmSyncResult | undefined> | undefined;
  let disposed = false;
  let forceRequested = false;

  async function drain() {
    while (!disposed) {
      const requested = revision;
      let result: AlarmSyncResult | undefined;
      try {
        const items = await read();
        if (disposed || revision !== requested) continue;
        result = await send(items, forceRequested);
      } catch { /* A failed read or native sync leaves the reservation unconfirmed. */ }
      if (disposed || revision !== requested) continue;
      publish(result);
      if (revision !== requested) continue;
      forceRequested = false;
      pending = undefined;
      return result;
    }
    pending = undefined;
  }

  return {
    request(force = false) {
      if (disposed) return Promise.resolve(undefined);
      revision++;
      forceRequested ||= force;
      return pending ??= drain();
    },
    dispose() { disposed = true; },
  };
}

export function reservationOutcome(schedule: Schedule | undefined, result?: AlarmSyncResult, now = Date.now()): ReservationOutcome {
  if (!schedule || !schedule.notificationsEnabled || schedule.notificationMethod === 'none') return 'notNeeded';

  const rule = schedule.recurrence;
  const start = rule.mode === 'once' ? rule.date : rule.startDate;
  const end = rule.mode === 'once' ? rule.date : rule.mode === 'range' ? rule.endDate : undefined;
  const today = dateKeyAt(now);
  let day = Date.parse(`${start > today ? start : today}T00:00:00+09:00`);
  const time = (schedule.hour * 60 + schedule.minute) * 60_000;
  for (let i = 0; i < (schedule.completedDates.length + 2) * 7; i++, day += 86_400_000) {
    const date = dateKeyAt(day);
    if (end && date > end) return 'notNeeded';
    if (day + time <= now || !onDate(schedule, date) || schedule.completedDates.includes(date)) continue;
    const receipt = result?.reservations?.find(item => item.id === schedule.id && item.date === date && item.due === day + time);
    return receipt?.outcome ?? 'unconfirmed';
  }
  return 'notNeeded';
}
