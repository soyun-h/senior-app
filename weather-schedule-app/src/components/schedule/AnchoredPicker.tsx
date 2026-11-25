import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

export const PICKER_GAP = 6;

// Unit-mass damped response (stiffness 280, damping 28), sampled over 400ms.
// Reflect its tiny overshoot inside the final bounds: the clip never exceeds 100%.
function boundedSpring(progress: number) {
  if (progress === 0 || progress === 1) return progress;
  const frequency = Math.sqrt(280 - 14 * 14);
  const response = (seconds: number) => 1 - Math.exp(-14 * seconds) *
    (Math.cos(frequency * seconds) + 14 / frequency * Math.sin(frequency * seconds));
  const value = response(progress * 0.4) / response(0.4);
  return Math.max(0, Math.min(1, value > 1 ? 2 - value : value));
}

/** Keep full-size content stationary; reveal only its clipped viewport. */
export function AnchoredPicker({ visible, anchor, onClose, children }: {
  visible: boolean; anchor: RefObject<ComponentRef<typeof View> | null>; onClose: () => void; children: ReactNode;
}) {
  const window = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [popupHeight, setPopupHeight] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number; width: number }>();
  const [settled, setSettled] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const run = useRef(0);
  const content = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => anchor.current?.measureInWindow((x, y, width, height) => setPosition({ left: Math.max(12, x - 16), top: y + height + PICKER_GAP, width: Math.min(width + 32, window.width - 24) })));
    return () => cancelAnimationFrame(frame);
  }, [visible, anchor, window.width, window.height]);
  const measured = !!position && popupHeight > 0;
  useEffect(() => {
    const serial = ++run.current;
    setSettled(false);
    if (visible && !measured) return;
    if (!visible && !measured) {
      reveal.setValue(0); opacity.setValue(0);
      setPosition(undefined); setPopupHeight(0);
      return;
    }
    const finish = () => {
      if (run.current !== serial) return;
      if (visible) setSettled(true);
      else { setPosition(undefined); setPopupHeight(0); }
    };
    if (reducedMotion) {
      reveal.setValue(visible ? 1 : 0);
      opacity.setValue(visible ? 1 : 0);
      finish();
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(reveal, { toValue: visible ? 1 : 0, duration: visible ? 400 : 250,
        easing: visible ? boundedSpring : Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: visible ? 120 : 250,
        easing: Easing.linear, useNativeDriver: false }),
    ]);
    animation.start(({ finished }) => { if (finished) finish(); });
    return () => animation.stop();
  }, [visible, measured, reducedMotion, reveal, opacity]);
  return <Modal visible={!!position} transparent animationType="none" onRequestClose={onClose}>
    <View style={styles.layer}>
      <Pressable accessibilityRole="button" accessibilityLabel="선택 팝업 닫기" onPress={onClose} style={StyleSheet.absoluteFill}/>
      {position && <View accessibilityViewIsModal style={[styles.popup, position, {height:popupHeight,left:Math.min(position.left,window.width-position.width-12),top:Math.max(12,Math.min(position.top,window.height-popupHeight-12))}]}>
        <Animated.View testID="schedule-picker-reveal" style={{width:position.width,height:Animated.multiply(reveal,popupHeight),opacity,overflow:settled?'visible':'hidden'}}>
          <View ref={content} collapsable={false} pointerEvents={visible&&settled?'auto':'none'} accessibilityElementsHidden={!visible||!settled} importantForAccessibility={visible&&settled?'auto':'no-hide-descendants'} onLayout={()=>content.current?.measureInWindow((_x,_y,_width,height)=>setPopupHeight(height))} style={[styles.content,{width:position.width}]}>{children}</View>
        </Animated.View>
      </View>}
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ layer: { flex: 1 }, popup: { position: 'absolute' }, content:{position:'absolute',left:0,top:0} });
