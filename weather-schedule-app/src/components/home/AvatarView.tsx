import { StyleSheet, View } from 'react-native';
import { imageFor } from '../../features/avatar/characterAssets';
import { legacyMouthPoses } from '../../features/avatar/characterMotion';
import type { CharacterDef, Mouth } from '../../features/avatar/characterTypes';
import type { MouthFrames } from '../../features/avatar/dialogueMedia';
import { CharacterImage } from './CharacterImage';

interface AvatarViewProps {
  character: CharacterDef;
  isSpeaking: boolean;
  mouth: Mouth;
  mouthFrames?: MouthFrames;
}

export function AvatarView({ character, isSpeaking, mouth, mouthFrames }: AvatarViewProps) {
  const mouthFrame = isSpeaking && mouth !== 'rest' && mouth !== 'm'
    ? mouthFrames?.[mouth] ?? imageFor(character.id, legacyMouthPoses[mouth])
    : undefined;

  return (
    <View style={avatarFrameStyle}>
      <CharacterImage characterId={character.id} label={character.name} mouthFrame={mouthFrame} />
    </View>
  );
}

export const avatarFrameStyle = StyleSheet.create({
  frame: { position: 'absolute', left: 4, right: 4, height: 470, bottom: 34 },
}).frame;
