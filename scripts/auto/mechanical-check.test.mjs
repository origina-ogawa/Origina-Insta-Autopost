import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mechanicalCheck } from './mechanical-check.mjs';

function tokensFixture() {
  return {
    font: { heading: { maxChars: 20 }, body: { maxChars: 60 } },
    limits: { slideTotalChars: 80, slideCountMin: 8, slideCountMax: 10 },
  };
}

function slidesFixture(count = 8) {
  return {
    slug: 'test',
    caption: '本文',
    hashtags: ['#a', '#b'],
    sources: ['https://example.com'],
    slides: Array.from({ length: count }, (_, i) => ({
      no: i + 1,
      heading: '見出し',
      body: '本文です',
      source_ref: 'https://example.com',
    })),
  };
}

test('mechanicalCheckは全項目クリアならokになる', () => {
  const result = mechanicalCheck(slidesFixture(8), tokensFixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('mechanicalCheckはスライド枚数が8枚未満だとNG', () => {
  const result = mechanicalCheck(slidesFixture(5), tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations[0], /枚数/);
});

test('mechanicalCheckはスライド枚数が10枚超だとNG', () => {
  const result = mechanicalCheck(slidesFixture(11), tokensFixture());
  assert.equal(result.ok, false);
});

test('mechanicalCheckはhashtagsが4個以上だとNG', () => {
  const input = slidesFixture(8);
  input.hashtags = ['#a', '#b', '#c', '#d'];
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /hashtags/);
});

test('mechanicalCheckは見出しが上限字数を超えるとNG', () => {
  const input = slidesFixture(8);
  input.slides[0].heading = 'あ'.repeat(21);
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /1枚目の見出し/);
});

test('mechanicalCheckはsource_refが無いスライドがあるとNG', () => {
  const input = slidesFixture(8);
  delete input.slides[2].source_ref;
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /3枚目/);
});

test('mechanicalCheckは合計文字数が上限を超えるとNG', () => {
  const input = slidesFixture(8);
  input.slides[1].heading = 'あ'.repeat(20);
  input.slides[1].body = 'い'.repeat(61);
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /合計文字数/);
});

test('mechanicalCheckはtokens.limits.slideCountMaxが10でも実質上限9枚を超えるとNG', () => {
  const result = mechanicalCheck(slidesFixture(10), tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /9枚/);
});

test('mechanicalCheckはcaption・heading・bodyが空だとNG', () => {
  const input = slidesFixture(8);
  input.caption = '';
  input.slides[0].heading = '';
  input.slides[1].body = '';
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  const joined = result.violations.join('');
  assert.match(joined, /captionが空です/);
  assert.match(joined, /1枚目の見出しが空です/);
  assert.match(joined, /2枚目の本文が空です/);
});
