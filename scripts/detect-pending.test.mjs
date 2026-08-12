import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanPendingPosts, isPending, DIR_PATTERN } from './detect-pending.mjs';

function makeTempPostsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'posts-test-'));
}

function makePost(postsDir, name, { published = false, passedInspection = true } = {}) {
  const dir = path.join(postsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'inspection.md'),
    passedInspection ? '# 検収結果: 合格(第1回)\n' : '# 検収結果: 不合格(第1回)\n'
  );
  if (published) {
    fs.writeFileSync(
      path.join(dir, 'published.json'),
      JSON.stringify({ postedAt: '2026-08-01T00:00:00.000Z', mediaId: '123' })
    );
  }
}

test('published.jsonが無く検収合格のフォルダは未投稿として検出される', () => {
  const postsDir = makeTempPostsDir();
  makePost(postsDir, '2026-08-13-test-theme');
  const { pending } = scanPendingPosts(postsDir);
  assert.deepEqual(pending, ['2026-08-13-test-theme']);
});

test('published.jsonがあるフォルダは対象外', () => {
  const postsDir = makeTempPostsDir();
  makePost(postsDir, '2026-08-13-test-theme', { published: true });
  const { pending } = scanPendingPosts(postsDir);
  assert.deepEqual(pending, []);
});

test('検収不合格のフォルダは対象外', () => {
  const postsDir = makeTempPostsDir();
  makePost(postsDir, '2026-08-13-test-theme', { passedInspection: false });
  const { pending } = scanPendingPosts(postsDir);
  assert.deepEqual(pending, []);
});

test('日付のみ(スラグ無し)の旧形式フォルダは対象外', () => {
  const postsDir = makeTempPostsDir();
  makePost(postsDir, '2026-08-13');
  const { pending } = scanPendingPosts(postsDir);
  assert.deepEqual(pending, []);
});

test('複数の未投稿フォルダをすべて名前順で検出する', () => {
  const postsDir = makeTempPostsDir();
  makePost(postsDir, '2026-08-14-b');
  makePost(postsDir, '2026-08-13-a');
  const { pending } = scanPendingPosts(postsDir);
  assert.deepEqual(pending, ['2026-08-13-a', '2026-08-14-b']);
});

test('isPendingはinspection.mdが無ければfalse', () => {
  const postsDir = makeTempPostsDir();
  fs.mkdirSync(path.join(postsDir, '2026-08-13-no-inspection'), { recursive: true });
  assert.equal(isPending(postsDir, '2026-08-13-no-inspection'), false);
});

test('DIR_PATTERNは日付のみ(スラグ無し)を拒否し、日付-スラグ形式は受け入れる', () => {
  // 旧形式（日付のみ）は常に除外される
  assert.equal(DIR_PATTERN.test('2026-08-13'), false, '日付のみはマッチしない');
  // 新形式（日付-スラグ）は受け入れられる
  assert.equal(DIR_PATTERN.test('2026-08-13-test-slug'), true, '日付-スラグはマッチする');
  assert.equal(DIR_PATTERN.test('2026-08-13-a'), true, '日付-スラグ(短いスラグ)はマッチする');
});
