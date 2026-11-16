import { parseEnvelope, type Grid, type WeatherEnvelope } from '../../../shared/kma.ts';
export class WeatherError extends Error {}
export function weatherEndpoint(): string | null {
  const raw = process.env.EXPO_PUBLIC_WEATHER_API_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) return null;
    return url.toString();
  } catch { return null; }
}
export async function fetchWeather(endpoint: string, grid: Grid, signal: AbortSignal): Promise<WeatherEnvelope> {
  const url = new URL(endpoint); url.searchParams.set('x', String(grid.x)); url.searchParams.set('y', String(grid.y));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    let code = 'WEATHER_UNAVAILABLE';
    try { code = (await response.json()).error ?? code; } catch { /* Non-JSON gateway errors are intentionally hidden. */ }
    throw new WeatherError(code === 'KEY_NOT_CONFIGURED' ? '기상청 서버 인증키 설정이 필요합니다.' : response.status === 429 ? '조회 한도에 도달했어요. 잠시 후 다시 확인합니다.' : '날씨 조회에 실패했어요. 잠시 후 다시 확인합니다.');
  }
  const data = parseEnvelope(await response.json());
  if (data.grid.x !== grid.x || data.grid.y !== grid.y || Date.parse(data.refreshedAt) > Date.now() + 60_000 || Date.parse(data.snapshot.observedAt) > Date.now()) throw new WeatherError('날씨 응답을 확인할 수 없습니다.');
  return data;
}
