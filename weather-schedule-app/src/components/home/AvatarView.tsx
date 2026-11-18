import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { characterMotion } from '../../features/avatar/characterMotion';
import type { CharacterDef, Pose } from '../../features/avatar/characterTypes';
import { CharacterImage } from './CharacterImage';

interface AvatarViewProps {
  character: CharacterDef;
  pose: Pose;
  isSpeaking: boolean;
  mouthOpen: boolean;
}

export function AvatarView({ character, pose, isSpeaking, mouthOpen }: AvatarViewProps) {
  const { pose: frame, bounce } = characterMotion(pose, isSpeaking, mouthOpen);
  const translateY = useRef(new Animated.Value(0)).current;

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
    <Animated.View style={[styles.frame, { transform: [{ translateY: bounce ? translateY : 0 }] }]}>
      <CharacterImage characterId={character.id} pose={frame} label={character.name} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 16, right: 16, height: 432, bottom: 66 },
});
