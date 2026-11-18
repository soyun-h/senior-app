import { useState } from 'react';
import { View } from 'react-native';
import type { CharacterDef, HomeDialogueSituation, Pose } from '../../features/avatar/characterTypes';
import { characterVoices } from '../../features/avatar/characterVoices';
import { getDialogueMedia, type MouthFrames } from '../../features/avatar/nabiMedia';
import { useHomeDialogueAudio } from '../../features/avatar/useHomeDialogueAudio';
import { AvatarView, avatarFrameStyle } from './AvatarView';
import { DialogueVideo } from './DialogueVideo';

interface DialogueAvatarProps {
  character: CharacterDef;
  situation: HomeDialogueSituation;
  pose: Pose;
  text: string;
}

function AudioAvatar({ character, situation, pose, text, mouthFrames }: DialogueAvatarProps & { mouthFrames?: MouthFrames }) {
  const speech = useHomeDialogueAudio(characterVoices[character.id][situation], mouthFrames ? text : undefined);
  return <AvatarView character={character} pose={pose} mouthFrames={mouthFrames} {...speech} />;
}

export function DialogueAvatar(props: DialogueAvatarProps) {
  const { character, situation } = props;
  const { mouthFrames, video } = getDialogueMedia(character.id, situation);
  const [videoState, setVideoState] = useState<'waiting' | 'playing' | 'ended' | 'failed'>('waiting');

  if (video === undefined || videoState === 'failed') {
    return <AudioAvatar {...props} mouthFrames={mouthFrames} />;
  }

  return (
    <>
      {videoState !== 'playing' && <AvatarView character={character} pose="idle" isSpeaking={false} mouth="rest" />}
      {videoState !== 'ended' && (
        <View style={[avatarFrameStyle, { opacity: videoState === 'playing' ? 1 : 0 }]}>
          <DialogueVideo source={video} label={character.name} onPlaybackState={setVideoState} />
        </View>
      )}
    </>
  );
}
