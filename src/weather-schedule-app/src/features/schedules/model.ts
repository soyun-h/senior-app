export type ScheduleType = 'medication' | 'general';
export type NotificationMethod = 'video-call' | 'alarm' | 'none';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // Monday=1, Sunday=7
export type DateKey = string; // validated YYYY-MM-DD in Asia/Seoul
export type Recurrence =
  | { mode: 'once'; date: DateKey }
  | { mode: 'range'; startDate: DateKey; endDate: DateKey }
  | { mode: 'weekly'; weekdays: Weekday[]; startDate: DateKey };
export interface ScheduleDraft {
  title: string;
  type: ScheduleType;
  recurrence: Recurrence;
  hour: number; // 24h wall-clock hour in timeZone
  minute: number;
  reminderMinutes: 5 | 10 | 30;
  notificationMethod: NotificationMethod;
  medicationNote?: string; // Legacy records only; no memo input is collected.
}
export interface Schedule extends ScheduleDraft {
  id: string;
  timeZone: 'Asia/Seoul';
  notificationsEnabled: boolean;
  completedDates: DateKey[];
  createdAt: string;
  updatedAt: string;
}
export interface ScheduleRepository {
  list(): Promise<Schedule[]>;
  create(draft: ScheduleDraft, id: string, now?: number): Promise<Schedule[]>;
  update(id: string, draft: ScheduleDraft, now?: number): Promise<Schedule[]>;
  complete(id: string, date: string, now?: number, method?: 'check' | 'photo'): Promise<Schedule[]>;
  toggleCompletion(id: string, date: DateKey, now?: number): Promise<Schedule[]>;
  delete(id: string): Promise<Schedule[]>;
  setNotifications(id: string, enabled: boolean, now?: number): Promise<Schedule[]>;
}
export function dateKeyAt(now = Date.now()): DateKey { return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10); }
export function validDate(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(value + 'T00:00:00+09:00');
  return Number.isFinite(stamp) && dateKeyAt(stamp) === value;
}
export function weekday(date: DateKey): Weekday {
  if (!validDate(date)) throw new Error('날짜를 확인해 주세요.');
  const day = new Date(date + 'T12:00:00+09:00').getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}
export function classifyTitle(title: string): ScheduleType {
  // Conservative, visible rule-based suggestion, not AI or a medication database.
  return /복약|복용|약\s*(먹|드|챙)|(?:혈압|당뇨|감기|진통|수면|처방)\s*약|영양제|비타민/u.test(title) ? 'medication' : 'general';
}
export function onDate(schedule: Schedule, date: DateKey): boolean {
  if (!validDate(date)) return false;
  const recurrence = schedule.recurrence;
  if (recurrence.mode === 'once') return recurrence.date === date;
  if (recurrence.mode === 'range') return date >= recurrence.startDate && date <= recurrence.endDate;
  return date >= recurrence.startDate && recurrence.weekdays.includes(weekday(date));
}
export function schedulesForDate(items: Schedule[], date: DateKey): Schedule[] {
  return items.filter(s => onDate(s, date)).sort((a, b) => a.hour - b.hour || a.minute - b.minute || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function formatTime(hour: number, minute: number): string { return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`; }
export function formatDate(date: DateKey): string {
  return `${date.slice(2,4)}년 ${Number(date.slice(5,7))}월 ${Number(date.slice(8))}일 (${['월','화','수','목','금','토','일'][weekday(date)-1]}요일)`;
}
export function validateDraft(draft: ScheduleDraft, now = Date.now(), previous?: ScheduleDraft): void {
  if (typeof draft.title !== 'string' || !draft.title.trim() || draft.title.trim().length > 80) throw new Error('일정 제목을 1~80자로 입력해 주세요.');
  if (!['general','medication'].includes(draft.type)) throw new Error('일정 유형을 선택해 주세요.');
  if (!Number.isInteger(draft.hour) || draft.hour < 0 || draft.hour > 23 || !Number.isInteger(draft.minute) || draft.minute < 0 || draft.minute > 59) throw new Error('시와 분을 올바르게 선택해 주세요.');
  if (![5,10,30].includes(draft.reminderMinutes) || !['video-call','alarm','none'].includes(draft.notificationMethod)) throw new Error('알림 설정을 확인해 주세요.');
  const r = draft.recurrence;
  const unchangedDates = previous?.hour === draft.hour && previous.minute === draft.minute &&
    JSON.stringify(r) === JSON.stringify(previous.recurrence);
  if (!r || !['once','range','weekly'].includes(r.mode)) throw new Error('날짜 또는 요일 반복을 선택해 주세요.');
  if (r.mode === 'once') {
    if (!validDate(r.date)) throw new Error('올바른 날짜를 선택해 주세요.');
    if (!unchangedDates && Date.parse(`${r.date}T${String(draft.hour).padStart(2,'0')}:${String(draft.minute).padStart(2,'0')}:00+09:00`) <= now) throw new Error('현재보다 뒤의 날짜와 시각을 선택해 주세요.');
  } else if (r.mode === 'range') {
    if (!validDate(r.startDate) || !validDate(r.endDate) || r.endDate < r.startDate) throw new Error('올바른 시작 날짜와 종료 날짜를 선택해 주세요.');
    if (!unchangedDates && (r.startDate < dateKeyAt(now) || Date.parse(`${r.endDate}T${String(draft.hour).padStart(2,'0')}:${String(draft.minute).padStart(2,'0')}:00+09:00`) <= now)) throw new Error('현재보다 뒤의 날짜와 시각을 선택해 주세요.');
  } else {
    if (!validDate(r.startDate) || (r.startDate !== dateKeyAt(now) && !(previous?.recurrence.mode === 'weekly' && previous.recurrence.startDate === r.startDate))) throw new Error('날짜가 바뀌었습니다. 다시 등록해 주세요.');
    if (!Array.isArray(r.weekdays) || !r.weekdays.length || new Set(r.weekdays).size !== r.weekdays.length || r.weekdays.some(d => !Number.isInteger(d) || d < 1 || d > 7)) throw new Error('반복할 요일을 하나 이상 선택해 주세요.');
  }
}
/** Strict stored-data boundary. Past dates are allowed when loading previously saved records. */
export function parseSchedules(raw: string | null): Schedule[] {
  if (raw === null) return [];
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.items)) throw new Error();
    const ids = new Set<string>();
    for (const s of data.items as Schedule[]) {
      if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id)) throw new Error();
      ids.add(s.id);
      if (typeof s.title !== 'string' || !s.title.trim() || s.title.length > 80 || !['general','medication'].includes(s.type) || s.timeZone !== 'Asia/Seoul') throw new Error();
      if (!Number.isInteger(s.hour) || s.hour<0 || s.hour>23 || !Number.isInteger(s.minute) || s.minute<0 || s.minute>59) throw new Error();
      if (![5,10,30].includes(s.reminderMinutes) || !['video-call','alarm','none'].includes(s.notificationMethod) || typeof s.notificationsEnabled !== 'boolean' || (s.notificationMethod==='none' && s.notificationsEnabled)) throw new Error();
      if ((s.medicationNote !== undefined && (typeof s.medicationNote !== 'string' || s.medicationNote.length>500)) || ![s.createdAt,s.updatedAt].every(d=>typeof d==='string' && Number.isFinite(Date.parse(d)))) throw new Error();
      if (!s.recurrence || !['once','range','weekly'].includes(s.recurrence.mode)) throw new Error();
      if (!Array.isArray(s.completedDates) || s.completedDates.some(d=>!validDate(d) || !onDate(s,d)) || new Set(s.completedDates).size !== s.completedDates.length) throw new Error();
      const r=s.recurrence;
      if (r.mode==='once') { if (!validDate(r.date)) throw new Error(); }
      else if (r.mode==='range') {
        if (!validDate(r.startDate) || !validDate(r.endDate) || r.endDate<r.startDate) throw new Error();
      }
      else if (r.mode==='weekly') {
        if (!validDate(r.startDate) || !Array.isArray(r.weekdays) || !r.weekdays.length || r.weekdays.some(d=>!Number.isInteger(d)||d<1||d>7) || new Set(r.weekdays).size!==r.weekdays.length) throw new Error();
      } else throw new Error();
    }
    return data.items;
  } catch { throw new Error('저장된 일정을 읽을 수 없습니다. 기존 데이터는 지우지 않았어요.'); }
}
