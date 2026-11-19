import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { demoReply, findCharacter, personalize, stateAction, stateLine, buildSystemPrompt } from '../src/features/avatar/characterBrain.ts';
import { cuesFromTiming, estimateTiming, mouthAt, vowelMouth } from '../src/features/avatar/visemes.ts';

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
test('Korean vowels map to mouth shapes', () => {
  assert.equal(vowelMouth('아'), 'a'); assert.equal(vowelMouth('오'), 'o'); assert.equal(vowelMouth('누'), 'o');
  assert.equal(vowelMouth('이'), 'i'); assert.equal(vowelMouth('에'), 'i'); assert.equal(vowelMouth(' '), 'rest');
});
test('ㅁ·ㅂ·ㅍ close the mouth only as final consonants', () => {
  const timing = { characters: ['마', '바', '파', '밥', '이'], starts: [0, 0.2, 0.4, 0.6, 1.2], ends: [0.2, 0.4, 0.6, 1.2, 1.4] };
  const cues = cuesFromTiming(timing);
  assert.equal(mouthAt(cues, 0.01), 'a');
  assert.equal(mouthAt(cues, 0.21), 'a');
  assert.equal(mouthAt(cues, 0.41), 'a');
  assert.equal(mouthAt(cues, 1.07), 'm');
  assert.equal(mouthAt(cues, 1.3), 'i');
  assert.equal(mouthAt(cues, 1.4), 'rest');
  const est = estimateTiming('안녕하세요!', 1);
  assert.equal(est.characters.length, 6); assert.ok(est.ends[5] > est.starts[0]);
});

test('sub-110 ms shapes extend the previous shape and 110 ms shapes remain', () => {
  const line = next => cuesFromTiming({ characters: ['아','이','오'], starts: [0, 0.2, next], ends: [0.2, next, 0.55] });
  assert.equal(mouthAt(line(0.3), 0.25), 'a');
  assert.equal(mouthAt(line(0.3), 0.4), 'o');
  assert.equal(mouthAt(line(0.31), 0.25), 'i');
});

test('interior punctuation rests require 150 ms but the line always finishes closed', () => {
  for (const punctuation of [',', '.']) {
    const line = next => cuesFromTiming({ characters: ['아', punctuation, '오'], starts: [0, 0.2, next], ends: [0.2, next, 0.6] });
    assert.equal(mouthAt(line(0.34), 0.24), 'a');
    assert.equal(mouthAt(line(0.35), 0.24), 'rest');
    assert.equal(mouthAt(line(0.34), 0.6), 'rest');
  }
});
