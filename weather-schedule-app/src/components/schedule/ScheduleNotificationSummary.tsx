import { StyleSheet, View } from 'react-native';
import { ScheduleAsset } from './ScheduleAsset';
import { ScheduleText as Text } from './ScheduleText';
import type { Schedule } from '../../features/schedules/model';

export function ScheduleNotificationSummary({ schedule, complete }: { schedule: Schedule; complete: boolean }) {
  const method = schedule.notificationsEnabled ? schedule.notificationMethod : 'none';
  const label = method === 'video-call' ? '영상통화' : method === 'alarm' ? '단순알람' : '알람없이';
  const color = complete ? '#4EA674' : '#BEBEBE';
  return <View accessible accessibilityLabel={`알림 방식: ${label}`} style={styles.summary}>
    <View style={styles.icon}><ScheduleAsset name="bell" width={16} height={19} bellTint={color}/>
      {method === 'none' && <View pointerEvents="none" style={[styles.slash,{backgroundColor:color}]}/>}
    </View>
    <Text style={[styles.text,{color}]}>{label}</Text>
  </View>;
}
const styles = StyleSheet.create({
  summary:{position:'absolute',right:28,top:'50%',marginTop:-12,height:24,flexDirection:'row',alignItems:'center',gap:3},
  icon:{width:16,height:19},slash:{position:'absolute',left:-1,top:9,width:20,height:1.2,transform:[{rotate:'-45deg'}]},
  text:{fontSize:16,lineHeight:20,fontWeight:'500'},
});
