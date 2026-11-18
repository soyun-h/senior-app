/*
 * 한국어 입 모양(립싱크) 계산 — 화면과 무관한 순수 로직
 *  글자(음절)의 모음을 보고 입 모양을 정해요.
 *    a: ㅏ ㅐ ㅑ ㅒ ㅓ ㅕ (크게 벌림)   o: ㅗ ㅛ ㅜ ㅠ ㅘ ㅝ ㅚ ㅟ … (둥글게)
 *    i: ㅣ ㅡ ㅢ ㅔ ㅖ (옆으로)          m: ㅁ ㅂ ㅍ (입술이 잠깐 닫힘)   rest: 쉼(다문 입)
 *  목소리 서비스가 글자별 시간(타임스탬프)을 주면 그 시간에 정확히 맞추고,
 *  없으면 말 빠르기로 시간을 추정해요.
 */
import type { Mouth, MouthCue } from './characterTypes.ts';

const VOWEL_A = new Set([0, 1, 2, 3, 4, 6]);
const VOWEL_I = new Set([5, 7, 18, 19, 20]);
const LIP_INITIAL = new Set([6, 7, 8, 17]); // ㅁ ㅂ ㅃ ㅍ
const LIP_FINAL = new Set([16, 17, 26]); // 받침 ㅁ ㅂ ㅍ

export interface CharTiming { characters: string[]; starts: number[]; ends: number[] }

function isHangul(ch: string) {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3;
}
function decompose(ch: string) {
  const s = ch.charCodeAt(0) - 0xac00;
  return { initial: Math.floor(s / 588), vowel: Math.floor((s % 588) / 28), final: s % 28 };
}
export function vowelMouth(ch: string): Mouth {
  if (!isHangul(ch)) return /[a-zA-Z0-9]/.test(ch) ? 'a' : 'rest';
  const { vowel } = decompose(ch);
  return VOWEL_A.has(vowel) ? 'a' : VOWEL_I.has(vowel) ? 'i' : 'o';
}

/** 한 글자 구간 [start, end] 안의 입 모양 큐 */
function syllableCues(ch: string, start: number, end: number): MouthCue[] {
  if (!isHangul(ch)) {
    if (/[a-zA-Z0-9]/.test(ch)) return [{ t: start, mouth: 'a' }];
    return [{ t: start, mouth: 'rest' }];
  }
  const { initial, final } = decompose(ch);
  const d = Math.max(0.04, end - start);
  const cues: MouthCue[] = [];
  let t = start;
  if (LIP_INITIAL.has(initial)) { cues.push({ t, mouth: 'm' }); t += Math.min(0.08, Math.max(0.06, d * 0.3)); }
  cues.push({ t, mouth: vowelMouth(ch) });
  if (LIP_FINAL.has(final)) cues.push({ t: start + d * 0.75, mouth: 'm' });
  return cues;
}

/** 같은 모양이 이어지면 합치고, 너무 짧은 깜빡임은 없애요 */
function tidy(cues: MouthCue[], minHold = 0.035): MouthCue[] {
  const out: MouthCue[] = [];
  for (const c of cues.sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (last && last.mouth === c.mouth) continue;
    if (last && c.t - last.t < minHold && last.mouth !== 'rest') { last.mouth = c.mouth; continue; }
    out.push({ ...c });
  }
  return out;
}

/** 목소리 서비스가 준 글자별 시간으로 입 모양 큐 만들기 */
export function cuesFromTiming(timing: CharTiming): MouthCue[] {
  const cues: MouthCue[] = [];
  const n = timing.characters.length;
  for (let i = 0; i < n; i++) {
    const ch = timing.characters[i], s = timing.starts[i] ?? 0, e = timing.ends[i] ?? s + 0.12;
    cues.push(...syllableCues(ch, s, e));
  }
  const end = n ? (timing.ends[n - 1] ?? 0) : 0;
  cues.push({ t: end, mouth: 'rest' });
  return tidy(cues);
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

/** 지금 시각(초)에 보여 줄 입 모양 */
export function mouthAt(cues: MouthCue[], t: number): Mouth {
  let m: Mouth = 'rest';
  for (const c of cues) { if (c.t <= t) m = c.mouth; else break; }
  return m;
}
