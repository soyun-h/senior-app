import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { homeDialogueLines } from '../src/features/avatar/homeDialogueLines.ts';
import { homeDemoDialogue, homeDialogue } from '../src/features/avatar/homeDialoguePresentation.ts';

const at = (hour, minute = 0) => new Date(2026, 10, 19, hour, minute);
const upcoming = [{ time: '9:00', completed: false }];

test('home dialogue reacts at the scheduled time and completion without treating an empty day as completed', () => {
  assert.equal(homeDialogue('char1', { now: at(8, 59), schedules: upcoming }).situation, 'greeting');
  const due = homeDialogue('char1', { now: at(9), schedules: upcoming });
  assert.equal(due.situation, 'schedulePending');
  assert.equal(due.pose, 'encourage');
  const completed = homeDialogue('char1', { now: at(9), schedules: [{ time: '9:00', completed: true }] });
  assert.equal(completed.situation, 'scheduleComplete');
  assert.equal(completed.pose, 'ok');
  assert.equal(homeDialogue('char1', { now: at(9), schedules: [] }).situation, 'greeting');
});

test('home dialogue changes at night and prioritizes current rain, snow and lightning', () => {
  assert.equal(homeDialogue('char1', { now: at(5, 59), schedules: upcoming }).pose, 'idle');
  assert.equal(homeDialogue('char1', { now: at(6), schedules: upcoming }).pose, 'wave');
  assert.equal(homeDialogue('char1', { now: at(22), schedules: upcoming }).situation, 'night');
  for (const [condition, pose] of [['rain', 'idle'], ['snow', 'idle'], ['thunder', 'idle']]) {
    const line = homeDialogue('char1', { now: at(22), schedules: upcoming, condition });
    assert.equal(line.situation, condition);
    assert.equal(line.pose, pose);
    assert.equal(line.text, homeDialogueLines.char1[condition]);
  }
});

test('the demo weather cycle shows five characters with matching dialogue and available poses', () => {
  const config = JSON.parse(readFileSync(new URL('../src/features/avatar/characters.json', import.meta.url), 'utf8'));
  const weatherCycle = ['clear', 'cloudy', 'rain', 'snow', 'thunder'];
  const steps = weatherCycle.map(condition => homeDemoDialogue(condition));
  assert.deepEqual(steps.map(step => step.characterId), ['char1', 'char2', 'char3', 'char4', 'char5']);
  assert.deepEqual(steps.map(step => step.situation), ['greeting', 'night', 'rain', 'snow', 'thunder']);
  assert.deepEqual(steps.map(step => step.pose), ['wave', 'idle', 'idle', 'ok', 'idle']);
  for (const { characterId, situation, text, pose } of steps) {
    const character = config.characters.find(option => option.id === characterId);
    assert.ok(character.assets[pose], characterId + ' ' + pose);
    assert.equal(text, homeDialogueLines[characterId][situation]);
  }
});

test('every home dialogue has an individual recording and five distinct character lines per situation', () => {
  const assetMap = readFileSync(new URL('../src/features/avatar/characterVoices.ts', import.meta.url), 'utf8');
  const clips = new Set();
  for (const [id, lines] of Object.entries(homeDialogueLines)) {
    for (const [situation, text] of Object.entries(lines)) {
      assert.ok(text.length > 0);
      const suffix = situation.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
      const file = situation === 'greeting' ? `${id}.m4a` : `${id}_${suffix}.m4a`;
      assert.ok(assetMap.includes(`${situation}: require('../../../assets/voices/${file}')`), file);
      const bytes = readFileSync(new URL(`../assets/voices/${file}`, import.meta.url));
      assert.equal(bytes.subarray(4, 8).toString(), 'ftyp', file);
      clips.add(bytes.toString('base64'));
    }
  }
  assert.equal(clips.size, 35);
  for (const situation of Object.keys(homeDialogueLines.char1)) {
    assert.equal(new Set(Object.values(homeDialogueLines).map(lines => lines[situation])).size, 5);
  }
});
