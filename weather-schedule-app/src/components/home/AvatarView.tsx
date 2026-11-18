import { StyleSheet } from 'react-native';
import type { CharacterDef, Pose } from '../../features/avatar/characterTypes';
import { CharacterImage } from './CharacterImage';

export function AvatarView({ character, pose }: { character: CharacterDef; pose: Pose }) {
  return <CharacterImage characterId={character.id} pose={pose} label={character.name} style={styles.image} />;
}
const styles = StyleSheet.create({ image: { position: 'absolute', width: 324, height: 432, bottom: 66, alignSelf: 'center' } });
