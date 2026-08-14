import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJudgePrompt, judgeContent } from './gemini-judge.mjs';

test('buildJudgePromptはルーブリックと検収対象を含む', () => {
  const prompt = buildJudgePrompt({ caption: 'c' }, [{ url: 'https://a.example.com' }], '# ルーブリック本文');
  assert.match(prompt, /# ルーブリック本文/);
  assert.match(prompt, /https:\/\/a\.example\.com/);
});

test('judgeContentは合格結果をそのまま返す', async () => {
  const callGeminiJson = async () => ({ ok: true, reasons: [] });
  const result = await judgeContent({}, [], 'rubric', { callGeminiJson });
  assert.equal(result.ok, true);
});

test('judgeContentは不合格理由をそのまま返す', async () => {
  const callGeminiJson = async () => ({ ok: false, reasons: ['3枚目のソースが14日を超えている'] });
  const result = await judgeContent({}, [], 'rubric', { callGeminiJson });
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, ['3枚目のソースが14日を超えている']);
});
