import { useEffect, useMemo, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';
import { isMouthOpen } from './characterMotion';
import type { Mouth } from './characterTypes';
import { estimateFiveVowelCues, mouthAt } from './visemes';

export function useHomeDialogueAudio(source: AudioSource, dialogueForMouthFrames?: string) {
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const isSpeaking = status.id === player.id && status.playing && status.currentTime > 0
    && !status.isBuffering && !status.didJustFinish;
  const [mouth, setMouth] = useState<Mouth>('rest');
  const cues = useMemo(
    () => dialogueForMouthFrames ? estimateFiveVowelCues(dialogueForMouthFrames, status.duration) : undefined,
    [dialogueForMouthFrames, status.duration],
  );

  useEffect(() => {
    if (!isSpeaking) return;
    const updateFrame = () => {
      const time = player.currentTime;
      setMouth(cues ? mouthAt(cues, time) : isMouthOpen(time) ? 'a' : 'rest');
    };
    updateFrame();
    const timer = setInterval(updateFrame, 50);
    return () => clearInterval(timer);
  }, [cues, isSpeaking, player]);

  useEffect(() => {
    let active = true;
    const play = () => {
      if (active) player.play();
    };
    const retryAfterInteraction = (event: Event) => {
      if (event.isTrusted && !player.playing && player.currentTime === 0) play();
    };

    if (Platform.OS === 'web') {
      // Some browsers require interaction before permitting audible autoplay.
      document.addEventListener('pointerup', retryAfterInteraction, true);
      document.addEventListener('keydown', retryAfterInteraction, true);
      play();
    } else {
      void setAudioModeAsync({ playsInSilentMode: true }).then(play, play);
    }

    return () => {
      active = false;
      if (Platform.OS === 'web') {
        document.removeEventListener('pointerup', retryAfterInteraction, true);
        document.removeEventListener('keydown', retryAfterInteraction, true);
      }
      player.pause();
    };
  }, [player]);

  return { isSpeaking, mouth: isSpeaking ? mouth : 'rest' as const };
}
