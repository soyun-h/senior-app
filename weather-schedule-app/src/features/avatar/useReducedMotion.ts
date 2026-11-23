import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

function webPreference(): boolean | null {
  if (Platform.OS !== 'web' || typeof matchMedia !== 'function') return null;
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 기기의 '동작 줄이기' 설정. 켜져 있으면 캐릭터 움직임을 생략한다.
 * 설정을 아직 모르면 null을 돌려준다. 호출하는 쪽은 null인 동안 움직임을 시작하지 않는다.
 * 웹은 prefers-reduced-motion을 바로 읽는다(허소윤 preview/schedules의 useReducedMotion과 같은 방식).
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(webPreference);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof matchMedia === 'function') {
      const media = matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(media.matches);
      update();
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => { if (active) setReduced(true); });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
