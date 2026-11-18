import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { hasImage } from './characterAssets';
import type { CharacterId } from './characterTypes';
import { characterVoices } from './characterVoices';
import { homeDialogue, type HomeDialogueContext } from './homeDialoguePresentation';
import { useHomeDialogueAudio } from './useHomeDialogueAudio';

export function useHomeDialogue(characterId: CharacterId, context: Omit<HomeDialogueContext, 'now'>) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = setInterval(refresh, 30_000);
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      foreground.remove();
    };
  }, []);

  const { situation, text, pose } = homeDialogue(characterId, { ...context, now });
  useHomeDialogueAudio(characterVoices[characterId][situation]);
  const displayPose = pose === 'encourage' && !hasImage(characterId, pose) ? 'wave' : pose;
  return { text, pose: displayPose };
}
