import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backgroundCondition, demoConditions, weatherMessage } from '../src/features/weather/presentation.ts';

test('five demo weather states resolve to distinct background keys', () => {
  assert.deepEqual(demoConditions, ['clear', 'cloudy', 'rain', 'snow', 'thunder']);
  assert.equal(new Set(demoConditions.map(backgroundCondition)).size, 5);
  assert.equal(backgroundCondition('unknown'), 'cloudy');
});
test('weather copy reflects provider temperature and guidance', () => {
  const snapshot = { condition: 'rain', temperatureCelsius: 7, observedAt: '2026-11-16T00:00:00Z' };
  assert.match(weatherMessage(snapshot), /7°C/);
  assert.match(weatherMessage(snapshot), /우산/);
  assert.match(weatherMessage({ ...snapshot, guidance: '새 안내 문구' }), /새 안내 문구/);
  assert.match(weatherMessage({ ...snapshot, condition: 'snow' }), /미끄러운/);
  assert.match(weatherMessage({ ...snapshot, condition: 'thunder' }), /실내/);
});
