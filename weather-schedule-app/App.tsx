import { useState } from 'react';
import { BackHandler } from 'react-native';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { ScheduleListScreen } from './src/screens/ScheduleListScreen';
import { ScheduleAddScreen } from './src/screens/ScheduleAddScreen';
import { ScheduleSuccessScreen } from './src/screens/ScheduleSuccessScreen';
import { ScheduleProvider } from './src/features/schedules/ScheduleProvider';
import type { BottomTabId } from './src/navigation/bottomTabs';
type Screen = 'home' | 'schedule' | 'schedule-add' | 'schedule-success';
export default function App() {
  const [saving,setSaving]=useState(false);
  const [screen,setScreen]=useState<Screen>('home');
  function navigate(tab: BottomTabId) { if(!saving&&(tab==='home'||tab==='schedule'))setScreen(tab); }
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(saving)return true;
      if(screen==='home')return false;
      setScreen(screen==='schedule'?'home':'schedule');return true;
    });return ()=>subscription.remove();
  },[screen,saving]);
  return <SafeAreaProvider><ScheduleProvider><StatusBar hidden/>
    {screen==='home'&&<HomeScreen onNavigate={navigate}/>}
    {screen==='schedule'&&<ScheduleListScreen onAdd={()=>setScreen('schedule-add')} onNavigate={navigate}/>}
    {screen==='schedule-add'&&<ScheduleAddScreen onSavingChange={setSaving} onBack={()=>setScreen('schedule')} onSaved={()=>setScreen('schedule-success')} onNavigate={navigate}/>}
    {screen==='schedule-success'&&<ScheduleSuccessScreen onList={()=>setScreen('schedule')} onNavigate={navigate}/>}
  </ScheduleProvider></SafeAreaProvider>;
}
