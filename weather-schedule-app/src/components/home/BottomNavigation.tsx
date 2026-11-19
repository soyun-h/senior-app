import { StyleSheet, View } from 'react-native';
import { HomeButton } from './HomeButton';
export function BottomNavigation() {
  return <View style={styles.bar} accessibilityLabel="하단 내비게이션">
    <View style={styles.items}><HomeButton icon="alarm" label="할 일"/><HomeButton icon="home" label="홈" selected/><HomeButton icon="calendar" label="달력"/></View>
  </View>;
}
const styles = StyleSheet.create({
  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 66, zIndex: 2, backgroundColor: 'white' },
  items: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -14 },
});
