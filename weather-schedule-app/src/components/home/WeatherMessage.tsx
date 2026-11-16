import { StyleSheet, View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { HomeText } from './HomeText';
import { weatherMessage } from '../../features/weather/presentation';
import type { WeatherSnapshot } from '../../features/weather/types';
export function WeatherMessage({ weather }: { weather: WeatherSnapshot }) {
  return <View style={styles.panel}><GlassSurface strong/><HomeText style={styles.text}>{weatherMessage(weather)}</HomeText></View>;
}
const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 90, left: 28, right: 28, minHeight: 85, borderRadius: 21, borderWidth: 1, borderColor: '#FFFFFFB0', backgroundColor: 'rgba(255,255,255,0.12)', padding: 14, justifyContent: 'center' },
  text: { textAlign: 'center', fontSize: 17, lineHeight: 26, fontWeight: '500' },
});
