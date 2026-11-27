import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isStale, parseEnvelope, usable, type WeatherEnvelope } from '../../../shared/kma.ts';
import { selectWeatherMode } from '../../../shared/mode.ts';
import { useDemoWeather } from './useDemoWeather';
import { fetchWeather, weatherEndpoint, WeatherError } from './api';
import { locateWeather } from './location';
import type { WeatherSnapshot } from './types';

export function useWeather(): { weather?: WeatherSnapshot; notice?: string; credit: string } {
  const mode = selectWeatherMode(__DEV__, process.env.EXPO_PUBLIC_WEATHER_MODE);
  const demo = useDemoWeather(mode === 'demo');
  const [data, setData] = useState<WeatherEnvelope>();
  const [problem, setProblem] = useState<string>();
  const [location, setLocation] = useState('위치 확인 중');
  const [now, setNow] = useState(Date.now());
  const [hasCache, setHasCache] = useState(false);
  useEffect(() => {
    if (mode === 'demo') return;
    const endpoint = weatherEndpoint();
    if (!endpoint) { setLocation('위치 사용 안 함'); setProblem('날씨 서버 연결 설정이 필요합니다.'); return; }
    let active = true, busy = false, failures = 0, lastAttempt = 0;
    let controller: AbortController | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let foreground: ReturnType<typeof AppState.addEventListener> | undefined;
    async function start() {
      const place = await locateWeather();
      if (!active) return;
      setLocation(place.label);
      const cacheKey = `kma-weather-v1:${place.grid.x}:${place.grid.y}`;
      try {
        const saved = await AsyncStorage.getItem(cacheKey);
        if (saved) {
          const value = parseEnvelope(JSON.parse(saved));
          if (active && value.grid.x === place.grid.x && value.grid.y === place.grid.y && usable(value)) {
            setData(value); setHasCache(true);
          }
        }
      } catch { /* Cache failures never prevent a live query. */ }
      async function refresh() {
        if (!active || busy) return;
        clearTimeout(retry);
        busy = true; lastAttempt = Date.now();
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), 35_000);
        try {
          const fresh = await fetchWeather(endpoint!, place.grid, controller.signal);
          if (!usable(fresh)) throw new WeatherError('받은 날씨 정보가 너무 오래되었습니다.');
          if (active) { setData(fresh); setProblem(undefined); setHasCache(false); }
          failures = 0;
          // Only validated KMA snapshots; coordinates stay local as a coarse grid, never raw GPS.
          if (active) await AsyncStorage.setItem(cacheKey, JSON.stringify(fresh)).catch(() => {});
        } catch (e) {
          failures++;
          if (active) setProblem(e instanceof WeatherError ? e.message : '날씨 연결이 원활하지 않습니다.');
        } finally {
          clearTimeout(timeout); busy = false;
          if (active) {
            setNow(Date.now());
            retry = setTimeout(() => { if (AppState.currentState === 'active') void refresh(); }, failures ? Math.min(15, 2 ** (failures - 1)) * 60_000 : 15 * 60_000);
          }
        }
      }
      await refresh();
      if (!active) return;
      tick = setInterval(() => setNow(Date.now()), 60_000);
      foreground = AppState.addEventListener('change', state => {
        if (state === 'active') { setNow(Date.now()); if (Date.now() - lastAttempt > 5 * 60_000) void refresh(); }
      });
    }
    void start().catch(() => { if (active) setProblem('날씨를 확인할 수 없습니다.'); });
    return () => { active = false; controller?.abort(); clearInterval(tick); clearTimeout(retry); foreground?.remove(); };
  }, [mode]);
  if (mode === 'demo') return { weather: demo, credit: '개발용 테스트 날씨 · 실제 기상청 조회 아님' };
  const valid = data && usable(data, now) ? data : undefined;
  const old = valid && (isStale(valid, now) || !!problem || hasCache);
  const fmt = (s: string) => new Date(s).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  return {
    weather: valid?.snapshot,
    notice: valid ? old ? '마지막 정상 정보입니다. 최신 날씨를 확인하세요.' : undefined : data ? '마지막 날씨 정보의 유효시간이 지났어요.' : problem ?? '날씨 정보를 확인하고 있어요.',
    credit: valid ? `기상청 · ${location} · 관측 ${fmt(valid.snapshot.observedAt)}\n${valid.snapshot.lightning === null ? '하늘' : '하늘·낙뢰'}: ${fmt(valid.snapshot.forecastValidAt)} 예보${valid.snapshot.lightning === null ? ' · 낙뢰 미제공' : ''}\n예보 발표 ${fmt(valid.snapshot.forecastIssuedAt)}${old ? ' · 갱신 지연' : ''}` : `기상청 · ${location} · 실제 날씨 미확인`,
  };
}
