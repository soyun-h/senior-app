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

interface DemoStep {
  characterId: CharacterId;
  situation: HomeDialogueSituation;
  pose?: Pose;
}

const firstDemoStep: DemoStep = { characterId: 'char1', situation: 'greeting' };
const demoSteps: Partial<Record<WeatherCondition, DemoStep>> = {
  cloudy: { characterId: 'char2', situation: 'night' },
  rain: { characterId: 'char3', situation: 'rain', pose: 'mouth_a' },
  snow: { characterId: 'char4', situation: 'snow', pose: 'ok' },
  thunder: { characterId: 'char5', situation: 'thunder' },
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
  return dialogueFor(characterId, selectSituation(context));
}

export function homeDemoDialogue(condition?: WeatherCondition) {
  const step = demoSteps[condition ?? 'unknown'] ?? firstDemoStep;
  return {
    characterId: step.characterId,
    ...dialogueFor(step.characterId, step.situation, step.pose),
  };
}

function dialogueFor(characterId: CharacterId, situation: HomeDialogueSituation, pose = homePoses[situation]) {
  return {
    situation,
    text: homeDialogueLines[characterId][situation],
    pose,
  };
}
