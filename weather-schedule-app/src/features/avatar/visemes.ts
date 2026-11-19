/*
 * 한국어 립싱크 큐 계산. 화면과 무관한 순수 함수만 둔다.
 *  음절의 중성으로 입 모양을 고른다.
 *    a: ㅏ ㅑ ㅓ ㅕ   e: ㅐ ㅒ ㅔ ㅖ ㅙ ㅚ ㅞ   i: ㅡ ㅢ ㅣ
 *    o: ㅗ ㅘ ㅛ      u: ㅜ ㅝ ㅟ ㅠ            m: 받침 ㅁ ㅂ ㅍ   rest: 쉼
 *  'aio' 세트에서는 e를 i로, u를 o로 합친다.
 *  음성 서비스가 글자별 타임스탬프를 주면 그 시간을 쓰고, 없으면 말 속도로 추정한다.
 */
import type { Mouth, MouthCue, MouthSet, SpokenVowel } from './characterTypes.ts';

const VOWEL_A = new Set([0, 2, 4, 6]);
const VOWEL_E = new Set([1, 3, 5, 7, 10, 11, 15]);
const VOWEL_I = new Set([18, 19, 20]);
const VOWEL_O = new Set([8, 9, 12]);
const MERGED: Record<SpokenVowel, SpokenVowel> = { a: 'a', e: 'i', i: 'i', o: 'o', u: 'o' };
const LIP_FINAL = new Set([16, 17, 26]); // 받침 ㅁ ㅂ ㅍ
const minPause = 0.15;

export interface CharTiming { characters: string[]; starts: number[]; ends: number[] }

function isHangul(ch: string) {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}
function decompose(ch: string) {
  const s = ch.charCodeAt(0) - 0xac00;
  return { vowel: Math.floor((s % 588) / 28), final: s % 28 };
}
export function vowelMouth(ch: string, set: MouthSet = 'aio'): Mouth {
  if (!isHangul(ch)) return /[a-zA-Z0-9]/.test(ch) ? 'a' : 'rest';
  const { vowel } = decompose(ch);
  const shape: SpokenVowel = VOWEL_A.has(vowel) ? 'a' : VOWEL_E.has(vowel) ? 'e' : VOWEL_I.has(vowel) ? 'i' : VOWEL_O.has(vowel) ? 'o' : 'u';
  return set === 'aeiou' ? shape : MERGED[shape];
}

/** 한 글자 구간 [start, end] 안의 입 모양 큐 */
function syllableCues(ch: string, start: number, end: number, set: MouthSet): MouthCue[] {
  const cues: MouthCue[] = [{ t: start, mouth: vowelMouth(ch, set) }];
  if (end > start && isHangul(ch) && LIP_FINAL.has(decompose(ch).final)) {
    cues.push({ t: start + (end - start) * 0.75, mouth: 'm' });
  }
  return cues;
}

/** 짧은 구간을 건너뛰면 이전 입 모양이 다음 유효 구간까지 유지된다. */
function tidy(cues: MouthCue[], end: number, minHold = 0.11): MouthCue[] {
  const runs = cues.sort((a, b) => a.t - b.t).filter((cue, index, sorted) =>
    cue.t < end && cue.mouth !== sorted[index - 1]?.mouth,
  );
  const out: MouthCue[] = [];
  for (const [index, cue] of runs.entries()) {
    const hold = (runs[index + 1]?.t ?? end) - cue.t;
    const minimum = cue.mouth === 'rest' ? minPause : minHold;
    if (hold + 1e-9 < minimum || (out.at(-1)?.mouth ?? 'rest') === cue.mouth) continue;
    out.push(cue);
  }
  out.push({ t: end, mouth: 'rest' });
  return out;
}

/** 목소리 서비스가 준 글자별 시간으로 입 모양 큐 만들기 */
export function cuesFromTiming(timing: CharTiming, set: MouthSet = 'aio'): MouthCue[] {
  const cues: MouthCue[] = [];
  let end = 0;
  const n = timing.characters.length;
  for (let i = 0; i < n; i++) {
    const ch = timing.characters[i], s = timing.starts[i] ?? 0, e = timing.ends[i] ?? s + 0.12;
    cues.push(...syllableCues(ch, s, e, set));
    end = Math.max(end, e);
  }
  return tidy(cues, end);
}

/** 시간 정보가 없을 때(기기 기본 목소리 등) 말 빠르기로 추정 */
export function estimateTiming(text: string, rate = 1): CharTiming {
  const characters = Array.from(text);
  const starts: number[] = [], ends: number[] = [];
  let t = 0.08;
  for (const ch of characters) {
    const d = isHangul(ch) ? 0.17 : /[,.!?…~]/.test(ch) ? 0.28 : /\s/.test(ch) ? 0.06 : 0.1;
    starts.push(t); t += d / Math.max(0.5, rate); ends.push(t);
  }
  return { characters, starts, ends };
}

/** 대사 글자와 음원 길이로 입 모양 큐를 추정한다. */
export function estimateMouthCues(text: string, duration: number, set: MouthSet = 'aio') {
  const { characters, starts, ends } = estimateTiming(text);
  const estimate = ends.at(-1) ?? 0;
  const scale = duration > 0 && Number.isFinite(duration) && estimate > 0 ? duration / estimate : 1;
  return cuesFromTiming({
    characters,
    starts: starts.map(time => time * scale),
    ends: ends.map(time => time * scale),
  }, set);
}

/** 지금 시각(초)에 보여 줄 입 모양 */
export function mouthAt(cues: MouthCue[], t: number): Mouth {
  let m: Mouth = 'rest';
  for (const c of cues) { if (c.t <= t) m = c.mouth; else break; }
  return m;
}
