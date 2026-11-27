import type { AudioSource } from 'expo-audio';
import type { CharacterId, HomeDialogueSituation } from './characterTypes';

// Recorded Korean lines. Expo requires literal asset paths to bundle them.
export const characterVoices: Record<CharacterId, Record<HomeDialogueSituation, AudioSource>> = {
  char1: { // F1
    greeting: require('../../../assets/voices/char1.m4a'),
    night: require('../../../assets/voices/char1_night.m4a'),
    schedulePending: require('../../../assets/voices/char1_schedule_pending.m4a'),
    scheduleComplete: require('../../../assets/voices/char1_schedule_complete.m4a'),
    rain: require('../../../assets/voices/char1_rain.m4a'),
    snow: require('../../../assets/voices/char1_snow.m4a'),
    thunder: require('../../../assets/voices/char1_thunder.m4a'),
  },
  char2: { // F2
    greeting: require('../../../assets/voices/char2.m4a'),
    night: require('../../../assets/voices/char2_night.m4a'),
    schedulePending: require('../../../assets/voices/char2_schedule_pending.m4a'),
    scheduleComplete: require('../../../assets/voices/char2_schedule_complete.m4a'),
    rain: require('../../../assets/voices/char2_rain.m4a'),
    snow: require('../../../assets/voices/char2_snow.m4a'),
    thunder: require('../../../assets/voices/char2_thunder.m4a'),
  },
  char3: { // F3
    greeting: require('../../../assets/voices/char3.m4a'),
    night: require('../../../assets/voices/char3_night.m4a'),
    schedulePending: require('../../../assets/voices/char3_schedule_pending.m4a'),
    scheduleComplete: require('../../../assets/voices/char3_schedule_complete.m4a'),
    rain: require('../../../assets/voices/char3_rain.m4a'),
    snow: require('../../../assets/voices/char3_snow.m4a'),
    thunder: require('../../../assets/voices/char3_thunder.m4a'),
  },
  char4: { // M1
    greeting: require('../../../assets/voices/char4.m4a'),
    night: require('../../../assets/voices/char4_night.m4a'),
    schedulePending: require('../../../assets/voices/char4_schedule_pending.m4a'),
    scheduleComplete: require('../../../assets/voices/char4_schedule_complete.m4a'),
    rain: require('../../../assets/voices/char4_rain.m4a'),
    snow: require('../../../assets/voices/char4_snow.m4a'),
    thunder: require('../../../assets/voices/char4_thunder.m4a'),
  },
  char5: { // M2
    greeting: require('../../../assets/voices/char5.m4a'),
    night: require('../../../assets/voices/char5_night.m4a'),
    schedulePending: require('../../../assets/voices/char5_schedule_pending.m4a'),
    scheduleComplete: require('../../../assets/voices/char5_schedule_complete.m4a'),
    rain: require('../../../assets/voices/char5_rain.m4a'),
    snow: require('../../../assets/voices/char5_snow.m4a'),
    thunder: require('../../../assets/voices/char5_thunder.m4a'),
  },
};
