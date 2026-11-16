import { Image, StyleSheet } from 'react-native';
import { backgroundCondition } from '../../features/weather/presentation';
import type { WeatherCondition } from '../../features/weather/types';
const backgrounds = {
  clear: require('../../../assets/design/weather-backgrounds/sunny.png'),
  cloudy: require('../../../assets/design/weather-backgrounds/cloudy.png'),
  rain: require('../../../assets/design/weather-backgrounds/rainy.png'),
  snow: require('../../../assets/design/weather-backgrounds/snowy.png'),
  thunder: require('../../../assets/design/weather-backgrounds/thunder.png'),
};
export function WeatherBackground({ condition }: { condition: WeatherCondition }) {
  return <Image testID={`weather-background-${condition}`} source={backgrounds[backgroundCondition(condition)]} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />;
}
