import { SEOUL, toGrid, type Grid } from './kma.ts';
export interface WeatherLocation { grid: Grid; label: string; fallback: boolean }
export interface LocationAccess {
  permission(): Promise<boolean>;
  position(): Promise<{ latitude: number; longitude: number }>;
}
/** Dependency boundary permits denied/disabled/GPS-timeout cases to be tested without native modules. */
export async function resolveLocation(access: LocationAccess): Promise<WeatherLocation> {
  const fallback = (reason: string): WeatherLocation => ({ grid: SEOUL, label: `서울 · ${reason}`, fallback: true });
  try {
    if (!await access.permission()) return fallback('위치 권한 없음');
    const point = await access.position();
    try { return { grid: toGrid(point.latitude, point.longitude), label: '현재 위치', fallback: false }; }
    catch { return fallback('기상청 지원 지역 밖'); }
  } catch { return fallback('위치 확인 불가'); }
}
