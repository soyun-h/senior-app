/* 캐릭터 포즈 이미지 연결표. Expo는 require 경로가 리터럴이어야 번들에 포함한다.
 * 새 포즈는 assets/characters/charN/charN_<pose>.jpg로 저장하고 아래 표에 추가한다.
 * 홈 화면은 현재 idle만 표시한다. wave·ok·encourage는 대사 영상을 만들 때 중간 동작 기준 이미지로 쓴다. */
import type { ImageSourcePropType } from 'react-native';
import type { CharacterId, Pose } from './characterTypes';

export const CHARACTER_IMAGES: Record<CharacterId, Partial<Record<Pose, ImageSourcePropType>>> = {
  char1: {
    profile: require('../../../assets/characters/char1/char1_profile.jpg'),
    idle: require('../../../assets/characters/char1/char1_idle.jpg'),
    wave: require('../../../assets/characters/char1/char1_wave.jpg'),
    ok: require('../../../assets/characters/char1/char1_ok.jpg'),
    encourage: require('../../../assets/characters/char1/char1_encourage.jpg'),
    mouth_a: require('../../../assets/characters/char1/char1_mouth_a.jpg'),
    mouth_o: require('../../../assets/characters/char1/char1_mouth_o.jpg'),
    mouth_i: require('../../../assets/characters/char1/char1_mouth_i.jpg'),
  },
  char2: {
    profile: require('../../../assets/characters/char2/char2_profile.jpg'),
    idle: require('../../../assets/characters/char2/char2_idle.jpg'),
    wave: require('../../../assets/characters/char2/char2_wave.jpg'),
    ok: require('../../../assets/characters/char2/char2_ok.jpg'),
    encourage: require('../../../assets/characters/char2/char2_encourage.jpg'),
    mouth_a: require('../../../assets/characters/char2/char2_mouth_a.jpg'),
    mouth_o: require('../../../assets/characters/char2/char2_mouth_o.jpg'),
  },
  char3: {
    profile: require('../../../assets/characters/char3/char3_profile.jpg'),
    idle: require('../../../assets/characters/char3/char3_idle.jpg'),
    wave: require('../../../assets/characters/char3/char3_wave.jpg'),
    ok: require('../../../assets/characters/char3/char3_ok.jpg'),
    mouth_a: require('../../../assets/characters/char3/char3_mouth_a.jpg'),
  },
  char4: {
    profile: require('../../../assets/characters/char4/char4_profile.jpg'),
    idle: require('../../../assets/characters/char4/char4_idle.jpg'),
    wave: require('../../../assets/characters/char4/char4_wave.jpg'),
    ok: require('../../../assets/characters/char4/char4_ok.jpg'),
    mouth_a: require('../../../assets/characters/char4/char4_mouth_a.jpg'),
  },
  char5: {
    profile: require('../../../assets/characters/char5/char5_profile.jpg'),
    idle: require('../../../assets/characters/char5/char5_idle.jpg'),
    wave: require('../../../assets/characters/char5/char5_wave.jpg'),
    ok: require('../../../assets/characters/char5/char5_ok.jpg'),
    mouth_a: require('../../../assets/characters/char5/char5_mouth_a.jpg'),
  },
};

/** 없는 포즈는 대체 포즈로 연결한다. 예: encourage가 없으면 idle. */
const FALLBACK: Partial<Record<Pose, Pose>> = { encourage: 'idle', mouth_o: 'mouth_a', mouth_i: 'mouth_a', mouth_a: 'idle', wave: 'idle', ok: 'idle', profile: 'idle' };
export function hasImage(id: CharacterId, pose: Pose): boolean { return !!CHARACTER_IMAGES[id]?.[pose]; }
export function resolvePose(id: CharacterId, pose: Pose): Pose {
  let current: Pose | undefined = pose;
  for (let i = 0; i < 4 && current; i++) {
    if (hasImage(id, current)) return current;
    current = FALLBACK[current];
  }
  return 'idle';
}
export function imageFor(id: CharacterId, pose: Pose): ImageSourcePropType {
  return CHARACTER_IMAGES[id][resolvePose(id, pose)] as ImageSourcePropType;
}
