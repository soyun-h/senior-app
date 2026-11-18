import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { hasImage } from './characterAssets';
import { getCharacter } from './characterConfig';
import type { CharacterId } from './characterTypes';
import { homeDemoDialogue, homeDialogue, type HomeDialogueContext } from './homeDialoguePresentation';

export function useHomeDialogue(characterId: CharacterId | undefined, context: Omit<HomeDialogueContext, 'now'>, demo: boolean) {
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

  const demoDialogue = demo ? homeDemoDialogue(context.condition) : undefined;
  const character = getCharacter(demoDialogue?.characterId ?? characterId);
  const { situation, text, pose } = demoDialogue ?? homeDialogue(character.id, { ...context, now });
  const displayPose = pose === 'encourage' && !hasImage(character.id, pose) ? 'wave' : pose;
  return { character, situation, text, pose: displayPose };
}
