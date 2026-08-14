import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchPrompt, extractSources, gatherSources } from './research.mjs';

test('buildResearchPromptはテーマと切り口を含む', () => {
  const prompt = buildResearchPrompt({ theme: 'AIに選ばれるHP', points: 'LLMO' });
  assert.match(prompt, /AIに選ばれるHP/);
  assert.match(prompt, /LLMO/);
});

test('extractSourcesはURLの重複を除く', () => {
  const sources = extractSources({
    sources: [
      { url: 'https://a.example.com', title: 'A' },
      { url: 'https://a.example.com', title: 'A重複' },
      { url: 'https://b.example.com', title: 'B' },
    ],
  });
  assert.equal(sources.length, 2);
});

test('extractSourcesはurlが無い要素を無視する', () => {
  const sources = extractSources({ sources: [{ title: 'urlなし' }, { url: 'https://a.example.com', title: 'A' }] });
  assert.equal(sources.length, 1);
});

test('gatherSourcesは3件以上集まればsufficient=true', async () => {
  const callGeminiGrounded = async () => ({
    text: '要約',
    sources: [
      { url: 'https://a.example.com', title: 'A' },
      { url: 'https://b.example.com', title: 'B' },
      { url: 'https://c.example.com', title: 'C' },
    ],
  });
  const result = await gatherSources({ theme: 'テスト' }, { callGeminiGrounded });
  assert.equal(result.sufficient, true);
  assert.equal(result.sources.length, 3);
});

test('gatherSourcesは3件未満ならsufficient=false', async () => {
  const callGeminiGrounded = async () => ({
    text: '要約',
    sources: [{ url: 'https://a.example.com', title: 'A' }],
  });
  const result = await gatherSources({ theme: 'テスト' }, { callGeminiGrounded });
  assert.equal(result.sufficient, false);
});
