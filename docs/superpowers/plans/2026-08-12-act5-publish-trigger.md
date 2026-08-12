# 第5幕以降(投稿トリガー) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 検収合格した投稿(`posts/YYYY-MM-DD-<slug>/`)がPRマージでmainに入ったことを検知し、GitHub ActionsがInstagramへ投稿する仕組み(`scripts/detect-pending.mjs` + `scripts/publish-instagram.mjs` + `.github/workflows/publish.yml`)を追加する。

**Architecture:** `publish.yml` は `main` への `push`(`posts/**`)をトリガーに起動する。まず `detect-pending.mjs` が「`published.json` を持たない検収合格済みフォルダ」を1件だけ特定し、`publish-instagram.mjs` が既存の `src/publish.js` のGraph API投稿ロジックを流用してそのフォルダの画像・キャプションを投稿、成功したら `published.json` を書いてmainへ記録用コミットをpushする。既存の `daily-post.yml` はユーザーの判断で変更しない(コメント追記のみ)。

**Tech Stack:** Node.js 22 / ESM(`"type": "module"`)、Node組み込みテストランナー(`node --test`、追加依存なし)、GitHub Actions。

## Global Constraints

- 対象は `docs/superpowers/specs/2026-08-12-act5-publish-trigger-design.md` の「第5幕以降(検収合格→PR→マージ→投稿)」のみ。第1〜3幕のスキーマ統合・ディレクトリ運用は対象外
- `posts/` の対象フォルダ名は正規表現 `^\d{4}-\d{2}-\d{2}-.+$` に一致するもののみ(日付のみの旧形式フォルダは常に除外)
- 未投稿判定: `published.json` が存在せず、かつ `inspection.md` に文字列 `検収結果: 合格` を含むフォルダのみ
- `published.json` の形式: `{ "postedAt": ISO8601文字列, "mediaId": string }`
- 未投稿フォルダが2件以上見つかったら自動投稿せずエラー終了する(1件に絞ってから再実行)
- `daily-post.yml` の実処理は変更しない。コメント追記のみ許可
- Node.js 20以上、ESM。新しい依存パッケージは追加しない(テストはNode組み込みの `node:test` を使う)
- コミットメッセージは1行の日本語でシンプルに

---

### Task 1: `scripts/detect-pending.mjs` の実装

**Files:**
- Create: `scripts/detect-pending.mjs`
- Test: `scripts/detect-pending.test.mjs`

**Interfaces:**
- Produces: `scanPendingPosts(postsDir: string): { pending: string[] }` — `postsDir` 配下の対象フォルダ名を未投稿判定してソート済み配列で返す
- Produces: `isPending(postsDir: string, name: string): boolean` — 個別フォルダの未投稿判定
- CLI: `node scripts/detect-pending.mjs [--dir <フォルダ名>]` — GitHub Actions の `GITHUB_OUTPUT` に `has_pending` と `dir` を書き出す

- [ ] **Step 1: 失敗するテストを書く**

`scripts/detect-pending.test.mjs` を作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanPendingPosts, isPending } from './detect-pending.mjs';

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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test scripts/detect-pending.test.mjs`
Expected: FAIL(`scripts/detect-pending.mjs` が存在しないため `Cannot find module` エラー)

- [ ] **Step 3: 実装する**

`scripts/detect-pending.mjs` を作成する。

```javascript
// posts/ 配下から「まだInstagramに投稿していない、検収合格済みのフォルダ」を検出する。
// 対象は posts/YYYY-MM-DD-<slug>/ 形式のみ(日付のみの旧フォルダは常に除外)。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR_PATTERN = /^\d{4}-\d{2}-\d{2}-.+$/;

export function isPending(postsDir, name) {
  const dir = path.join(postsDir, name);
  const publishedPath = path.join(dir, 'published.json');
  if (fs.existsSync(publishedPath)) return false;

  const inspectionPath = path.join(dir, 'inspection.md');
  if (!fs.existsSync(inspectionPath)) return false;
  const inspection = fs.readFileSync(inspectionPath, 'utf8');
  if (!inspection.includes('検収結果: 合格')) return false;

  return true;
}

export function scanPendingPosts(postsDir) {
  if (!fs.existsSync(postsDir)) return { pending: [] };
  const names = fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && DIR_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort();

  return { pending: names.filter((name) => isPending(postsDir, name)) };
}

function appendGithubOutput(line) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return; // ローカル実行時はGITHUB_OUTPUTが無いのでスキップ
  fs.appendFileSync(outPath, line + '\n', 'utf8');
}

function main() {
  const argv = process.argv.slice(2);
  const overrideIdx = argv.indexOf('--dir');
  const override = overrideIdx !== -1 ? argv[overrideIdx + 1] : null;
  const postsDir = path.join(ROOT, 'posts');

  if (override) {
    if (!isPending(postsDir, override)) {
      console.error(
        `--dir で指定された "${override}" は未投稿の条件を満たしていません` +
          `(published.json が存在する、または inspection.md が合格になっていない可能性があります)`
      );
      process.exit(1);
    }
    console.log(`指定フォルダを対象にします: ${override}`);
    appendGithubOutput('has_pending=true');
    appendGithubOutput(`dir=${override}`);
    return;
  }

  const { pending } = scanPendingPosts(postsDir);

  if (pending.length === 0) {
    console.log('未投稿のフォルダはありません');
    appendGithubOutput('has_pending=false');
    return;
  }

  if (pending.length > 1) {
    console.error(
      `未投稿のフォルダが複数見つかりました。--dir で対象を1つ指定して再実行してください:\n` +
        pending.map((p) => `  - ${p}`).join('\n')
    );
    process.exit(1);
  }

  console.log(`未投稿のフォルダ: ${pending[0]}`);
  appendGithubOutput('has_pending=true');
  appendGithubOutput(`dir=${pending[0]}`);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test scripts/detect-pending.test.mjs`
Expected: PASS(6テストすべて成功)

- [ ] **Step 5: コミット**

```bash
git add scripts/detect-pending.mjs scripts/detect-pending.test.mjs
git commit -m "未投稿フォルダを検出するdetect-pending.mjsを追加"
```

---

### Task 2: `scripts/publish-instagram.mjs` の実装

**Files:**
- Create: `scripts/publish-instagram.mjs`
- Test: `scripts/publish-instagram.test.mjs`
- Read (参考・変更しない): `src/publish.js`

**Interfaces:**
- Consumes: なし(Task 1とは独立)
- Produces: `buildCaption(post: {caption: string, hashtags?: string[]}): string`
- Produces: `listSlideImages(dir: string): string[]`(`slide-N.png` を番号順に返す)
- Produces: `buildPublishedRecord(mediaId: string, now?: Date): { postedAt: string, mediaId: string }`
- Produces: `parseDirArg(argv: string[]): string | null`
- CLI: `node scripts/publish-instagram.mjs --dir <posts配下のフォルダ名>`(環境変数 `IG_USER_ID`, `IG_ACCESS_TOKEN`, `IMAGE_BASE_URL` が必須)

- [ ] **Step 1: 失敗するテストを書く**

`scripts/publish-instagram.test.mjs` を作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCaption, listSlideImages, buildPublishedRecord, parseDirArg } from './publish-instagram.mjs';

test('buildCaptionはcaptionとhashtagsを改行区切りで結合する', () => {
  const caption = buildCaption({ caption: '本文です', hashtags: ['#AI', '#DX'] });
  assert.equal(caption, '本文です\n\n#AI #DX');
});

test('buildCaptionはhashtagsが無くてもエラーにならない', () => {
  const caption = buildCaption({ caption: '本文です' });
  assert.equal(caption, '本文です');
});

test('listSlideImagesはslide-N.pngだけを番号順で返す', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slides-test-'));
  fs.writeFileSync(path.join(dir, 'slide-2.png'), '');
  fs.writeFileSync(path.join(dir, 'slide-10.png'), '');
  fs.writeFileSync(path.join(dir, 'slide-1.png'), '');
  fs.writeFileSync(path.join(dir, 'inspection.md'), '');
  const images = listSlideImages(dir);
  assert.deepEqual(images, ['slide-1.png', 'slide-2.png', 'slide-10.png']);
});

test('buildPublishedRecordは投稿日時とmediaIdを含む', () => {
  const record = buildPublishedRecord('178912345', new Date('2026-08-13T03:31:00.000Z'));
  assert.deepEqual(record, { postedAt: '2026-08-13T03:31:00.000Z', mediaId: '178912345' });
});

test('parseDirArgは--dirの次の値を返す', () => {
  assert.equal(parseDirArg(['--dir', '2026-08-13-a']), '2026-08-13-a');
});

test('parseDirArgは--dirが無ければnullを返す', () => {
  assert.equal(parseDirArg([]), null);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test scripts/publish-instagram.test.mjs`
Expected: FAIL(`scripts/publish-instagram.mjs` が存在しないため `Cannot find module` エラー)

- [ ] **Step 3: 実装する**

`scripts/publish-instagram.mjs` を作成する。Graph API呼び出し部分は `src/publish.js` のロジックをそのまま流用し、読み込み元だけ `posts/<dir>/slides.json` に変更する。

```javascript
// Instagram公式API(Content Publishing)でカルーセル投稿する。
// 前提: 画像が公開URLで取得できること(publish.yml が posts/<dir> の内容を
//       マージ後のコミットに含め、IMAGE_BASE_URL 環境変数で渡す)。
// 必要な環境変数: IG_USER_ID, IG_ACCESS_TOKEN, IMAGE_BASE_URL
// 入力: posts/<dir>/slides.json (caption, hashtags) と posts/<dir>/slide-*.png
// 出力: posts/<dir>/published.json (投稿成功時のみ)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
// 「Instagramログインによる API設定」(IGAAで始まるトークン)は graph.facebook.com ではなく
// graph.instagram.com を使う。Facebookページ経由の旧方式とはAPIのホストが異なる点に注意。
const API = `https://graph.instagram.com/${process.env.GRAPH_API_VERSION || 'v23.0'}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseDirArg(argv) {
  const idx = argv.indexOf('--dir');
  if (idx === -1 || !argv[idx + 1]) return null;
  return argv[idx + 1];
}

export function buildCaption(post) {
  return [post.caption, '', (post.hashtags || []).join(' ')].join('\n').trim();
}

export function listSlideImages(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^slide-\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
}

export function buildPublishedRecord(mediaId, now = new Date()) {
  return { postedAt: now.toISOString(), mediaId };
}

async function graph(pathname, params) {
  const res = await fetch(`${API}/${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, access_token: process.env.IG_ACCESS_TOKEN }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Graph APIエラー (${pathname}): ${JSON.stringify(data.error || data)}`);
  return data;
}

async function waitUntilReady(containerId, label) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${API}/${containerId}?fields=status_code&access_token=${process.env.IG_ACCESS_TOKEN}`);
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`コンテナ処理失敗 (${label}): ${JSON.stringify(data)}`);
    await sleep(3000);
  }
  throw new Error(`コンテナ処理がタイムアウトしました (${label})`);
}

async function notifyChatwork(message) {
  const token = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID;
  if (!token || !roomId) return;
  await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ body: message }),
  }).catch((e) => console.warn('Chatwork通知に失敗:', e.message));
}

async function main() {
  const targetDir = parseDirArg(process.argv.slice(2));
  if (!targetDir) throw new Error('--dir <posts配下のフォルダ名> を指定してください');

  const { IG_USER_ID, IG_ACCESS_TOKEN, IMAGE_BASE_URL } = process.env;
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) throw new Error('IG_USER_ID / IG_ACCESS_TOKEN が設定されていません');
  if (!IMAGE_BASE_URL) throw new Error('IMAGE_BASE_URL が設定されていません(画像の公開URLのベース)');

  const dir = path.join(POSTS_DIR, targetDir);
  const post = JSON.parse(fs.readFileSync(path.join(dir, 'slides.json'), 'utf8'));
  const images = listSlideImages(dir);
  if (images.length < 2) throw new Error('カルーセルには画像が2枚以上必要です');

  const caption = buildCaption(post);

  const children = [];
  for (const img of images) {
    const url = `${IMAGE_BASE_URL.replace(/\/$/, '')}/${img}`;
    console.log(`子コンテナ作成: ${url}`);
    const { id } = await graph(`${IG_USER_ID}/media`, { image_url: url, is_carousel_item: true });
    await waitUntilReady(id, img);
    children.push(id);
  }

  const parent = await graph(`${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
  });
  await waitUntilReady(parent.id, 'carousel');

  const published = await graph(`${IG_USER_ID}/media_publish`, { creation_id: parent.id });
  console.log(`投稿完了! media_id: ${published.id}`);

  fs.writeFileSync(
    path.join(dir, 'published.json'),
    JSON.stringify(buildPublishedRecord(published.id), null, 2)
  );
  console.log(`posts/${targetDir}/published.json を作成しました`);

  await notifyChatwork(
    `[info][title]Instagram自動投稿 完了[/title]フォルダ: ${targetDir}\nスライド: ${images.length}枚\nmedia_id: ${published.id}[/info]`
  );
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch(async (e) => {
    console.error(e);
    await notifyChatwork(`[info][title]Instagram自動投稿 失敗[/title]${String(e.message).slice(0, 500)}[/info]`).catch(() => {});
    process.exit(1);
  });
}
```

**注記:** `src/publish.js` は変更・削除しない。`daily-post.yml`(未変更のまま残す)が `npm run publish:ig` 経由でこのファイルに依存し続けるため。

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test scripts/publish-instagram.test.mjs`
Expected: PASS(6テストすべて成功。Graph API呼び出し部分はネットワークアクセスを伴うため、既存の `src/publish.js` 同様ユニットテスト対象外とし、Task 6で手動確認する)

- [ ] **Step 5: コミット**

```bash
git add scripts/publish-instagram.mjs scripts/publish-instagram.test.mjs
git commit -m "posts配下のフォルダを投稿するpublish-instagram.mjsを追加"
```

---

### Task 3: `package.json` にnpmスクリプトを追加

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1・Task 2で作成した `scripts/detect-pending.mjs`, `scripts/publish-instagram.mjs`, `scripts/*.test.mjs`

- [ ] **Step 1: package.jsonのscriptsに追記する**

現在の `package.json` の `scripts` は以下の内容。

```json
  "scripts": {
    "generate": "node src/generate.js",
    "render": "node src/render.js",
    "publish:ig": "node src/publish.js",
    "post": "npm run generate && npm run render"
  },
```

これを以下に置き換える(既存3項目は変更せず、`detect-pending` / `publish:instagram` / `test` を追加するだけ)。

```json
  "scripts": {
    "generate": "node src/generate.js",
    "render": "node src/render.js",
    "publish:ig": "node src/publish.js",
    "post": "npm run generate && npm run render",
    "detect-pending": "node scripts/detect-pending.mjs",
    "publish:instagram": "node scripts/publish-instagram.mjs",
    "test": "node --test scripts/*.test.mjs"
  },
```

- [ ] **Step 2: テストスクリプトが通ることを確認する**

Run: `npm test`
Expected: PASS(Task 1・Task 2のテスト合計12件がすべて成功)

- [ ] **Step 3: コミット**

```bash
git add package.json
git commit -m "detect-pending/publish:instagram/testのnpmスクリプトを追加"
```

---

### Task 4: `.github/workflows/publish.yml` の新設

**Files:**
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: `scripts/detect-pending.mjs`(CLI、`GITHUB_OUTPUT` に `has_pending`/`dir` を出力)
- Consumes: `scripts/publish-instagram.mjs`(CLI、`--dir` 引数と環境変数 `IG_USER_ID`/`IG_ACCESS_TOKEN`/`IMAGE_BASE_URL`/`CHATWORK_API_TOKEN`/`CHATWORK_ROOM_ID`)

- [ ] **Step 1: ワークフローファイルを作成する**

`.github/workflows/publish.yml` を作成する。

```yaml
# posts/ への変更(検収合格→PR→mainマージ)をトリガーにInstagramへカルーセル投稿する。
# 生成・画像化はここでは行わない。posts/<dir> に既に揃っているファイルを使って投稿するだけ。
name: publish-instagram

on:
  push:
    branches: [main]
    paths:
      - 'posts/**'
  workflow_dispatch:
    inputs:
      dir:
        description: '投稿対象フォルダ名(例: 2026-08-13-ai-agent-basics)。未指定なら自動検出'
        type: string
        default: ''
      dry_run:
        description: '検出のみ行い、実際には投稿しない'
        type: boolean
        default: true

permissions:
  contents: write

concurrency:
  group: publish-instagram
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: 依存関係のインストール
        run: npm ci

      - name: 未投稿の検出
        id: detect
        run: |
          if [ -n "${{ inputs.dir }}" ]; then
            node scripts/detect-pending.mjs --dir "${{ inputs.dir }}"
          else
            node scripts/detect-pending.mjs
          fi

      - name: Instagramへ投稿
        if: ${{ steps.detect.outputs.has_pending == 'true' && (github.event_name == 'push' || inputs.dry_run == false) }}
        env:
          IG_USER_ID: ${{ secrets.IG_USER_ID }}
          IG_ACCESS_TOKEN: ${{ secrets.IG_ACCESS_TOKEN }}
          IMAGE_BASE_URL: https://raw.githubusercontent.com/${{ github.repository }}/${{ github.sha }}/posts/${{ steps.detect.outputs.dir }}
          CHATWORK_API_TOKEN: ${{ secrets.CHATWORK_API_TOKEN }}
          CHATWORK_ROOM_ID: ${{ secrets.CHATWORK_ROOM_ID }}
        run: node scripts/publish-instagram.mjs --dir "${{ steps.detect.outputs.dir }}"

      # AGENTS.mdの「mainへの直接コミット禁止」の例外として扱う(投稿完了の機械的な記録のみ。
      # 詳細は docs/superpowers/specs/2026-08-12-act5-publish-trigger-design.md 参照)
      - name: 投稿完了を記録
        id: commit
        if: ${{ steps.detect.outputs.has_pending == 'true' && (github.event_name == 'push' || inputs.dry_run == false) }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add "posts/${{ steps.detect.outputs.dir }}/published.json"
          git commit -m "投稿完了記録: ${{ steps.detect.outputs.dir }}"
          success=false
          for i in 1 2 3; do
            if git push; then
              success=true
              break
            fi
            echo "push失敗、リトライします ($i/3)"
            git pull --rebase
            sleep 5
          done
          if [ "$success" != "true" ]; then
            echo "::error::published.jsonのpushに失敗しました。手動で posts/${{ steps.detect.outputs.dir }}/published.json を作成してください"
            exit 1
          fi

      - name: 記録失敗をChatworkに通知
        if: ${{ steps.commit.outcome == 'failure' }}
        run: |
          curl -s -X POST "https://api.chatwork.com/v2/rooms/${{ secrets.CHATWORK_ROOM_ID }}/messages" \
            -H "X-ChatWorkToken: ${{ secrets.CHATWORK_API_TOKEN }}" \
            --data-urlencode "body=[info][title]Instagram自動投稿 記録失敗[/title]投稿は成功した可能性がありますが published.json の記録に失敗しました。手動で posts/${{ steps.detect.outputs.dir }}/published.json を作成してください。[/info]"
```

- [ ] **Step 2: YAMLとして正しく読み込めることを確認する**

`js-yaml` は既存の依存関係にあるため、追加インストールなしで構文チェックできる。

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/publish.yml','utf8')); console.log('OK')"`
Expected: `OK` と表示される(構文エラーがあれば例外で落ちる)

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/publish.yml
git commit -m "投稿トリガー用のpublish.ymlを追加"
```

---

### Task 5: `daily-post.yml` へ注記コメントを追加

**Files:**
- Modify: `.github/workflows/daily-post.yml`

- [ ] **Step 1: ワークフロー名の直後に注記コメントを追加する**

現在の該当箇所:

```yaml
name: daily-instagram-post

on:
```

これを以下に置き換える(コメント2行を追加するだけ、他は一切変更しない)。

```yaml
name: daily-instagram-post
# publish.yml(mainへのposts/push起動)が本番の投稿トリガーになったため、
# このワークフローはテスト目的以外で dry_run: false 実行しないこと。

on:
```

- [ ] **Step 2: YAMLとして正しく読み込めることを確認する**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/daily-post.yml','utf8')); console.log('OK')"`
Expected: `OK` と表示される

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/daily-post.yml
git commit -m "daily-post.ymlにpublish.yml併存の注記を追加"
```

---

### Task 6: 手動動作確認

**Files:** なし(検証のみ)

- [ ] **Step 1: ダミーの投稿フォルダでdetect-pendingをローカル確認する**

```bash
mkdir -p posts/2099-01-01-plan-test
echo '# 検収結果: 合格(第1回)' > posts/2099-01-01-plan-test/inspection.md
echo '{"caption":"テスト","hashtags":[]}' > posts/2099-01-01-plan-test/slides.json
node scripts/detect-pending.mjs
```

Expected: `未投稿のフォルダ: 2099-01-01-plan-test` と表示される

- [ ] **Step 2: published.jsonがあると対象外になることを確認する**

```bash
echo '{"postedAt":"2026-08-12T00:00:00.000Z","mediaId":"dummy"}' > posts/2099-01-01-plan-test/published.json
node scripts/detect-pending.mjs
```

Expected: `未投稿のフォルダはありません` と表示される

- [ ] **Step 3: ダミーフォルダを削除する**

```bash
rm -rf posts/2099-01-01-plan-test
git status
```

Expected: `posts/2099-01-01-plan-test` がgit管理下に入っていないこと(untrackedのまま削除されただけ)を確認する

- [ ] **Step 4: GitHub Actions上でdry_run確認する(ブランチをpush後)**

GitHub上で `publish.yml` を `workflow_dispatch` から `dry_run: true` のまま実行し、`未投稿の検出` ステップが正常に完了する(エラーにならない)ことを確認する。この時点では実際のIG投稿・mainへのコミットは発生しない。

- [ ] **Step 5: 実際の投稿を伴うテストは必ず事前確認する**

`dry_run: false` での実行、または実際に `posts/` へPRをマージしてのテストは、CLAUDE.mdの禁止事項4番により**必ず事前にユーザーへ確認してから**実行する。このタスクではコード変更は行わない。
