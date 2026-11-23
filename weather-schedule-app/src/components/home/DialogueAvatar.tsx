import type { CharacterDef, HomeDialogueSituation, Pose } from '../../features/avatar/characterTypes';
import { characterVoices } from '../../features/avatar/characterVoices';
import { useHomeDialogueAudio } from '../../features/avatar/useHomeDialogueAudio';
import { AvatarView } from './AvatarView';

interface DialogueAvatarProps {
  character: CharacterDef;
  situation: HomeDialogueSituation;
  pose: Pose;
}

export function DialogueAvatar({ character, situation, pose }: DialogueAvatarProps) {
  const { phase, replay } = useHomeDialogueAudio(characterVoices[character.id][situation]);
  return <AvatarView character={character} pose={pose} phase={phase} onPress={replay} />;
}
