import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { CharacterDef, Pose } from '../../features/avatar/characterTypes';
import type { SpeechPhase } from '../../features/avatar/useHomeDialogueAudio';
import { useReducedMotion } from '../../features/avatar/useReducedMotion';
import { CharacterImage } from './CharacterImage';

const useNativeDriver = Platform.OS !== 'web';

interface AvatarViewProps {
  character: CharacterDef;
  /** 대사에 맞는 제스처 자세. 대사가 끝나면 idle로 돌아간다. */
  pose: Pose;
  phase: SpeechPhase;
  onPress?: () => void;
}

/**
 * 홈 캐릭터.
 * 1) 등장: 아래에서 12px 올라오며 나타남(300ms)
 * 2) 말하는 중: 상황 자세를 유지하고 작게 위아래로 움직임(한 번에 450ms)
 * 3) 대사 끝: 기본 자세로 겹쳐 바뀜(300ms), 이후 천천히 떠 있는 움직임(1.6s)
 * 기기의 '동작 줄이기'가 켜져 있으면 움직임 없이 자세만 바꾼다. 설정을 확인하기 전에는 움직임을 시작하지 않는다.
 */
export function AvatarView({ character, pose, phase, onPress }: AvatarViewProps) {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const gesture = useRef(new Animated.Value(pose === 'idle' ? 0 : 1)).current;
  const speaking = phase === 'speaking';

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) enter.setValue(1);
    else Animated.timing(enter, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [enter, reduced]);

  useEffect(() => {
    bob.setValue(0);
    if (reduced !== false) return;
    const half = speaking ? 225 : 1600;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      Animated.timing(bob, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob, reduced, speaking]);

  useEffect(() => {
    const target = pose !== 'idle' && phase !== 'done' ? 1 : 0;
    Animated.timing(gesture, { toValue: target, duration: reduced === false ? 300 : 0, easing: Easing.inOut(Easing.quad), useNativeDriver }).start();
  }, [gesture, phase, pose, reduced]);

  const translateY = Animated.add(
    enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, speaking ? -4 : -2] }),
  );

  return (
    <Animated.View style={[styles.frame, { opacity: enter, transform: [{ translateY }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${character.name}, 누르면 대사를 다시 들려줍니다`}
        disabled={!onPress}
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      >
        <View style={StyleSheet.absoluteFill}>
          <CharacterImage characterId={character.id} label={character.name} />
        </View>
        {pose !== 'idle' && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: gesture }]}>
            <CharacterImage characterId={character.id} pose={pose} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 몸 아래쪽은 하단 내비게이션 뒤로 들어가고, 얼굴은 대사창(bottom 183) 위에 오도록 맞춘 값.
  frame: { position: 'absolute', left: 4, right: 4, height: 470, bottom: 54 },
});
