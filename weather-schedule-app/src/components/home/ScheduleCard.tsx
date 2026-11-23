import { Pressable, StyleSheet, View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { HomeText } from './HomeText';
import { HomeIcon } from './HomeIcon';
export interface HomeSchedule { id: string; time: string; title: string; completed: boolean }
export function ScheduleCard({ schedule, onPress }: { schedule: HomeSchedule; onPress?: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" style={styles.card} accessible accessibilityLabel={`${schedule.time} ${schedule.title} ${schedule.completed ? '완료' : '대기'}`}>
    <GlassSurface/><View style={styles.row}><HomeText style={styles.time}>{schedule.time}</HomeText><HomeIcon name={schedule.completed ? 'check' : 'clock'} size={18} color={schedule.completed ? '#4AAE78' : '#858987'}/></View>
    <HomeText numberOfLines={1} style={styles.description}>{schedule.title} │ <HomeText style={{ color: schedule.completed ? '#006951' : '#747977', fontSize: 14 }}>{schedule.completed ? '완료' : '대기'}</HomeText></HomeText>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { flex: 1, maxWidth: 149, height: 74, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 21, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  time: { fontSize: 24, lineHeight: 29, color: '#4AAE78', fontWeight: '700' },
  description: { fontSize: 14, color: '#5C6260' },
});
