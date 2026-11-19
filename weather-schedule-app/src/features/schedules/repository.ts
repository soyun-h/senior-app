import { dateKeyAt, onDate, parseSchedules, validateDraft, type Schedule, type ScheduleDraft, type ScheduleRepository } from './model.ts';
export const SCHEDULE_STORAGE_KEY = 'weather-schedule:schedules:v1';
export interface ScheduleStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
/** One serialized writer per app. Failed writes never publish an optimistic success. */
export class LocalScheduleRepository implements ScheduleRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private storage: ScheduleStorage;
  constructor(storage: ScheduleStorage) { this.storage = storage; }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  list(): Promise<Schedule[]> { return this.serialize(async () => parseSchedules(await this.storage.getItem(SCHEDULE_STORAGE_KEY))); }
  private mutate(change: (items: Schedule[]) => Schedule[]): Promise<Schedule[]> {
    return this.serialize(async () => {
      const items = parseSchedules(await this.storage.getItem(SCHEDULE_STORAGE_KEY));
      const next = change(items);
      // Validate output before persisting; malformed storage is never silently overwritten.
      const raw = JSON.stringify({ version: 1, items: next });
      parseSchedules(raw);
      await this.storage.setItem(SCHEDULE_STORAGE_KEY, raw);
      return next;
    });
  }
  create(draft: ScheduleDraft, id: string, now = Date.now()): Promise<Schedule[]> {
    // Copy input before asynchronous storage to avoid mutation by a caller during a save.
    const copy = JSON.parse(JSON.stringify(draft)) as ScheduleDraft;
    return this.mutate(items => {
      if (!id || id.length > 120) throw new Error('일정 번호를 만들 수 없습니다. 다시 시도해 주세요.');
      if (items.some(s => s.id === id)) return items; // retry of the same form submission
      validateDraft(copy, now);
      const createdAt = new Date(now).toISOString();
      return [...items, { ...copy, title: copy.title.trim(), ...(copy.medicationNote === undefined ? {} : {medicationNote:copy.type==='medication'?copy.medicationNote.trim():''}), id,
        timeZone: 'Asia/Seoul', notificationsEnabled: copy.notificationMethod !== 'none', completedDates: [], createdAt, updatedAt: createdAt }];
    });
  }
  toggleCompletion(id: string, date: string, now = Date.now()): Promise<Schedule[]> {
    return this.mutate(items => items.map(s => {
      if (s.id!==id) return s;
      if (date!==dateKeyAt(now) || !onDate(s,date)) throw new Error('오늘 일정의 완료 상태만 변경할 수 있습니다.');
      return { ...s, completedDates:s.completedDates.includes(date)?s.completedDates.filter(d=>d!==date):[...s.completedDates,date],updatedAt:new Date(now).toISOString() };
    }));
  }
  setNotifications(id: string, enabled: boolean, now = Date.now()): Promise<Schedule[]> {
    return this.mutate(items => items.map(s => s.id===id ? { ...s, notificationsEnabled:s.notificationMethod==='none'?false:enabled,updatedAt:new Date(now).toISOString() } : s));
  }
}
