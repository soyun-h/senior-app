import { useCallback, useEffect, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';

/** waiting: 재생 전(웹 자동 재생이 막힌 경우 포함), speaking: 말하는 중, done: 대사 끝 */
export type SpeechPhase = 'waiting' | 'speaking' | 'done';

export function useHomeDialogueAudio(source: AudioSource) {
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [done, setDone] = useState(false);

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

  const speaking = status.playing && status.currentTime > 0 && !done;
  useEffect(() => {
    if (status.didJustFinish) setDone(true);
  }, [status.didJustFinish]);
  useEffect(() => {
    if (!speaking) return;
    // 웹의 media 요소는 끝에 도달해도 마지막 상태 이벤트를 보내지 않을 때가 있어 직접 확인한다.
    const timer = setInterval(() => {
      if (player.duration > 0 && player.currentTime >= player.duration - 0.05) setDone(true);
    }, 200);
    return () => clearInterval(timer);
  }, [player, speaking]);

  const replay = useCallback(() => {
    setDone(false);
    void player.seekTo(0).then(() => player.play(), () => player.play());
  }, [player]);

  const phase: SpeechPhase = done ? 'done' : speaking ? 'speaking' : 'waiting';
  return { phase, replay };
}
