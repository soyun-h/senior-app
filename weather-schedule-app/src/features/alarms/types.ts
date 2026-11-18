/** Local date/time and Android notification behavior will be implemented later. */
export interface ScheduleAlarm {
  id: string;
  title: string;
  scheduledAt: string; // ISO 8601 instant including timezone offset or Z
  timeZone: string; // IANA timezone, e.g. Asia/Seoul
}
