import { StyleSheet, Text, View } from 'react-native';
import { ScheduleShell } from '../components/schedule/ScheduleShell';
import { RegisterButton } from '../components/schedule/ScheduleControls';
import type { BottomTabId } from '../navigation/bottomTabs';
/** Reserved, intentionally empty until the user supplies the future logo. */
export function CompletionLogoSlot() { return <View testID="completion-logo-slot" style={styles.logo}/>; }
export function ScheduleSuccessScreen({ message,onList,onNavigate }: { message:string; onList:()=>void;onNavigate:(tab:BottomTabId)=>void }) {
  return <ScheduleShell onNavigate={onNavigate} form><View style={styles.center}>
    <CompletionLogoSlot/>
    <Text accessibilityRole="header" style={styles.title}>할 일이 등록되었어요!</Text>
    <Text style={styles.message}>{message}</Text>
    <View style={styles.button}><RegisterButton label="일정 목록으로" onPress={onList}/></View>
  </View></ScheduleShell>;
}
const styles=StyleSheet.create({center:{flex:1,justifyContent:'center',alignItems:'center',paddingHorizontal:28,paddingBottom:90},logo:{height:48,width:120},title:{fontSize:27,lineHeight:40,fontWeight:'700',color:'#003C40',textAlign:'center'},message:{fontSize:16,lineHeight:24,color:'#66786D',textAlign:'center',marginTop:12},button:{width:'100%',marginTop:36}});
