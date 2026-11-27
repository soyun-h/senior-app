import { createContext, useContext, type RefObject, type ComponentRef } from 'react';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
export const GlassBlurContext = createContext<RefObject<ComponentRef<typeof View> | null> | undefined>(undefined);
export function GlassSurface({ strong = false }: { strong?: boolean }) {
  const target = useContext(GlassBlurContext);
  return <View pointerEvents="none" style={styles.clip}>
    <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={strong ? 24 : 12} tint="light" style={StyleSheet.absoluteFill}/>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.10)' }]}/>
    <View style={styles.highlight}/>
  </View>;
}
const styles = StyleSheet.create({
  clip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 21, overflow: 'hidden' },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: '#FFFFFFB0' },
});
