import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { demoConditions } from './presentation';
import type { WeatherSnapshot } from './types';

/** Development-only cycle. Replace this hook with WeatherProvider-backed state later. */
export function useDemoWeather(): WeatherSnapshot {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!__DEV__) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') setIndex(value => (value + 1) % demoConditions.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);
  return {
    condition: demoConditions[index], temperatureCelsius: 13, observedAt: '2026-11-16T09:00:00+09:00',
    // Same fixture copy across all five reference frames; a real provider may change it.
    guidance: '비가 온다고 하니 우산 꼭 챙기세요.',
  };
}
