import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bottomTabs } from '../src/navigation/bottomTabs.ts';

test('common navigation has stable unique IDs, final labels, order and existing assets', () => {
  assert.deepEqual(bottomTabs.map(tab => tab.id), ['schedule', 'home', 'calendar']);
  assert.deepEqual(bottomTabs.map(tab => tab.label), ['일정', '홈', '달력']);
  assert.deepEqual(bottomTabs.map(tab => tab.icon), ['alarm', 'home', 'calendar']);
  assert.equal(new Set(bottomTabs.map(tab => tab.id)).size, 3);
  assert.ok(bottomTabs.every(tab => tab.id !== tab.label));
});
