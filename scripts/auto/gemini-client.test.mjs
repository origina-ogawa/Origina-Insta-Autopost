import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFirstJsonObject } from './gemini-client.mjs';

test('extractFirstJsonObjectはJSONだけの応答をそのまま返す', () => {
  const json = extractFirstJsonObject('{"a":1}');
  assert.equal(json, '{"a":1}');
});

test('extractFirstJsonObjectは末尾の余分な文字を無視する', () => {
  const json = extractFirstJsonObject('{"a":1}}}');
  assert.equal(json, '{"a":1}');
});

test('extractFirstJsonObjectは文字列内の中括弧に惑わされない', () => {
  const json = extractFirstJsonObject('{"a":"{not a real brace"}');
  assert.equal(JSON.parse(json).a, '{not a real brace');
});

test('extractFirstJsonObjectは前置きの説明文を無視する', () => {
  const json = extractFirstJsonObject('以下がJSONです:\n{"a":1}\nよろしくお願いします');
  assert.equal(json, '{"a":1}');
});
