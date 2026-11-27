import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { demoReply, findCharacter, personalize, stateAction, stateLine, buildSystemPrompt } from '../src/features/avatar/characterBrain.ts';

const config = JSON.parse(readFileSync(new URL('../src/features/avatar/characters.json', import.meta.url), 'utf8'));

test('characters.json has five characters with every state line', () => {
  assert.equal(config.characters.length, 5);
  for (const c of config.characters) for (const s of ['CALL_INCOMING', 'GREETING', 'GREETING_WEATHER', 'LISTENING', 'AUTH_SUCCESS', 'AUTH_FAIL']) assert.ok(c.stateLines[s]?.length, `${c.id} ${s}`);
});
test('greeting fills honorific, alarm and weather from a WeatherSnapshot', () => {
  const t = stateLine(findCharacter(config, 1), 'GREETING', { honorific: '할아버지', alarmLabel: '저녁 약', weather: { condition: 'rain', temperatureCelsius: 7.6 } });
  assert.match(t, /할아버지/); assert.match(t, /저녁 약/); assert.match(t, /비가 오고 8도/); assert.match(t, /우산/);
  assert.doesNotMatch(t, /\{/);
});
test('auth fail asks for photo next time in every character', () => {
  for (const c of config.characters) assert.match(stateLine(c, 'AUTH_FAIL', {}), /다음에는 꼭 사진 인증 해주세요/);
});
test('personality shapes actions (도윤 is shy instead of laughing)', () => {
  const doyun = findCharacter(config, 5), seoyun = findCharacter(config, 2);
  assert.equal(personalize('laugh', doyun), 'shy');
  assert.equal(stateAction(seoyun, 'GREETING'), 'nod');
  assert.equal(demoReply(findCharacter(config, 1), '머리가 아파').action, 'worry');
  assert.equal(demoReply(doyun, '고마워').action, 'shy');
  assert.equal(demoReply(doyun, '이제 끊을게').end, true);
});
test('system prompt carries persona and JSON contract', () => {
  const p = buildSystemPrompt(config, findCharacter(config, 3), { honorific: '할머니' });
  assert.match(p, /간호학과/); assert.match(p, /"action"/);
});
