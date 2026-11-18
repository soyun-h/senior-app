import { StyleSheet, View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { HomeText } from './HomeText';

export function CharacterDialogue({ name, text }: { name: string; text: string }) {
  return (
    <View style={styles.panel}>
      <GlassSurface strong />
      <HomeText style={styles.name}>{name}</HomeText>
      <HomeText style={styles.text}>{text}</HomeText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', bottom: 90, left: 28, right: 28, minHeight: 85, borderRadius: 21, borderWidth: 1, borderColor: '#FFFFFFB0', backgroundColor: 'rgba(255,255,255,0.12)', padding: 14, justifyContent: 'center' },
  name: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#245940' },
  text: { textAlign: 'center', fontSize: 17, lineHeight: 24, fontWeight: '500' },
});
