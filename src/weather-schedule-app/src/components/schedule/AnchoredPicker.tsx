import { useEffect, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

/** Transparent modal provides native z-order without dimming or replacing the page. */
export function AnchoredPicker({ visible, anchor, onClose, children }: {
  visible: boolean; anchor: RefObject<ComponentRef<typeof View> | null>; onClose: () => void; children: ReactNode;
}) {
  const window = useWindowDimensions();
  const [position, setPosition] = useState<{ left: number; top: number; width: number }>();
  useEffect(() => {
    if (!visible) { setPosition(undefined); return; }
    const frame = requestAnimationFrame(() => anchor.current?.measureInWindow((x, y, width, height) => setPosition({ left: x, top: y + height + 4, width })));
    return () => cancelAnimationFrame(frame);
  }, [visible, anchor, window.width, window.height]);
  return <Modal visible={visible && !!position} transparent animationType="none" onRequestClose={onClose}>
    <View style={styles.layer}>
      <Pressable accessibilityRole="button" accessibilityLabel="선택 팝업 닫기" onPress={onClose} style={StyleSheet.absoluteFill}/>
      {position && <View accessibilityViewIsModal style={[styles.popup, position]}>{children}</View>}
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ layer: { flex: 1 }, popup: { position: 'absolute' } });
