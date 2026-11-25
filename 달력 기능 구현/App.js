import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, AppState, Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { dayKey, monthDates, monthStart } from './calendarDates.mjs';
import { listPhotoRecords, savePhotoRecord } from './photoRecords';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const dateOutline = require('./assets/date-outline.png');
const dateFill = require('./assets/date-fill.png');
const colors = {
  ink: '#0B0B0B',
  day: '#616161',
  sunday: '#43A574',
  green: '#006954',
  background: '#FFFFFF',
};

function showNotice(message) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(message);
}

function useToday() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timer;
    function updateToday() {
      clearTimeout(timer);
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      setToday(now);
      timer = setTimeout(updateToday, tomorrow.getTime() - now.getTime() + 100);
    }
    updateToday();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') updateToday();
    });
    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, []);

  return today;
}

function MonthArrow({ previous, onPress, styles }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={previous ? '이전 달' : '다음 달'}
      hitSlop={6}
      onPress={onPress}
      style={styles.arrow}
    >
      <View accessible={false} style={[styles.chevron, previous && styles.previousChevron]}>
        <View style={styles.chevronTop} />
        <View style={styles.chevronBottom} />
      </View>
    </Pressable>
  );
}

function RecordPhotos({ photos, scale, styles }) {
  const scroller = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const more = photos.length - 3;
  const widths = [81, 83, 80];

  return (
    <ScrollView
      ref={scroller}
      horizontal
      style={styles.photoScroll}
      contentContainerStyle={styles.photoRow}
      showsHorizontalScrollIndicator={false}
      bounces={false}
      scrollEventThrottle={16}
      onScroll={({ nativeEvent }) => setAtStart(nativeEvent.contentOffset.x < 3 * scale)}
    >
      {photos.map(({ id, source }, index) => {
        const showMore = index === 2 && more > 0 && atStart;
        const thumbStyle = [styles.photo, { width: (widths[index] ?? widths[0]) * scale }];
        const image = (
          <Image
            source={source}
            resizeMode="cover"
            accessible={!showMore}
            accessibilityLabel={`기록 사진 ${index + 1}`}
            style={thumbStyle}
          />
        );
        return showMore ? (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`기록 사진 ${more}장 더 보기`}
            onPress={() => scroller.current?.scrollTo({ x: 254 * scale, animated: true })}
            style={thumbStyle}
          >
            {image}
            <View style={styles.morePhotos}>
              <Text style={styles.moreLabel}>+{more}</Text>
            </View>
          </Pressable>
        ) : <View key={id} style={thumbStyle}>{image}</View>;
      })}
    </ScrollView>
  );
}

function RecordCard({ date, allowCapture, scale, styles }) {
  const key = dayKey(date);
  const [result, setResult] = useState({ photos: [], state: 'loading' });
  const [revision, refresh] = useState(0);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const capturePending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let loaded = [];
    listPhotoRecords(key).then((photos) => {
      loaded = photos;
      if (cancelled) photos.forEach((photo) => photo.release?.());
      else setResult({ photos, state: 'ready' });
    }, () => {
      if (!cancelled) setResult({ photos: [], state: 'error' });
    });
    return () => {
      cancelled = true;
      loaded.forEach((photo) => photo.release?.());
    };
  }, [key, revision]);

  const { photos, state: status } = result;
  const hasPhotos = photos.length > 0;

  async function capturePhoto() {
    if (capturePending.current) return;
    capturePending.current = true;
    setTakingPhoto(true);

    try {
      if (dayKey(new Date()) !== key) {
        showNotice('오늘 날짜를 다시 선택해 주세요.');
        return;
      }
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showNotice('사진을 찍으려면 카메라 접근을 허용해 주세요.');
          return;
        }
      }

      const capture = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (capture.canceled) return;

      const { uri, file } = capture.assets[0];
      await savePhotoRecord({ uri, file, capturedAt: new Date() });
      refresh((value) => value + 1);
    } catch {
      showNotice('사진을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      capturePending.current = false;
      setTakingPhoto(false);
    }
  }

  const title = (
    <Text style={styles.recordDay}>
      {date.getDate()}<Text style={styles.daySuffix}>일</Text>
    </Text>
  );

  return (
    <View style={styles.card}>
      {allowCapture && hasPhotos ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${date.getDate()}일, 기록 사진 추가`}
          onPress={capturePhoto}
          disabled={takingPhoto}
          style={styles.recordTitle}
        >
          {title}
        </Pressable>
      ) : <View style={styles.recordTitle}>{title}</View>}
      {hasPhotos ? (
        <RecordPhotos photos={photos} scale={scale} styles={styles} />
      ) : (
        <View style={styles.photoPlaceholder}>
          {allowCapture && status === 'ready' && (
            <Pressable accessibilityRole="button" onPress={capturePhoto} disabled={takingPhoto}>
              <Text style={styles.captureText}>{takingPhoto ? '사진을 저장하는 중이에요.' : '기록 사진 찍기'}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.recordSummary}>
        {hasPhotos ? (
          <>
            <View accessible={false} style={styles.check} />
            <Text style={styles.summaryText}>
              <Text style={styles.photoCount}>{photos.length}개</Text>의 기록을 확인하세요
            </Text>
          </>
        ) : (
          <Text accessibilityLiveRegion="polite" style={[styles.summaryText, styles.emptyText]}>
            {status === 'loading' ? '기록을 불러오는 중이에요.' : status === 'error'
              ? '기록을 불러오지 못했어요.' : '이날의 기록 사진이 없어요.'}
          </Text>
        )}
      </View>
    </View>
  );
}

export function CalendarScreen() {
  const today = useToday();
  const todayKey = dayKey(today);
  const [month, setMonth] = useState(() => monthStart(today));
  const [selected, setSelected] = useState(null);
  const selectedKey = selected ? dayKey(selected) : null;
  const recordDate = selected ?? today;
  const recordKey = dayKey(recordDate);
  const dates = useMemo(() => monthDates(month), [month]);
  const windowWidth = useWindowDimensions().width;
  const [width, setWidth] = useState(0);
  const scale = (width || windowWidth) / 360;
  const styles = useMemo(() => makeStyles(scale, dates.length / 7), [scale, dates.length]);
  const showRecord = monthStart(recordDate).getTime() === month.getTime();
  const title = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <StatusBar hidden />
      <View style={styles.body} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.page}>
            <LinearGradient
              colors={['#C7E8C1', '#E5F5E2', '#FFFFFF']}
              locations={[0, 0.52, 1]}
              style={styles.gradient}
            />
            <View style={styles.monthHeader}>
              <MonthArrow previous onPress={() => setMonth((value) => monthStart(value, -1))} styles={styles} />
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.month}>{title}</Text>
              <MonthArrow onPress={() => setMonth((value) => monthStart(value, 1))} styles={styles} />
            </View>
            <View style={styles.weekdays}>
              {weekdays.map((day, index) => (
                <Text key={day} style={[styles.weekday, index === 0 && styles.sunday]}>{day}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {dates.map((date, index) => {
                if (!date) return <View key={`empty-${index}`} style={styles.cell} />;
                const key = dayKey(date);
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${title} ${date.getDate()}일${isToday ? ', 오늘' : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    aria-pressed={Platform.OS === 'web' ? isSelected : undefined}
                    aria-current={isToday ? 'date' : undefined}
                    onPress={() => setSelected(date)}
                    style={styles.cell}
                  >
                    <View style={styles.dayCircle}>
                      {isSelected && (
                        <Image
                          source={dateFill}
                          accessible={false}
                          fadeDuration={0}
                          style={styles.dateMarker}
                        />
                      )}
                      <Text style={[
                        styles.dayNumber,
                        index % 7 === 0 && key >= todayKey && styles.sunday,
                        isSelected && styles.selectedNumber,
                      ]}>
                        {date.getDate()}
                      </Text>
                      {isToday && (
                        <Image
                          source={dateOutline}
                          accessible={false}
                          fadeDuration={0}
                          style={styles.dateMarker}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {showRecord && (
              <RecordCard
                key={recordKey}
                date={recordDate}
                allowCapture={recordKey === todayKey}
                scale={scale}
                styles={styles}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><CalendarScreen /></SafeAreaProvider>;
}

function makeStyles(scale, rowCount) {
  const size = (value) => value * scale;
  const extraRow = (rowCount - 5) * 57;
  const column = 318 / 7;
  const text = { includeFontPadding: false };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F0F0F0' },
    body: { flex: 1, backgroundColor: colors.background },
    page: { height: size(729 + extraRow), backgroundColor: colors.background },
    gradient: { position: 'absolute', top: 0, left: 0, right: 0, height: size(153) },
    monthHeader: {
      position: 'absolute', left: size(49), right: size(49), top: size(50),
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    month: { ...text, color: colors.ink, fontSize: size(26), lineHeight: size(34), fontWeight: '700' },
    arrow: {
      width: size(36), height: size(36), borderRadius: size(18), alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#F5FBF4', borderWidth: size(1), borderColor: '#FFFFFF',
      boxShadow: `0px ${size(3)}px ${size(5)}px rgba(43, 115, 63, 0.08)`,
    },
    chevron: { width: size(12), height: size(18), position: 'relative' },
    previousChevron: { transform: [{ rotate: '180deg' }] },
    chevronTop: {
      position: 'absolute', width: size(2), height: size(10), left: size(6), top: size(0.5),
      borderRadius: size(1), backgroundColor: colors.sunday, transform: [{ rotate: '-41deg' }],
    },
    chevronBottom: {
      position: 'absolute', width: size(2), height: size(10), left: size(6), top: size(7.5),
      borderRadius: size(1), backgroundColor: colors.sunday, transform: [{ rotate: '41deg' }],
    },
    weekdays: {
      position: 'absolute', top: size(145), left: size(21), width: size(318),
      flexDirection: 'row',
    },
    weekday: {
      ...text, width: size(column), color: colors.ink, textAlign: 'center',
      fontSize: size(17), lineHeight: size(24), fontWeight: '600',
    },
    sunday: { color: colors.sunday },
    grid: {
      position: 'absolute', left: size(21), top: size(182), width: size(318),
      height: size(rowCount * 56.7), flexDirection: 'row', flexWrap: 'wrap',
    },
    cell: { width: `${100 / 7}%`, height: size(56.7), alignItems: 'center', justifyContent: 'center' },
    dayCircle: {
      height: size(35), width: size(35), alignItems: 'center', justifyContent: 'center',
    },
    dateMarker: { position: 'absolute', top: 0, left: 0, width: size(35), height: size(35) },
    dayNumber: { ...text, color: colors.day, fontSize: size(18), lineHeight: size(22), fontWeight: '700' },
    selectedNumber: { color: colors.green },
    card: {
      position: 'absolute', top: size(483 + extraRow), left: size(28), width: size(304),
      height: size(221), borderRadius: size(12), backgroundColor: '#FFFFFF',
      paddingHorizontal: size(25), paddingTop: size(17),
      boxShadow: `0px 0px ${size(7)}px rgba(17, 54, 34, 0.10)`,
    },
    recordTitle: { height: size(45), alignSelf: 'flex-start' },
    recordDay: {
      ...text, color: colors.green, fontSize: size(30), lineHeight: size(34), fontWeight: '700',
    },
    daySuffix: { fontSize: size(16), fontWeight: '700' },
    photoScroll: { width: size(254), maxHeight: size(110) },
    photoRow: { gap: size(5) },
    photo: {
      height: size(110), borderRadius: size(4), overflow: 'hidden', backgroundColor: '#F0F0F0',
    },
    morePhotos: {
      ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.5)',
      alignItems: 'center', justifyContent: 'center',
    },
    moreLabel: { ...text, color: '#444444', fontSize: size(15), fontWeight: '700' },
    recordSummary: { marginTop: size(9), flexDirection: 'row', alignItems: 'center', gap: size(7) },
    check: {
      width: size(14), height: size(8), borderLeftWidth: size(4), borderBottomWidth: size(4),
      borderRadius: size(2), borderColor: '#399D70', transform: [{ rotate: '-42deg' }, { translateY: -size(1) }],
    },
    summaryText: { ...text, color: '#999999', fontSize: size(16), lineHeight: size(21) },
    photoCount: { color: colors.sunday, fontWeight: '700' },
    photoPlaceholder: { justifyContent: 'center', height: size(110) },
    emptyText: { color: colors.day },
    captureText: { ...text, color: colors.green, fontSize: size(16), fontWeight: '700' },
  });
}
