import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayJst, sanitizeSlug, fallbackSlugFromTheme } from './slug.mjs';

test('todayJstはJSTの日付をYYYY-MM-DD形式で返す', () => {
  // UTC 2026-08-13T20:00:00 = JST 2026-08-14T05:00:00
  assert.equal(todayJst(new Date('2026-08-13T20:00:00.000Z')), '2026-08-14');
});

test('sanitizeSlugは英数とハイフンだけを残す', () => {
  assert.equal(sanitizeSlug('AI-Agent 2026!!', 'fallback'), 'ai-agent-2026');
});

test('sanitizeSlugは空になったらfallbackを返す', () => {
  assert.equal(sanitizeSlug('ホームページ制作', 'fallback-slug'), 'fallback-slug');
});

test('sanitizeSlugは前後の余分なハイフンを除く', () => {
  assert.equal(sanitizeSlug('--hello--', 'fallback'), 'hello');
});

test('fallbackSlugFromThemeは同じテーマから同じスラッグを生成する(決定的)', () => {
  const a = fallbackSlugFromTheme('AIに選ばれるHPの作り方');
  const b = fallbackSlugFromTheme('AIに選ばれるHPの作り方');
  assert.equal(a, b);
  assert.match(a, /^post-[0-9a-f]{10}$/);
});
