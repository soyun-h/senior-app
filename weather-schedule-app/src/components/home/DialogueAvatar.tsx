import type { CharacterDef, HomeDialogueSituation } from '../../features/avatar/characterTypes';
import { characterVoices } from '../../features/avatar/characterVoices';
import { useHomeDialogueAudio } from '../../features/avatar/useHomeDialogueAudio';
import { AvatarView } from './AvatarView';

export function DialogueAvatar({ character, situation }: { character: CharacterDef; situation: HomeDialogueSituation }) {
  useHomeDialogueAudio(characterVoices[character.id][situation]);
  return <AvatarView character={character} />;
}
