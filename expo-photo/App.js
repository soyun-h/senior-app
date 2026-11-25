import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Alert, Animated, BackHandler, Easing, Image, Linking,
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { savePhotoRecord } from './photoRecords';

const missions = [
  { name: '당뇨약', time: '오전 9:00', message: '9시 당뇨약 복용을 완료했어요!', share: '오전 9:00 당뇨약 복용을 완료했어요!' },
  { name: '연속극', time: '오전 10:20' },
  { name: '경로당 가기', time: '오전 11:00' },
  { name: '아들 방문', time: '오후 06:30' },
];

const notes = [
  '오늘도 건강하게 챙기고 있다는 걸 전해주세요.',
  '약을 잘 드셨다는 소식이 가족에게는 큰 안심이 돼요.',
  '가족들이 오늘도 걱정 없이 지낼 수 있도록 알려주세요.',
  '오늘도 잘 지내고 있다는 반가운 소식을 보내보세요.',
];

const iconPaths = {
  back: 'm15 5-7 7 7 7',
  close: 'm5 5 14 14M19 5 5 19',
  flash: 'm13 2-9 12h7l-1 8 10-12h-7z',
  switch: 'M3 7h4l2-3h6l2 3h4v13H3zM8 13a4 4 0 0 1 7-2m1-2v3h-3M16 15a4 4 0 0 1-7 2m-1 2v-3h3',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3zM16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z',
  check: 'm5 12 4 4 10-10',
  share: 'M12 20V4m-6 6 6-6 6 6',
  sparkle: 'M12 0c0 7 3 10 12 12-9 2-12 5-12 12 0-7-3-10-12-12C9 10 12 7 12 0Z',
};

const box = (u, x, y, width, height) => ({
  position: 'absolute', left: x * u, top: y * u, width: width * u, height: height * u,
});

function Icon({ name, size, color, stroke = 1.8 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d={iconPaths[name]} fill={name === 'sparkle' ? color : 'none'} stroke={name === 'sparkle' ? 'none' : color}
        strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Label({ u, size, weight = '500', color = '#111', style, children, ...props }) {
  return <Text allowFontScaling={false} style={[{ fontSize: size * u, color, fontWeight: weight, includeFontPadding: false }, style]} {...props}>{children}</Text>;
}

function SystemBar({ u, back }) {
  return (
    <View style={{ width: 360 * u, height: 51 * u, backgroundColor: '#efefef' }}>
      {[72, 79, 86].map((x) => <View key={x} style={[box(u, x, 17, 2, 17), { backgroundColor: '#7b7e7c', borderRadius: u }]} />)}
      <View style={[box(u, 171, 17, 17, 17), { borderColor: '#7b7e7c', borderWidth: 2 * u, borderRadius: 6 * u }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="이전 화면" onPress={back} style={[box(u, 255, 3, 44, 44), styles.center]}>
        <Icon name="back" size={25 * u} color="#7b7e7c" />
      </Pressable>
    </View>
  );
}

function CameraStage({ u, onCaptured, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const camera = useRef(null);
  const active = useRef(true);
  const capturing = useRef(false);
  const permissionAsked = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (permission?.granted || !permission?.canAskAgain || permissionAsked.current) return;
    permissionAsked.current = true;
    requestPermission().catch(() => setError('카메라 권한을 확인할 수 없어요.'));
  }, [permission, requestPermission]);

  function switchCamera() {
    if (capturing.current) return;
    setError('');
    setReady(false);
    setTorch(false);
    setFacing((value) => value === 'back' ? 'front' : 'back');
  }

  async function capture() {
    if (!camera.current || !ready || capturing.current) return;
    capturing.current = true;
    setSending(true);
    try {
      const result = await camera.current.takePictureAsync({ quality: .92 });
      if (!result?.uri) throw new Error('Camera did not produce a photo.');
      if (active.current) onCaptured({ uri: result.uri, at: new Date() });
    } catch {
      if (active.current) setError('사진을 찍지 못했어요. 다시 눌러 주세요.');
    } finally {
      capturing.current = false;
      if (active.current) setSending(false);
    }
  }

  const guideColor = 'rgba(255,255,255,.75)';
  const corner = { borderColor: guideColor };
  return (
    <View style={[styles.camera, { height: 729 * u }]}>
      {permission?.granted && <CameraView
        key={facing} ref={camera} facing={facing} enableTorch={torch} mode="picture" style={StyleSheet.absoluteFill}
        onCameraReady={() => setReady(true)}
        onMountError={() => { setReady(false); setError('이 카메라를 열 수 없어요. 카메라를 바꾸거나 권한을 확인해 주세요.'); }} />}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,.24)' }]} />
      {[
        ['switch', '카메라 전환', 18, 43, switchCamera],
        ['flash', '플래시', 157, 43, () => { if (ready && facing === 'back') setTorch((value) => !value); }],
        ['close', '닫기', 295, 39, onClose],
      ].map(([icon, label, x, y, action]) => (
        <Pressable key={icon} accessibilityRole="button" accessibilityLabel={label}
          onPress={action} style={[box(u, x, y, 54, 48), styles.center]}>
          <Icon name={icon} size={33 * u} color="white" />
        </Pressable>
      ))}
      <Label u={u} size={29} weight="700" color="white" style={[box(u, 0, 153, 360, 44), styles.textCenter]}>사진 기록 촬영</Label>
      <View pointerEvents="none" style={[box(u, 39, 249, 285, 275), styles.center]}>
        <View style={[box(u, 0, 0, 33, 33), corner, { borderTopWidth: 4 * u, borderLeftWidth: 4 * u }]} />
        <View style={[box(u, 252, 0, 33, 33), corner, { borderTopWidth: 4 * u, borderRightWidth: 4 * u }]} />
        <View style={[box(u, 0, 242, 33, 33), corner, { borderBottomWidth: 4 * u, borderLeftWidth: 4 * u }]} />
        <View style={[box(u, 252, 242, 33, 33), corner, { borderBottomWidth: 4 * u, borderRightWidth: 4 * u }]} />
        <Label u={u} size={23} weight="700" color={guideColor}>네모 안에 맞춰주세요</Label>
      </View>
      {permission?.granted === false && (
        <Pressable accessibilityRole="button" style={[box(u, 28, 540, 304, 44), styles.center]} onPress={() => {
          const action = permission.canAskAgain ? requestPermission : Linking.openSettings;
          action().catch(() => setError('설정에서 카메라 권한을 확인해 주세요.'));
        }}>
          <Label u={u} size={15} weight="700" color="white">{permission.canAskAgain ? '카메라 권한 허용' : '설정에서 카메라 권한 허용'}</Label>
        </Pressable>
      )}
      {error ? <Label u={u} size={14} color="white" style={[box(u, 20, 580, 320, 46), styles.textCenter]}>{error}</Label> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="사진 촬영" disabled={!ready || sending}
        onPress={capture} style={[box(u, 135.5, 593, 89, 89), styles.center]}>
        <LinearGradient colors={['#289367', '#63ac7a', '#c5edbf']} style={[StyleSheet.absoluteFill, { borderRadius: 45 * u }]} />
        <View style={[styles.center, { width: 75 * u, height: 75 * u, borderRadius: 38 * u, backgroundColor: 'white' }]}>
          <Icon name="camera" size={47 * u} color="#43a570" />
        </View>
      </Pressable>
    </View>
  );
}

function ReviewStage({ u, photo, selected, setSelected, retake, register }) {
  return (
    <View style={{ height: 934 * u }}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로가기" onPress={retake}
        style={[box(u, 29, 47, 47, 47), styles.center, styles.surface, { borderRadius: 24 * u, zIndex: 1 }]}>
        <Icon name="back" size={29 * u} color="#777b78" />
      </Pressable>
      <View pointerEvents="none" style={[box(u, 76, 47, 208, 48), styles.center]}>
        <Label u={u} size={29} weight="700">기록하기</Label>
      </View>
      <View style={[box(u, 29, 168, 303, 301), { borderRadius: 10 * u, overflow: 'hidden', backgroundColor: '#eef3ee' }]}>
        <Image source={{ uri: photo.uri }} accessibilityLabel="기록할 사진" resizeMode="cover" style={StyleSheet.absoluteFill} />
        <Pressable accessibilityRole="button" onPress={retake} style={[box(u, 16, 16, 106, 29), styles.row, styles.center,
          { borderRadius: 16 * u, backgroundColor: 'rgba(255,255,255,.8)', gap: 5 * u }]}>
          <Icon name="camera" size={17 * u} color="#555" />
          <Label u={u} size={15} color="#555">재촬영</Label>
        </Pressable>
      </View>
      <View style={[box(u, 29, 502, 304, 24), styles.row, { gap: 6 * u }]}>
        <Icon name="check" size={17 * u} color="#348a65" stroke={4} />
        <Label u={u} size={17} weight="700">무엇을 수행했나요?</Label>
      </View>
      {missions.map((mission, index) => {
        const checked = selected === index;
        return (
          <Pressable key={mission.name} accessibilityRole="radio" accessibilityState={{ checked }}
            accessibilityLabel={mission.name + ' ' + mission.time} onPress={() => setSelected(index)}
            style={[box(u, 29, 542 + index * 60, 304, 52), styles.row, { borderRadius: 10 * u, overflow: 'hidden', paddingHorizontal: 19 * u }]}>
            <LinearGradient colors={checked ? ['#c6e8c2', '#a8d9a3'] : ['#f5f5f5', '#fafafa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.center, { width: 24 * u, height: 24 * u, borderRadius: 12 * u, borderWidth: 1.5 * u,
              borderColor: checked ? '#47a172' : '#808781', backgroundColor: checked ? '#47a172' : 'white' }]}>
              {checked && <Icon name="check" size={17 * u} color="white" stroke={3.5} />}
            </View>
            <Label u={u} size={17} weight="700" color={checked ? '#05483d' : '#727673'} style={{ marginLeft: 24 * u, flex: 1 }}>{mission.name}</Label>
            <Label u={u} size={15.5} color={checked ? '#328867' : '#929592'}>{mission.time}</Label>
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" disabled={selected === null} onPress={register}
        style={[box(u, 29, 824, 303, 53), styles.center, styles.surface, { borderRadius: 27 * u, opacity: selected === null ? .48 : 1 }]}>
        <LinearGradient colors={['#459f72', '#75c37a']} locations={[.35, 1]} style={[StyleSheet.absoluteFill, { borderRadius: 27 * u }]} />
        <Label u={u} size={17} weight="700" color="white">등록하기</Label>
      </Pressable>
    </View>
  );
}

const sparkles = [[266, 296, 16, 22], [281, 284, 6, 6], [296, 269, 5, 5],
  [50, 379, 16, 22], [79, 361, 10, 10], [67, 355, 5, 5]];

function useCompletionMotion(u) {
  const arrival = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let loop;
    const animate = (reduced) => {
      if (!active) return;
      arrival.stopAnimation();
      loop?.stop();
      if (reduced) {
        arrival.setValue(1);
        shimmer.setValue(0);
        return;
      }
      arrival.setValue(0);
      Animated.timing(arrival, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }).start();
      shimmer.setValue(0);
      loop = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 1650, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
      loop.start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(animate, () => animate(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', animate);
    return () => { active = false; subscription.remove(); arrival.stopAnimation(); loop?.stop(); };
  }, [arrival, shimmer]);

  const map = (times, values) => arrival.interpolate({ inputRange: times, outputRange: values });
  const beat = [0, .06, .18, .42, .61, .79, 1];
  const bounce = (distance) => ({
    opacity: map(beat, [0, 0, .85, 1, 1, 1, 1]),
    transform: [
      { translateY: map(beat, [22, 22, 18, -12, 4, -3, 0].map((n) => n * u * distance)) },
      { scaleX: map(beat, [.58, .58, .83, .98, 1.045, .99, 1]) },
      { scaleY: map(beat, [.38, .38, .62, 1.1, .955, 1.021, 1]) },
    ],
  });
  const paper = (start, x, angle, opacity) => {
    const times = [0, start, .52, .72, 1];
    return {
      opacity: map(times, [0, 0, opacity, opacity, opacity]),
      transform: [
        { translateX: map(times, [0, 0, x * .42, x * 1.12, x].map((n) => n * u)) },
        { translateY: map(times, [14, 14, -7, 2, 0].map((n) => n * u)) },
        { rotate: map(times, [0, 0, angle * .55, angle * 1.45, angle].map((n) => n + 'deg')) },
      ],
    };
  };
  const sparkleScale = (index) => {
    const offset = index / 6;
    const value = (t) => .55 + .85 * (.5 - .5 * Math.cos(2 * Math.PI * (t + offset)));
    const points = [0, .25, .5, .75, 1];
    return shimmer.interpolate({ inputRange: points, outputRange: points.map(value) });
  };
  return { bounce, paper, sparkleScale };
}

function CompleteStage({ u, uri, mission, note }) {
  const { bounce, paper, sparkleScale } = useCompletionMotion(u);
  const message = mission.message || mission.time + ' ' + mission.name + ' 완료했어요!';
  const shareMessage = mission.share || message;
  const shareOpen = useRef(false);

  async function sharePicture() {
    if (shareOpen.current) return;
    shareOpen.current = true;
    try {
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert('공유할 수 없어요', '이 기기에서는 문구 복사를 사용할 수 있어요.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: '가족에게 기록 사진 보내기' });
    } catch {
      Alert.alert('공유할 수 없어요', '잠시 후 다시 눌러 주세요.');
    } finally {
      shareOpen.current = false;
    }
  }

  function share() {
    Alert.alert('가족 공유', '기록 사진을 보내거나 문구를 복사할 수 있어요.', [
      { text: '문구 복사', onPress: () => {
        Clipboard.setStringAsync(shareMessage, { android: { isSensitive: true } })
          .then(() => Alert.alert('기록 문구를 복사했어요.'))
          .catch(() => Alert.alert('문구를 복사하지 못했어요.'));
      } },
      { text: '사진 공유', onPress: sharePicture },
      { text: '닫기', style: 'cancel' },
    ]);
  }

  const card = box(u, 104, 233, 151, 197);
  return (
    <View style={{ height: 729 * u }}>
      <Animated.View style={[card, { borderRadius: 11 * u, backgroundColor: '#f0f6ef' }, paper(.3, -24, -14, .7)]} />
      <Animated.View style={[card, { borderRadius: 11 * u, backgroundColor: '#e7f2e5' }, paper(.24, -12, -8, 1)]} />
      <Animated.Image source={{ uri }} accessibilityLabel="기록 완료 사진" resizeMode="cover"
        style={[card, { borderRadius: 9 * u }, bounce(1)]} />
      {sparkles.map(([x, y, width, height], index) => (
        <Animated.View key={x} pointerEvents="none" style={[box(u, x, y, width, height), styles.center,
          { transform: [{ scale: sparkleScale(index) }] }]}>
          {width === 16 ? <Icon name="sparkle" size={width * u} color="#7ec492" />
            : <View style={[StyleSheet.absoluteFill, { borderRadius: height * u, backgroundColor: '#b8e2b4' }]} />}
        </Animated.View>
      ))}
      <Animated.View style={[box(u, 0, 459, 360, 32), styles.center, bounce(.58)]}>
        <Label u={u} size={24} weight="800" color="#006957">기록 완료!</Label>
      </Animated.View>
      <View style={[box(u, 28, 517, 304, 157), styles.surface, { borderRadius: 22 * u }]}>
        <Label u={u} size={16} weight="700" style={[box(u, 16, 24, 272, 24), styles.textCenter]}>명숙(큰딸)님에게 공유해보아요</Label>
        <Label u={u} size={11.5} color="#727773" numberOfLines={1} style={[box(u, 16, 56, 272, 18), styles.textCenter]}>{note}</Label>
        <Pressable accessibilityRole="button" accessibilityLabel="가족 공유" onPress={share}
          style={[box(u, 16, 89, 272, 35), styles.row, { gap: 8 * u }]}>
          <View style={[styles.center, { flex: 1, height: 35 * u, borderRadius: 25 * u, backgroundColor: '#f0f0f0' }]}>
            <Label u={u} size={14.5} weight="600" numberOfLines={1}>{message}</Label>
          </View>
          <LinearGradient colors={['#3caa75', '#ccebc5']} style={[styles.center, { width: 34 * u, height: 34 * u, borderRadius: 17 * u }]}>
            <Icon name="share" size={20 * u} color="white" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function PhotoFlow() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const u = Math.min(width, 430) / 360;
  const scroll = useRef(null);
  const [step, setStep] = useState('camera');
  const [photo, setPhoto] = useState(null);
  const [selected, setSelected] = useState(null);
  const [savedRecords, setSavedRecords] = useState({});
  const [note, setNote] = useState('');
  const registering = useRef(false);

  function retake() {
    setPhoto(null);
    setSelected(null);
    setSavedRecords({});
    setStep('camera');
  }

  function back() {
    if (step === 'complete') setStep('review');
    else if (step === 'review') retake();
    else if (step === 'camera') setStep('closed');
    else return false;
    return true;
  }

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    const subscription = BackHandler.addEventListener('hardwareBackPress', back);
    return () => subscription.remove();
  }, [step]);

  function register() {
    if (selected === null || !photo || registering.current) return;
    registering.current = true;
    try {
      if (!savedRecords[selected]) {
        const uri = savePhotoRecord(photo.uri, photo.at, missions[selected]);
        setSavedRecords((previous) => ({ ...previous, [selected]: uri }));
      }
      setNote(notes[Math.floor(Math.random() * notes.length)]);
      setStep('complete');
    } catch {
      Alert.alert('사진을 저장하지 못했어요.', '저장 공간을 확인한 뒤 다시 눌러 주세요.');
    } finally {
      registering.current = false;
    }
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <ScrollView ref={scroll} style={{ width: 360 * u }} showsVerticalScrollIndicator={false}>
        {step === 'camera' && <CameraStage u={u} onClose={back} onCaptured={(value) => { setPhoto(value); setStep('review'); }} />}
        {step === 'review' && <ReviewStage u={u} photo={photo} selected={selected} setSelected={setSelected} retake={retake} register={register} />}
        {step === 'complete' && <CompleteStage u={u} uri={savedRecords[selected]} mission={missions[selected]} note={note} />}
        {step === 'closed' && <View style={[styles.center, { height: 729 * u }]}>
          <Pressable accessibilityRole="button" onPress={retake} style={{ backgroundColor: '#31815b', borderRadius: 26 * u, padding: 16 * u }}>
            <Label u={u} size={18} weight="700" color="white">사진 기록 촬영 시작</Label>
          </Pressable>
        </View>}
        {step !== 'closed' && <SystemBar u={u} back={back} />}
      </ScrollView>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><PhotoFlow /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: '#fdfdfd' },
  center: { alignItems: 'center', justifyContent: 'center' },
  textCenter: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  camera: { backgroundColor: '#252d28' },
  surface: { backgroundColor: '#fff', elevation: 2, shadowColor: '#293f32', shadowOpacity: .12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
