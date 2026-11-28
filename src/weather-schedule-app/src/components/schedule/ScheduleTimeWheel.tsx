import { ScheduleText as Text } from './ScheduleText';
import { ScheduleBlurContext } from './ScheduleBlurContext';
import { BlurView } from 'expo-blur';
import { useContext, useEffect, useRef, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { to24Hour } from '../../features/schedules/selection';

const ROW = 56;
const periods = ['오전', '오후'];
const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function WheelColumn({ label, values, index, onChange, spaced = false }: {
  spaced?: boolean; label: string; values: string[]; index: number; onChange: (index: number) => void;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const latestIndex = useRef(index);
  const positioned = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (latestIndex.current !== index) {
      latestIndex.current = index;
      scroll.current?.scrollTo({ y: index * ROW, animated: false });
    }
  }, [index]);
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  function select(next: number) {
    const bounded = Math.max(0, Math.min(values.length - 1, next));
    if (latestIndex.current !== bounded) {
      latestIndex.current = bounded;
      onChangeRef.current(bounded);
    }
  }
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    select(Math.round(offset / ROW));
    if (Platform.OS !== 'web') return;
    clearTimeout(settleTimer.current);
    // RN Web doesn't emit momentum-end for every mouse-wheel gesture.
    settleTimer.current = setTimeout(() => {
      scroll.current?.scrollTo({ y: latestIndex.current * ROW, animated: false });
    }, 140);
  }
  return <View style={[styles.column,spaced&&{marginRight:20}]}>
    <View pointerEvents="none" style={[styles.selection,label==='분'&&{left:0}]}/>
    <ScrollView
      ref={scroll}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: values.length - 1, now: index, text: values[index] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        const next = index + (event.nativeEvent.actionName === 'increment' ? 1 : -1);
        select(next);
        scroll.current?.scrollTo({ y: latestIndex.current * ROW, animated: false });
      }}
      onLayout={() => { if (!positioned.current) { positioned.current = true; scroll.current?.scrollTo({ y: latestIndex.current * ROW, animated: false }); } }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      snapToInterval={ROW}
      decelerationRate="fast"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      {values.map((value, i) => <Pressable
        key={value}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
        accessibilityState={{ selected: i === index }}
        onPress={() => { select(i); scroll.current?.scrollTo({ y: i * ROW, animated: false }); }}
        style={styles.row}
      ><Text style={[styles.value, i === index && styles.selectedValue,label==='오전 오후'&&styles.periodValue]}>{value}</Text></Pressable>)}
    </ScrollView>
  </View>;
}

/** Shared anchored popup content for date and weekly modes. No OS picker or text input. */
export function ScheduleTimeWheel({ hour, minute, onChange }: {
  hour: number; minute: number; onChange: (value: { hour: number; minute: number }) => void;
}) {
  const blurTarget=useContext(ScheduleBlurContext);
  const periodIndex = hour < 12 ? 0 : 1;
  const hourIndex = (hour % 12 || 12) - 1;
  return <View testID="schedule-time-wheel" style={styles.popup}>
    <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurView" pointerEvents="none" tint="light" intensity={25} style={StyleSheet.absoluteFill}/>
    <WheelColumn spaced label="오전 오후" values={periods} index={periodIndex} onChange={i => onChange({ hour: to24Hour(i === 0 ? '오전' : '오후', hourIndex + 1), minute })}/>
    <WheelColumn label="시" values={hours} index={hourIndex} onChange={i => onChange({ hour: to24Hour(periodIndex === 0 ? '오전' : '오후', i + 1), minute })}/>
    <Text accessible={false} style={styles.colon}>:</Text>
    <WheelColumn label="분" values={minutes} index={minute} onChange={i => onChange({ hour, minute: i })}/>
  </View>;
}

// Values are estimates measured from the supplied 360×895 PNG, not Figma tokens.
const styles = StyleSheet.create({
  popup: { height: 220, paddingHorizontal: 11, paddingTop: 27, paddingBottom: 23, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D6D6D6', borderRadius: 12, backgroundColor: '#FFFFFFD9', overflow: 'hidden', boxShadow: '0px 4px 12px #6C9B7410' },
  column: { flex: 1, height: ROW * 3, overflow: 'hidden' },
  selection: { position: 'absolute', top: ROW - 1.5, left: 1, right: 1, height: 59, borderRadius: 12, backgroundColor: '#E8E8E8' },
  scroll: { height: ROW * 3 }, scrollContent: { paddingVertical: ROW },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 30, lineHeight: 40, fontWeight: '500', color: '#C4C4C4' },
  periodValue:{fontSize:25},
  selectedValue: { fontSize: 30, fontWeight: '600', color: '#000' },
  colon: { width: 20, fontSize: 26, lineHeight: 40, fontWeight: '600', color: '#000', textAlign: 'center' },
});
