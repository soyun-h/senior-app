import { Pressable, StyleSheet, View } from 'react-native';
import { HomeIcon, type IconName } from './HomeIcon';
import { HomeText } from './HomeText';
export function HomeButton({ icon, label, selected = false, onPress }: { icon: IconName; label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: !onPress }} disabled={!onPress} onPress={onPress} style={styles.button}>
    <View style={[styles.circle, selected && styles.selected]}><HomeIcon name={icon} color={selected ? '#FFF' : icon === 'settings' ? '#B1B4B2' : '#4AAE78'} size={icon === 'settings' ? 36 : 30}/></View>
    {icon !== 'settings' && <HomeText style={styles.label}>{label}</HomeText>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minWidth: 48, minHeight: 48, alignItems: 'center' },
  circle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  selected: { backgroundColor: '#62BD78', borderWidth: 3, borderColor: '#A3D896' },
  label: { fontSize: 12, color: '#737373', marginTop: 5 },
});
