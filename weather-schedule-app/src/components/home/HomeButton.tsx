import { Image, Pressable, StyleSheet, View } from 'react-native';
import { HomeIcon, type IconName } from './HomeIcon';
import { HomeText } from './HomeText';
export function HomeButton({ icon, label, selected = false, navigationTab = false, onPress }: { icon: IconName; label: string; selected?: boolean; navigationTab?: boolean; onPress?: () => void }) {
  const home = icon === 'home';
  return <Pressable accessibilityRole={navigationTab ? 'tab' : 'button'} accessibilityLabel={label} aria-selected={navigationTab ? selected : undefined} accessibilityState={{ selected, disabled: !onPress }} disabled={!onPress} onPress={onPress} style={styles.button}>
    <View style={[styles.circle, home && styles.home]}>
      {home ? <Image source={require('../../../assets/design/refinement/buttons/Home button.png')} resizeMode="contain" style={styles.homeImage}/> : <HomeIcon name={icon}/>}
    </View>
    {icon !== 'settings' && <HomeText style={[styles.label, navigationTab && selected && !home && styles.activeLabel]}>{label}</HomeText>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { width: 48, minHeight: 48, alignItems: 'center' },
  circle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 2px 6px rgba(20,70,40,0.08)' },
  home: { backgroundColor: 'transparent', boxShadow: 'none' },
  homeImage: { position: 'absolute', width: 75, height: 75, left: -13.5, top: -15 },
  label: { fontSize: 12, color: '#737373', marginTop: 5 },
  activeLabel: { color: '#4EA674', fontWeight: '700' },
});
