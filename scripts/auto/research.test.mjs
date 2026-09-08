import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchPrompt, extractSources, gatherSources } from './research.mjs';

const recentDate = () => new Date().toISOString();
const oldDate = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

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

test('gatherSourcesは公開日が14日以内と確認できた3件以上でsufficient=true', async () => {
  const callGeminiGrounded = async () => ({
    text: '要約',
    sources: [
      { url: 'https://a.example.com', title: 'A' },
      { url: 'https://b.example.com', title: 'B' },
      { url: 'https://c.example.com', title: 'C' },
    ],
  });
  const fetchPublishedDate = async () => recentDate();
  const result = await gatherSources({ theme: 'テスト' }, { callGeminiGrounded, fetchPublishedDate });
  assert.equal(result.sufficient, true);
  assert.equal(result.sources.length, 3);
  assert.ok(result.sources.every((s) => typeof s.publishedAt === 'string'));
});

test('gatherSourcesは公開日が確認できたものが3件未満ならsufficient=false', async () => {
  const callGeminiGrounded = async () => ({
    text: '要約',
    sources: [{ url: 'https://a.example.com', title: 'A' }],
  });
  const fetchPublishedDate = async () => recentDate();
  const result = await gatherSources({ theme: 'テスト' }, { callGeminiGrounded, fetchPublishedDate });
  assert.equal(result.sufficient, false);
});

test('gatherSourcesは公開日が取得できないソースを除外する(バグ再発防止: 全ソースが常に公開日不明扱いになっていた不具合)', async () => {
  const callGeminiGrounded = async () => ({
    text: '要約',
    sources: [
      { url: 'https://a.example.com', title: 'A' },
      { url: 'https://b.example.com', title: 'B' },
      { url: 'https://c.example.com', title: 'C' },
    ],
  });
  const fetchPublishedDate = async () => null;
  const result = await gatherSources({ theme: 'テスト' }, { callGeminiGrounded, fetchPublishedDate });
  assert.equal(result.sufficient, false);
  assert.equal(result.sources.length, 0);
});

test('gatherSourcesは14日より古い公開日のソースを除外する', async () => {
  const callGeminiGrounded = async () => ({
    text: '要約',
    sources: [
      { url: 'https://a.example.com', title: 'A' },
      { url: 'https://b.example.com', title: 'B' },
      { url: 'https://c.example.com', title: 'C' },
    ],
  });
  const fetchPublishedDate = async (url) => (url === 'https://c.example.com' ? oldDate() : recentDate());
  const result = await gatherSources({ theme: 'テスト' }, { callGeminiGrounded, fetchPublishedDate });
  assert.equal(result.sufficient, false);
  assert.equal(result.sources.length, 2);
});
