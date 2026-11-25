import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from 'expo-audio';
import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';
import * as Speech from 'expo-speech';

export const greeting = '오늘의 날씨는 13°C 입니다.\n비가 온다고 하니 우산 꼭 챙기세요.';
const noSpeech = '잘 듣지 못했어요. 다시 한 번 말씀해 주세요.';

function reply(text) {
  if (/힘들|피곤|슬프|아프|우울/.test(text)) return '많이 힘드셨겠어요. 무슨 일이 있었는지 들려주실래요?';
  if (/좋아|좋았|즐거|기쁘|행복/.test(text)) return '기분이 좋으시다니 저도 기뻐요! 무슨 좋은 일이 있으셨어요?';
  if (/식사|밥|점심|저녁|먹었/.test(text)) return '그러셨군요! 오늘 드신 것 중에 뭐가 가장 맛있었어요?';
  if (/고마|감사/.test(text)) return '저도 고마워요. 오늘 기억에 남는 일이 더 있었나요?';
  return '이야기해 주셔서 고마워요. 조금 더 들려주실래요?';
}

function voiceLevel(buffer) {
  const samples = new Int16Array(buffer);
  let power = 0;
  for (let i = 0; i < samples.length; i += 4) power += (samples[i] / 32768) ** 2;
  return Math.sqrt(power / Math.max(1, Math.ceil(samples.length / 4)));
}

async function transcribe(turn) {
  const host = Constants.expoConfig?.hostUri;
  if (!host || !process.env.EXPO_PUBLIC_VOICE_TOKEN) throw new Error('Expo Go에서 실행용 QR을 다시 열어 주세요.');
  const audio = new Uint8Array(turn.frames.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of turn.frames) {
    audio.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  const timeout = setTimeout(() => turn.controller.abort(), 30000);
  try {
    const response = await fetch('http://' + host + '/_oneureun/voice', {
      method: 'POST',
      body: audio,
      signal: turn.controller.signal,
      headers: {
        Authorization: 'Bearer ' + process.env.EXPO_PUBLIC_VOICE_TOKEN,
        'Content-Type': 'application/octet-stream',
        'X-Sample-Rate': String(turn.rate),
        'X-Channels': String(turn.channels),
      },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '음성을 읽을 수 없어요.');
    return result.text;
  } finally {
    clearTimeout(timeout);
  }
}

export function useVoice() {
  const [view, setView] = useState({ phase: 'idle', line: greeting, transcript: '' });
  const current = useRef(null);
  const generation = useRef(0);
  const askingPermission = useRef(false);
  const mounted = useRef(false);
  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
    onBuffer: ({ data, sampleRate, channels }) => {
      const turn = current.current;
      if (!turn?.listening || turn.finishing) return;
      const duration = data.byteLength * 500 / (sampleRate * channels);
      if (turn.rate && (turn.rate !== sampleRate || turn.channels !== channels)) return;
      turn.rate = sampleRate;
      turn.channels = channels;
      turn.elapsed += duration;
      if (voiceLevel(data) >= .018) {
        turn.voiced += duration;
        turn.lastVoice = turn.elapsed;
      }
      if (turn.voiced < 150 && turn.frames.length && turn.elapsed > 600) {
        while (turn.frames.length > 1 && turn.buffered > 450) {
          turn.buffered -= turn.frames.shift().byteLength * 500 / (sampleRate * channels);
        }
      }
      turn.frames.push(data.slice(0));
      turn.buffered += duration;
      if (turn.voiced >= 150 && turn.elapsed - turn.lastVoice >= 900) void finish(turn);
    },
  });

  const stop = async () => {
    generation.current++;
    const turn = current.current;
    current.current = null;
    if (turn) {
      clearTimeout(turn.timer);
      turn.controller.abort();
    }
    await Promise.allSettled([Speech.stop(), stream.stop()]);
  };

  const error = (errorMessage) => setView((previous) => ({ ...previous, phase: 'error', errorMessage }));

  async function listen(turn) {
    if (current.current !== turn) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (current.current !== turn) return;
      turn.listening = true;
      await stream.start();
      if (current.current !== turn) {
        if (!current.current?.listening) await stream.stop();
        return;
      }
      setView((previous) => ({ ...previous, phase: 'listening' }));
      turn.timer = setTimeout(() => { void finish(turn); }, 11000);
    } catch {
      if (current.current === turn) {
        await stop();
        error('마이크를 열 수 없어요. 권한을 확인한 뒤 다시 눌러 주세요.');
      }
    }
  }

  async function say(line, misses = 0) {
    const stopping = stop();
    const run = generation.current;
    await stopping;
    if (!mounted.current || generation.current !== run) return;
    const turn = {
      controller: new AbortController(), frames: [], elapsed: 0, buffered: 0,
      voiced: 0, lastVoice: 0, misses, listening: false, finishing: false,
    };
    current.current = turn;
    setView({ phase: 'speaking', line, transcript: '', errorMessage: '' });
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (current.current !== turn) return;
      const startListening = () => {
        if (current.current !== turn) return;
        clearTimeout(turn.timer);
        turn.timer = setTimeout(() => { void listen(turn); }, 250);
      };
      turn.timer = setTimeout(() => {
        if (current.current !== turn) return;
        void stop();
        error('아바타 음성을 재생하지 못했어요. 다시 눌러 주세요.');
      }, 14000);
      Speech.speak(line.replace('13°C', '13도'), { language: 'ko-KR', rate: .9, onDone: startListening, onError: startListening });
    } catch {
      if (current.current === turn) void listen(turn);
    }
  }

  async function finish(turn) {
    if (current.current !== turn || turn.finishing) return;
    turn.finishing = true;
    turn.listening = false;
    clearTimeout(turn.timer);
    try {
      await stream.stop();
      if (current.current !== turn) return;
      let text = '';
      if (turn.voiced >= 150) {
        setView((previous) => ({ ...previous, phase: 'thinking' }));
        text = await transcribe(turn);
      }
      if (current.current !== turn) return;
      if (text) {
        setView((previous) => ({ ...previous, phase: 'heard', transcript: text }));
        turn.timer = setTimeout(() => {
          if (current.current === turn) void say(reply(text));
        }, 1500);
        return;
      }
      if (!turn.misses) return say(noSpeech, 1);
      current.current = null;
      setView((previous) => ({ ...previous, phase: 'idle', transcript: '' }));
    } catch (cause) {
      if (current.current !== turn) return;
      current.current = null;
      error(cause instanceof TypeError || cause.name === 'AbortError'
        ? '음성 서버에 연결할 수 없어요. 휴대폰과 PC의 Wi-Fi를 확인해 주세요.'
        : cause.message || '음성 인식에 실패했어요. 다시 눌러 주세요.');
    }
  }

  async function begin() {
    if (current.current || askingPermission.current) return;
    askingPermission.current = true;
    setView((previous) => ({ ...previous, errorMessage: '' }));
    const run = generation.current;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!mounted.current || generation.current !== run) return;
      if (!permission.granted) return error('Expo Go에 마이크 권한을 허용한 뒤 다시 눌러 주세요.');
      await say(greeting);
    } catch {
      if (mounted.current && generation.current === run) error('마이크 권한을 확인하지 못했어요. 다시 눌러 주세요.');
    } finally {
      askingPermission.current = false;
    }
  }

  useEffect(() => {
    mounted.current = true;
    void begin();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      void stop();
      setView((previous) => ({ ...previous, phase: 'idle', transcript: '', errorMessage: '' }));
    });
    return () => { mounted.current = false; subscription.remove(); void stop(); };
  }, []);

  const press = () => {
    if (view.phase === 'listening' && current.current) void finish(current.current);
    if (view.phase === 'idle' || view.phase === 'error') void begin();
  };
  return { ...view, press };
}
