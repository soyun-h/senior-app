import { useEffect } from 'react';
import { setAudioModeAsync, useAudioPlayer, type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';

export function useHomeDialogueAudio(source: AudioSource) {
  const player = useAudioPlayer();

  useEffect(() => {
    let active = true;
    const play = () => {
      if (active) player.play();
    };
    const retryAfterInteraction = (event: Event) => {
      if (event.isTrusted && !player.playing && player.currentTime === 0) play();
    };

    player.replace(source);
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
  }, [player, source]);
}
