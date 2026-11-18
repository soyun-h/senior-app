/* 자동 생성 파일: 캐릭터 이미지 연결표 (Expo는 이미지를 require로 미리 묶어야 해요).
 * 새 이미지를 넣으면 assets/characters/charN/charN_<pose>.jpg 로 저장하고 여기에 한 줄 추가하세요. */
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

/** 없는 이미지는 대신할 이미지로 (예: 격려 이미지가 없으면 기본 이미지) */
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
