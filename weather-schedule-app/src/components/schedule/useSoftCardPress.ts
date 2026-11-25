import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

export const SCHEDULE_LONG_PRESS_MS = 500;

/** One shared progress drives background opacity and the whole card's transform. */
export function useSoftCardPress(pressed: boolean, latched: boolean) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (latched || reducedMotion) {
      progress.setValue(latched || pressed ? 1 : 0);
      return;
    }
    // Resume from the current value if another press interrupts restoration.
    const animation = Animated.timing(progress, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? SCHEDULE_LONG_PRESS_MS : 180,
      easing: pressed ? Easing.inOut(Easing.quad) : Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [pressed, latched, reducedMotion, progress]);
  return {
    opacity: progress,
    scale: reducedMotion ? 1 : progress.interpolate({inputRange:[0,1],outputRange:[1,0.95],extrapolate:'clamp'}),
  };
}
