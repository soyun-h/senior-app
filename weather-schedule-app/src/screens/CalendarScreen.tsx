import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { RegisterButton } from '../components/schedule/ScheduleControls';
import { ScheduleCalendar } from '../components/schedule/ScheduleCalendar';
import { ScheduleShell } from '../components/schedule/ScheduleShell';
import { ScheduleText as Text } from '../components/schedule/ScheduleText';
import { useAccount } from '../features/account/Account';
import type { CloudCare } from '../features/account/cloudCare';
import { android, photoSource } from '../features/android/bridge';
import { loadRecords, type Proof } from '../features/android/careStorage';
import { formatDate, formatTime, onDate, schedulesForDate, type DateKey, type Schedule } from '../features/schedules/model';
import { useSchedules, useToday } from '../features/schedules/ScheduleProvider';
import { calendarDates, shiftDate } from '../features/schedules/selection';
import type { BottomTabId } from '../navigation/bottomTabs';

const captureTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' });

export function CalendarScreen({ date, onSelect, onAdd, onEdit, onNavigate }: {
  date: DateKey;
  onSelect: (date: DateKey) => void;
  onAdd: () => void;
  onEdit: (schedule: Schedule) => void;
  onNavigate: (tab: BottomTabId) => void;
}) {
  const { items, loading, loadError, reload } = useSchedules();
  const today = useToday();
  const schedules = schedulesForDate(items, date);
  const care = useAccount()?.care;
  const [month, setMonth] = useState(date.slice(0, 7));
  const [photoResult, setPhotoResult] = useState<{ month: string; proofs: Proof[]; error?: string }>();
  const [photoRevision, setPhotoRevision] = useState(0);
  const current = photoResult?.month === month ? photoResult : undefined;
  const photos = current?.proofs.filter(proof => proof.date === date) ?? [];
  const markedDates = new Set(current?.proofs.map(proof => proof.date));

  useEffect(() => {
    const controller = new AbortController();
    const days = calendarDates(month, 'sunday');
    const first = days[0];
    const end = shiftDate(days[days.length - 1], 1);
    const query = care ? care.photosForDates(first, end, controller.signal)
      : loadRecords().then(({ proofs }) => proofs.filter(proof => proof.date >= first && proof.date < end)
        .sort((a, b) => b.savedAt - a.savedAt));
    void query.then(proofs => {
      if (!controller.signal.aborted) setPhotoResult({ month, proofs });
    }).catch(error => {
      if (!controller.signal.aborted) setPhotoResult({ month, proofs: [],
        error: error instanceof Error ? error.message : '사진 기록을 불러오지 못했어요.' });
    });
    return () => controller.abort();
  }, [care, month, photoRevision]);

  function changeMonth(next: string) {
    setMonth(next);
    onSelect(today.startsWith(next) ? today : `${next}-01`);
  }

  return <ScheduleShell activeTab="calendar" onNavigate={onNavigate}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>달력</Text>
      <ScheduleCalendar singleDay selection={{ startDate: date, endDate: date, awaitingEnd: false }}
        onChange={selection => onSelect(selection.startDate)} onMonthChange={changeMonth}
        hasSchedule={day => items.some(item => onDate(item, day))} hasPhoto={day => markedDates.has(day)}/>
      <Text accessibilityRole="header" style={styles.date}>{formatDate(date)}</Text>
      <View style={styles.photoSection}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>인증 사진</Text>
        {!current && <Text style={styles.note}>사진 기록을 불러오고 있어요.</Text>}
        {!!current?.error && <View>
          <Text accessibilityRole="alert" style={styles.error}>{current.error}</Text>
          <Pressable accessibilityRole="button" style={styles.retry} onPress={() => {
            setPhotoResult(undefined);
            setPhotoRevision(value => value + 1);
          }}><Text style={styles.itemTitle}>사진 다시 불러오기</Text></Pressable>
        </View>}
        {current && !current.error && !photos.length && <Text style={styles.note}>이 날짜에 등록된 인증 사진이 없어요.</Text>}
        {!!photos.length && <View style={styles.gallery}>
          {photos.map(proof => <CalendarPhotoCard key={proof.id} proof={proof} care={care}/>)}
        </View>}
      </View>
      {!!loadError && <View>
        <Text accessibilityRole="alert" style={styles.error}>{loadError}</Text>
        <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.retry}><Text style={styles.itemTitle}>다시 불러오기</Text></Pressable>
      </View>}
      {loading && <Text style={styles.note}>일정을 불러오고 있어요.</Text>}
      {!loading && !loadError && !schedules.length && <Text style={styles.note}>이 날짜에 등록된 일정이 없어요.</Text>}
      {schedules.map(schedule => <Pressable key={schedule.id} accessibilityRole="button" onPress={() => onEdit(schedule)} style={styles.item}>
        <Text style={styles.itemTitle}>{schedule.title}</Text>
        <Text style={styles.note}>{formatTime(schedule.hour, schedule.minute)}{schedule.completedDates.includes(date) ? ' · 완료' : ''}</Text>
      </Pressable>)}
      {date >= today && <RegisterButton label="이 날짜에 할 일 추가" onPress={onAdd}/>}
    </ScrollView>
  </ScheduleShell>;
}

function CalendarPhotoCard({ proof, care }: { proof: Proof; care?: CloudCare }) {
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const canOpen = !!(care || android);
  useEffect(() => {
    let active = true;
    let source: string | undefined;
    function release() { if (source?.startsWith('blob:')) URL.revokeObjectURL(source); }
    void (care ? care.photo(proof.id) : android?.photo({ id: proof.id }))?.then(photo => {
      source = photo.uri;
      if (active) setUri(photoSource(source));
      else release();
    }).catch(() => { if (active) setError('사진을 열지 못했어요.'); });
    return () => { active = false; release(); };
  }, [care, proof.id, revision]);

  return <View style={styles.photoCard}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${proof.title} 사진 보기`}
      disabled={!uri || !!error} onPress={() => setExpanded(true)}>
      <View style={styles.thumbnailFrame}>
        {uri && !error && <Image source={{ uri }} resizeMode="cover" style={styles.thumbnail}
          testID="calendar-photo-thumbnail" accessibilityLabel={`${proof.title} 인증 사진`}
          onError={() => setError('사진을 표시하지 못했어요.')}/>}
        {canOpen && !uri && !error && <ActivityIndicator accessibilityLabel="사진 불러오는 중"/>}
        {(!canOpen || error) && <Text style={styles.thumbnailNotice}>{error || 'Android 앱에서 볼 수 있어요.'}</Text>}
      </View>
      <View style={styles.caption}>
        <Text style={styles.itemTitle}>{proof.title}</Text>
        <Text style={styles.note}>{captureTime.format(proof.savedAt)} 촬영</Text>
      </View>
    </Pressable>
    {!!error && <Pressable accessibilityRole="button" accessibilityLabel={`${proof.title} 사진 다시 열기`}
      style={styles.photoRetry} onPress={() => {
        setUri(undefined); setError(undefined); setRevision(value => value + 1);
      }}><Text style={styles.itemTitle}>다시 열기</Text></Pressable>}
    {uri && expanded && <CalendarPhoto proof={proof} uri={uri} onClose={() => setExpanded(false)}/>}
  </View>;
}

function CalendarPhoto({ proof, uri, onClose }: { proof: Proof; uri: string; onClose: () => void }) {
  const { height } = useWindowDimensions();
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={styles.photoDialog}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{proof.title}</Text>
        <Text style={styles.note}>{formatDate(proof.date)} · {captureTime.format(proof.savedAt)} 촬영</Text>
        <Image source={{ uri }} accessibilityLabel="저장된 인증 사진" resizeMode="contain"
          style={[styles.preview, { height: Math.min(360, height * 0.52) }]}/>
        <Pressable accessibilityRole="button" accessibilityLabel="사진 닫기" style={styles.retry} onPress={onClose}>
          <Text style={styles.itemTitle}>닫기</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 108, gap: 14 },
  heading: { color: '#003C40', fontSize: 27, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  date: { color: '#003C40', fontSize: 20, fontWeight: '700', marginTop: 8 },
  photoSection: { gap: 8, marginBottom: 4 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { flexBasis: '48%', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  thumbnailFrame: { width: '100%', aspectRatio: 1, backgroundColor: '#F0F6F1', alignItems: 'center', justifyContent: 'center' },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailNotice: { color: '#374E43', fontSize: 14, textAlign: 'center', padding: 8 },
  caption: { padding: 10, gap: 3 },
  photoRetry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  sectionTitle: { color: '#003C40', fontSize: 18, fontWeight: '700' },
  item: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, gap: 4 },
  itemTitle: { color: '#006954', fontSize: 17, fontWeight: '600' },
  note: { color: '#374E43', fontSize: 15 },
  error: { color: '#8B3F31', fontSize: 16, lineHeight: 23 },
  retry: { minHeight: 44, justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0009' },
  photoDialog: { width: '100%', maxWidth: 440, padding: 20, gap: 10, borderRadius: 14, backgroundColor: '#FFFFFF' },
  preview: { width: '100%', backgroundColor: '#F0F6F1', borderRadius: 8 },
});
