import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../features/avatar/useReducedMotion';
import { GlassSurface } from './GlassSurface';
import { HomeText } from './HomeText';

const useNativeDriver = Platform.OS !== 'web';

/**
 * 캐릭터 대사창. 아래쪽 bottom 90 자리는 WeatherMessage가 쓰므로 그 위에 둔다.
 * 대사가 바뀔 때마다(부모의 key) 아래에서 8px 올라오며 나타난다(250ms).
 */
export function CharacterDialogue({ name, text }: { name: string; text: string }) {
  const reduced = useReducedMotion();
  const appear = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: reduced ? 0 : 250, delay: reduced ? 0 : 150, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [appear, reduced]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${name}: ${text}`}
      accessibilityLiveRegion="polite"
      style={[styles.panel, { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
    >
      <GlassSurface strong />
      <HomeText style={styles.text}>{text}</HomeText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 183, left: 28, right: 28, minHeight: 60, borderRadius: 21, borderWidth: 1, borderColor: '#FFFFFFB0', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center', overflow: 'hidden' },
  text: { textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '500' },
});
