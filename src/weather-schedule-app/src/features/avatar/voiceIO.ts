import { android } from '../android/bridge';

type Recognition = {
  lang: string;
  start(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const inputErrors: Record<string, string> = {
  'not-allowed': '마이크 권한을 허용한 뒤 다시 말해 주세요.',
  'service-not-allowed': '이 브라우저에서 음성 인식 사용이 제한되어 있어요.',
  'audio-capture': '마이크 연결을 확인해 주세요.',
  'language-not-supported': '이 기기에서 한국어 음성 인식을 사용할 수 없어요.',
  network: '음성 인식에 연결하지 못했어요. 연결을 확인하거나 글로 입력해 주세요.',
};

export async function recognizeKorean(signal: AbortSignal) {
  if (android) return (await android.recognize()).text?.trim();
  if (typeof window === 'undefined' || !window.isSecureContext) {
    throw new Error('마이크는 HTTPS 또는 localhost에서 사용할 수 있어요.');
  }
  const browser = window as Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Recognizer = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!Recognizer) throw new Error('이 브라우저에서 마이크를 열 수 없어요. 글로 입력해 주세요.');
  return new Promise<string | undefined>((resolve, reject) => {
    const input = new Recognizer();
    input.lang = 'ko-KR';
    let heard: string | undefined;
    function finish(error?: string) {
      signal.removeEventListener('abort', stop);
      input.onresult = input.onerror = input.onend = null;
      if (error) reject(new Error(error));
      else resolve(heard);
    }
    function stop() { finish(); input.abort(); }
    input.onresult = event => { heard = event.results[0]?.[0]?.transcript.trim(); };
    input.onend = () => finish();
    input.onerror = ({ error }) => finish(error === 'aborted' || error === 'no-speech' ? undefined
      : inputErrors[error] ?? '음성을 인식하지 못했어요. 다시 말하거나 글로 입력해 주세요.');
    if (signal.aborted) return finish();
    signal.addEventListener('abort', stop, { once: true });
    try { input.start(); }
    catch { finish('마이크를 시작하지 못했어요. 다시 시도해 주세요.'); }
  });
}

export async function speakKorean(text: string, signal: AbortSignal) {
  if (signal.aborted) return;
  const bridge = android;
  if (bridge) {
    const stop = () => { void bridge.stopVoice().catch(() => {}); };
    signal.addEventListener('abort', stop, { once: true });
    try { await bridge.speak({ text }); }
    finally { signal.removeEventListener('abort', stop); }
    return;
  }
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    throw new Error('이 브라우저에서 답변을 소리 내어 읽을 수 없어요.');
  }
  const synth = window.speechSynthesis;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = 'ko-KR';
  speech.rate = 0.9;
  speech.voice = synth.getVoices().find(voice => /^ko(?:[-_]|$)/i.test(voice.lang)) ?? null;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      finish('음성 재생을 완료하지 못했어요.');
      synth.cancel();
    }, Math.max(15000, text.length * 320));
    function finish(error?: string) {
      clearTimeout(timeout);
      signal.removeEventListener('abort', stop);
      speech.onend = speech.onerror = null;
      if (error) reject(new Error(error));
      else resolve();
    }
    function stop() { finish(); synth.cancel(); }
    speech.onend = () => finish();
    speech.onerror = () => finish('한국어 답변을 재생하지 못했어요.');
    signal.addEventListener('abort', stop, { once: true });
    try { synth.speak(speech); }
    catch { finish('음성 재생을 시작하지 못했어요.'); }
  });
}
