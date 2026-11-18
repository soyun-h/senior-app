/** Pure KMA boundary: no key, network, platform APIs, or fixtures. All timestamps are instants. */
export type Condition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'thunder' | 'unknown';
export interface Grid { x: number; y: number }
export interface LiveSnapshot {
  condition: Condition;
  temperatureCelsius: number;
  observedAt: string;
  forecastIssuedAt: string;
  forecastValidAt: string;
  observedPrecipitation: number;
  forecastPrecipitation: number;
  sky: number;
  lightning: number | null;
  source: 'KMA';
}
export interface WeatherEnvelope {
  snapshot: LiveSnapshot;
  grid: Grid;
  refreshedAt: string;
  cacheStatus: 'fresh' | 'stale';
}
export const SEOUL: Grid = { x: 60, y: 127 };
const HOUR = 3_600_000;
export function assertGrid(grid: Grid): void {
  if (!Number.isInteger(grid.x) || !Number.isInteger(grid.y) || grid.x < 1 || grid.x > 149 || grid.y < 1 || grid.y > 253) throw new Error('INVALID_GRID');
}
/** KMA Lambert conformal conic (DFS), degrees to grid, standard rounding. */
export function toGrid(latitude: number, longitude: number): Grid {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 32 || latitude > 40 || longitude < 123 || longitude > 132) throw new Error('OUTSIDE_KOREA');
  const rad = Math.PI / 180, re = 6371.00877 / 5;
  const slat1 = 30 * rad, slat2 = 60 * rad, olon = 126 * rad, olat = 38 * rad;
  const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(Math.tan(Math.PI / 4 + slat2 / 2) / Math.tan(Math.PI / 4 + slat1 / 2));
  const sf = Math.pow(Math.tan(Math.PI / 4 + slat1 / 2), sn) * Math.cos(slat1) / sn;
  const ro = re * sf / Math.pow(Math.tan(Math.PI / 4 + olat / 2), sn);
  const ra = re * sf / Math.pow(Math.tan(Math.PI / 4 + latitude * rad / 2), sn);
  let theta = longitude * rad - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  const grid = { x: Math.floor(ra * Math.sin(theta) + 43 + 0.5), y: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5) };
  assertGrid(grid); return grid;
}
export interface Base { date: string; time: string; instant: string }
export function kstInstant(date: string, time: string): string {
  if (!/^\d{8}$/.test(date) || !/^\d{4}$/.test(time) || +time.slice(0, 2) > 23 || +time.slice(2) > 59) throw new Error('INVALID_TIME');
  const stamp = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T${time.slice(0, 2)}:${time.slice(2)}:00+09:00`;
  const parsed = new Date(stamp);
  if (!Number.isFinite(+parsed) || new Date(+parsed + 9 * HOUR).toISOString().slice(0, 10).replaceAll('-', '') !== date) throw new Error('INVALID_TIME');
  return parsed.toISOString();
}
function baseAt(instant: number): Base {
  const s = new Date(instant + 9 * HOUR).toISOString();
  return { date: s.slice(0, 10).replaceAll('-', ''), time: s.slice(11, 16).replace(':', ''), instant: new Date(instant).toISOString() };
}
/** Conservative publication grace: observation HH:00 +15m; forecast HH:30 +15m. */
export function latestBase(kind: 'observation' | 'forecast', now: number, backHours = 0): Base {
  const offset = kind === 'forecast' ? 30 * 60_000 : 0;
  return baseAt(Math.floor((now - 15 * 60_000 - offset) / HOUR) * HOUR + offset - backHours * HOUR);
}
export interface Item { category: string; baseDate: string; baseTime: string; obsrValue?: string | number; fcstDate?: string; fcstTime?: string; fcstValue?: string | number }
export function readItems(payload: unknown): Item[] {
  const response = (payload as { response?: { header?: { resultCode?: string }; body?: { totalCount?: number; items?: { item?: Item[] } } } })?.response;
  if (String(response?.header?.resultCode) !== '00') throw new Error('KMA_UNAVAILABLE');
  const rows = response?.body?.items?.item;
  if (!Array.isArray(rows) || !rows.length || (response?.body?.totalCount ?? 0) > rows.length) throw new Error('KMA_INCOMPLETE');
  return rows;
}
function value(rows: Item[], category: string, allowed?: number[]): number {
  const raw = rows.find(row => row.category === category);
  const s = raw?.obsrValue ?? raw?.fcstValue;
  if (s === undefined || String(s).trim() === '') throw new Error('KMA_MISSING_' + category);
  const n = Number(s);
  if (!Number.isFinite(n) || n < -90 || (allowed && !allowed.includes(n))) throw new Error('KMA_INVALID_' + category);
  return n;
}
export function chooseCondition(pty: number, sky: number, lightning: number | null): Condition {
  // LGT is a forecast risk, never evidence that lightning was observed at the user.
  if (lightning !== null && lightning > 0) return 'thunder';
  if ([3, 7].includes(pty)) return 'snow';
  if ([1, 2, 4, 5, 6].includes(pty)) return 'rain';
  return sky === 1 ? 'clear' : [3, 4].includes(sky) ? 'cloudy' : 'unknown';
}
/** Accept actual hourly/half-hourly response issues, not an equality with the request.
 * A response may be at most one cycle older than the requested issue, and no more
 * than two hours old now. Never combine categories from different issue groups.
 */
function selectForecast(forecasts: Item[], requested: Base, now: number) {
  const requestAt = Date.parse(kstInstant(requested.date, requested.time));
  const groups = new Map<string, Item[]>();
  for (const row of forecasts) {
    const issue = kstInstant(row.baseDate, row.baseTime);
    if (!['00', '30'].includes(row.baseTime.slice(2))) throw new Error('KMA_INVALID_FORECAST_ISSUE');
    const valid = Date.parse(kstInstant(row.fcstDate ?? '', row.fcstTime ?? ''));
    const issued = Date.parse(issue);
    if (valid <= issued || valid > issued + 6 * HOUR) throw new Error('KMA_INVALID_FORECAST_VALIDITY');
    const group = groups.get(issue) ?? [];
    group.push(row); groups.set(issue, group);
  }
  const issues = [...groups.keys()].filter(issue => {
    const issued = Date.parse(issue);
    return issued <= now && issued <= requestAt && now - issued <= 2 * HOUR && requestAt - issued <= HOUR;
  }).sort().reverse();
  if (!issues.length) throw new Error('KMA_NO_RECENT_FORECAST_ISSUE');
  const issuedAt = issues[0];
  const group = groups.get(issuedAt)!;
  const times = [...new Set(group.map(row => kstInstant(row.fcstDate!, row.fcstTime!)))];
  const candidates = times.filter(t => Date.parse(t) >= now - 30 * 60_000 && Date.parse(t) <= now + 90 * 60_000);
  candidates.sort((a, b) => Math.abs(Date.parse(a) - now) - Math.abs(Date.parse(b) - now) || a.localeCompare(b));
  if (!candidates.length) throw new Error('KMA_NO_NEAR_FORECAST');
  const validAt = candidates[0];
  const rows = group.filter(row => kstInstant(row.fcstDate!, row.fcstTime!) === validAt);
  // Even identical duplicates are ambiguous; never silently pick the first value.
  for (const category of ['SKY', 'PTY', 'LGT']) {
    if (rows.filter(row => row.category === category).length > 1) throw new Error('KMA_DUPLICATE_FORECAST_CATEGORY');
  }
  return { rows, issuedAt, validAt };
}
export function normalize(observations: Item[], forecasts: Item[], obsBase: Base, fcstBase: Base, now: number): LiveSnapshot {
  const obs = observations.filter(r => r.baseDate === obsBase.date && r.baseTime === obsBase.time);
  const { rows, issuedAt, validAt } = selectForecast(forecasts, fcstBase, now);
  const temperature = value(obs, 'T1H');
  if (temperature < -60 || temperature > 60) throw new Error('KMA_INVALID_TEMPERATURE');
  const pty = value(obs, 'PTY', [0, 1, 2, 3, 5, 6, 7]);
  const sky = value(rows, 'SKY', [1, 3, 4]);
  const forecastPty = value(rows, 'PTY', [0, 1, 2, 3, 5, 6, 7]);
  const lightning = rows.some(r => r.category === 'LGT') ? value(rows, 'LGT') : null;
  if (lightning !== null && lightning < 0) throw new Error('KMA_INVALID_LGT');
  if (now - +new Date(obsBase.instant) > 2 * HOUR || +new Date(obsBase.instant) > now) throw new Error('KMA_OLD_OBSERVATION');
  return { condition: chooseCondition(pty, sky, lightning), temperatureCelsius: temperature, observedAt: obsBase.instant,
    forecastIssuedAt: issuedAt, forecastValidAt: validAt, observedPrecipitation: pty,
    forecastPrecipitation: forecastPty, sky, lightning, source: 'KMA' };
}
export function isStale(data: WeatherEnvelope, now = Date.now()): boolean {
  return data.cacheStatus === 'stale' || now - +new Date(data.refreshedAt) > 15 * 60_000 || now - +new Date(data.snapshot.observedAt) > 90 * 60_000 || now - +new Date(data.snapshot.forecastValidAt) > HOUR;
}
export function usable(data: WeatherEnvelope, now = Date.now()): boolean {
  return now - +new Date(data.snapshot.observedAt) <= 6 * HOUR && now - +new Date(data.snapshot.observedAt) >= 0;
}
/** Validate cache/network boundaries rather than trusting JSON casts. */
export function parseEnvelope(input: unknown): WeatherEnvelope {
  const d = input as WeatherEnvelope;
  if (!d || !d.snapshot || !d.grid) throw new Error('INVALID_WEATHER');
  assertGrid(d.grid);
  const s = d.snapshot;
  if (s.source !== 'KMA' || !['clear','cloudy','rain','snow','thunder','unknown'].includes(s.condition) || !Number.isFinite(s.temperatureCelsius) || s.temperatureCelsius < -60 || s.temperatureCelsius > 60 || !['fresh','stale'].includes(d.cacheStatus)) throw new Error('INVALID_WEATHER');
  for (const t of [s.observedAt, s.forecastIssuedAt, s.forecastValidAt, d.refreshedAt]) if (typeof t !== 'string' || !Number.isFinite(Date.parse(t))) throw new Error('INVALID_WEATHER');
  if (chooseCondition(s.observedPrecipitation, s.sky, s.lightning) !== s.condition || ![0,1,2,3,5,6,7].includes(s.observedPrecipitation) || ![0,1,2,3,5,6,7].includes(s.forecastPrecipitation) || ![1,3,4].includes(s.sky) || (s.lightning !== null && (!Number.isFinite(s.lightning) || s.lightning < 0))) throw new Error('INVALID_WEATHER');
  return d;
}
