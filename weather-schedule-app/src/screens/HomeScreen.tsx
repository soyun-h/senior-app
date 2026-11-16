import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeatherBackground } from '../components/home/WeatherBackground';
import { AvatarView } from '../components/home/AvatarView';
import type { AvatarDefinition } from '../features/avatar/types';
import { HomeText } from '../components/home/HomeText';
import { HomeButton } from '../components/home/HomeButton';
import { ScheduleCard, type HomeSchedule } from '../components/home/ScheduleCard';
import { WeatherMessage } from '../components/home/WeatherMessage';
import { BottomNavigation } from '../components/home/BottomNavigation';
import { useDemoWeather } from '../features/weather/useDemoWeather';
import type { WeatherSnapshot } from '../features/weather/types';
const demoSchedules: HomeSchedule[] = [
  { id: '1', time: '9:00', title: '당뇨약', completed: true },
  { id: '2', time: '10:20', title: '연속극', completed: false },
];
export function HomeScreen({ weather, avatar }: { weather?: WeatherSnapshot; avatar?: AvatarDefinition }) {
  const demoWeather = useDemoWeather();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const scale = Math.min(width / 360, availableHeight / 730);
  const canvasHeight = availableHeight / scale;
  return <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={{ width: 360 * scale, height: availableHeight, overflow: 'hidden' }}>
      <View style={{ width: 360, height: canvasHeight, transform: [{ scale }], transformOrigin: 'top left' }}>
        <WeatherBackground condition={(weather ?? demoWeather).condition}/>
        <View style={styles.settings}><HomeButton icon="settings" label="설정"/></View>
        <View style={styles.scheduleSection}>
          <HomeText accessibilityRole="header" style={styles.heading}>오늘의 할 일</HomeText>
          <View style={styles.cards}>{demoSchedules.map(schedule => <ScheduleCard key={schedule.id} schedule={schedule}/>)}</View>
          <HomeText style={styles.credit}>날씨 정보 제공: 기상청</HomeText>
        </View>
        <AvatarView avatar={avatar}/>
        <WeatherMessage weather={weather ?? demoWeather}/>
        <BottomNavigation/>
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EDF1', alignItems: 'center' },
  settings: { position: 'absolute', top: 46, right: 23 },
  scheduleSection: { position: 'absolute', top: 108, left: 28, right: 28 },
  heading: { fontSize: 17, fontWeight: '700', marginLeft: 8, marginBottom: 10 },
  cards: { flexDirection: 'row', gap: 6 },
  credit: { color: '#FFF', fontSize: 10, marginTop: 7, marginLeft: 8 },
});
