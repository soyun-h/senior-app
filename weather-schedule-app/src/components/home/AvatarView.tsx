import { Pressable, StyleSheet, View } from 'react-native';
import type { CharacterDef, Pose } from '../../features/avatar/characterTypes';
import type { SpeechPhase } from '../../features/avatar/useHomeDialogueAudio';
import { CharacterImage } from './CharacterImage';

interface AvatarViewProps {
  character: CharacterDef;
  /** 대사에 맞는 자세. 대사가 끝나면 idle로 돌아간다. */
  pose: Pose;
  phase: SpeechPhase;
  onPress?: () => void;
}

/**
 * 홈 캐릭터. 움직임 없이 고정 이미지만 쓴다.
 * 말하는 동안(재생 전 포함) 상황 자세를 보여 주고, 대사가 끝나면 기본 자세로 바로 바꾼다.
 * 캐릭터를 누르면 대사를 처음부터 다시 들려준다.
 */
export function AvatarView({ character, pose, phase, onPress }: AvatarViewProps) {
  const shownPose: Pose = phase === 'done' ? 'idle' : pose;
  return (
    <View style={styles.frame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${character.name}, 누르면 대사를 다시 들려줍니다`}
        disabled={!onPress}
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      >
        <CharacterImage characterId={character.id} pose={shownPose} label={character.name} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // 몸 아래쪽은 하단 내비게이션 뒤로 들어가고, 얼굴은 대사창(bottom 183) 위에 오도록 맞춘 값.
  frame: { position: 'absolute', left: 4, right: 4, height: 470, bottom: 54 },
});
