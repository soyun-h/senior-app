import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSystemPrompt, findCharacter } from '../src/features/avatar/characterBrain.ts';
import {
  CHARACTER_GUIDE_TITLE, GUIDE_SECTIONS, PERSONA_CARDS, TEST_SCRIPTS, buildMemorySummaryPrompt, personaCardText,
} from '../src/features/avatar/characterGuide.ts';

const config = JSON.parse(readFileSync(new URL('../src/features/avatar/characters.json', import.meta.url), 'utf8'));

test('every character in characters.json has a persona card', () => {
  for (const c of config.characters) {
    const card = PERSONA_CARDS[c.id];
    assert.ok(card, c.id);
    assert.ok(card.greeting && card.goodbye && card.difference, c.id);
    assert.ok(card.examples.length >= 5, `${c.id} needs at least 5 example lines`);
  }
});

test('greetings are all different so characters stay distinguishable', () => {
  const greetings = Object.values(PERSONA_CARDS).map(c => c.greeting);
  assert.equal(new Set(greetings).size, greetings.length);
});

test('system prompt includes the persona card with honorific filled, guide rules and memory', () => {
  const p = buildSystemPrompt(config, findCharacter(config, 5), { honorific: '할아버지', memory: '- 손자 민수가 군대에 간다고 하심' });
  assert.match(p, new RegExp(CHARACTER_GUIDE_TITLE.replace(/[&]/g, '\\&')));
  assert.match(p, /\.\.\.할아버지\. 도윤이요\./);
  assert.doesNotMatch(p, /\{호칭\}/);
  assert.match(p, /119/);
  assert.match(p, /민수/);
  assert.match(p, /"action"/);
  assert.ok(p.split('\n').length > 40, 'prompt keeps its line breaks');
});

test('first call is marked when there is no memory', () => {
  const p = buildSystemPrompt(config, findCharacter(config, 1), {});
  assert.match(p, /없음 \(첫 통화\)/);
});

test('safety rules come before character rules', () => {
  const titles = GUIDE_SECTIONS.map(s => s.title);
  assert.ok(titles.findIndex(t => t.startsWith('안전')) < titles.indexOf('캐릭터 지키기'));
});

test('memory summary prompt carries old memory and transcript', () => {
  const p = buildMemorySummaryPrompt('- 트로트를 좋아하심', '어르신: 오늘 경로당 다녀왔어');
  assert.match(p, /트로트/); assert.match(p, /경로당/); assert.match(p, /최대 10줄/);
});

test('there are 30 test scripts', () => {
  assert.equal(TEST_SCRIPTS.length, 30);
  assert.ok(personaCardText('char3').includes('간호학과'));
});
