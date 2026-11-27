import { Pressable, StyleSheet } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { HomeText } from './HomeText';

/** 캐릭터 대사창. 아래쪽 bottom 90 자리는 WeatherMessage가 쓰므로 그 위에 둔다. */
export function CharacterDialogue({ name, text, onPress }: { name: string; text: string; onPress?: () => void }) {
  return (
    <Pressable accessible accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? '말벗 열기' : `${name}: ${text}`}
      accessibilityHint={onPress ? `${name}에게 말을 거는 화면을 열어요. ${text}` : undefined}
      accessibilityLiveRegion="polite" onPress={onPress} style={styles.panel}>
      <GlassSurface strong />
      <HomeText style={styles.text}>{text}</HomeText>
      {onPress && <HomeText style={styles.voice}>말벗 열기</HomeText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 183, left: 28, right: 28, minHeight: 60, borderRadius: 21, borderWidth: 1, borderColor: '#FFFFFFB0', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center', overflow: 'hidden' },
  text: { textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '500' },
  voice: { marginTop: 4, color: '#006954', textAlign: 'center', fontSize: 14, fontWeight: '700' },
});
