import { useRef, type ComponentRef } from 'react';
import { BlurTargetView } from 'expo-blur';
import { GlassBlurContext } from '../components/home/GlassSurface';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectWeatherMode } from '../../shared/mode';
import { WeatherBackground } from '../components/home/WeatherBackground';
import { DialogueAvatar } from '../components/home/DialogueAvatar';
import { CharacterDialogue } from '../components/home/CharacterDialogue';
import type { CharacterId } from '../features/avatar/characterTypes';
import { useHomeDialogue } from '../features/avatar/useHomeDialogue';
import { HomeText } from '../components/home/HomeText';
import { HomeButton } from '../components/home/HomeButton';
import { ScheduleCard, type HomeSchedule } from '../components/home/ScheduleCard';
import { BottomNavigation } from '../components/home/BottomNavigation';
import { weatherMessage } from '../features/weather/presentation';
import { useWeather } from '../features/weather/useWeather';
const demoSchedules: HomeSchedule[] = [
  { id: '1', time: '9:00', title: '당뇨약', completed: true },
  { id: '2', time: '10:20', title: '연속극', completed: false },
];
interface HomeScreenProps {
  characterId?: CharacterId;
  schedules?: readonly HomeSchedule[];
}

export function HomeScreen({ characterId, schedules = demoSchedules }: HomeScreenProps) {
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const demo = selectWeatherMode(__DEV__, process.env.EXPO_PUBLIC_WEATHER_MODE) === 'demo';
  const { weather, notice, credit } = useWeather();
  const { character, situation, text } = useHomeDialogue(characterId, { schedules, condition: notice ? undefined : weather?.condition }, demo);
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
          <DialogueAvatar key={`${character.id}:${situation}`} character={character} situation={situation} text={text}/>
        </BlurTargetView>
        <View style={styles.settings}><HomeButton icon="settings" label="설정"/></View>
        <View style={styles.scheduleSection}>
          <HomeText accessibilityRole="header" style={styles.heading}>오늘의 할 일</HomeText>
          <View style={styles.cards}>{schedules.map(schedule => <ScheduleCard key={schedule.id} schedule={schedule}/>)}</View>
          <View style={[styles.weatherDetails, !demo && styles.weatherReport]}>
            <HomeText style={[styles.credit, !demo && styles.liveCredit]}>{credit}</HomeText>
            {!demo && weather && <HomeText style={styles.weatherText}>{weatherMessage(weather)}</HomeText>}
            {!demo && notice && <HomeText style={styles.weatherText}>{notice}</HomeText>}
          </View>
        </View>
        <CharacterDialogue name={character.name} text={text}/>
        <BottomNavigation/>
      </View>
    </View>
  </View></GlassBlurContext.Provider>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EDF1', alignItems: 'center', justifyContent: 'center' },
  settings: { position: 'absolute', top: 46, right: 23 },
  scheduleSection: { position: 'absolute', top: 104, left: 28, right: 28 },
  heading: { fontSize: 17, fontWeight: '700', marginLeft: 8, marginBottom: 7 },
  cards: { flexDirection: 'row', gap: 6 },
  weatherDetails: { marginTop: 5, paddingHorizontal: 8, paddingVertical: 4, gap: 2 },
  credit: { color: '#FFF', fontSize: 10, lineHeight: 13 },
  liveCredit: { color: '#314853' },
  weatherReport: { borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.82)' },
  weatherText: { color: '#243e48', fontSize: 11, lineHeight: 15 },
});
