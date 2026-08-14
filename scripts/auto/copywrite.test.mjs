import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCopyPrompt, writeSlides } from './copywrite.mjs';

function fixtures() {
  return {
    topic: { theme: 'テスト' },
    structure: [{ role: 'hook', point: '要点', sourceIndex: 1 }],
    sources: [{ url: 'https://a.example.com', title: 'A' }],
    tokens: { font: { heading: { maxChars: 20 }, body: { maxChars: 60 } }, limits: { slideTotalChars: 80 } },
  };
}

test('buildCopyPromptは文字数上限を含む', () => {
  const { topic, structure, sources, tokens } = fixtures();
  const prompt = buildCopyPrompt(topic, structure, sources, tokens);
  assert.match(prompt, /見出し: 20字以内/);
  assert.match(prompt, /本文: 60字以内/);
});

test('buildCopyPromptは差し戻し理由があれば含める', () => {
  const { topic, structure, sources, tokens } = fixtures();
  const prompt = buildCopyPrompt(topic, structure, sources, tokens, ['4枚目が72字']);
  assert.match(prompt, /前回の差し戻し理由/);
  assert.match(prompt, /4枚目が72字/);
});

test('buildCopyPromptは差し戻し理由が無ければその節を含めない', () => {
  const { topic, structure, sources, tokens } = fixtures();
  const prompt = buildCopyPrompt(topic, structure, sources, tokens, []);
  assert.doesNotMatch(prompt, /前回の差し戻し理由/);
});

test('writeSlidesはGeminiの返り値をそのまま返す', async () => {
  const { topic, structure, sources, tokens } = fixtures();
  const fakeResult = { slug: 'test', caption: 'c', hashtags: [], sources: [], slides: [] };
  const callGeminiJson = async () => fakeResult;
  const result = await writeSlides(topic, structure, sources, tokens, { callGeminiJson });
  assert.deepEqual(result, fakeResult);
});
