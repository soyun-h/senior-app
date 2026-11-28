import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { NotificationMethod } from '../../features/schedules/model';
import { ScheduleText as Text } from './ScheduleText';
import { SelectionSurface } from './SelectionSurface';
import { useReducedMotion } from './useReducedMotion';

const choices = [
  { id: 'video-call', label: '영상통화', width: 81 },
  { id: 'alarm', label: '알람', width: 52 },
  { id: 'none', label: '알람 없이', width: 81 },
] as const;
// Adapt the reference shared/tokens.css lead (620/36) and trail (190/19) presets.
// Sample the unit-mass damped spring response over a finite interval, normalizing
// its endpoint so the original pixel geometry is reached exactly, without a long tail.
function springCurve(stiffness: number, damping: number, milliseconds: number) {
  const frequency = Math.sqrt(stiffness - damping * damping / 4);
  const response = (time: number) => 1 - Math.exp(-damping * time / 2) *
    (Math.cos(frequency * time) + damping / (2 * frequency) * Math.sin(frequency * time));
  const seconds = milliseconds / 1000;
  const end = response(seconds);
  return (progress: number) => progress === 1 ? 1 : response(progress * seconds) / end;
}
const leadMotion = { duration: 260, easing: springCurve(620, 36, 260), useNativeDriver: false };
const trailMotion = { duration: 360, easing: springCurve(190, 19, 360), useNativeDriver: false };
export function NotificationMethodControl({ value, onChange, disabled }: {
  value: NotificationMethod; onChange: (method: NotificationMethod) => void; disabled: boolean;
}) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(81)).current;
  const highlightWidth = useMemo(() => Animated.subtract(right, left), [left, right]);
  const current = useRef({ left: 0, right: 81 });
  useEffect(() => {
    const leftListener = left.addListener(({ value }) => { current.current.left = value; });
    const rightListener = right.addListener(({ value }) => { current.current.right = value; });
    return () => { left.removeListener(leftListener); right.removeListener(rightListener); };
  }, [left, right]);
  const previousWidth = useRef(0);
  useEffect(() => {
    if (!width) return;
    const index = choices.findIndex(choice => choice.id === value);
    const targetWidth = choices[index].width;
    const targetX = width / 3 * (index + 0.5) - targetWidth / 2;
    if (reduced || previousWidth.current !== width) {
      left.stopAnimation(); right.stopAnimation();
      left.setValue(targetX); right.setValue(targetX + targetWidth);
      previousWidth.current = width;
      return;
    }
    const toRight = targetX + targetWidth / 2 >= (current.current.left + current.current.right) / 2;
    const leadingEdge = toRight ? right : left;
    const trailingEdge = toRight ? left : right;
    // Front stretches first. The back follows 80ms later, then snaps into place.
    // Retarget from the actual current edges, including mid-flight reversals.
    const animation = Animated.parallel([
      Animated.timing(leadingEdge, { ...leadMotion, toValue: toRight ? targetX + targetWidth : targetX }),
      Animated.sequence([
        Animated.delay(80),
        Animated.timing(trailingEdge, { ...trailMotion, toValue: toRight ? targetX : targetX + targetWidth }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [value, width, reduced, left, right]);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.options}>
    {width > 0 && <Animated.View testID="notification-method-highlight" pointerEvents="none" style={[styles.surface, { left, width: highlightWidth }]}><SelectionSurface/></Animated.View>}
    {choices.map(choice => <Pressable key={choice.id} accessibilityRole="radio" accessibilityLabel={choice.label} aria-checked={value === choice.id} accessibilityState={{ checked: value === choice.id }} disabled={disabled} onPress={() => onChange(choice.id)} style={styles.method}>
      <Text numberOfLines={1} style={[styles.text, value === choice.id && styles.selected]}>{choice.label}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  options: { flex: 1, minWidth: 0, marginLeft: 17.5, flexDirection: 'row', alignItems: 'center', height: 30 },
  method: { flex: 1, minWidth: 0, height: 30, justifyContent: 'center', alignItems: 'center' },
  surface: { position: 'absolute', top: 0, height: 30, borderRadius: 10, overflow: 'hidden' },
  text: { fontSize: 16, lineHeight: 20, textAlign: 'center', color: '#858585' },
  selected: { color: '#006954' },
});
