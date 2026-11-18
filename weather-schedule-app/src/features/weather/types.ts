import type { LiveSnapshot } from '../../../shared/kma.ts';
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'thunder' | 'unknown';
export interface WeatherSnapshot extends Partial<LiveSnapshot> {
  condition: WeatherCondition;
  temperatureCelsius: number;
  observedAt: string;
  guidance?: string;
}
export interface WeatherProvider {
  getCurrentWeather(grid: { x: number; y: number }): Promise<WeatherSnapshot>;
}
