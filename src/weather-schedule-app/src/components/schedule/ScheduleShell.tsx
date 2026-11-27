import { useFonts } from 'expo-font';
import { BlurTargetView } from 'expo-blur';
import { useRef, type ComponentRef } from 'react';
import { ScheduleBlurContext } from './ScheduleBlurContext';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { BottomNavigation } from '../home/BottomNavigation';
import type { BottomTabId } from '../../navigation/bottomTabs';
export function ScheduleShell({ children, onNavigate, form = false, activeTab = 'schedule' }: {
  children: ReactNode; onNavigate: (tab: BottomTabId) => void; form?: boolean; activeTab?: BottomTabId;
}) {
  const [fontsLoaded,fontError]=useFonts({
    'SchedulePretendard-Regular':require('../../../assets/fonts/pretendard/Pretendard-Regular.otf'),
    'SchedulePretendard-Medium':require('../../../assets/fonts/pretendard/Pretendard-Medium.otf'),
    'SchedulePretendard-SemiBold':require('../../../assets/fonts/pretendard/Pretendard-SemiBold.otf'),
    'SchedulePretendard-Bold':require('../../../assets/fonts/pretendard/Pretendard-Bold.otf'),
  });
  const blurTarget=useRef<ComponentRef<typeof View>>(null);
  if(fontError)throw fontError;
  return <ScheduleBlurContext.Provider value={blurTarget}><SafeAreaView style={styles.safe}>
    <BlurTargetView ref={blurTarget} style={styles.stage}>
      <Image accessible={false} source={form ? require('../../../assets/schedule/images/background.png') : require('../../../assets/schedule/images/list-background.png')} resizeMode="stretch" style={styles.background}/>
      {fontsLoaded&&children}
      <BottomNavigation activeTab={activeTab} onNavigate={onNavigate}/>
    </BlurTargetView>
  </SafeAreaView></ScheduleBlurContext.Provider>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8FCF7',alignItems:'center'},
  stage:{flex:1,width:'100%',maxWidth:480},
  background:{position:'absolute',width:'100%',height:'100%'},
});
