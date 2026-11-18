import type { WeatherCondition } from '../weather/types.ts';
import type { CharacterId, HomeDialogueSituation, Pose } from './characterTypes.ts';
import { homeDialogueLines } from './homeDialogueLines.ts';

export interface HomeDialogueContext {
  now: Date;
  schedules: readonly { time: string; completed: boolean }[];
  condition?: WeatherCondition;
}

const homePoses: Record<HomeDialogueSituation, Pose> = {
  greeting: 'wave',
  night: 'idle',
  schedulePending: 'encourage',
  scheduleComplete: 'ok',
  rain: 'mouth_o',
  snow: 'mouth_i',
  thunder: 'mouth_a',
};

function selectSituation({ now, schedules, condition }: HomeDialogueContext): HomeDialogueSituation {
  if (condition === 'thunder' || condition === 'snow' || condition === 'rain') return condition;

  const hour = now.getHours();
  if (hour < 6 || hour >= 22) return 'night';
  if (schedules.length && schedules.every(schedule => schedule.completed)) return 'scheduleComplete';

  const minuteOfDay = hour * 60 + now.getMinutes();
  const hasDueSchedule = schedules.some(({ time, completed }) => {
    if (completed || !/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time)) return false;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes <= minuteOfDay;
  });
  return hasDueSchedule ? 'schedulePending' : 'greeting';
}

export function homeDialogue(characterId: CharacterId, context: HomeDialogueContext) {
  const situation = selectSituation(context);
  return {
    situation,
    text: homeDialogueLines[characterId][situation],
    pose: homePoses[situation],
  };
}
