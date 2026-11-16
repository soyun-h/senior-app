import { StyleSheet, View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { HomeText } from './HomeText';
import { weatherMessage } from '../../features/weather/presentation';
import type { WeatherSnapshot } from '../../features/weather/types';
export function WeatherMessage({ weather, notice }: { weather?: WeatherSnapshot; notice?: string }) {
  return <View style={styles.panel}><GlassSurface strong/><HomeText style={styles.text}>{weather ? notice ? `관측 기온 ${weather.temperatureCelsius}°C · 갱신 지연\n${notice}` : weatherMessage(weather) : `${notice ?? '날씨를 확인할 수 없습니다.'}\n현재 날씨를 확인할 수 없어요.`}</HomeText></View>;
}
const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 90, left: 28, right: 28, minHeight: 85, borderRadius: 21, borderWidth: 1, borderColor: '#FFFFFFB0', backgroundColor: 'rgba(255,255,255,0.12)', padding: 14, justifyContent: 'center' },
  text: { textAlign: 'center', fontSize: 17, lineHeight: 26, fontWeight: '500' },
});
