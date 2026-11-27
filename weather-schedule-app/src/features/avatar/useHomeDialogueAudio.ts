import { useCallback, useEffect, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';
import { android } from '../android/bridge';

/** waiting: 재생 전(웹 자동 재생이 막힌 경우 포함), speaking: 말하는 중, done: 대사 끝 */
export type SpeechPhase = 'waiting' | 'speaking' | 'done';

export function useHomeDialogueAudio(source: AudioSource) {
  const player = useAudioPlayer(source, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async (autoplay: boolean) => {
      try {
        const allowed = !android || (await android.voicePlaybackAllowed()).allowed;
        if (!active) return;
        if (!allowed) { player.pause(); setDone(true); }
        else if (autoplay) player.play();
      } catch {
        if (active) setDone(true);
      }
    };
    const ringer = android?.addListener('voiceOutputChanged', () => void check(false));
    const resume = android?.addListener('changed', () => void check(false));
    if (Platform.OS === 'web') void check(true);
    else void setAudioModeAsync({ playsInSilentMode: false }).then(() => check(true), () => check(true));

    return () => {
      active = false;
      void ringer?.then(listener => listener.remove()).catch(() => {});
      void resume?.then(listener => listener.remove()).catch(() => {});
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
    void (async () => {
      if (android && !(await android.voicePlaybackAllowed()).allowed) return;
      setDone(false);
      await player.seekTo(0);
      player.play();
    })().catch(() => {});
  }, [player]);

  const phase: SpeechPhase = done ? 'done' : speaking ? 'speaking' : 'waiting';
  return { phase, replay };
}
