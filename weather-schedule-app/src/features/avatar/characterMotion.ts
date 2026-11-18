import type { Pose } from './characterTypes.ts';

const frameDurationMs = 200;

export function isMouthOpen(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds * 1000 / frameDurationMs) % 2 === 0;
}

export function characterMotion(pose: Pose, isSpeaking: boolean, mouthOpen: boolean): { pose: Pose; bounce: boolean } {
  if (!isSpeaking) return { pose: 'idle', bounce: false };

  // The mouth variants match the body position of the idle photo.
  if (pose === 'idle' || pose === 'mouth_a' || pose === 'mouth_o' || pose === 'mouth_i') {
    const openPose = pose === 'idle' ? 'mouth_a' : pose;
    return { pose: mouthOpen ? openPose : 'idle', bounce: false };
  }

  return { pose, bounce: true };
}
