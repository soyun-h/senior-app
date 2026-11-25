import { Pressable, StyleSheet, View } from 'react-native';
import { HomeIcon, type IconName } from './HomeIcon';
import { NavigationActiveArtwork } from './NavigationActiveArtwork';
import { HomeText } from './HomeText';
export function HomeButton({ icon, label, selected = false, navigationTab = false, onPress }: { icon: IconName; label: string; selected?: boolean; navigationTab?: boolean; onPress?: () => void }) {
  const home = icon === 'home';
  const active = navigationTab && selected;
  const alignment = navigationTab ? navigationIconAlignment[icon as NavigationIcon] : undefined;
  const glyphStyle = alignment ? { transform: [
    { translateX: alignment.x },
    { translateY: active ? alignment.activeY : alignment.y },
    { scale: alignment.scale },
  ] } : undefined;
  return <Pressable accessibilityRole={navigationTab ? 'tab' : 'button'} accessibilityLabel={label} aria-selected={navigationTab ? selected : undefined} accessibilityState={{ selected, disabled: !onPress }} disabled={!onPress} onPress={onPress} style={styles.button}>
    <View style={[styles.circle, active && styles.active]}>
      {active && <NavigationActiveArtwork replaceHomeIcon={!home}/>}
      {!(active && home) && <View pointerEvents="none" style={glyphStyle}><HomeIcon name={icon} tint={active ? '#FFFFFF' : home ? '#4EA674' : undefined}/></View>}
    </View>
    {icon !== 'settings' && <HomeText style={[styles.label, active && styles.activeLabel]}>{label}</HomeText>}
  </Pressable>;
}
type NavigationIcon = 'alarm' | 'home' | 'calendar';
// Optical offsets in dp, measured from rendered SVG ink rather than its viewBox.
// The original active PNG's disc is 1.95dp above the inactive 48dp circle.
// Keep its embedded home glyph untouched; match the inactive SVG to that artwork.
const navigationIconAlignment: Record<NavigationIcon, { x: number; y: number; activeY: number; scale: number }> = {
  alarm: { x: 0.1, y: 0.65, activeY: -1.3, scale: 1 },
  home: { x: 0.75, y: -1.5, activeY: -3.45, scale: 0.9 },
  calendar: { x: 0.15, y: 0.6, activeY: -1.35, scale: 1 },
};
const styles = StyleSheet.create({
  button: { width: 48, minHeight: 48, alignItems: 'center' },
  circle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 2px 6px rgba(20,70,40,0.08)' },
  active: { backgroundColor: 'transparent', boxShadow: 'none' },
  label: { fontSize: 12, color: '#737373', marginTop: 5 },
  activeLabel: { color: '#4EA674', fontWeight: '700' },
});
