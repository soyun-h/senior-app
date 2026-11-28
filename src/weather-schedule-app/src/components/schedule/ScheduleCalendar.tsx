import { ScheduleText as Text } from './ScheduleText';
import { ScheduleBlurContext } from './ScheduleBlurContext';
import { BlurView } from 'expo-blur';
import { useContext, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle, type GestureResponderEvent } from 'react-native';
import { calendarDates, calendarDateAtPoint, dragDateSelection, type DateSelection } from '../../features/schedules/selection';
import type { DateKey } from '../../features/schedules/model';
import { ScheduleAsset } from './ScheduleAsset';
import { SelectionSurface } from './SelectionSurface';

const webGestureStyle: ViewStyle & { touchAction: string; userSelect: string } = { touchAction: 'none', userSelect: 'none' };
const days = ['일', '월', '화', '수', '목', '금', '토'];
export function ScheduleCalendar({ selection, onChange, singleDay = false, hasSchedule, hasPhoto, onMonthChange }: {
  selection: DateSelection; onChange: (selection: DateSelection) => void; singleDay?: boolean;
  hasSchedule?: (date: DateKey) => boolean; hasPhoto?: (date: DateKey) => boolean; onMonthChange?: (month: string) => void;
}) {
  const blurTarget=useContext(ScheduleBlurContext);
  const [month, setMonth] = useState(selection.startDate.slice(0, 7));
  const [year, number] = month.split('-').map(Number);
  const dates = calendarDates(month, 'sunday');
  const [gridWidth, setGridWidth] = useState(0);
  const grid = useRef<ComponentRef<typeof View>>(null);
  const gesture = useRef<{ anchor?: string; x: number; y: number; ended: boolean; bounds?: { x: number; y: number; width: number; height: number } } | null>(null);
  function updateGesture() {
    const current = gesture.current;
    if (!current?.bounds) return;
    const { bounds } = current;
    const date = calendarDateAtPoint(dates, bounds.width, bounds.height - 4, current.x - bounds.x, current.y - bounds.y - 4);
    // Outside the grid: retain the last valid range rather than selecting unrelated dates.
    if (date) {
      current.anchor ??= date;
      onChange(dragDateSelection(current.anchor, date));
    }
    if (current.ended) gesture.current = null;
  }
  function startGesture(event: GestureResponderEvent) {
    const startX = event.nativeEvent.pageX, startY = event.nativeEvent.pageY;
    const current = { x: startX, y: startY, ended: false };
    gesture.current = current;
    // Measure in the same window coordinate space as pageX/pageY, including modal positioning.
    grid.current?.measureInWindow((x, y, width, height) => {
      if (gesture.current !== current) return;
      const date = calendarDateAtPoint(dates, width, height - 4, startX - x, startY - y - 4);
      Object.assign(current, { bounds: { x, y, width, height }, anchor: date });
      updateGesture();
    });
  }
  function moveGesture(event: GestureResponderEvent, ended = false) {
    if (!gesture.current) return;
    Object.assign(gesture.current, { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, ended });
    updateGesture();
  }
  function move(delta: number) {
    const date = new Date(Date.UTC(year, number - 1 + delta, 1));
    changeMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  function changeMonth(next: string) {
    setMonth(next);
    onMonthChange?.(next);
  }
  function selectDay(date: DateKey) {
    if (singleDay && !date.startsWith(month)) changeMonth(date.slice(0, 7));
    onChange(dragDateSelection(date, date));
  }
  const layout = singleDay ? styles : pickerStyles;
  return <View testID="schedule-calendar" style={layout.popup}>
    <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurView" pointerEvents="none" tint="light" intensity={25} style={StyleSheet.absoluteFill}/>
    <View style={layout.month}>
      <Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => move(-1)} style={layout.move}><ScheduleAsset name="month-left"/></Pressable>
      <Text accessibilityRole="header" accessibilityLabel={`${year}년 ${number}월`} style={styles.monthText}>{number}월</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => move(1)} style={layout.move}><ScheduleAsset name="month-right"/></Pressable>
    </View>
    <View style={layout.week}>{days.map((day, index) => <View key={day} style={styles.weekday}><Text style={[styles.weekText, index === 0 && styles.sunday]}>{day}</Text></View>)}</View>
    <View ref={grid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)} collapsable={false} style={[layout.grid, !singleDay && Platform.OS === 'web' && webGestureStyle]}
      onStartShouldSetResponderCapture={singleDay ? undefined : () => true}
      onResponderGrant={singleDay ? undefined : startGesture}
      onResponderMove={singleDay ? undefined : event => moveGesture(event)}
      onResponderRelease={singleDay ? undefined : event => moveGesture(event, true)}
      onResponderTerminationRequest={singleDay ? undefined : () => false}
      onResponderTerminate={singleDay ? undefined : () => { gesture.current = null; }}
    >
      {Array.from({length:dates.length/7},(_,row)=>{
        const week=dates.slice(row*7,row*7+7);
        const selected=week.map((date,index)=>date>=selection.startDate&&date<=selection.endDate?index:-1).filter(index=>index>=0);
        return <View key={week[0]} style={layout.calendarRow}>
          {!!selected.length&&gridWidth>0&&<View pointerEvents="none" style={[layout.range,{left:selected[0]*gridWidth/7,width:selected.length*gridWidth/7}]}><SelectionSurface width={selected.length*gridWidth/7} height={singleDay ? 31.5 : 36} variant={selected.length===1?'date':'pill'}/></View>}
          {week.map((date,index)=>{
            const active=date>=selection.startDate&&date<=selection.endDate;
            const marked = hasSchedule?.(date);
            const photographed = hasPhoto?.(date);
            return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${date} 날짜${marked ? ', 일정 있음' : ''}${photographed ? ', 인증 사진 있음' : ''}`} accessibilityState={{selected:active}} aria-selected={active} onPress={() => selectDay(date)} style={layout.cell}>
              <Text style={[styles.dateText,index===0&&styles.sunday,!date.startsWith(month)&&styles.adjacent,active&&styles.activeText]}>{Number(date.slice(8))}</Text>
              {(marked || photographed) && <View pointerEvents="none" style={styles.markers}>
                {marked && <View style={styles.mark}/>}
                {photographed && <View style={styles.photoMark}/>}
              </View>}
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
  markers: { position: 'absolute', bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  mark: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#006954' },
  photoMark: { width: 6, height: 5, borderWidth: 1.5, borderColor: '#694DA2', borderRadius: 1 },
});

// Layout estimates from the latest 360px reference; keep 4px grid inset for gesture coordinates.
const pickerStyles = StyleSheet.create({
  popup: { borderWidth: 1, borderColor: '#D6D6D6', borderRadius: 12, backgroundColor: '#FFFFFFD9', overflow: 'hidden', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, boxShadow: '0px 4px 12px #6C9B7418' },
  month: { height: 50, marginHorizontal:-2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  move: { width: 36, height: 50, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', height: 40 },
  grid: {paddingTop:4,marginTop:-4}, calendarRow:{flexDirection:'row',height:46.5}, cell: { width: '14.285714%', height: 46.5, alignItems: 'center', justifyContent: 'center' },
  range: { position: 'absolute', top: 5.25, height:36, borderRadius:10, overflow: 'hidden' },
});
