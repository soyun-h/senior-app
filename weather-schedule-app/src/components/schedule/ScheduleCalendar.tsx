import { ScheduleText as Text } from './ScheduleText';
import { ScheduleBlurContext } from './ScheduleBlurContext';
import { BlurView } from 'expo-blur';
import { useContext, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { calendarDates, selectDate, type DateSelection } from '../../features/schedules/selection';
import { ScheduleAsset } from './ScheduleAsset';
import { SelectionSurface } from './SelectionSurface';

const days = ['일', '월', '화', '수', '목', '금', '토'];
export function ScheduleCalendar({ selection, onChange }: { selection: DateSelection; onChange: (selection: DateSelection) => void }) {
  const blurTarget=useContext(ScheduleBlurContext);
  const [month, setMonth] = useState(selection.startDate.slice(0, 7));
  const [year, number] = month.split('-').map(Number);
  const dates = calendarDates(month, 'sunday');
  function move(delta: number) {
    const date = new Date(Date.UTC(year, number - 1 + delta, 1));
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return <View testID="schedule-calendar" style={styles.popup}>
    <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurView" pointerEvents="none" tint="light" intensity={25} style={StyleSheet.absoluteFill}/>
    <View style={styles.month}>
      <Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => move(-1)} style={styles.move}><ScheduleAsset name="month-left"/></Pressable>
      <Text accessibilityRole="header" accessibilityLabel={`${year}년 ${number}월`} style={styles.monthText}>{number}월</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => move(1)} style={styles.move}><ScheduleAsset name="month-right"/></Pressable>
    </View>
    <View style={styles.week}>{days.map((day, index) => <View key={day} style={styles.weekday}><Text style={[styles.weekText, index === 0 && styles.sunday]}>{day}</Text></View>)}</View>
    <View style={styles.grid}>
      {Array.from({length:dates.length/7},(_,row)=>{
        const week=dates.slice(row*7,row*7+7);
        const selected=week.map((date,index)=>date>=selection.startDate&&date<=selection.endDate?index:-1).filter(index=>index>=0);
        return <View key={week[0]} style={styles.calendarRow}>
          {!!selected.length&&<View pointerEvents="none" style={[styles.range,{left:`${selected[0]*100/7}%`,width:`${selected.length*100/7}%`}]}><SelectionSurface variant={selected.length===1?'date':'pill'}/></View>}
          {week.map((date,index)=>{
            const active=date>=selection.startDate&&date<=selection.endDate;
            return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${date} 날짜`} accessibilityState={{selected:active}} aria-selected={active} onPress={()=>onChange(selectDate(selection,date))} style={styles.cell}>
              <Text style={[styles.dateText,index===0&&styles.sunday,!date.startsWith(month)&&styles.adjacent,active&&styles.activeText]}>{Number(date.slice(8))}</Text>
            </Pressable>;
          })}
        </View>;
      })}
    </View>
  </View>;
}
// Measured estimates from the supplied raster: 270px popup at 360px viewport.
const styles = StyleSheet.create({
  popup: { borderWidth: 1, borderColor: '#D6D6D6', borderRadius: 12, backgroundColor: '#FFFFFFD9', overflow: 'hidden', paddingHorizontal: 13, paddingTop: 8, paddingBottom: 10, boxShadow: '0px 4px 12px #6C9B7418' },
  month: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  move: { width: 36, height: 42, alignItems: 'center', justifyContent: 'center' }, monthText: { fontSize: 18, fontWeight: '600', color: '#000' },
  week: { flexDirection: 'row', height: 32 }, weekday: { width: '14.285714%', alignItems: 'center', justifyContent: 'center' }, weekText: { fontSize: 12, color: '#111' },
  grid: {paddingTop:4}, calendarRow:{flexDirection:'row',height:41.5}, cell: { width: '14.285714%', height: 41.5, alignItems: 'center', justifyContent: 'center' },
  range: { position: 'absolute', top: 5, bottom: 5, borderRadius:10, overflow: 'hidden' },
  dateText: { fontSize: 13, fontWeight: '600', color: '#666' }, sunday: { color: '#4EA674' }, adjacent: { opacity: 0.28 }, activeText: { color: '#006954', opacity: 1 },
});
