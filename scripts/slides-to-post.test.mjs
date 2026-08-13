import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapHeadingToLines, convertSlidesToPost } from './slides-to-post.mjs';

test('wrapHeadingToLinesは8文字ごとに改行する', () => {
  assert.deepEqual(wrapHeadingToLines('発注してはいけないWeb制作会社4選'), [
    '発注してはいけな',
    'いWeb制作会社',
    '4選',
  ]);
});

test('wrapHeadingToLinesは行数上限を超えたら最後の行にまとめる', () => {
  const lines = wrapHeadingToLines('あ'.repeat(40), { maxLineLen: 8, maxLines: 4 });
  assert.equal(lines.length, 4);
  assert.equal(lines.slice(0, 3).join('').length, 24);
  assert.equal(lines[3].length, 16); // 40 - 24
});

test('wrapHeadingToLinesは空文字でも1行返す', () => {
  assert.deepEqual(wrapHeadingToLines(''), ['']);
});

function sampleSlidesJson() {
  return {
    slug: 'test-theme',
    caption: '本文です',
    hashtags: ['#AI', '#DX'],
    sources: ['https://example.com'],
    slides: [
      { no: 1, heading: 'フックの見出し', body: '導入の本文です', source_ref: 'sources/a.md#1' },
      { no: 2, heading: '本文1枚目の見出し', body: '本文1枚目の内容です', source_ref: 'sources/a.md#1' },
      { no: 3, heading: '本文2枚目の見出し', body: '本文2枚目の内容です', source_ref: 'sources/a.md#2' },
      { no: 4, heading: 'まとめ', body: 'まとめの本文です', source_ref: 'sources/a.md#2' },
    ],
  };
}

test('convertSlidesToPostは1枚目をcover、最後をsummary、間をbodyにする', () => {
  const post = convertSlidesToPost(sampleSlidesJson());
  assert.equal(post.slides.length, 4);
  assert.equal(post.slides[0].type, 'cover');
  assert.equal(post.slides[1].type, 'body');
  assert.equal(post.slides[2].type, 'body');
  assert.equal(post.slides[3].type, 'summary');
});

test('convertSlidesToPostはcaption/hashtagsをそのまま引き継ぐ', () => {
  const post = convertSlidesToPost(sampleSlidesJson());
  assert.equal(post.caption, '本文です');
  assert.deepEqual(post.hashtags, ['#AI', '#DX']);
});

test('convertSlidesToPostはheader_titleを1枚目の見出しにする', () => {
  const post = convertSlidesToPost(sampleSlidesJson());
  assert.equal(post.header_title, 'フックの見出し');
});

test('convertSlidesToPostはbodyスライドの番号を2桁ゼロ埋めにする', () => {
  const post = convertSlidesToPost(sampleSlidesJson());
  assert.equal(post.slides[1].number, '02');
  assert.equal(post.slides[2].number, '03');
});

test('convertSlidesToPostは2枚しかない場合はcoverとsummaryだけになる', () => {
  const input = sampleSlidesJson();
  input.slides = [input.slides[0], input.slides[3]];
  const post = convertSlidesToPost(input);
  assert.equal(post.slides.length, 2);
  assert.equal(post.slides[0].type, 'cover');
  assert.equal(post.slides[1].type, 'summary');
});

test('convertSlidesToPostはslidesが空だとエラーになる', () => {
  const input = sampleSlidesJson();
  input.slides = [];
  assert.throws(() => convertSlidesToPost(input));
});

test('convertSlidesToPostはheadingが無いスライドがあるとエラーになる', () => {
  const input = sampleSlidesJson();
  delete input.slides[1].heading;
  assert.throws(() => convertSlidesToPost(input));
});
