import { StyleSheet, View } from 'react-native';
import { HomeButton } from './HomeButton';
import { bottomTabs, type BottomNavigationProps } from '../../navigation/bottomTabs';

/** Shared by home and future schedule/calendar screens. Parent controls the active route. */
export function BottomNavigation({ activeTab, onNavigate }: BottomNavigationProps) {
  return <View style={styles.bar} accessibilityLabel="하단 내비게이션">
    <View style={styles.items}>
      {bottomTabs.map(tab => <HomeButton
        key={tab.id}
        icon={tab.icon}
        label={tab.label}
        selected={activeTab === tab.id}
        navigationTab
        onPress={onNavigate ? () => onNavigate(tab.id) : undefined}
      />)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 66, backgroundColor: 'white' },
  items: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 43, marginTop: -14 },
});
