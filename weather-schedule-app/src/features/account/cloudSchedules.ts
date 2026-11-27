import type { SupabaseClient } from '@supabase/supabase-js';
import { dateKeyAt, onDate, parseSchedules, type DateKey, type Schedule, type ScheduleDraft, type ScheduleRepository } from '../schedules/model';
import { LocalScheduleRepository, SCHEDULE_STORAGE_KEY } from '../schedules/repository';
import { browserStore, readableCloudError } from './client';

type Completion = { scheduleId: string; date: DateKey; done: boolean; method: 'check' | 'photo'; at: string };
type Cache = { items: Schedule[]; actions: Completion[]; ready: boolean };
type Row = { id: string; title: string; schedule_type: Schedule['type']; scheduled_time: string; timezone: Schedule['timeZone'];
  recurrence_rule: Schedule['recurrence']; reminder_minutes: Schedule['reminderMinutes']; notification_method: Schedule['notificationMethod'];
  notifications_enabled: boolean; medication_note: string | null; created_at: string; updated_at: string };
const cols = 'id,title,schedule_type,scheduled_time,timezone,recurrence_rule,reminder_minutes,notification_method,notifications_enabled,medication_note,created_at,updated_at';

function schedule(row: Row, dates: DateKey[] = []): Schedule {
  const [hour, minute] = row.scheduled_time.split(':').map(Number);
  const value: Schedule = { id: row.id, title: row.title, type: row.schedule_type, hour, minute, timeZone: row.timezone,
    recurrence: row.recurrence_rule, reminderMinutes: row.reminder_minutes, notificationMethod: row.notification_method,
    notificationsEnabled: row.notifications_enabled, ...(row.medication_note !== null ? { medicationNote: row.medication_note } : {}),
    completedDates: [], createdAt: row.created_at, updatedAt: row.updated_at };
  value.completedDates = dates.filter(day => onDate(value, day));
  return value;
}
function values(item: Schedule, user_id: string) {
  return { id: item.id, user_id, title: item.title, schedule_type: item.type, timezone: item.timeZone,
    scheduled_time: `${String(item.hour).padStart(2, '0')}:${String(item.minute).padStart(2, '0')}:00`,
    recurrence_rule: item.recurrence, reminder_minutes: item.reminderMinutes, notification_method: item.notificationMethod,
    notifications_enabled: item.notificationsEnabled, medication_note: item.medicationNote ?? null };
}
function overlay(items: Schedule[], actions: Completion[]) {
  return items.map(item => {
    const dates = new Set(item.completedDates);
    for (const entry of actions) {
      if (entry.scheduleId !== item.id || !onDate(item, entry.date)) continue;
      if (entry.done) dates.add(entry.date); else dates.delete(entry.date);
    }
    return { ...item, completedDates: [...dates].sort() };
  });
}

export async function deterministicId(scope: string, source: string) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${source}`))).slice(0, 16);
  hash[6] = (hash[6] & 15) | 80;
  hash[8] = (hash[8] & 63) | 128;
  const hex = [...hash].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class CloudSchedules implements ScheduleRepository {
  private pending: Promise<unknown> = Promise.resolve();
  private readonly key: string;
  constructor(private readonly client: SupabaseClient, private readonly user: string) { this.key = `schedules:${user}`; }

  private serial<T>(work: () => Promise<T>) {
    const run = this.pending.then(work);
    this.pending = run.catch(() => {});
    return run;
  }

  private async load(): Promise<Cache> {
    const raw = await browserStore.getItem(this.key);
    return raw ? JSON.parse(raw) as Cache : { items: [], actions: [], ready: false };
  }
  private async save(cache: Cache) { await browserStore.setItem(this.key, JSON.stringify(cache)); }

  async cached() { const cache = await this.load(); return cache.ready ? cache.items : null; }

  private async flush(cache: Cache) {
    for (const action of [...cache.actions]) {
      const { error } = await this.client.rpc('allit_set_occurrence', { target_schedule: action.scheduleId, day: action.date,
        done: action.done, method: action.method, action_at: action.at });
      if (error) continue;
      cache.actions = cache.actions.filter(entry => entry !== action);
      await this.save(cache);
    }
  }

  list() { return this.serial(async () => {
    const cache = await this.load();
    await this.flush(cache);
    try {
      const rows: Row[] = [];
      const completed = new Map<string, DateKey[]>();
      for (let offset = 0; ; offset += 100) {
        const result = await this.client.from('schedules').select(cols).eq('user_id', this.user).order('id').range(offset, offset + 99);
        if (result.error) throw result.error;
        rows.push(...result.data as Row[]);
        if (result.data.length < 100) break;
      }
      for (let offset = 0; ; offset += 200) {
        const result = await this.client.from('schedule_occurrences').select('schedule_id,occurrence_date').eq('user_id', this.user)
          .eq('status', 'completed').order('id').range(offset, offset + 199);
        if (result.error) throw result.error;
        for (const row of result.data) {
          const dates = completed.get(row.schedule_id) ?? [];
          dates.push(row.occurrence_date);
          completed.set(row.schedule_id, dates);
        }
        if (result.data.length < 200) break;
      }
      cache.items = overlay(parseSchedules(JSON.stringify({ version: 1,
        items: rows.map(row => schedule(row, completed.get(row.id))) })), cache.actions);
      cache.ready = true;
      await this.save(cache);
    } catch (error) {
      if (!cache.ready) throw new Error(readableCloudError(error, '서버에서 일정을 불러오지 못했어요. 연결을 확인해 주세요.'));
    }
    return cache.items;
  }); }

  private model(items: Schedule[]) {
    return new LocalScheduleRepository({ getItem: async () => JSON.stringify({ version: 1, items }), setItem: async () => {} });
  }

  private mutate(id: string, operation: 'create' | 'update' | 'delete', change: (repo: LocalScheduleRepository) => Promise<Schedule[]>) {
    return this.serial(async () => {
      const cache = await this.load();
      const previous = cache.items.find(item => item.id === id);
      if (operation === 'create' && previous) return cache.items;
      if (operation !== 'create' && !previous) throw new Error('일정을 다시 불러온 뒤 변경해 주세요.');
      const changed = await change(this.model(cache.items));
      const next = changed.find(item => item.id === id);
      if (operation === 'delete' && previous) {
        const result = await this.client.from('schedules').delete().eq('id', id).eq('user_id', this.user)
          .eq('updated_at', previous.updatedAt).select('id').maybeSingle();
        if (result.error || !result.data) throw new Error(readableCloudError(result.error, '서버 일정을 삭제하지 못했어요. 일정을 다시 불러와 주세요.'));
        cache.actions = cache.actions.filter(entry => entry.scheduleId !== id);
        cache.items = changed;
      } else if (next) {
        const result = previous
          ? await this.client.from('schedules').update(values(next, this.user)).eq('id', id).eq('user_id', this.user)
            .eq('updated_at', previous.updatedAt).select(cols).maybeSingle()
          : await this.client.from('schedules').upsert(values(next, this.user), { onConflict: 'id', ignoreDuplicates: true }).select(cols).maybeSingle();
        if (result.error) throw new Error(readableCloudError(result.error, '서버에 일정을 저장하지 못했어요. 연결을 확인해 주세요.'));
        const row = result.data ?? (operation === 'create'
          ? (await this.client.from('schedules').select(cols).eq('id', id).eq('user_id', this.user).maybeSingle()).data : null);
        if (!row) throw new Error('다른 기기에서 변경됐어요. 일정을 다시 불러와 주세요.');
        cache.items = changed.map(item => item.id === id ? schedule(row as Row, next.completedDates) : item);
      }
      cache.ready = true;
      await this.save(cache);
      return cache.items;
    });
  }
  create(draft: ScheduleDraft, id: string, now?: number) { return this.mutate(id, 'create', repo => repo.create(draft, id, now)); }
  update(id: string, draft: ScheduleDraft, now?: number) { return this.mutate(id, 'update', repo => repo.update(id, draft, now)); }
  delete(id: string) { return this.mutate(id, 'delete', repo => repo.delete(id)); }
  setNotifications(id: string, enabled: boolean, now?: number) { return this.mutate(id, 'update', repo => repo.setNotifications(id, enabled, now)); }

  complete(id: string, date: string, now = Date.now(), method: 'check' | 'photo' = 'check') {
    return this.setCompletion(id, date, true, now, method);
  }
  toggleCompletion(id: string, date: string, now = Date.now()) {
    return this.setCompletion(id, date, undefined, now, 'check');
  }
  private setCompletion(id: string, date: string, done: boolean | undefined, now: number, method: 'check' | 'photo') {
    return this.serial(async () => {
      const cache = await this.load();
      const item = cache.items.find(item => item.id === id && onDate(item, date));
      if (!item || date > dateKeyAt(now) || done === undefined && date !== dateKeyAt(now)) return cache.items;
      const action = { scheduleId: id, date, done: done ?? !item.completedDates.includes(date), method, at: new Date(now).toISOString() };
      cache.actions = [...cache.actions.filter(entry => !(entry.scheduleId === id && entry.date === date)), action];
      cache.items = overlay(cache.items, [action]);
      await this.save(cache);
      void this.serial(async () => this.flush(await this.load())).catch(() => {});
      return cache.items;
    });
  }

  async pendingCount() { return (await this.load()).actions.length; }
  flushCompletions() { return this.serial(async () => this.flush(await this.load())); }
  clear() { return this.serial(() => browserStore.removeItem(this.key)); }

  importLegacy(items: Schedule[], photoOccurrences: Set<string>) { return this.serial(async () => {
    for (const original of items) {
      const id = await deterministicId(this.user, `schedule:${original.id}`);
      const record = { ...original, id };
      const result = await this.client.from('schedules').upsert({ ...values(record, this.user), created_at: record.createdAt }, { onConflict: 'id', ignoreDuplicates: true });
      if (result.error) throw result.error;
      for (const day of record.completedDates) {
        const occurrence = await this.client.rpc('allit_set_occurrence', { target_schedule: id, day, done: true,
          method: photoOccurrences.has(`${original.id}:${day}`) ? 'photo' : 'check', action_at: record.updatedAt });
        if (occurrence.error) throw occurrence.error;
      }
    }
  }); }
}

export async function loadLegacySchedules() {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return parseSchedules(await AsyncStorage.getItem(SCHEDULE_STORAGE_KEY));
}
