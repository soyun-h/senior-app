import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { BottomNavigation } from '../home/BottomNavigation';
import type { BottomTabId } from '../../navigation/bottomTabs';
export function ScheduleShell({ children, onNavigate, form = false }: { children: ReactNode; onNavigate: (tab: BottomTabId) => void; form?: boolean }) {
  return <SafeAreaView style={styles.safe}>
    <View style={styles.stage}>
      <Image accessible={false} source={form ? require('../../../assets/schedule/images/background.png') : require('../../../assets/schedule/images/list-background.png')} resizeMode="stretch" style={styles.background}/>
      {children}
      <BottomNavigation activeTab="schedule" onNavigate={onNavigate} enabledTabs={['schedule', 'home']}/>
    </View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8FCF7',alignItems:'center'},
  stage:{flex:1,width:'100%',maxWidth:480},
  background:{position:'absolute',width:'100%',height:'100%'},
});
