import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
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
/** Keep the reference's light sky; preserve local contrast around the original bolt.
 * Coordinates refer to the existing 360×664 background, not a fabricated lightning asset.
 */
function ThunderLight() {
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 360 664" preserveAspectRatio="none">
    <Defs>
      <RadialGradient id="thunderVeil" gradientUnits="userSpaceOnUse" cx="282" cy="242" rx="100" ry="132">
        <Stop offset="0" stopColor="white" stopOpacity={0.22}/>
        <Stop offset="0.35" stopColor="white" stopOpacity={0.30}/>
        <Stop offset="0.75" stopColor="white" stopOpacity={0.50}/>
        <Stop offset="1" stopColor="white" stopOpacity={0.609}/>
      </RadialGradient>
      <RadialGradient id="thunderGlow" gradientUnits="userSpaceOnUse" cx="290" cy="205" rx="38" ry="38">
        <Stop offset="0" stopColor="#F8F5FF" stopOpacity={0.30}/>
        <Stop offset="0.35" stopColor="#F8F5FF" stopOpacity={0.10}/>
        <Stop offset="1" stopColor="#F8F5FF" stopOpacity={0}/>
      </RadialGradient>
    </Defs>
    <Rect width="360" height="664" fill="url(#thunderVeil)"/>
    <Rect width="360" height="664" fill="url(#thunderGlow)"/>
  </Svg>;
}
export function WeatherBackground({ condition }: { condition: WeatherCondition }) {
  return <View style={styles.layer}><Image testID={`weather-background-${condition}`} source={backgrounds[backgroundCondition(condition)]} style={[StyleSheet.absoluteFill, condition === 'thunder' && { width: '100%', height: '100%' }]} resizeMode="cover" accessible={false} />{condition === 'thunder' ? <ThunderLight/> : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${whiteVeil[backgroundCondition(condition)]})` }]}/>}</View>;
}

const styles = StyleSheet.create({ layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 66 } });
