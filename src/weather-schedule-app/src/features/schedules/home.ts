import { schedulesForDate, type Schedule } from './model.ts';

/** The existing home layout has exactly two card slots; the list shows all today's items. */
export function homeSchedules(items: Schedule[], today: string) {
  return schedulesForDate(items, today).slice(0, 2).map(schedule => ({
    id: schedule.id,
    time: `${schedule.hour}:${String(schedule.minute).padStart(2, '0')}`,
    title: schedule.title,
    completed: schedule.completedDates.includes(today),
  }));
}
