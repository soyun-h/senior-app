/*
 * 캐릭터 대화 로직. 화면과 무관한 순수 함수로 앱·아바타 서버·테스트가 함께 쓴다.
 *  대사 템플릿 채우기, 인사·날씨 문구, 데모 응답, 대화 모델용 system prompt
 */
import type {
  CallState, CharacterAction, CharacterConfig, CharacterDef, CharacterReply, LineContext, WeatherLike,
} from './characterTypes.ts';
import { guideRulesText, memoryText, personaCardText } from './characterGuide.ts';

export const STATES: CallState[] = ['CALL_INCOMING', 'GREETING', 'LISTENING', 'TALKING', 'AUTH_SUCCESS', 'AUTH_FAIL'];
export const ACTIONS: CharacterAction[] = ['none', 'nod', 'laugh', 'shy', 'worry', 'cheer', 'encourage'];

/** 1, '1', 'char1' 어떤 형태로 와도 'char1' */
export function toCharId(v: unknown): string {
  const n = String(v ?? '').replace(/[^0-9]/g, '');
  return n ? `char${n}` : 'char1';
}
export function findCharacter(config: CharacterConfig, idLike: unknown): CharacterDef {
  const id = toCharId(idLike);
  return config.characters.find(c => c.id === id) ?? config.characters[0];
}

export function skyPhrase(w: WeatherLike = {}): string {
  const k = String(w.condition ?? w.sky ?? '');
  if (/clear|맑/.test(k)) return '맑고';
  if (/thunder|천둥|뇌우/.test(k)) return '천둥이 치고';
  if (/rain|비|소나기/.test(k)) return '비가 오고';
  if (/snow|눈/.test(k)) return '눈이 오고';
  if (/cloud|흐|구름/.test(k)) return '흐리고';
  return '';
}
export function weatherTip(w: WeatherLike = {}): string {
  const given = w.tip ?? w.guidance;
  if (given) return String(given).replace(/[.!]+$/, '');
  const t = Number(w.temp ?? w.temperatureCelsius), sky = String(w.condition ?? w.sky ?? '');
  if (/rain|thunder|비|소나기/.test(sky)) return '나가실 때 우산 꼭 챙기세요';
  if (/snow|눈/.test(sky)) return '길이 미끄러우니 조심하세요';
  if (!Number.isNaN(t) && t <= 5) return '따뜻하게 입고 계세요';
  if (!Number.isNaN(t) && t >= 28) return '물 자주 드시고 시원하게 계세요';
  return '가볍게 산책하기 좋은 날이에요';
}
function tempOf(w?: WeatherLike | null): string {
  const t = Number(w?.temp ?? w?.temperatureCelsius);
  return Number.isNaN(t) ? '' : String(Math.round(t));
}

export function fill(template: string, ctx: LineContext = {}): string {
  const w = ctx.weather ?? null;
  const map: Record<string, string> = {
    '{호칭}': ctx.honorific ?? '할머니',
    '{이름}': ctx.name ?? '',
    '{알람}': ctx.alarmLabel || '약',
    '{날씨}': w ? skyPhrase(w) : '',
    '{기온}': tempOf(w),
    '{날씨팁}': w ? weatherTip(w) : '',
  };
  let out = String(template ?? '');
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  return out.replace(/\s+/g, ' ').trim();
}

const counters: Record<string, number> = {};
export function pick(list: string[] | undefined, key = ''): string {
  if (!list?.length) return '';
  const c = (counters[key] = (counters[key] ?? 0) + 1);
  return list[(c - 1) % list.length];
}

export function stateLine(char: CharacterDef, state: CallState, ctx: LineContext = {}): string {
  const c = { ...ctx, name: char.name };
  if (state === 'GREETING') {
    let text = fill(pick(char.stateLines.GREETING, char.id + 'G'), c);
    if (ctx.weather && skyPhrase(ctx.weather)) text += ' ' + fill(pick(char.stateLines.GREETING_WEATHER, char.id + 'GW'), c);
    return text;
  }
  return fill(pick(char.stateLines[state], char.id + state), c);
}

/** 캐릭터 성격에 맞게 행동을 조정한다. 예: 도윤은 laugh 대신 shy. */
export function personalize(action: unknown, char: CharacterDef): CharacterAction {
  const a = ACTIONS.includes(action as CharacterAction) ? (action as CharacterAction) : 'none';
  if (char.id === 'char5' && (a === 'laugh' || a === 'cheer')) return 'shy';
  if ((char.id === 'char2' || char.id === 'char3') && a === 'cheer') return 'nod';
  return a;
}
export function stateAction(char: CharacterDef, state: CallState): CharacterAction {
  const base: Record<CallState, CharacterAction> = {
    CALL_INCOMING: 'none', GREETING: 'cheer', LISTENING: 'nod', TALKING: 'none', AUTH_SUCCESS: 'cheer', AUTH_FAIL: 'encourage',
  };
  return personalize(base[state], char);
}

const INTENTS: { key: string; re: RegExp; action: CharacterAction; end?: boolean }[] = [
  { key: 'bye', re: /(끊|그만 하|이만|잘 있어|다음에 또|안녕히)/, action: 'none', end: true },
  { key: 'health', re: /(아프|아파|불편|어지러|쑤시|열이|기침|숨이|저려|힘들어)/, action: 'worry' },
  { key: 'not_yet', re: /(안 ?먹|아직|깜빡|잊어|까먹|못 ?먹)/, action: 'nod' },
  { key: 'ask_photo', re: /(먹었|드셨|먹음|먹고 왔|다 먹|챙겨 먹|복용했)/, action: 'cheer' },
  { key: 'remind', re: /약/, action: 'nod' },
  { key: 'meal', re: /(밥|식사|진지|반찬|배고)/, action: 'nod' },
  { key: 'lonely', re: /(심심|외로|적적|혼자|보고 ?싶)/, action: 'worry' },
  { key: 'thanks', re: /(고마|사랑|예쁘|착하|최고)/, action: 'laugh' },
];

/** AI 서버가 없거나 실패했을 때 대사표에서 대답 */
export function demoReply(char: CharacterDef, userText: string, ctx: LineContext = {}): CharacterReply {
  let it = INTENTS.find(i => i.re.test(userText ?? ''));
  if (it?.key === 'ask_photo' && ctx.medTaken) it = { key: 'thanks', re: /./, action: 'laugh' };
  const key = it?.key ?? 'smalltalk';
  const action = personalize(it?.action ?? char.favoriteActions[0] ?? 'none', char);
  const text = fill(pick(char.replyLines[key] ?? char.replyLines.smalltalk, char.id + key), { ...ctx, name: char.name });
  return { text, action, end: !!it?.end, source: 'demo' };
}

export function buildSystemPrompt(config: CharacterConfig, char: CharacterDef, ctx: LineContext = {}): string {
  const c = { ...ctx, name: char.name };
  const w = ctx.weather && skyPhrase(ctx.weather) ? ctx.weather : null;
  return [
    char.systemPrompt,
    `성격: ${char.personality}`,
    `말투: ${char.speechStyle}`,
    `어르신을 "${ctx.honorific ?? '할머니'}"라고 부른다.`,
    '말투 예시:',
    ...['GREETING', 'AUTH_SUCCESS'].map(s => '- ' + fill(char.stateLines[s][0], c)),
    ...['smalltalk', 'health'].map(k => '- ' + fill(char.replyLines[k][0], c)),
    '',
    personaCardText(char.id).split('\n').map(line => fill(line, c)).join('\n'),
    '',
    ctx.medTaken
      ? '상황: 어르신은 오늘 약을 이미 드셨고 사진 인증도 끝났다. 사진을 다시 부탁하지 않고 편하게 안부를 나눈다.'
      : `상황: ${ctx.alarmLabel || '약'} 드실 시간이라 영상통화 중이다. 자연스럽게 약을 권하고, 드셨다고 하면 '약 사진' 버튼으로 보여 달라고 한다.`,
    w ? `오늘 날씨: ${skyPhrase(w)} ${tempOf(w)}도. 필요하면 날씨 이야기를 해도 된다.` : '',
    '반드시 지킬 규칙:',
    ...config.commonRules.map(r => '- ' + r),
    '',
    guideRulesText(),
    '',
    memoryText(ctx.memory),
    '',
    '출력: JSON 한 개만 출력한다.',
    `{"text": "소리 내어 말할 대사", "action": "${ACTIONS.join('|')} 중 하나", "end": false}`,
    `- action은 대사의 감정에 맞게 고른다. 이 캐릭터가 자주 하는 행동: ${char.favoriteActions.join(', ')}`,
    '- 어르신이 통화를 끝내자고 하면 작별 인사를 하고 end를 true로 한다.',
  ].filter(Boolean).join('\n');
}
