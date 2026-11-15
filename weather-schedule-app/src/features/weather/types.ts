/** Provider-neutral contract for a future Korea Meteorological Administration adapter. */
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'unknown';
export interface WeatherSnapshot {
  condition: WeatherCondition;
  temperatureCelsius: number;
  observedAt: string;
}
export interface WeatherProvider {
  getCurrentWeather(grid: { x: number; y: number }): Promise<WeatherSnapshot>;
}
