// topics.ymlから曜日別テーマを選ぶ。src/generate.jsのpickTopic()と同じロジックだが、
// 設計書(docs/superpowers/specs/2026-08-14-auto-post-pipeline-design.md)の決定により
// generate.jsは変更しない方針のため、ここに複製する(パス・日付を引数化してテストしやすくした点のみ差分)。
import fs from 'node:fs';
import yaml from 'js-yaml';

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function pickTopic(topicsYmlPath, now = new Date()) {
  const data = yaml.load(fs.readFileSync(topicsYmlPath, 'utf8'));
  if (!data?.weekly) throw new Error('topics.yml に weekly 構造がありません');

  const jstMs = now.getTime() + 9 * 3600 * 1000;
  let dow = new Date(jstMs).getUTCDay(); // 0=日 .. 6=土
  if (dow === 0 || dow === 6) dow = 1; // 土日は月曜カテゴリにフォールバック

  const day = data.weekly[WEEKDAY_KEYS[dow]];
  if (!day?.topics?.length) throw new Error(`topics.yml の ${WEEKDAY_KEYS[dow]} にテーマがありません`);

  const weekNumber = Math.floor(jstMs / (7 * 86_400_000));
  const topic = day.topics[weekNumber % day.topics.length];
  return { ...topic, category: day.category };
}
