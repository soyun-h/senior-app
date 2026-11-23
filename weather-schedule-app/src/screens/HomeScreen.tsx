import type { BottomTabId } from '../navigation/bottomTabs';
import { useRef, type ComponentRef } from 'react';
import { BlurTargetView } from 'expo-blur';
import { GlassBlurContext } from '../components/home/GlassSurface';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeatherBackground } from '../components/home/WeatherBackground';
import { AvatarView } from '../components/home/AvatarView';
import type { AvatarDefinition } from '../features/avatar/types';
import { HomeText } from '../components/home/HomeText';
import { HomeButton } from '../components/home/HomeButton';
import { ScheduleCard } from '../components/home/ScheduleCard';
import { WeatherMessage } from '../components/home/WeatherMessage';
import { BottomNavigation } from '../components/home/BottomNavigation';
import { useWeather } from '../features/weather/useWeather';
import { useSchedules, useToday } from '../features/schedules/ScheduleProvider';
import { homeSchedules } from '../features/schedules/home';
export function HomeScreen({ avatar, onNavigate }: { avatar?: AvatarDefinition; onNavigate?: (tab: BottomTabId) => void }) {
  const { items, loading, loadError } = useSchedules();
  const today = useToday();
  const schedules = homeSchedules(items, today);
  const openSchedules = () => onNavigate?.('schedule');
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const { weather, notice, credit } = useWeather();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const scale = Math.min(width / 360, availableHeight / 730);
  const canvasHeight = 730;
  return <GlassBlurContext.Provider value={blurTarget}><View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={{ width: 360 * scale, height: canvasHeight * scale, overflow: 'hidden' }}>
      <View style={{ width: 360, height: canvasHeight, transform: [{ scale }], transformOrigin: 'top left' }}>
        <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
          <WeatherBackground condition={weather?.condition ?? 'unknown'}/>
          <AvatarView avatar={avatar}/>
        </BlurTargetView>
        <View style={styles.settings}><HomeButton icon="settings" label="설정"/></View>
        <View style={styles.scheduleSection}>
          <Pressable accessibilityRole="button" accessibilityLabel="오늘의 할 일 목록 보기" onPress={openSchedules}><HomeText style={styles.heading}>오늘의 할 일</HomeText></Pressable>
          <View testID="home-schedules" style={styles.cards}>{!loading && !loadError && schedules.map(schedule => <ScheduleCard key={schedule.id} schedule={schedule} onPress={openSchedules}/>)}
            {(loading || loadError || schedules.length === 0) && <View style={styles.emptyCard}><HomeText accessibilityRole={loadError ? 'alert' : undefined} style={styles.emptyText}>{loading ? '일정을 불러오고 있어요.' : loadError ? '일정을 불러오지 못했어요.' : '오늘 일정이 없어요.'}</HomeText></View>}
          </View>
          <HomeText style={styles.credit}>{credit}</HomeText>
        </View>
        <WeatherMessage weather={weather} notice={notice} displayScale={scale}/>
        <BottomNavigation activeTab="home" onNavigate={onNavigate} enabledTabs={['schedule', 'home']}/>
      </View>
    </View>
  </View></GlassBlurContext.Provider>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EDF1', alignItems: 'center', justifyContent: 'center' },
  settings: { position: 'absolute', top: 46, right: 23 },
  scheduleSection: { position: 'absolute', top: 108, left: 28, right: 28 },
  heading: { fontSize: 17, fontWeight: '700', marginLeft: 8, marginBottom: 7 },
  cards: { flexDirection: 'row', gap: 6 },
  emptyCard: { flex: 1, height: 74, justifyContent: 'center', paddingHorizontal: 18 },
  emptyText: { color: '#5C6260', fontSize: 14, textAlign: 'center' },
  credit: { color: '#FFF', fontSize: 10, marginTop: 7, marginLeft: 8 },
});
