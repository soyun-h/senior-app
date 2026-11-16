import type { WeatherCondition, WeatherSnapshot } from './types';
export const demoConditions = ['clear', 'cloudy', 'rain', 'snow', 'thunder'] as const;
export function backgroundCondition(condition: WeatherCondition) {
  return condition === 'unknown' ? 'cloudy' : condition;
}
export function weatherMessage(weather: WeatherSnapshot): string {
  const guidance: Record<WeatherCondition, string> = {
    clear: '맑은 하루예요. 편안한 하루 보내세요.',
    cloudy: '구름이 많아요. 외출 전 날씨를 확인하세요.',
    rain: '비가 온다고 하니 우산 꼭 챙기세요.',
    snow: '눈이 내려요. 미끄러운 길 조심하세요.',
    thunder: '번개가 칠 수 있어요. 실내에 머무르세요.',
    unknown: '외출 전 최신 날씨를 확인하세요.',
  };
  return `오늘의 날씨는 ${weather.temperatureCelsius}°C 입니다.\n${weather.guidance ?? guidance[weather.condition]}`;
}
