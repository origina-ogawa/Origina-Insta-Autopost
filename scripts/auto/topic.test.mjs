import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pickTopic } from './topic.mjs';

function writeTopicsYml(dir) {
  const p = path.join(dir, 'topics.yml');
  fs.writeFileSync(
    p,
    `weekly:
  monday:
    category: 月曜カテゴリ
    topics:
      - theme: 月曜テーマ1
        points: 切り口1
      - theme: 月曜テーマ2
  tuesday:
    category: 火曜カテゴリ
    topics:
      - theme: 火曜テーマ1
`
  );
  return p;
}

test('pickTopicは指定した曜日(JST)のカテゴリ・テーマを返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-test-'));
  const ymlPath = writeTopicsYml(dir);
  // 2026-08-18は火曜日(UTC 00:00 = JST 09:00、同じ曜日)
  const topic = pickTopic(ymlPath, new Date('2026-08-18T00:00:00.000Z'));
  assert.equal(topic.category, '火曜カテゴリ');
  assert.equal(topic.theme, '火曜テーマ1');
});

test('pickTopicは週替わりでローテーションする', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-test-'));
  const ymlPath = writeTopicsYml(dir);
  // 2026-08-17(月)と2026-08-24(月、翌週)でテーマが変わることを確認
  const week1 = pickTopic(ymlPath, new Date('2026-08-17T00:00:00.000Z'));
  const week2 = pickTopic(ymlPath, new Date('2026-08-24T00:00:00.000Z'));
  assert.notEqual(week1.theme, week2.theme);
});

test('pickTopicは土日を月曜カテゴリにフォールバックする', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-test-'));
  const ymlPath = writeTopicsYml(dir);
  // 2026-08-16は日曜日
  const topic = pickTopic(ymlPath, new Date('2026-08-16T00:00:00.000Z'));
  assert.equal(topic.category, '月曜カテゴリ');
});

test('pickTopicはweekly構造が無いとエラーになる', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-test-'));
  const p = path.join(dir, 'topics.yml');
  fs.writeFileSync(p, 'foo: bar\n');
  assert.throws(() => pickTopic(p));
});
