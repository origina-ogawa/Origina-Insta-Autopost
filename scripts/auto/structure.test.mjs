import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStructurePrompt, buildStructure } from './structure.mjs';

function sourcesFixture() {
  return [
    { url: 'https://a.example.com', title: 'A' },
    { url: 'https://b.example.com', title: 'B' },
    { url: 'https://c.example.com', title: 'C' },
  ];
}

test('buildStructurePromptはソース一覧を番号付きで含む', () => {
  const prompt = buildStructurePrompt({ theme: 'テスト' }, sourcesFixture());
  assert.match(prompt, /1\. A — https:\/\/a\.example\.com/);
  assert.match(prompt, /3\. C — https:\/\/c\.example\.com/);
});

test('buildStructureは8〜10枚の構成案を返す', async () => {
  const slides = Array.from({ length: 8 }, (_, i) => ({ role: 'body', point: `要点${i + 1}`, sourceIndex: 1 }));
  const callGeminiJson = async () => ({ slides });
  const result = await buildStructure({ theme: 'テスト' }, sourcesFixture(), { callGeminiJson });
  assert.equal(result.length, 8);
});

test('buildStructureはスライド数が8枚未満だとエラーを投げる', async () => {
  const callGeminiJson = async () => ({ slides: [{ role: 'hook', point: 'x', sourceIndex: 1 }] });
  await assert.rejects(() => buildStructure({ theme: 'テスト' }, sourcesFixture(), { callGeminiJson }), /8〜9枚/);
});

test('buildStructureはスライド数が10枚超だとエラーを投げる', async () => {
  const slides = Array.from({ length: 11 }, () => ({ role: 'body', point: 'x', sourceIndex: 1 }));
  const callGeminiJson = async () => ({ slides });
  await assert.rejects(() => buildStructure({ theme: 'テスト' }, sourcesFixture(), { callGeminiJson }), /8〜9枚/);
});
