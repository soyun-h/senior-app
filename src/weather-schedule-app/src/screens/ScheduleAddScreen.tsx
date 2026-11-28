import { scheduleFonts } from '../components/schedule/scheduleTypography';
import { ScheduleText as Text } from '../components/schedule/ScheduleText';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { ScheduleShell } from '../components/schedule/ScheduleShell';
import { NotificationMethodControl } from '../components/schedule/NotificationMethodControl';
import { ScheduleAsset } from '../components/schedule/ScheduleAsset';
import { RegisterButton, SectionTitle } from '../components/schedule/ScheduleControls';
import { SelectionSurface } from '../components/schedule/SelectionSurface';
import { ScheduleCalendar } from '../components/schedule/ScheduleCalendar';
import { ScheduleTimeWheel } from '../components/schedule/ScheduleTimeWheel';
import { AnchoredPicker, PICKER_GAP } from '../components/schedule/AnchoredPicker';
import { classifyTitle, dateKeyAt, type DateKey, type NotificationMethod, type Schedule, type ScheduleDraft, type Weekday } from '../features/schedules/model';
import { pickerTimeLabel, selectionLabel, type DateSelection } from '../features/schedules/selection';
import { useSchedules } from '../features/schedules/ScheduleProvider';
import type { BottomTabId } from '../navigation/bottomTabs';

const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
export function ScheduleAddScreen({ onBack, onSaved, onNavigate, onSavingChange, existing, initialDate, activeTab = 'schedule' }: {
  onBack: () => void; onSaved: (schedule: Schedule | undefined) => Promise<void>; onNavigate: (tab: BottomTabId) => void;
  onSavingChange: (busy: boolean) => void; existing?: Schedule; initialDate?: DateKey; activeTab?: BottomTabId;
}) {
  const { repository, accept } = useSchedules();
  const rule = existing?.recurrence;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [mode, setMode] = useState<'once' | 'weekly'>(rule?.mode === 'weekly' ? 'weekly' : 'once');
  const [selection, setSelection] = useState<DateSelection>(() => {
    const nextDate = dateKeyAt(Date.now() + 60_000);
    const startDate = rule?.mode === 'once' ? rule.date : rule?.mode === 'range' ? rule.startDate
      : rule?.mode === 'weekly' ? rule.startDate : initialDate && initialDate >= nextDate ? initialDate : nextDate;
    return { startDate, endDate: rule?.mode === 'range' ? rule.endDate : startDate, awaitingEnd: false };
  });
  const [days, setDays] = useState<Weekday[]>(rule?.mode === 'weekly' ? rule.weekdays : []);
  // Use the current minute in KST, with a small future offset, rather than a fixed sample date/time.
  const [time, setTime] = useState(() => {
    if (existing) return { hour: existing.hour, minute: existing.minute };
    const next = new Date(Date.now() + 9 * 3_600_000 + 60_000);
    return { hour: next.getUTCHours(), minute: next.getUTCMinutes() };
  });
  const [pickerTime, setPickerTime] = useState(time);
  const [method, setMethod] = useState<NotificationMethod>(existing ? existing.notificationsEnabled ? existing.notificationMethod : 'none' : 'video-call');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const savingRef = useRef(false);
  const titleInput = useRef<ComponentRef<typeof TextInput>>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollOffset = useRef(0);
  const window = useWindowDimensions();
  const dateAnchor = useRef<ComponentRef<typeof View>>(null);
  const timeAnchor = useRef<ComponentRef<typeof View>>(null);
  const [id] = useState(() => globalThis.crypto?.randomUUID?.() ??
    `schedule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => setError(undefined), [title, mode, selection, days, time, method]);
  function navigate(tab: BottomTabId) { if (!savingRef.current) onNavigate(tab); }
  function closePicker() { if (picker === 'time') setTime(pickerTime); setPicker(null); }
  function openPicker(kind: 'date' | 'time') {
    if (picker === kind) { closePicker(); return; }
    if (kind === 'time') setPickerTime(time);
    titleInput.current?.blur();
    if (kind === 'date') setSelection(previous => ({ ...previous, awaitingEnd: false }));
    const anchor = kind === 'date' ? dateAnchor : timeAnchor;
    anchor.current?.measureInWindow((_x, y, _width, height) => {
      const popupHeight = kind === 'date' ? 340.5 : 220;
      const excess = Math.max(0, y + height + PICKER_GAP + popupHeight + 12 - window.height);
      if (excess) scroll.current?.scrollTo({ y: scrollOffset.current + excess, animated: false });
      requestAnimationFrame(() => setPicker(kind));
    });
  }
  async function save() {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); onSavingChange(true); setError(undefined); setPicker(null);
    try {
      const recurrence: ScheduleDraft['recurrence'] = mode === 'weekly'
        ? { mode: 'weekly', weekdays: days, startDate: rule?.mode === 'weekly' ? rule.startDate : dateKeyAt() }
        : selection.startDate === selection.endDate
          ? { mode: 'once', date: selection.startDate }
          : { mode: 'range', startDate: selection.startDate, endDate: selection.endDate };
      const draft: ScheduleDraft = { title, type: existing?.type ?? classifyTitle(title), recurrence, ...time, reminderMinutes: existing?.reminderMinutes ?? 30, notificationMethod: method };
      const savedId = existing?.id ?? id;
      const items = existing ? await repository.update(savedId, draft) : await repository.create(draft, savedId);
      accept(items);
      await onSaved(items.find(item => item.id === savedId));
    } catch (e) {
      setError(e instanceof Error && /입력|선택|날짜|일정 번호/.test(e.message) ? e.message : existing ? '일정을 수정하지 못했어요. 다시 시도해 주세요.' : '일정을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally { savingRef.current = false; setSaving(false); onSavingChange(false); }
  }
  return <ScheduleShell onNavigate={navigate} activeTab={activeTab} form>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} onScroll={event => { scrollOffset.current=event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={activeTab === 'calendar' ? '달력으로 돌아가기' : '일정 목록으로 돌아가기'} disabled={saving} onPress={onBack} style={styles.back}><ScheduleAsset name="back"/></Pressable>
          <Text accessibilityRole="header" style={styles.title}>{existing ? '일정 수정' : '일정 추가'}</Text>
        </View>
        <View style={styles.titleSection}>
          <SectionTitle>어떤 일정인가요?</SectionTitle>
          <View style={styles.inputRow}>
            <TextInput ref={titleInput} accessibilityLabel="일정 제목" value={title} onChangeText={setTitle} maxLength={80} editable={!saving} style={styles.input}/>
            <Pressable accessibilityRole="button" accessibilityLabel="일정 제목 수정" disabled={saving} onPress={() => titleInput.current?.focus()} style={styles.edit}><ScheduleAsset name="edit"/></Pressable>
          </View>
        </View>
        <View style={styles.whenSection}>
          <SectionTitle offsetY={mode==='once'?11:0}>언제인가요?</SectionTitle>
          <View testID="schedule-when-card" style={styles.panel}>
            <View style={styles.tabs}>
              {([{ id: 'once', label: '날짜 지정' }, { id: 'weekly', label: '요일 반복' }] as const).map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} aria-selected={mode === tab.id} disabled={saving} onPress={() => { setMode(tab.id); setPicker(null); }} style={[styles.tab, mode === tab.id && styles.activeTab]}><Text style={[styles.tabText, mode === tab.id && styles.activeTabText]}>{tab.label}</Text></Pressable>)}
            </View>
            {mode === 'once' ? <View ref={dateAnchor} collapsable={false} style={styles.dateRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="날짜 선택" accessibilityState={{ expanded: picker === 'date' }} disabled={saving} onPress={() => openPicker('date')} style={styles.selector}>
                <ScheduleAsset name="small-calendar"/><Text style={styles.selectorText}>{selectionLabel(selection.startDate, selection.endDate)}</Text><ScheduleAsset name={picker === 'date' ? 'fold' : 'open'}/>
              </Pressable>
            </View> : <View style={styles.weekdays}>{weekdays.map((label, i) => {
              const day = (i + 1) as Weekday, selected = days.includes(day);
              return <Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={`${label}요일 반복`} accessibilityState={{ checked: selected }} aria-checked={selected} disabled={saving} onPress={() => setDays(old => selected ? old.filter(value => value !== day) : [...old, day].sort())} style={styles.day}>
                {selected && <SelectionSurface variant="date"/>}<Text style={[styles.dayText, i === 6 && styles.sunday, selected && styles.selectedDayText]}>{label}</Text>
              </Pressable>;
            })}</View>}
            <View ref={timeAnchor} collapsable={false} style={styles.timeRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="시간 선택" accessibilityState={{ expanded: picker === 'time' }} disabled={saving} onPress={() => openPicker('time')} style={styles.selector}>
                <ScheduleAsset name="alarm" width={16} height={16} alarmTint="#006954"/><Text style={styles.selectorText}>{pickerTimeLabel(time.hour, time.minute)}</Text><ScheduleAsset name={picker === 'time' ? 'fold' : 'open'}/>
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.methodSection}>
          <SectionTitle>어떻게 알려드릴까요?</SectionTitle>
          <View testID="schedule-method-card" style={styles.methods}>
            <View style={styles.methodIcon}><ScheduleAsset name="bell"/></View>
            <NotificationMethodControl value={method} onChange={setMethod} disabled={saving}/>
          </View>
        </View>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <RegisterButton fontSize={18} label={saving ? '저장 중…' : existing ? '수정 완료' : '일정 추가하기'} disabled={saving} onPress={() => void save()}/>
      </ScrollView>
    </KeyboardAvoidingView>
    <AnchoredPicker visible={picker === 'date'} anchor={dateAnchor} onClose={() => setPicker(null)}><ScheduleCalendar selection={selection} onChange={setSelection}/></AnchoredPicker>
    <AnchoredPicker visible={picker === 'time'} anchor={timeAnchor} onClose={closePicker}><ScheduleTimeWheel {...pickerTime} onChange={setPickerTime}/></AnchoredPicker>
  </ScheduleShell>;
}
// Raster measurements (360×895 including 50px system bar); estimates, not Figma tokens.
const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingHorizontal: 28, paddingTop: 47, paddingBottom: 112 },
  header: { height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 42 }, back: { position: 'absolute', left: 0, width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFFCC', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 3px 5px #204C3320' }, title: { fontSize: 30, lineHeight:34, transform:[{translateY:-1}], fontWeight: '700', color: '#000' },
  titleSection: { marginBottom: 33 }, inputRow: { height: 40, flexDirection: 'row', alignItems: 'center', borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6D6D6' }, input: { flex: 1, minWidth: 0, height: 38, fontFamily:scheduleFonts.medium, fontWeight:'normal', includeFontPadding:false, fontSize: 16, lineHeight:20, color: '#333', paddingHorizontal: 11, paddingVertical: 7 }, edit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  whenSection: { marginBottom: 39 }, panel: { height: 188, backgroundColor: '#FFFFFFDC', borderRadius: 12, paddingHorizontal: 17, boxShadow: '0px 4px 18px #6C9B741A' },
  tabs: { height: 52, flexDirection: 'row', borderBottomWidth: 2, borderColor: '#D1D1D1' }, tab: { flex: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent', marginBottom: -2 }, activeTab: { borderColor: '#00765E' }, tabText: { fontSize: 16, color: '#C4C4C4', fontWeight: '500' }, activeTabText: { color: '#00765E',fontWeight:'600' },
  dateRow: { marginTop: 23, height: 40 }, timeRow: { height: 40, marginTop: 9 }, selector: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 9, borderRadius: 10, borderWidth: 1, borderColor: '#D6D6D6', backgroundColor: '#FFFFFF' }, selectorText: { fontSize: 16, lineHeight:20,fontWeight:'500', color: '#006954', flex: 1 },
  weekdays: { height: 34, flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 9 }, day: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderRadius: 10 }, dayText: { fontSize: 16, color: '#666', fontWeight: '600' }, sunday: { color: '#4EA674' }, selectedDayText: { color: '#006954' },
  methodSection: { marginBottom: 39 }, methods: { height: 64, flexDirection: 'row', alignItems: 'center', paddingLeft:17,paddingRight:20.5, backgroundColor: '#FFFFFFDC', borderRadius: 12, boxShadow: '0px 4px 18px #6C9B741A' }, methodIcon:{width:27,height:32,alignItems:'center',justifyContent:'center'},
  error: { color: '#A32727', fontSize: 16, lineHeight: 25, marginBottom: 12 },
});
