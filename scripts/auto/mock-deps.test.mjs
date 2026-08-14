import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockDeps } from './mock-deps.mjs';

test('mockDeps.callGeminiGroundedは3件以上のsourcesを返す', async () => {
  const result = await mockDeps.callGeminiGrounded('プロンプト');
  assert.ok(result.sources.length >= 3);
});

test('mockDeps.callGeminiJsonForStructureは8〜10枚のslidesを返す', async () => {
  const result = await mockDeps.callGeminiJsonForStructure('プロンプト');
  assert.ok(result.slides.length >= 8 && result.slides.length <= 10);
});

test('mockDeps.callGeminiJsonForCopyはproducer.md互換スキーマを返す', async () => {
  const result = await mockDeps.callGeminiJsonForCopy('プロンプト');
  assert.equal(typeof result.caption, 'string');
  assert.ok(Array.isArray(result.slides));
  assert.ok(result.slides.length >= 8);
});

test('mockDeps.callGeminiJsonForJudgeはok:trueを返す', async () => {
  const result = await mockDeps.callGeminiJsonForJudge('プロンプト');
  assert.equal(result.ok, true);
});

test('mockDeps.createIssueは固定のIssue番号を返す', () => {
  assert.equal(mockDeps.createIssue({ title: 't', body: 'b' }), 0);
});

test('mockDeps.commentIssue/closeIssueは例外を投げない', () => {
  assert.doesNotThrow(() => mockDeps.commentIssue(0, 'test'));
  assert.doesNotThrow(() => mockDeps.closeIssue(0, 'test'));
});
