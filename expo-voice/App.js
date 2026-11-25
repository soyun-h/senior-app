import React, { useEffect } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { greeting, useVoice } from './useVoice';

const home = require('./assets/home.png');
const blankCaption = require('./assets/caption-surface.png');
const designWidth = 360;
const designHeight = 780;

const statusLabels = {
  idle: '대사창을 눌러 대화를 시작하세요',
  speaking: '나비가 말하고 있어요',
  listening: '듣고 있어요',
  thinking: '음성을 글로 바꾸고 있어요',
  error: '대사창을 눌러 다시 시도하세요',
};

function VoiceHome() {
  const voice = useVoice();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = Math.min(width / designWidth, Math.max(1, height - insets.top - insets.bottom) / designHeight);
  const box = (left, top, width, height) => ({
    position: 'absolute',
    left: left * scale,
    top: top * scale,
    width: width * scale,
    height: height * scale,
  });
  const caption = voice.phase === 'heard' ? voice.transcript : voice.line;
  const originalCaption = caption === greeting;
  const buttonLabel = voice.phase === 'listening' ? '음성 입력 끝내기' : '음성 대화 시작';

  useEffect(() => {
    if (voice.errorMessage) Alert.alert('음성 대화', voice.errorMessage);
  }, [voice.errorMessage]);

  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View accessibilityLabel="오느른 메인 홈" style={[styles.frame, { width: designWidth * scale, height: designHeight * scale }]}>
        <Image source={home} accessible={false} resizeMode="contain" style={box(0, 0, designWidth, designHeight)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          accessibilityHint={statusLabels[voice.phase]}
          accessibilityValue={{ text: caption }}
          onPress={voice.press}
          style={[box(28, 551, 304, 86), styles.caption]}>
          {!originalCaption && <Image source={blankCaption} accessible={false} resizeMode="stretch" style={[StyleSheet.absoluteFill, { width: 304 * scale, height: 86 * scale }]} />}
          {!originalCaption && <Text allowFontScaling={false} accessibilityLiveRegion="polite" numberOfLines={2}
            style={[styles.line, { top: 19 * scale, left: 12 * scale, right: 12 * scale, fontSize: 18 * scale, lineHeight: 25 * scale }]}>{caption}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={buttonLabel} onPress={voice.press} style={box(151, 649, 58, 54)} />
      </View>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><VoiceHome /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5ebef' },
  frame: { position: 'relative', overflow: 'hidden', backgroundColor: '#e2e7ea' },
  caption: { overflow: 'hidden' },
  line: { position: 'absolute', color: '#111', textAlign: 'center', fontWeight: '600', includeFontPadding: false },
});
