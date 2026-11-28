import { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Original PNG stays untouched. Reuse its complete silhouette, rim and shadow.
// Restore only the central house-shaped region using colors
// sampled beside the original glyph; the opaque raster cannot supply hidden pixels.
const centerStops = [
  [44, '#4EA674'],
  [48, '#4EA674'],
  [52, '#4FA675'],
  [56, '#50A774'],
  [60, '#53AA75'],
  [64, '#56AC75'],
  [68, '#5BB076'],
  [72, '#5EB377'],
  [76, '#61B578'],
  [80, '#65B878'],
  [84, '#68BA78'],
  [88, '#6CBD7A'],
  [92, '#6FC07A'],
  [96, '#72C37A'],
  [100, '#76C67C'],
  [104, '#79C87C'],
  [108, '#7DCC7D'],
  [112, '#80CE7D'],
] as const;
// Source PNG is 166px including transparent padding and shadow. The colored
// circle is 94px across, starting at (36,34); fit that disc to the 48dp button.
const artworkSize = 166 * 48 / 94;
export function NavigationActiveArtwork() {
  const gradientId = `nav-center-${useId().replaceAll(':', '')}`;
  return <View testID="active-navigation-artwork" pointerEvents="none" style={styles.art}>
    <Image source={require('../../../assets/design/refinement/buttons/Home button.png')} resizeMode="contain" style={styles.image}/>
    <Svg width={artworkSize} height={artworkSize} viewBox="0 0 166 166" style={StyleSheet.absoluteFill}>
      <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="166" gradientUnits="userSpaceOnUse">
        {centerStops.map(([y,color])=><Stop key={y} offset={y/166} stopColor={color}/>)}
      </LinearGradient></Defs>
      <Path d="M84 44 L118 76 L118 112 L52 112 L52 76 Z" fill={`url(#${gradientId})`}/>
    </Svg>
  </View>;
}
const styles = StyleSheet.create({
  art: { position:'absolute',width:artworkSize,height:artworkSize,left:-36*48/94,top:-34*48/94 },
  image: { width:artworkSize,height:artworkSize },
});
