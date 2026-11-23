import { dateKeyAt, validDate, type DateKey } from './model.ts';

/** Local calendar arithmetic uses explicit KST noon, independent of device timezone. */
export function shiftDate(date: DateKey, days: number): DateKey {
  if (!validDate(date) || !Number.isInteger(days)) throw new Error('날짜를 확인해 주세요.');
  return dateKeyAt(Date.parse(`${date}T12:00:00+09:00`) + days * 86_400_000);
}
export function calendarDates(month: string, weekStartsOn: 'monday' | 'sunday'): DateKey[] {
  const first = `${month}-01`;
  if (!validDate(first)) throw new Error('날짜를 확인해 주세요.');
  const [year, number] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const offset = weekStartsOn === 'monday' ? (firstDay + 6) % 7 : firstDay;
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => shiftDate(first, i - offset));
}
export interface DateSelection { startDate: DateKey; endDate: DateKey; awaitingEnd: boolean }
/** First tap selects a single day; second extends it; a third starts a new selection. */
export function selectDate(current: DateSelection, date: DateKey): DateSelection {
  if (!validDate(date)) throw new Error('날짜를 확인해 주세요.');
  if (!current.awaitingEnd) return { startDate: date, endDate: date, awaitingEnd: true };
  return {
    startDate: date < current.startDate ? date : current.startDate,
    endDate: date < current.startDate ? current.startDate : date,
    awaitingEnd: false,
  };
}
export function selectionLabel(startDate: DateKey, endDate: DateKey): string {
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error('날짜를 확인해 주세요.');
  const start = startDate.replaceAll('-', '.');
  if (startDate === endDate) return start;
  return `${start} - ${startDate.slice(0, 4) === endDate.slice(0, 4) ? endDate.slice(5).replace('-', '.') : endDate.replaceAll('-', '.')}`;
}
export function to24Hour(period: '오전' | '오후', hour: number): number {
  if (!['오전', '오후'].includes(period) || !Number.isInteger(hour) || hour < 1 || hour > 12) throw new Error('시각을 확인해 주세요.');
  return hour % 12 + (period === '오후' ? 12 : 0);
}
export function pickerTimeLabel(hour: number, minute: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error('시각을 확인해 주세요.');
  return `${hour < 12 ? '오전' : '오후'} ${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
