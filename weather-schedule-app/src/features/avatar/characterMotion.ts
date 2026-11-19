import type { CharacterId, Pose, SpokenVowel } from './characterTypes.ts';

const frameDurationMs = 200;

export function isMouthOpen(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds * 1000 / frameDurationMs) % 2 === 0;
}

export const legacyMouthPoses: Record<SpokenVowel, Pose> = {
  a: 'mouth_a', e: 'mouth_i', i: 'mouth_i', o: 'mouth_o', u: 'mouth_o',
};

// Bounds in the original 810 × 1080 idle frame's coordinates.
export const mouthRegions: Record<CharacterId, { x: number; y: number; width: number; height: number }> = {
  char1: { x: 332, y: 505, width: 132, height: 100 },
  char2: { x: 289, y: 500, width: 130, height: 90 },
  char3: { x: 355, y: 563, width: 138, height: 99 },
  char4: { x: 327, y: 501, width: 140, height: 96 },
  char5: { x: 347, y: 484, width: 130, height: 89 },
};
