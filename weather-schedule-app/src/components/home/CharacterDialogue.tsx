import { StyleSheet, View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { HomeText } from './HomeText';

/** 캐릭터 대사창. 아래쪽 bottom 90 자리는 WeatherMessage가 쓰므로 그 위에 둔다. */
export function CharacterDialogue({ name, text }: { name: string; text: string }) {
  return (
    <View accessible accessibilityLabel={`${name}: ${text}`} style={styles.panel}>
      <GlassSurface strong />
      <HomeText style={styles.text}>{text}</HomeText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 183, left: 28, right: 28, minHeight: 60, borderRadius: 21, borderWidth: 1, borderColor: '#FFFFFFB0', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center' },
  text: { textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '500' },
});
