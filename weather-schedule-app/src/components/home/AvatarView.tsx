import { StyleSheet, View } from 'react-native';
import type { CharacterDef } from '../../features/avatar/characterTypes';
import { CharacterImage } from './CharacterImage';

export function AvatarView({ character }: { character: CharacterDef }) {
  return (
    <View style={styles.frame}>
      <CharacterImage characterId={character.id} label={character.name} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 4, right: 4, height: 470, bottom: 54 },
});
