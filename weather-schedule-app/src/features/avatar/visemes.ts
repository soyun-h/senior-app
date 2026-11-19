/*
 * 한국어 입 모양(립싱크) 계산 — 화면과 무관한 순수 로직
 *  글자(음절)의 모음을 보고 입 모양을 정해요.
 *    a: ㅏ ㅑ ㅓ ㅕ (크게 벌림)   o: ㅗ ㅜ ㅛ ㅠ ㅘ ㅝ ㅟ … (둥글게)
 *    i: ㅣ ㅡ ㅢ ㅔ ㅐ ㅖ … (옆으로)   m: 받침 ㅁ ㅂ ㅍ   rest: 쉼(다문 입)
 *  목소리 서비스가 글자별 시간(타임스탬프)을 주면 그 시간에 정확히 맞추고,
 *  없으면 말 빠르기로 시간을 추정해요.
 */
import type { Mouth, MouthCue } from './characterTypes.ts';

const VOWEL_A = new Set([0, 2, 4, 6]);
const VOWEL_I = new Set([1, 3, 5, 7, 10, 11, 15, 18, 19, 20]);
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
export function vowelMouth(ch: string): Mouth {
  if (!isHangul(ch)) return /[a-zA-Z0-9]/.test(ch) ? 'a' : 'rest';
  const { vowel } = decompose(ch);
  return VOWEL_A.has(vowel) ? 'a' : VOWEL_I.has(vowel) ? 'i' : 'o';
}

/** 한 글자 구간 [start, end] 안의 입 모양 큐 */
function syllableCues(ch: string, start: number, end: number): MouthCue[] {
  const cues: MouthCue[] = [{ t: start, mouth: vowelMouth(ch) }];
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
export function cuesFromTiming(timing: CharTiming): MouthCue[] {
  const cues: MouthCue[] = [];
  let end = 0;
  const n = timing.characters.length;
  for (let i = 0; i < n; i++) {
    const ch = timing.characters[i], s = timing.starts[i] ?? 0, e = timing.ends[i] ?? s + 0.12;
    cues.push(...syllableCues(ch, s, e));
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

export function estimateFiveVowelCues(text: string, duration: number) {
  const { characters, starts, ends } = estimateTiming(text);
  const estimate = ends.at(-1) ?? 0;
  const scale = duration > 0 && Number.isFinite(duration) && estimate > 0 ? duration / estimate : 1;
  return cuesFromTiming({
    characters,
    starts: starts.map(time => time * scale),
    ends: ends.map(time => time * scale),
  });
}

/** 지금 시각(초)에 보여 줄 입 모양 */
export function mouthAt(cues: MouthCue[], t: number): Mouth {
  let m: Mouth = 'rest';
  for (const c of cues) { if (c.t <= t) m = c.mouth; else break; }
  return m;
}
