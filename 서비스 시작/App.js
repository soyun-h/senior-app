import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import * as SecureStore from 'expo-secure-store';
import {
  Art, BirthFields, DateWheel, EntryField, FriendCarousel, HEIGHT, Slice, Tap, WIDTH,
  artwork, characters, rect,
} from './Design';
import { EMPTY_BIRTH, STORAGE_KEY, birthDateString, formatPhone, isPhoneNumber, updateBirth } from './onboarding';

function Next({ enabled, onPress }) {
  return <Tap label="다음" x={28} y={625} width={304} height={52} disabled={!enabled} onPress={onPress} />;
}

function Confirmation({ phone, busy, onCancel, onRegister }) {
  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.scrim]}>
      <Slice source={artwork.confirm} x={19} y={265} width={322} height={253} />
      <Text allowFontScaling={false} style={styles.dialogPhone}>{phone}</Text>
      <Text accessibilityLabel="해당 연락처로 등록할까요?" style={styles.invisiblePrompt} />
      <Tap label="취소" x={46} y={452} width={127} height={40} disabled={busy} onPress={onCancel} />
      <Tap label="등록" x={186} y={452} width={127} height={40} disabled={busy} onPress={onRegister} />
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('profile');
  const [showIntro, setShowIntro] = useState(true);
  const [introReady, setIntroReady] = useState(false);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState(EMPTY_BIRTH);
  const [part, setPart] = useState(null);
  const [familyName, setFamilyName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [friendIndex, setFriendIndex] = useState(2);
  const [progress, setProgress] = useState(76);
  const [focusedBottom, setFocusedBottom] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(HEIGHT);
  const [busy, setBusy] = useState(false);
  const narrow = useWindowDimensions().width < WIDTH;
  const introOpacity = useRef(new Animated.Value(1)).current;
  const saved = useRef({});
  const saving = useRef(false);
  const scroll = useRef(null);
  const phoneInput = useRef(null);
  const carousel = useRef(null);
  const centeredDate = useRef(null);
  const initialFriend = useRef(2);
  const finishTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => value ? JSON.parse(value) : {})
      .catch(() => ({}))
      .then((previous) => {
        if (!mounted) return;
        saved.current = previous;
        setName(previous.name ?? '');
        if (previous.birthDate) {
          const [year, month, day] = previous.birthDate.split('-').map(Number);
          setBirth({ year, month, day });
        }
        setFamilyName(previous.family?.name ?? '');
        setPhone(previous.family?.phone ?? '');
        const storedFriend = characters.findIndex(({ id }) => id === previous.characterId);
        if (storedFriend >= 0) {
          initialFriend.current = storedFriend;
          setFriendIndex(storedFriend);
        }
      });
    return () => {
      mounted = false;
      clearTimeout(finishTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!introReady) return;
    let timer;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        Animated.timing(introOpacity, {
          toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }).start(({ finished }) => { if (finished) setShowIntro(false); });
      }, 1500);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      introOpacity.stopAnimation();
    };
  }, [introReady, introOpacity]);

  useEffect(() => {
    if (focusedBottom && viewportHeight < focusedBottom) {
      scroll.current?.scrollTo({ y: focusedBottom - viewportHeight + 12, animated: true });
    }
  }, [focusedBottom, viewportHeight]);

  const changeScreen = (next) => {
    Keyboard.dismiss();
    setFocusedBottom(0);
    setScreen(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const closeDate = (value = centeredDate.current) => {
    if (value != null) setBirth((current) => updateBirth(current, part, value));
    setPart(null);
    centeredDate.current = null;
  };

  const openDate = (nextPart) => {
    Keyboard.dismiss();
    if (part === nextPart) {
      closeDate();
      return;
    }
    if (part) closeDate();
    centeredDate.current = birth[nextPart] ?? { year: 1968, month: 1, day: 1 }[nextPart];
    setPart(nextPart);
  };

  const goBack = () => {
    if (saving.current || screen === 'progress' || showIntro) return true;
    if (confirm) setConfirm(false);
    else if (part) { setPart(null); centeredDate.current = null; }
    else if (screen === 'family') changeScreen('profile');
    else if (screen === 'friends') changeScreen('family');
    else if (screen === 'outro') {
      initialFriend.current = friendIndex;
      changeScreen('friends');
    } else return false;
    return true;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  });

  const persist = async (values) => {
    const record = { ...saved.current, ...values, name: name.trim(), birthDate: birthDateString(birth) };
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(record));
    saved.current = record;
  };

  const enterFriends = async (family) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      await persist(family ? { family } : {});
      setConfirm(false);
      initialFriend.current = friendIndex;
      changeScreen('friends');
    } catch {
      // Keep the current step and its input available for retry.
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const finish = async () => {
    if (saving.current) return;
    saving.current = true;
    setProgress(76);
    changeScreen('progress');
    try {
      await persist({ characterId: characters[friendIndex].id });
      setProgress(100);
      finishTimer.current = setTimeout(() => {
        saving.current = false;
        changeScreen('outro');
      }, 650);
    } catch {
      saving.current = false;
      initialFriend.current = friendIndex;
      changeScreen('friends');
    }
  };

  const profileReady = !!name.trim() && !!birthDateString(birth);
  const familyReady = !!familyName.trim() && isPhoneNumber(phone);
  const source = screen === 'profile'
    ? part ? artwork.date : profileReady ? artwork.profileReady : artwork.profile
    : screen === 'family'
      ? familyReady ? artwork.familyReady : artwork.family
      : artwork[screen];

  const page = (
    <ScrollView ref={scroll} style={styles.scroller} bounces={false} nestedScrollEnabled
      automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}>
      <View style={styles.canvas}>
        <View style={StyleSheet.absoluteFill} importantForAccessibility={confirm ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={confirm}>
          <Art source={source} />
          {['profile', 'family', 'friends'].includes(screen) &&
            <Tap label="뒤로" x={12} y={45} width={55} height={55} onPress={goBack} />}

          {screen === 'profile' && (
            <>
              {part ? (
                <>
                  <Tap label="생년월일 선택" x={65} y={90} width={295} height={245} onPress={() => closeDate()} />
                  <Art source={artwork.wheelBackground} x={110} y={450} width={140} height={276} />
                  <DateWheel key={part} part={part} birth={birth} onValue={(value) => { centeredDate.current = value; }}
                    onPick={closeDate} />
                </>
              ) : (
                <>
                  <EntryField label="이름" y={373} value={name} onChangeText={setName}
                    onFocus={() => setFocusedBottom(425)} onBlur={() => setFocusedBottom(0)}
                    onSubmit={() => openDate('year')} />
                  <Next enabled={profileReady} onPress={() => changeScreen('family')} />
                </>
              )}
              <BirthFields birth={birth} openPart={part} onPress={openDate} />
            </>
          )}

          {screen === 'family' && (
            <>
              <EntryField label="이름" y={373} value={familyName} onChangeText={setFamilyName}
                onFocus={() => setFocusedBottom(425)} onBlur={() => setFocusedBottom(0)}
                onSubmit={() => phoneInput.current?.focus()} />
              <EntryField label="전화번호" y={479} value={phone} onChangeText={(value) => setPhone(formatPhone(value))}
                onFocus={() => setFocusedBottom(531)} onBlur={() => setFocusedBottom(0)} phone inputRef={phoneInput} />
              <Tap label="나중에 등록할게요" x={90} y={563} width={180} height={45} disabled={busy}
                onPress={() => enterFriends(null)} />
              <Next enabled={familyReady && !busy} onPress={() => { Keyboard.dismiss(); setConfirm(true); }} />
            </>
          )}

          {screen === 'friends' && (
            <>
              <FriendCarousel carouselRef={carousel} initial={initialFriend.current} selected={friendIndex} onSelect={setFriendIndex} />
              <Next enabled onPress={finish} />
            </>
          )}
          {screen === 'progress' && progress !== 76 && (
            <>
              <Art source={artwork.progressBackground} x={147} y={379} width={66} height={28} />
              <Text allowFontScaling={false} style={styles.progress}>{progress}%</Text>
            </>
          )}
        </View>
        {confirm && <Confirmation phone={phone} busy={busy} onCancel={() => setConfirm(false)}
          onRegister={() => enterFriends({ name: familyName.trim(), phone })} />}
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar hidden />
      {Platform.OS === 'android' && <NavigationBar hidden />}
      <View style={styles.page} pointerEvents={showIntro ? 'none' : 'auto'}
        accessibilityElementsHidden={showIntro} importantForAccessibility={showIntro ? 'no-hide-descendants' : 'auto'}>
        {narrow ? <ScrollView horizontal bounces={false} keyboardShouldPersistTaps="handled">{page}</ScrollView> : page}
      </View>
      {showIntro && (
        <Animated.View style={[styles.cover, { opacity: introOpacity }]} accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Art source={artwork.intro} onLoadEnd={() => setIntroReady(true)} />
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: '#fff' },
  page: { flex: 1, width: '100%', alignItems: 'center' },
  scroller: { width: WIDTH, flexGrow: 0 },
  canvas: { width: WIDTH, height: HEIGHT, backgroundColor: '#fff' },
  cover: { position: 'absolute', top: 0, width: WIDTH, height: HEIGHT, backgroundColor: '#fff' },
  scrim: { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  dialogPhone: {
    ...rect(69, 360, 222, 35), textAlign: 'center', textAlignVertical: 'center',
    lineHeight: 35, includeFontPadding: false, backgroundColor: '#fff', color: '#00383d',
    fontSize: 20, fontWeight: '700',
  },
  invisiblePrompt: { ...rect(70, 397, 220, 22) },
  progress: {
    ...rect(147, 379, 66, 28), textAlign: 'center', lineHeight: 25,
    includeFontPadding: false, color: 'white', fontSize: 20, fontWeight: '700',
  },
});
