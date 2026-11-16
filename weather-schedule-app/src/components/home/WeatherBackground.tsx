import { Image, StyleSheet, View } from 'react-native';
import { backgroundCondition } from '../../features/weather/presentation';
import type { WeatherCondition } from '../../features/weather/types';
const backgrounds = {
  clear: require('../../../assets/design/weather-backgrounds/sunny.png'),
  cloudy: require('../../../assets/design/weather-backgrounds/cloudy.png'),
  rain: require('../../../assets/design/weather-backgrounds/rainy.png'),
  snow: require('../../../assets/design/weather-backgrounds/snowy.png'),
  thunder: require('../../../assets/design/weather-backgrounds/thunder.png'),
};
const whiteVeil = { clear: 0.357, cloudy: 0.059, rain: 0.481, snow: 0.145, thunder: 0.609 };
export function WeatherBackground({ condition }: { condition: WeatherCondition }) {
  return <View style={styles.layer}><Image testID={`weather-background-${condition}`} source={backgrounds[backgroundCondition(condition)]} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} /><View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${whiteVeil[backgroundCondition(condition)]})` }]}/></View>;
}

const styles = StyleSheet.create({ layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 66 } });
