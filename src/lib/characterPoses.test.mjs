import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignCharacterPoses, nextCoverStartIndex } from './characterPoses.js';

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

test('startIndexを指定すると、そのポーズから割り当てが始まる(表紙のポーズを投稿ごとに変える用)', () => {
  const slides = [{ type: 'cover' }, { type: 'body' }];
  const result = assignCharacterPoses(slides, ['A', 'B', 'C'], { startIndex: 2 });
  assert.deepEqual(result, ['C', 'A']);
});

test('nextCoverStartIndexは投稿数をポーズ数で割った余りを返す', () => {
  assert.equal(nextCoverStartIndex(0, 6), 0);
  assert.equal(nextCoverStartIndex(1, 6), 1);
  assert.equal(nextCoverStartIndex(6, 6), 0);
  assert.equal(nextCoverStartIndex(8, 6), 2);
});

test('nextCoverStartIndexはポーズが0枚なら0を返す', () => {
  assert.equal(nextCoverStartIndex(5, 0), 0);
});
