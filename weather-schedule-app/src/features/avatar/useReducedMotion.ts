import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** 기기의 '동작 줄이기' 설정. 켜져 있으면 캐릭터 움직임을 생략한다. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }, () => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
