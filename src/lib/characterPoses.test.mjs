import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignCharacterPoses } from './characterPoses.js';

test('ポーズ画像が無ければ全スライドundefined', () => {
  const slides = [{ type: 'cover' }, { type: 'body' }];
  const result = assignCharacterPoses(slides, []);
  assert.deepEqual(result, [undefined, undefined]);
});

test('cover・bodyスライドには順番にポーズを割り当て、summaryは対象外', () => {
  const slides = [{ type: 'cover' }, { type: 'body' }, { type: 'summary' }, { type: 'body' }];
  const result = assignCharacterPoses(slides, ['A', 'B']);
  assert.deepEqual(result, ['A', 'B', undefined, 'A']);
});

test('ポーズ数よりスライドが多い場合は循環する', () => {
  const slides = [{ type: 'cover' }, { type: 'body' }, { type: 'body' }];
  const result = assignCharacterPoses(slides, ['A']);
  assert.deepEqual(result, ['A', 'A', 'A']);
});
