import type { CharacterId, Pose, SpokenVowel } from './characterTypes.ts';

const frameDurationMs = 200;

export function isMouthOpen(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds * 1000 / frameDurationMs) % 2 === 0;
}

/** 입 모양 PNG 세트가 없을 때 쓰는 기존 JPG 포즈. e·u는 가까운 i·o 포즈를 쓴다. */
export const legacyMouthPoses: Record<SpokenVowel, Pose> = {
  a: 'mouth_a', e: 'mouth_i', i: 'mouth_i', o: 'mouth_o', u: 'mouth_o',
};

// 입 모양 레이어를 합성할 영역. 810×1080 idle 프레임 좌표.
export const mouthRegions: Record<CharacterId, { x: number; y: number; width: number; height: number }> = {
  char1: { x: 332, y: 505, width: 132, height: 100 },
  char2: { x: 289, y: 500, width: 130, height: 90 },
  char3: { x: 355, y: 563, width: 138, height: 99 },
  char4: { x: 327, y: 501, width: 140, height: 96 },
  char5: { x: 347, y: 484, width: 130, height: 89 },
};
