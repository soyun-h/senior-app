import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useReducedMotion } from './useReducedMotion';

/** Only mounted during unresolved storage reads; no minimum display time. */
export function ScheduleSkeleton() {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(316);
  const id = useId().replaceAll(':', '');
  useEffect(() => {
    if (reduced) { progress.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.delay(1000),
    ]));
    animation.start();
    return () => { animation.stop(); progress.setValue(0); };
  }, [reduced, progress]);
  return <View testID="schedule-skeleton" accessibilityRole="progressbar" accessibilityLabel="일정을 불러오고 있어요." accessibilityState={{ busy: true }} pointerEvents="none">
    {[0, 1, 2].map(row => <View key={row} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.slot}>
      <View style={styles.card}>
        <View style={styles.check}/><View style={styles.title}/><View style={styles.time}/><View style={styles.bell}/><View style={styles.toggle}/>
        {!reduced && <Animated.View testID={`schedule-shimmer-${row}`} style={[styles.shimmer, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-90, width] }) }] }]}>
          <Svg width={90} height="100%"><Defs><LinearGradient id={`${id}${row}`} x1="0%" y1="0%" x2="100%" y2="0%"><Stop offset="0" stopColor="#FFF" stopOpacity={0}/><Stop offset="0.5" stopColor="#FFF" stopOpacity={0.6}/><Stop offset="1" stopColor="#FFF" stopOpacity={0}/></LinearGradient></Defs><Rect width={90} height="100%" fill={`url(#${id}${row})`}/></Svg>
        </Animated.View>}
      </View>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  slot: { aspectRatio: 316 / 98 },
  card: { position: 'absolute', left: 6, right: 6, top: 6, bottom: 6, borderRadius: 21, backgroundColor: '#F0F2F1', overflow: 'hidden' },
  check: { position: 'absolute', left: 22, top: '50%', marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E6E3' },
  title: { position: 'absolute', left: 82, right: 108, top: '50%', marginTop: -20, height: 16, borderRadius: 5, backgroundColor: '#E2E6E3' },
  time: { position: 'absolute', left: 82, width: 65, top: '50%', marginTop: 7, height: 12, borderRadius: 4, backgroundColor: '#E2E6E3' },
  bell: { position: 'absolute', right: 76, top: '50%', marginTop: -13.5, width: 23, height: 27, borderRadius: 7, backgroundColor: '#E2E6E3' },
  toggle: { position: 'absolute', right: 24, top: '50%', marginTop: -12, width: 48, height: 24, borderRadius: 12, backgroundColor: '#E2E6E3' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 90 },
});
