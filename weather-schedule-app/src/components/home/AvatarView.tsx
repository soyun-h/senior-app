import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { characterMotion } from '../../features/avatar/characterMotion';
import type { CharacterDef, Mouth, Pose } from '../../features/avatar/characterTypes';
import type { MouthFrames } from '../../features/avatar/dialogueMedia';
import { CharacterImage } from './CharacterImage';

interface AvatarViewProps {
  character: CharacterDef;
  pose: Pose;
  isSpeaking: boolean;
  mouth: Mouth;
  mouthFrames?: MouthFrames;
}

export function AvatarView({ character, pose, isSpeaking, mouth, mouthFrames }: AvatarViewProps) {
  const mouthOpen = mouth !== 'rest' && mouth !== 'm';
  const { pose: frame, bounce } = characterMotion(pose, isSpeaking, mouthOpen);
  const mouthFrame = isSpeaking && !bounce && mouthOpen ? mouthFrames?.[mouth] : undefined;
  const [translateY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!bounce) return;
    const options = { easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(translateY, { ...options, toValue: -2.5, duration: 210 }),
      Animated.timing(translateY, { ...options, toValue: 0, duration: 240 }),
    ]));
    motion.start();
    return () => {
      motion.stop();
      translateY.setValue(0);
    };
  }, [bounce, translateY]);

  return (
    <Animated.View style={[avatarFrameStyle, { transform: [{ translateY: bounce ? translateY : 0 }] }]}>
      <CharacterImage characterId={character.id} pose={frame} label={character.name} mouthFrame={mouthFrame} />
    </Animated.View>
  );
}

export const avatarFrameStyle = StyleSheet.create({
  frame: { position: 'absolute', left: 4, right: 4, height: 470, bottom: 34 },
}).frame;
