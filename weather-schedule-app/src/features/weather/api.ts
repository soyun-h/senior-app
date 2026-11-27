import { parseEnvelope, type Grid, type WeatherEnvelope } from '../../../shared/kma.ts';
import { CapacitorHttp } from '@capacitor/core';
import { android } from '../android/bridge';
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
  // The Worker deliberately rejects browser origins outside its allowlist. Android uses
  // the same public URL and shared response validation via its native HTTP transport.
  const native = android ? await CapacitorHttp.get({ url: url.toString(), connectTimeout: 10_000, readTimeout: 20_000 }) : null;
  const response = native ? null : await fetch(url.toString(), { signal });
  const status = native?.status ?? response?.status ?? 0;
  signal.throwIfAborted();
  if (status < 200 || status >= 300) {
    let code = 'WEATHER_UNAVAILABLE';
    try { code = (native?.data ?? await response?.json())?.error ?? code; } catch { /* Non-JSON gateway errors are intentionally hidden. */ }
    throw new WeatherError(code === 'KEY_NOT_CONFIGURED' ? '기상청 서버 인증키 설정이 필요합니다.' : status === 429 ? '조회 한도에 도달했어요. 잠시 후 다시 확인합니다.' : '날씨 조회에 실패했어요. 잠시 후 다시 확인합니다.');
  }
  const data = parseEnvelope(native?.data ?? await response?.json());
  if (data.grid.x !== grid.x || data.grid.y !== grid.y || Date.parse(data.refreshedAt) > Date.now() + 60_000 || Date.parse(data.snapshot.observedAt) > Date.now()) throw new WeatherError('날씨 응답을 확인할 수 없습니다.');
  return data;
}
