# 幕1〜5の完全自動化(Gemini API単独経路) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 平日JST12:30にGitHub Actionsが自動起動し、Gemini APIだけで一次ソース収集→構成案作成→文言清書→自己検収(reject-retry)を行い、合格したら既存のpublish.ymlに接続してInstagram投稿まで無人で完了させる。あわせて手動経路(Claude Codeエージェント)から「第2幕の構成承認待ち」を撤廃する。

**Architecture:** `scripts/auto/` 配下に、researcher/director/producer/inspector相当の処理をGemini API直叫びで再現する小さな純粋関数群(プロンプト生成+結果整形)を作り、`scripts/run-auto-pipeline.mjs` がそれらを注入(依存性注入)して束ねるオーケストレーターになる。実際のPlaywright画像化・Instagram投稿・git操作は既存の `src/render.js`・`scripts/slides-to-post.mjs`・`.github/workflows/publish.yml` をそのまま再利用し、新設する `.github/workflows/auto-company-post.yml` のシェルステップから呼び出す。

**Tech Stack:** Node.js 22(ESM)、Gemini API(`generateContent`、JSON生成モード+Google検索グラウンディング)、GitHub CLI(`gh`、Issue作成用)、GitHub Actions、`node:test`。

## Global Constraints

- 新規npmパッケージは追加しない(`fetch`はNode標準、`gh`はActionsランナーにプリインストール済み)
- 新規シークレットは追加しない。既存の `GEMINI_API_KEY`・`CHATWORK_API_TOKEN`・`CHATWORK_ROOM_ID` のみ使う
- `src/generate.js`・`src/render.js`・`scripts/slides-to-post.mjs`・`scripts/detect-pending.mjs`・`scripts/publish-instagram.mjs`・`.github/workflows/publish.yml` は変更しない(設計書 `docs/superpowers/specs/2026-08-14-auto-post-pipeline-design.md` の決定)
- 新規テストファイルは `node:test` + `node:assert/strict` を使い、既存の `scripts/*.test.mjs` と同じスタイル(純粋関数を `export` し、ネットワーク呼び出しは依存性注入で差し替え可能にする)に合わせる
- コミットメッセージは1行の日本語
- テキストのプロンプト・コメントはすべて日本語

---

## Task 1: テスト実行対象に `scripts/auto/` を追加し、最初のモジュール(`topic.mjs`)を作る

現在の `package.json` の `test` スクリプトは `scripts/*.test.mjs` と `src/lib/*.test.mjs` しか拾わない。新しいテストは `scripts/auto/` サブディレクトリに置くため、先にこのグロブを直しておく。

**Files:**
- Modify: `package.json`(`scripts.test`)
- Create: `scripts/auto/topic.mjs`
- Test: `scripts/auto/topic.test.mjs`

**Interfaces:**
- Produces: `pickTopic(topicsYmlPath: string, now?: Date): { theme: string, points?: string, category: string }` — 他の全モジュールがテーマ選定に使う

- [ ] **Step 1: package.json のtestスクリプトを直す**

`package.json` の `"scripts"` セクション内、現在の行:

```json
    "test": "node --test scripts/*.test.mjs src/lib/*.test.mjs"
```

を次に置き換える:

```json
    "test": "node --test scripts/*.test.mjs scripts/auto/*.test.mjs src/lib/*.test.mjs"
```

- [ ] **Step 2: 失敗する状態を確認するため、先にテストを書く**

`scripts/auto/topic.test.mjs` を作成:

```js
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
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `node --test scripts/auto/topic.test.mjs`
Expected: FAIL (`scripts/auto/topic.mjs` が存在しないため `ERR_MODULE_NOT_FOUND`)

- [ ] **Step 4: 実装を書く**

`scripts/auto/topic.mjs` を作成:

```js
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
```

- [ ] **Step 5: テストが通ることを確認**

Run: `node --test scripts/auto/topic.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 6: commit**

```bash
git add package.json scripts/auto/topic.mjs scripts/auto/topic.test.mjs
git commit -m "自動投稿パイプライン用のtopic選定モジュールを追加"
```

---

## Task 2: 日付・スラッグのユーティリティ(`slug.mjs`)

**Files:**
- Create: `scripts/auto/slug.mjs`
- Test: `scripts/auto/slug.test.mjs`

**Interfaces:**
- Consumes: なし
- Produces: `todayJst(now?: Date): string`(`YYYY-MM-DD`)、`sanitizeSlug(input: string, fallback: string): string`、`fallbackSlugFromTheme(theme: string): string`

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/slug.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayJst, sanitizeSlug, fallbackSlugFromTheme } from './slug.mjs';

test('todayJstはJSTの日付をYYYY-MM-DD形式で返す', () => {
  // UTC 2026-08-13T20:00:00 = JST 2026-08-14T05:00:00
  assert.equal(todayJst(new Date('2026-08-13T20:00:00.000Z')), '2026-08-14');
});

test('sanitizeSlugは英数とハイフンだけを残す', () => {
  assert.equal(sanitizeSlug('AI-Agent 2026!!', 'fallback'), 'ai-agent-2026');
});

test('sanitizeSlugは空になったらfallbackを返す', () => {
  assert.equal(sanitizeSlug('ホームページ制作', 'fallback-slug'), 'fallback-slug');
});

test('sanitizeSlugは前後の余分なハイフンを除く', () => {
  assert.equal(sanitizeSlug('--hello--', 'fallback'), 'hello');
});

test('fallbackSlugFromThemeは同じテーマから同じスラッグを生成する(決定的)', () => {
  const a = fallbackSlugFromTheme('AIに選ばれるHPの作り方');
  const b = fallbackSlugFromTheme('AIに選ばれるHPの作り方');
  assert.equal(a, b);
  assert.match(a, /^post-[0-9a-f]{10}$/);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/slug.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/slug.mjs`:

```js
// posts/<dir>/ のディレクトリ名(YYYY-MM-DD-<slug>)を組み立てるためのユーティリティ。
export function todayJst(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function sanitizeSlug(input, fallback) {
  const cleaned = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

// AIが有効なslugを返さなかった場合の保険。テーマ文字列から決定的に短い英数字列を作る。
export function fallbackSlugFromTheme(theme) {
  return 'post-' + Buffer.from(String(theme), 'utf8').toString('hex').slice(0, 10);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/slug.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/slug.mjs scripts/auto/slug.test.mjs
git commit -m "自動投稿パイプライン用の日付・スラッグユーティリティを追加"
```

---

## Task 3: Gemini API呼び出しの薄いラッパー(`gemini-client.mjs`)

**Files:**
- Create: `scripts/auto/gemini-client.mjs`
- Test: `scripts/auto/gemini-client.test.mjs`

**Interfaces:**
- Produces: `extractFirstJsonObject(text: string): string`、`callGeminiJson(prompt: string, opts?): Promise<object>`、`callGeminiGrounded(prompt: string, opts?): Promise<{ text: string, sources: Array<{url: string, title: string}> }>`
- 後続タスク(research/structure/copywrite/gemini-judge)はすべて `callGeminiJson`/`callGeminiGrounded` を `{ callGeminiJson }` / `{ callGeminiGrounded }` という依存性注入の形で受け取る

- [ ] **Step 1: 失敗するテストを書く(純粋関数の部分のみ。実APIは呼ばない)**

`scripts/auto/gemini-client.test.mjs`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/gemini-client.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/gemini-client.mjs`:

```js
// Gemini APIを直接呼ぶ薄いラッパー。JSON生成モードと検索グラウンディングモードの2種類を提供する。
// リトライ・JSON抽出のロジックは src/generate.js の callGemini() と同じ考え方(設計書の決定により
// generate.js自体は変更せず、こちらは自動投稿パイプライン専用として複製する)。
import 'dotenv/config';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(err) {
  if (err.status === 429 || err.status >= 500) return true;
  if (!err.status) return true;
  return false;
}

// Geminiが末尾に余分な文字を付けることがあるため、最初の "{" から対応する "}" までだけを取り出す。
export function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

async function requestOnce({ prompt, tools, apiKey, model }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  if (tools) body.tools = tools;
  else body.generationConfig = { responseMimeType: 'application/json', temperature: 0.9 };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Gemini APIエラー: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function requestWithRetry(opts, attempts) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await requestOnce(opts);
    } catch (e) {
      lastErr = e;
      if (i === attempts || !isRetryable(e)) throw e;
      console.warn(`Gemini呼び出し失敗(${i}/${attempts}回目、リトライします): ${e.message}`);
      await sleep(2000 * 2 ** (i - 1));
    }
  }
  throw lastErr;
}

function extractText(data) {
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Geminiの応答が空です(finishReason: ${candidate?.finishReason ?? '不明'})`);
  return { text, candidate };
}

export async function callGeminiJson(
  prompt,
  { attempts = 3, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}
) {
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');
  const data = await requestWithRetry({ prompt, apiKey, model }, attempts);
  const { text } = extractText(data);
  return JSON.parse(extractFirstJsonObject(text));
}

export async function callGeminiGrounded(
  prompt,
  { attempts = 3, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-2.5-flash' } = {}
) {
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');
  const data = await requestWithRetry({ prompt, apiKey, model, tools: [{ google_search: {} }] }, attempts);
  const { text, candidate } = extractText(data);
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c) => c.web && { url: c.web.uri, title: c.web.title }).filter(Boolean);
  return { text, sources };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/gemini-client.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/gemini-client.mjs scripts/auto/gemini-client.test.mjs
git commit -m "Gemini API呼び出しの薄いラッパーを追加"
```

---

## Task 4: 機械チェック(`mechanical-check.mjs`) — inspector相当・客観項目

**Files:**
- Create: `scripts/auto/mechanical-check.mjs`
- Test: `scripts/auto/mechanical-check.test.mjs`

**Interfaces:**
- Consumes: `slidesJson`(producer.md互換スキーマ: `{slug, caption, hashtags, sources, slides: [{no, heading, body, source_ref}]}`)、`tokens`(`templates/carousel/tokens.json`の内容)
- Produces: `mechanicalCheck(slidesJson, tokens): { ok: boolean, violations: string[] }` — 後続の `inspect-loop.mjs` が使う

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/mechanical-check.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mechanicalCheck } from './mechanical-check.mjs';

function tokensFixture() {
  return {
    font: { heading: { maxChars: 20 }, body: { maxChars: 60 } },
    limits: { slideTotalChars: 80, slideCountMin: 8, slideCountMax: 10 },
  };
}

function slidesFixture(count = 8) {
  return {
    slug: 'test',
    caption: '本文',
    hashtags: ['#a', '#b'],
    sources: ['https://example.com'],
    slides: Array.from({ length: count }, (_, i) => ({
      no: i + 1,
      heading: '見出し',
      body: '本文です',
      source_ref: 'https://example.com',
    })),
  };
}

test('mechanicalCheckは全項目クリアならokになる', () => {
  const result = mechanicalCheck(slidesFixture(8), tokensFixture());
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('mechanicalCheckはスライド枚数が8枚未満だとNG', () => {
  const result = mechanicalCheck(slidesFixture(5), tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations[0], /枚数/);
});

test('mechanicalCheckはスライド枚数が10枚超だとNG', () => {
  const result = mechanicalCheck(slidesFixture(11), tokensFixture());
  assert.equal(result.ok, false);
});

test('mechanicalCheckはhashtagsが4個以上だとNG', () => {
  const input = slidesFixture(8);
  input.hashtags = ['#a', '#b', '#c', '#d'];
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /hashtags/);
});

test('mechanicalCheckは見出しが上限字数を超えるとNG', () => {
  const input = slidesFixture(8);
  input.slides[0].heading = 'あ'.repeat(21);
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /1枚目の見出し/);
});

test('mechanicalCheckはsource_refが無いスライドがあるとNG', () => {
  const input = slidesFixture(8);
  delete input.slides[2].source_ref;
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /3枚目/);
});

test('mechanicalCheckは合計文字数が上限を超えるとNG', () => {
  const input = slidesFixture(8);
  input.slides[1].heading = 'あ'.repeat(20);
  input.slides[1].body = 'い'.repeat(60);
  const result = mechanicalCheck(input, tokensFixture());
  assert.equal(result.ok, false);
  assert.match(result.violations.join(''), /合計文字数/);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/mechanical-check.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/mechanical-check.mjs`:

```js
// slides.json(producer.md互換スキーマ)を、tokens.jsonの文字数上限などに照らして機械的に検証する。
// 文字数はAIに数えさせるより確実なため、コードで判定する
// (rubric/carousel.mdの「2. 文字量」「3-1 枚数」に対応。定性項目はgemini-judge.mjsが担当する)。
export function mechanicalCheck(slidesJson, tokens) {
  const violations = [];
  const slides = slidesJson.slides || [];

  if (slides.length < tokens.limits.slideCountMin || slides.length > tokens.limits.slideCountMax) {
    violations.push(
      `スライド枚数が${slides.length}枚です(${tokens.limits.slideCountMin}〜${tokens.limits.slideCountMax}枚が必要)`
    );
  }

  if (!Array.isArray(slidesJson.hashtags) || slidesJson.hashtags.length > 3) {
    violations.push(`hashtagsが${slidesJson.hashtags?.length ?? 0}個です(3個以内が必要)`);
  }

  slides.forEach((s, i) => {
    const heading = s.heading || '';
    const body = s.body || '';
    const n = i + 1;
    if (heading.length > tokens.font.heading.maxChars) {
      violations.push(`${n}枚目の見出しが${heading.length}字です(${tokens.font.heading.maxChars}字以内)`);
    }
    if (body.length > tokens.font.body.maxChars) {
      violations.push(`${n}枚目の本文が${body.length}字です(${tokens.font.body.maxChars}字以内)`);
    }
    if (heading.length + body.length > tokens.limits.slideTotalChars) {
      violations.push(
        `${n}枚目の合計文字数が${heading.length + body.length}字です(${tokens.limits.slideTotalChars}字以内)`
      );
    }
    if (!s.source_ref) {
      violations.push(`${n}枚目に source_ref がありません`);
    }
  });

  return { ok: violations.length === 0, violations };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/mechanical-check.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/mechanical-check.mjs scripts/auto/mechanical-check.test.mjs
git commit -m "自動検収の機械チェック(文字数・枚数)を追加"
```

---

## Task 5: 一次ソース収集(`research.mjs`) — researcher相当

**Files:**
- Create: `scripts/auto/research.mjs`
- Test: `scripts/auto/research.test.mjs`

**Interfaces:**
- Consumes: `topic: { theme, points?, category }`、`{ callGeminiGrounded }`(Task 3の `callGeminiGrounded` と同じシグネチャ)
- Produces: `gatherSources(topic, deps): Promise<{ sufficient: boolean, sources: Array<{url,title}>, summary: string }>` — Task 6・7・9が使う

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/research.test.mjs`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/research.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/research.mjs`:

```js
// 一次ソース収集(researcher.md相当)。Gemini検索グラウンディングで探し、
// rubric/carousel.mdの「1-4 件数: 3件以上」を満たすかを判定する。
export function buildResearchPrompt(topic) {
  return `あなたはWeb制作会社のリサーチ担当です。次のテーマについて、直近14日以内に公開された
一次情報(公式ブログ・公式ドキュメント・論文・一次発表のいずれか。まとめ記事や個人の解説記事は不可)を
Google検索で調べ、3件以上見つけてください。

# テーマ
${topic.theme}
${topic.points ? `切り口の候補: ${topic.points}` : ''}

見つけた情報は、後続の担当者が読むための短いメモとして日本語200字程度で要約してください。`;
}

export function extractSources(groundingResult) {
  const seen = new Set();
  const sources = [];
  for (const s of groundingResult.sources || []) {
    if (!s?.url || seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push(s);
  }
  return sources;
}

export async function gatherSources(topic, { callGeminiGrounded }) {
  const prompt = buildResearchPrompt(topic);
  const result = await callGeminiGrounded(prompt);
  const sources = extractSources(result);
  return { sufficient: sources.length >= 3, sources, summary: result.text };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/research.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/research.mjs scripts/auto/research.test.mjs
git commit -m "自動投稿パイプラインの一次ソース収集モジュールを追加"
```

---

## Task 6: 構成案作成(`structure.mjs`) — director相当

**Files:**
- Create: `scripts/auto/structure.mjs`
- Test: `scripts/auto/structure.test.mjs`

**Interfaces:**
- Consumes: `topic`、`sources: Array<{url,title}>`(Task 5の出力)、`{ callGeminiJson }`(Task 3)
- Produces: `buildStructure(topic, sources, deps): Promise<Array<{role, point, sourceIndex}>>`(8〜10要素) — Task 9が使う

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/structure.test.mjs`:

```js
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
  await assert.rejects(() => buildStructure({ theme: 'テスト' }, sourcesFixture(), { callGeminiJson }), /8〜10枚/);
});

test('buildStructureはスライド数が10枚超だとエラーを投げる', async () => {
  const slides = Array.from({ length: 11 }, () => ({ role: 'body', point: 'x', sourceIndex: 1 }));
  const callGeminiJson = async () => ({ slides });
  await assert.rejects(() => buildStructure({ theme: 'テスト' }, sourcesFixture(), { callGeminiJson }), /8〜10枚/);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/structure.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/structure.mjs`:

```js
// 構成案作成(director.md相当)。一次ソースだけを根拠に8〜10枚のスライド構成を作らせる。
export function buildStructurePrompt(topic, sources) {
  const sourceList = sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n');
  return `あなたはInstagramカルーセル投稿の構成作家です。次の一次ソースだけを根拠に、
8〜10枚のスライド構成案を考えてください。ここに無い情報を足してはいけません。

# テーマ
${topic.theme}

# 一次ソース
${sourceList}

# 構成の型
1枚目: フック(数字・意外性・問題提起のいずれかを含む)
2枚目: 前提の共有(なぜ今これが重要か)
3〜(N-1)枚目: 本文。1枚1メッセージ、詰め込まない
最終枚: まとめ+行動喚起

各スライドに、上記ソース番号(1〜${sources.length})を根拠として1つだけ紐付けてください。
紐付けられないスライドは作らないでください。

# 出力形式(JSON以外は出力しない)
{
  "slides": [
    { "role": "hook", "point": "このスライドで伝えること(1行)", "sourceIndex": 1 }
  ]
}`;
}

export async function buildStructure(topic, sources, { callGeminiJson }) {
  const prompt = buildStructurePrompt(topic, sources);
  const result = await callGeminiJson(prompt);
  const slides = result.slides;
  if (!Array.isArray(slides) || slides.length < 8 || slides.length > 10) {
    throw new Error(`構成案のスライド数が不正です(8〜10枚が必要、実際は${slides?.length ?? 0}枚)`);
  }
  return slides;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/structure.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/structure.mjs scripts/auto/structure.test.mjs
git commit -m "自動投稿パイプラインの構成案作成モジュールを追加"
```

---

## Task 7: 文言清書(`copywrite.mjs`) — producer相当

**Files:**
- Create: `scripts/auto/copywrite.mjs`
- Test: `scripts/auto/copywrite.test.mjs`

**Interfaces:**
- Consumes: `topic`、`structure`(Task 6の出力)、`sources`(Task 5の出力)、`tokens`(tokens.json)、`{ callGeminiJson }`、`rejectionReasons?: string[]`
- Produces: `writeSlides(topic, structure, sources, tokens, deps, rejectionReasons?): Promise<slidesJson>`(producer.md互換スキーマ) — Task 9が使う

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/copywrite.test.mjs`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/copywrite.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/copywrite.mjs`:

```js
// 文言清書(producer.md相当)。構成案をもとに、producer.mdと同じslides.jsonスキーマで
// 文言をGeminiに書かせる。不合格で差し戻された場合はrejectionReasonsに理由を積んで再生成する。
export function buildCopyPrompt(topic, structure, sources, tokens, rejectionReasons = []) {
  const sourceList = sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n');
  const structureList = structure
    .map((s, i) => `${i + 1}. [${s.role}] ${s.point}(根拠: ソース${s.sourceIndex})`)
    .join('\n');
  const retryNote = rejectionReasons.length
    ? `\n# 前回の差し戻し理由(必ず直すこと)\n${rejectionReasons.map((r) => `- ${r}`).join('\n')}\n`
    : '';

  return `あなたはWeb制作会社のSNS担当です。次の構成案をもとに、Instagramカルーセル投稿の
文言を清書してください。

# テーマ
${topic.theme}

# 一次ソース
${sourceList}

# 構成案
${structureList}
${retryNote}
# 文字数の上限(厳守。超えたら書き直す。フォントを縮めることでは解決しない)
- 見出し: ${tokens.font.heading.maxChars}字以内
- 本文: ${tokens.font.body.maxChars}字以内
- 1スライドの合計(見出し+本文): ${tokens.limits.slideTotalChars}字以内

# ルール
- 1スライド1メッセージ
- 未確定情報には「〜とされています」「〜と発表されました」の留保をつける
- 断定してよいのはソースで確定と分類されたものだけ
- hashtagsは3個以内、関連性の高いものだけ厳選する
- source_refには、そのスライドの根拠にした一次ソースのURLをそのまま入れる

# 出力形式(JSON以外は出力しない)
{
  "slug": "半角英数とハイフンだけの短いスラッグ",
  "caption": "投稿本文(300〜500文字)",
  "hashtags": ["#タグ1", "#タグ2", "#タグ3"],
  "sources": [${sources.map((s) => `"${s.url}"`).join(', ')}],
  "slides": [
    { "no": 1, "heading": "", "body": "", "source_ref": "" }
  ]
}`;
}

export async function writeSlides(topic, structure, sources, tokens, { callGeminiJson }, rejectionReasons = []) {
  const prompt = buildCopyPrompt(topic, structure, sources, tokens, rejectionReasons);
  return callGeminiJson(prompt);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/copywrite.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/copywrite.mjs scripts/auto/copywrite.test.mjs
git commit -m "自動投稿パイプラインの文言清書モジュールを追加"
```

---

## Task 8: 定性判定(`gemini-judge.mjs`) — inspector相当・rubric判定

**Files:**
- Create: `scripts/auto/gemini-judge.mjs`
- Test: `scripts/auto/gemini-judge.test.mjs`

**Interfaces:**
- Consumes: `slidesJson`、`sources`、`rubricMarkdown: string`(`rubric/carousel.md`の内容)、`{ callGeminiJson }`
- Produces: `judgeContent(slidesJson, sources, rubricMarkdown, deps): Promise<{ ok: boolean, reasons: string[] }>` — Task 9が使う

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/gemini-judge.test.mjs`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/gemini-judge.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/gemini-judge.mjs`:

```js
// 定性判定(inspector.md相当)。文字数など機械的に数えられる項目は mechanical-check.mjs が
// 担当済みのため、ここではrubric/carousel.mdのうち「1. 情報鮮度」「4. 表現の正確さ」など
// 判断が必要な項目だけをGeminiに判定させる。
export function buildJudgePrompt(slidesJson, sources, rubricMarkdown) {
  return `あなたは投稿の品質検収担当です。次のルーブリックのうち「1. 情報鮮度」「4. 表現の正確さ」の
項目だけを判定してください(文字数・枚数など機械的に数えられる項目は別途チェック済みのため対象外です)。
1項目でもNGがあれば全体を不合格としてください。

# ルーブリック
${rubricMarkdown}

# 一次ソース
${JSON.stringify(sources)}

# 検収対象
${JSON.stringify(slidesJson)}

# 出力形式(JSON以外は出力しない)
{ "ok": true, "reasons": [] }

不合格の場合は "ok": false とし、"reasons" に「どのスライドの何が問題か」を日本語で具体的に書いてください。`;
}

export async function judgeContent(slidesJson, sources, rubricMarkdown, { callGeminiJson }) {
  const prompt = buildJudgePrompt(slidesJson, sources, rubricMarkdown);
  return callGeminiJson(prompt);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/gemini-judge.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/gemini-judge.mjs scripts/auto/gemini-judge.test.mjs
git commit -m "自動投稿パイプラインの定性判定モジュールを追加"
```

---

## Task 9: 文言清書→自己検収のreject-retryループ(`inspect-loop.mjs`)

これが自動経路でいちばん重要な分岐ロジックなので、独立したモジュールとして丁寧にテストする。

**Files:**
- Create: `scripts/auto/inspect-loop.mjs`
- Test: `scripts/auto/inspect-loop.test.mjs`

**Interfaces:**
- Consumes: `topic`、`structure`(Task 6)、`sources`(Task 5)、`tokens`、`rubricMarkdown`、`{ writeSlides, mechanicalCheck, judgeContent, maxAttempts? }`。
  ここで渡す `writeSlides`/`judgeContent` は Task 7/8 の生の export ではなく、
  **`{ callGeminiJson }` などの依存を呼び出し側(Task 14)で束縛済みのラッパー関数**。
  期待するシグネチャは `writeSlides(topic, structure, sources, tokens, rejectionReasons) => Promise<slidesJson>`
  (Task 7の6引数版から `{callGeminiJson}` を除いた5引数版)、
  `judgeContent(slidesJson, sources, rubricMarkdown) => Promise<{ok, reasons}>`
  (Task 8の4引数版から `{callGeminiJson}` を除いた3引数版)。`mechanicalCheck` はTask 4の
  `mechanicalCheck(slidesJson, tokens)` をそのまま渡せる(依存を持たない純粋関数のため)
- Produces: `runCopywriteInspectLoop(topic, structure, sources, tokens, rubricMarkdown, deps): Promise<{ passed: boolean, slidesJson: object, attempts: number, rejectionReasons: string[] }>` — Task 14(オーケストレーター)が使う

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/inspect-loop.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCopywriteInspectLoop } from './inspect-loop.mjs';

function baseArgs() {
  return [{ theme: 'テスト' }, [{ role: 'hook', point: 'x', sourceIndex: 1 }], [{ url: 'https://a.example.com' }], {}, 'rubric'];
}

test('1回目で機械チェック・Gemini判定とも合格なら1回で終わる', async () => {
  let writeSlidesCalls = 0;
  const deps = {
    writeSlides: async () => {
      writeSlidesCalls++;
      return { slides: [] };
    },
    mechanicalCheck: () => ({ ok: true, violations: [] }),
    judgeContent: async () => ({ ok: true, reasons: [] }),
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.equal(result.passed, true);
  assert.equal(result.attempts, 1);
  assert.equal(writeSlidesCalls, 1);
});

test('機械チェックがNGならGemini判定を呼ばずに差し戻す', async () => {
  let judgeCalls = 0;
  const deps = {
    writeSlides: async () => ({ slides: [] }),
    mechanicalCheck: () => ({ ok: false, violations: ['4枚目が72字'] }),
    judgeContent: async () => {
      judgeCalls++;
      return { ok: true, reasons: [] };
    },
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), { ...deps, maxAttempts: 1 });
  assert.equal(result.passed, false);
  assert.equal(judgeCalls, 0);
  assert.deepEqual(result.rejectionReasons, ['4枚目が72字']);
});

test('2回目で合格すればattempts=2で終わる', async () => {
  let call = 0;
  const deps = {
    writeSlides: async () => {
      call++;
      return { slides: [], attempt: call };
    },
    mechanicalCheck: () => ({ ok: true, violations: [] }),
    judgeContent: async () => (call === 1 ? { ok: false, reasons: ['トーンが不適切'] } : { ok: true, reasons: [] }),
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.equal(result.passed, true);
  assert.equal(result.attempts, 2);
});

test('maxAttempts回とも不合格ならpassed=falseで理由を返す', async () => {
  const deps = {
    writeSlides: async () => ({ slides: [] }),
    mechanicalCheck: () => ({ ok: true, violations: [] }),
    judgeContent: async () => ({ ok: false, reasons: ['情報鮮度が14日を超えている'] }),
    maxAttempts: 3,
  };
  const result = await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.equal(result.passed, false);
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.rejectionReasons, ['情報鮮度が14日を超えている']);
});

test('2回目の呼び出しには1回目の差し戻し理由が渡される', async () => {
  const receivedReasons = [];
  let call = 0;
  const deps = {
    writeSlides: async (topic, structure, sources, tokens, reasons) => {
      call++;
      receivedReasons.push(reasons);
      return { slides: [] };
    },
    mechanicalCheck: () => ({ ok: false, violations: ['1回目の理由'] }),
    judgeContent: async () => ({ ok: true, reasons: [] }),
    maxAttempts: 2,
  };
  await runCopywriteInspectLoop(...baseArgs(), deps);
  assert.deepEqual(receivedReasons[0], []);
  assert.deepEqual(receivedReasons[1], ['1回目の理由']);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/inspect-loop.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/inspect-loop.mjs`:

```js
// 文言清書(producer相当)→自己検収(inspector相当)のreject-retryループ。
// inspector.mdの「3回目の不合格でPMに報告する」ルールと同じ回数(既定3回)まで、
// 差し戻し理由をプロンプトに積み増しながら再生成する。
// 構成案(structure)は差し戻しの対象外(director.mdのルールと同じく、やり直すのは文言清書のみ)。
export async function runCopywriteInspectLoop(
  topic,
  structure,
  sources,
  tokens,
  rubricMarkdown,
  { writeSlides, mechanicalCheck, judgeContent, maxAttempts = 3 }
) {
  let slidesJson;
  let rejectionReasons = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    slidesJson = await writeSlides(topic, structure, sources, tokens, rejectionReasons);
    const mech = mechanicalCheck(slidesJson, tokens);
    const judge = mech.ok ? await judgeContent(slidesJson, sources, rubricMarkdown) : { ok: false, reasons: [] };

    if (mech.ok && judge.ok) {
      return { passed: true, slidesJson, attempts: attempt, rejectionReasons: [] };
    }
    rejectionReasons = [...mech.violations, ...(judge.reasons || [])];
  }

  return { passed: false, slidesJson, attempts: maxAttempts, rejectionReasons };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/inspect-loop.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/inspect-loop.mjs scripts/auto/inspect-loop.test.mjs
git commit -m "自動投稿パイプラインのreject-retryループを追加"
```

---

## Task 10: GitHub Issue操作(`github-issue.mjs`)

**Files:**
- Create: `scripts/auto/github-issue.mjs`
- Test: `scripts/auto/github-issue.test.mjs`

**Interfaces:**
- Produces: `createIssue({title, body}, execFile?): number`、`commentIssue(number, body, execFile?): void`、`closeIssue(number, body?, execFile?): void`
- `execFile` は `node:child_process` の `execFileSync` と同じシグネチャ(`(cmd, args, opts) => string`)。既定値は実際の `execFileSync`、テストではフェイク関数を注入する

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/github-issue.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIssue, commentIssue, closeIssue } from './github-issue.mjs';

function fakeExecFile(returnValue) {
  const calls = [];
  const fn = (cmd, args) => {
    calls.push({ cmd, args });
    return returnValue;
  };
  fn.calls = calls;
  return fn;
}

test('createIssueはgh issue createを呼び、URLからIssue番号を取り出す', () => {
  const execFile = fakeExecFile('https://github.com/owner/repo/issues/42\n');
  const number = createIssue({ title: 'タイトル', body: '本文' }, execFile);
  assert.equal(number, 42);
  assert.equal(execFile.calls[0].cmd, 'gh');
  assert.deepEqual(execFile.calls[0].args, ['issue', 'create', '--title', 'タイトル', '--body', '本文']);
});

test('createIssueはURLにissues番号が無いとエラーを投げる', () => {
  const execFile = fakeExecFile('想定外の出力');
  assert.throws(() => createIssue({ title: 't', body: 'b' }, execFile), /Issue番号を取得できません/);
});

test('commentIssueはgh issue commentを正しい引数で呼ぶ', () => {
  const execFile = fakeExecFile('');
  commentIssue(42, 'コメント本文', execFile);
  assert.deepEqual(execFile.calls[0].args, ['issue', 'comment', '42', '--body', 'コメント本文']);
});

test('closeIssueはbody指定時に--commentを付ける', () => {
  const execFile = fakeExecFile('');
  closeIssue(42, 'クローズ理由', execFile);
  assert.deepEqual(execFile.calls[0].args, ['issue', 'close', '42', '--comment', 'クローズ理由']);
});

test('closeIssueはbody省略時に--commentを付けない', () => {
  const execFile = fakeExecFile('');
  closeIssue(42, undefined, execFile);
  assert.deepEqual(execFile.calls[0].args, ['issue', 'close', '42']);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/github-issue.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/github-issue.mjs`:

```js
// GitHub Issueの作成・コメント・クローズ。GitHub Actionsランナーにプリインストールされている
// ghコマンドを使う(GH_TOKEN/GITHUB_TOKENは環境変数から自動的に読まれる)。
import { execFileSync } from 'node:child_process';

export function createIssue({ title, body }, execFile = execFileSync) {
  const output = execFile('gh', ['issue', 'create', '--title', title, '--body', body], { encoding: 'utf8' }).trim();
  const match = output.match(/\/issues\/(\d+)/);
  if (!match) throw new Error(`Issue番号を取得できませんでした(gh issue createの出力: ${output})`);
  return Number(match[1]);
}

export function commentIssue(number, body, execFile = execFileSync) {
  execFile('gh', ['issue', 'comment', String(number), '--body', body], { encoding: 'utf8' });
}

export function closeIssue(number, body, execFile = execFileSync) {
  const args = ['issue', 'close', String(number)];
  if (body) args.push('--comment', body);
  execFile('gh', args, { encoding: 'utf8' });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/github-issue.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/github-issue.mjs scripts/auto/github-issue.test.mjs
git commit -m "自動投稿パイプラインのGitHub Issue操作モジュールを追加"
```

---

## Task 11: Chatwork通知(`notify.mjs`)

**Files:**
- Create: `scripts/auto/notify.mjs`
- Test: `scripts/auto/notify.test.mjs`

**Interfaces:**
- Produces: `notifyChatwork(message: string, opts?: { token?, roomId?, fetchImpl? }): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/notify.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyChatwork } from './notify.mjs';

test('notifyChatworkはtoken/roomIdが無ければ何もしない', async () => {
  let called = false;
  await notifyChatwork('メッセージ', { token: undefined, roomId: undefined, fetchImpl: async () => (called = true) });
  assert.equal(called, false);
});

test('notifyChatworkは正しいURLとヘッダーでPOSTする', async () => {
  let capturedUrl, capturedOpts;
  const fetchImpl = async (url, opts) => {
    capturedUrl = url;
    capturedOpts = opts;
    return { ok: true };
  };
  await notifyChatwork('メッセージ', { token: 'tok', roomId: '123', fetchImpl });
  assert.equal(capturedUrl, 'https://api.chatwork.com/v2/rooms/123/messages');
  assert.equal(capturedOpts.headers['X-ChatWorkToken'], 'tok');
  assert.equal(capturedOpts.method, 'POST');
});

test('notifyChatworkはfetch失敗時も例外を投げない', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };
  await assert.doesNotReject(() => notifyChatwork('メッセージ', { token: 'tok', roomId: '123', fetchImpl }));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/notify.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/notify.mjs`:

```js
// Chatwork通知。scripts/publish-instagram.mjsのnotifyChatwork()と同じ実装だが、
// 設計書の決定によりpublish-instagram.mjsは変更しないため、ここに複製する
// (fetchを差し替え可能にしてテストできるようにした点のみ差分)。
export async function notifyChatwork(message, { token = process.env.CHATWORK_API_TOKEN, roomId = process.env.CHATWORK_ROOM_ID, fetchImpl = fetch } = {}) {
  if (!token || !roomId) return;
  await fetchImpl(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { 'X-ChatWorkToken': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ body: message }),
  }).catch((e) => console.warn('Chatwork通知に失敗:', e.message));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/notify.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/notify.mjs scripts/auto/notify.test.mjs
git commit -m "自動投稿パイプラインのChatwork通知モジュールを追加"
```

---

## Task 12: 検収結果ファイル生成(`inspection-md.mjs`)

**Files:**
- Create: `scripts/auto/inspection-md.mjs`
- Test: `scripts/auto/inspection-md.test.mjs`

**Interfaces:**
- Produces: `buildInspectionMd(attempt: number): string` — `scripts/detect-pending.mjs` の `PASS_PATTERN`(`/^#{0,6}\s*検収結果:\s*合格(?!\s*\/)/m`)に一致する文字列を返す

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/inspection-md.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInspectionMd } from './inspection-md.mjs';
import { PASS_PATTERN } from '../detect-pending.mjs';

test('buildInspectionMdはdetect-pending.mjsのPASS_PATTERNに一致する', () => {
  const md = buildInspectionMd(1);
  assert.match(md, PASS_PATTERN);
});

test('buildInspectionMdは試行回数を含む', () => {
  const md = buildInspectionMd(2);
  assert.match(md, /第2回/);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/inspection-md.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/inspection-md.mjs`:

```js
// posts/<dir>/inspection.md を組み立てる。scripts/detect-pending.mjsのPASS_PATTERNが
// 一致する固定フォーマットの先頭行を必ず含める(一致しないとpublish.ymlが検出できない)。
export function buildInspectionMd(attempt) {
  return `# 検収結果: 合格(第${attempt}回・自動検収)

GitHub Actionsの自動投稿パイプライン(機械チェック + Gemini判定)に合格しました。
判定の根拠は自動投稿Issueのコメント履歴を参照してください。
`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/inspection-md.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/inspection-md.mjs scripts/auto/inspection-md.test.mjs
git commit -m "自動検収結果のinspection.md生成モジュールを追加"
```

---

## Task 13: ドライラン用のモック依存(`mock-deps.mjs`)

CLIの `--mock` フラグ用。Gemini API・`gh`・Chatworkを一切呼ばず、固定データで正常系(合格)を1回通すためのフェイク実装をまとめる。

**Files:**
- Create: `scripts/auto/mock-deps.mjs`
- Test: `scripts/auto/mock-deps.test.mjs`

**Interfaces:**
- Produces: `mockDeps: { callGeminiGrounded, callGeminiJsonForStructure, callGeminiJsonForCopy, callGeminiJsonForJudge, createIssue, commentIssue, closeIssue }`(すべて非同期関数、ネットワークを一切呼ばない)

- [ ] **Step 1: 失敗するテストを書く**

`scripts/auto/mock-deps.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockDeps } from './mock-deps.mjs';

test('mockDeps.callGeminiGroundedは3件以上のsourcesを返す', async () => {
  const result = await mockDeps.callGeminiGrounded('プロンプト');
  assert.ok(result.sources.length >= 3);
});

test('mockDeps.callGeminiJsonForStructureは8〜10枚のslidesを返す', async () => {
  const result = await mockDeps.callGeminiJsonForStructure('プロンプト');
  assert.ok(result.slides.length >= 8 && result.slides.length <= 10);
});

test('mockDeps.callGeminiJsonForCopyはproducer.md互換スキーマを返す', async () => {
  const result = await mockDeps.callGeminiJsonForCopy('プロンプト');
  assert.equal(typeof result.caption, 'string');
  assert.ok(Array.isArray(result.slides));
  assert.ok(result.slides.length >= 8);
});

test('mockDeps.callGeminiJsonForJudgeはok:trueを返す', async () => {
  const result = await mockDeps.callGeminiJsonForJudge('プロンプト');
  assert.equal(result.ok, true);
});

test('mockDeps.createIssueは固定のIssue番号を返す', () => {
  assert.equal(mockDeps.createIssue({ title: 't', body: 'b' }), 0);
});

test('mockDeps.commentIssue/closeIssueは例外を投げない', () => {
  assert.doesNotThrow(() => mockDeps.commentIssue(0, 'test'));
  assert.doesNotThrow(() => mockDeps.closeIssue(0, 'test'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test scripts/auto/mock-deps.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND`)

- [ ] **Step 3: 実装を書く**

`scripts/auto/mock-deps.mjs`:

```js
// --mockフラグ用のフェイク依存。Gemini API・gh・Chatworkを一切呼ばず、
// 固定データで正常系(1回で合格)を通す。ローカルでの動作確認・CI用。
function mockSources() {
  return [
    { url: 'https://example.com/a', title: '一次ソースA(モック)' },
    { url: 'https://example.com/b', title: '一次ソースB(モック)' },
    { url: 'https://example.com/c', title: '一次ソースC(モック)' },
  ];
}

function mockSlides() {
  return Array.from({ length: 8 }, (_, i) => ({
    no: i + 1,
    heading: `見出し${i + 1}`,
    body: `本文${i + 1}です`,
    source_ref: 'https://example.com/a',
  }));
}

export const mockDeps = {
  async callGeminiGrounded() {
    return { text: 'モック要約', sources: mockSources() };
  },
  async callGeminiJsonForStructure() {
    return {
      slides: Array.from({ length: 8 }, (_, i) => ({ role: i === 0 ? 'hook' : 'body', point: `要点${i + 1}`, sourceIndex: 1 })),
    };
  },
  async callGeminiJsonForCopy() {
    return {
      slug: 'mock-post',
      caption: 'モックのキャプションです。',
      hashtags: ['#AI', '#DX'],
      sources: mockSources().map((s) => s.url),
      slides: mockSlides(),
    };
  },
  async callGeminiJsonForJudge() {
    return { ok: true, reasons: [] };
  },
  createIssue() {
    return 0;
  },
  commentIssue() {},
  closeIssue() {},
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test scripts/auto/mock-deps.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: commit**

```bash
git add scripts/auto/mock-deps.mjs scripts/auto/mock-deps.test.mjs
git commit -m "自動投稿パイプラインのドライラン用モック依存を追加"
```

---

## Task 14: オーケストレーター(`scripts/run-auto-pipeline.mjs`)

Task 1〜13の全モジュールを束ね、GitHub Actionsから呼ばれるCLIエントリーポイントを作る。分岐ロジック自体はTask 9でテスト済みのため、ここでは「本物の依存を正しく組み立てて渡し、ファイルを正しいパスに書き出す」配線に専念する(このファイル自体は既存コードの`main()`関数群(`generate.js`・`publish-instagram.mjs`など)と同じく、統合テストの対象とし単体テストは書かない)。

**Files:**
- Create: `scripts/run-auto-pipeline.mjs`

**Interfaces:**
- Consumes: Task 1〜13の全 export
- Produces(副作用): 合格時は `work/<slug>/slides.json` と `work/<slug>/inspection.md` を書き、`$GITHUB_OUTPUT` に `published`・`slug`・`dir`・`issue_number` を書く。不合格時は `published=false` のみ書く

- [ ] **Step 1: 実装を書く**

`scripts/run-auto-pipeline.mjs`:

```js
#!/usr/bin/env node
// 幕1〜4(researcher/director/producer/inspector相当)をGemini APIだけで再現する
// 自動実行のエントリーポイント。.github/workflows/auto-company-post.yml から呼ばれる。
//
// 使い方:
//   node scripts/run-auto-pipeline.mjs          … 本番実行(GEMINI_API_KEY・gh認証が必要)
//   node scripts/run-auto-pipeline.mjs --mock   … 何も呼ばず固定データで流れを確認する(テスト用)
//
// 出力: work/<slug>/slides.json, work/<slug>/inspection.md(合格時のみ)
//       $GITHUB_OUTPUT に published/slug/dir/issue_number を書く(GitHub Actions上のみ)
import fs from 'node:fs';
import path from 'node:path';

import { pickTopic } from './auto/topic.mjs';
import { todayJst, sanitizeSlug, fallbackSlugFromTheme } from './auto/slug.mjs';
import { callGeminiJson, callGeminiGrounded } from './auto/gemini-client.mjs';
import { gatherSources } from './auto/research.mjs';
import { buildStructure } from './auto/structure.mjs';
import { writeSlides } from './auto/copywrite.mjs';
import { mechanicalCheck } from './auto/mechanical-check.mjs';
import { judgeContent } from './auto/gemini-judge.mjs';
import { runCopywriteInspectLoop } from './auto/inspect-loop.mjs';
import { createIssue, commentIssue, closeIssue } from './auto/github-issue.mjs';
import { notifyChatwork } from './auto/notify.mjs';
import { buildInspectionMd } from './auto/inspection-md.mjs';
import { mockDeps } from './auto/mock-deps.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function appendGithubOutput(line) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  fs.appendFileSync(outPath, line + '\n', 'utf8');
}

async function main() {
  const mock = process.argv.includes('--mock');

  const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/carousel/tokens.json'), 'utf8'));
  const rubricMarkdown = fs.readFileSync(path.join(ROOT, 'rubric/carousel.md'), 'utf8');
  const topic = pickTopic(path.join(ROOT, 'topics.yml'));

  const deps = mock
    ? {
        gatherSourcesFn: (t) => gatherSources(t, { callGeminiGrounded: mockDeps.callGeminiGrounded }),
        buildStructureFn: (t, s) => buildStructure(t, s, { callGeminiJson: mockDeps.callGeminiJsonForStructure }),
        writeSlidesFn: (t, st, s, tk, r) => writeSlides(t, st, s, tk, { callGeminiJson: mockDeps.callGeminiJsonForCopy }, r),
        judgeContentFn: (s, src, r) => judgeContent(s, src, r, { callGeminiJson: mockDeps.callGeminiJsonForJudge }),
        createIssue: mockDeps.createIssue,
        commentIssue: mockDeps.commentIssue,
        closeIssue: mockDeps.closeIssue,
        notify: async () => {},
      }
    : {
        gatherSourcesFn: (t) => gatherSources(t, { callGeminiGrounded }),
        buildStructureFn: (t, s) => buildStructure(t, s, { callGeminiJson }),
        writeSlidesFn: (t, st, s, tk, r) => writeSlides(t, st, s, tk, { callGeminiJson }, r),
        judgeContentFn: (s, src, r) => judgeContent(s, src, r, { callGeminiJson }),
        createIssue,
        commentIssue,
        closeIssue,
        notify: notifyChatwork,
      };

  console.log(`カテゴリ: ${topic.category} / テーマ: ${topic.theme}${mock ? ' (mockモード)' : ''}`);

  const issueNumber = deps.createIssue({
    title: `自動投稿 ${todayJst()} ${topic.category}`,
    body: `テーマ: ${topic.theme}\n\nこのIssueは自動投稿パイプラインの経過記録用です。`,
  });
  appendGithubOutput(`issue_number=${issueNumber}`);

  const research = await deps.gatherSourcesFn(topic);
  if (!research.sufficient) {
    const msg = `一次ソースが${research.sources.length}件しか見つかりませんでした(3件必要)。本日は見送ります。`;
    console.log(msg);
    deps.commentIssue(issueNumber, msg);
    await deps.notify(`[info][title]自動投稿 見送り[/title]一次ソース不足: ${topic.theme}[/info]`);
    appendGithubOutput('published=false');
    return;
  }

  const structure = await deps.buildStructureFn(topic, research.sources);

  const result = await runCopywriteInspectLoop(topic, structure, research.sources, tokens, rubricMarkdown, {
    writeSlides: deps.writeSlidesFn,
    mechanicalCheck,
    judgeContent: deps.judgeContentFn,
  });

  if (!result.passed) {
    const msg = `自己検収が${result.attempts}回とも不合格でした。本日は見送ります。\n${result.rejectionReasons.join('\n')}`;
    console.log(msg);
    deps.commentIssue(issueNumber, msg);
    await deps.notify(`[info][title]自動投稿 見送り[/title]${result.attempts}回不合格: ${topic.theme}[/info]`);
    appendGithubOutput('published=false');
    return;
  }

  const slug = sanitizeSlug(result.slidesJson.slug, fallbackSlugFromTheme(topic.theme));
  const dir = `${todayJst()}-${slug}`;

  const workDir = path.join(ROOT, 'work', slug);
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(path.join(workDir, 'slides.json'), JSON.stringify(result.slidesJson, null, 2));
  fs.writeFileSync(path.join(workDir, 'inspection.md'), buildInspectionMd(result.attempts));
  console.log(`合格(第${result.attempts}回): work/${slug}/slides.json を書き出しました`);

  deps.closeIssue(issueNumber, `検収合格(第${result.attempts}回)。posts/${dir}/ へpushします。実際のInstagram投稿結果はChatworkでお知らせします。`);

  appendGithubOutput('published=true');
  appendGithubOutput(`slug=${slug}`);
  appendGithubOutput(`dir=${dir}`);
}

main().catch((e) => {
  console.error(e);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, `## 自動投稿パイプライン 失敗\n\n\`\`\`\n${e.stack || e.message}\n\`\`\`\n`);
  }
  process.exit(1);
});
```

- [ ] **Step 2: mockモードで実際に動かして配線を確認する**

Run: `node scripts/run-auto-pipeline.mjs --mock`
Expected: 標準出力に「合格(第1回): work/mock-post/slides.json を書き出しました」のような行が出る。エラーなく終了する(exit code 0)

- [ ] **Step 3: 生成されたファイルを確認する**

Run: `cat work/mock-post/slides.json work/mock-post/inspection.md`
Expected: `slides.json` がproducer.md互換スキーマのJSON、`inspection.md` が `# 検収結果: 合格(第1回・自動検収)` で始まるテキストになっている

- [ ] **Step 4: 後片付け(mockで作った作業ファイルはgit管理外だが、ローカルを汚さないよう消しておく)**

Run: `rm -rf work/mock-post`

- [ ] **Step 5: commit**

```bash
git add scripts/run-auto-pipeline.mjs
git commit -m "自動投稿パイプラインのオーケストレーターを追加"
```

---

## Task 15: GitHub Actionsワークフロー新設(`auto-company-post.yml`)

**Files:**
- Create: `.github/workflows/auto-company-post.yml`

**Interfaces:**
- Consumes: Task 14の `scripts/run-auto-pipeline.mjs`(GITHUB_OUTPUTの`published`/`slug`/`dir`を読む)、既存の `scripts/slides-to-post.mjs`・`npm run render`
- Produces: `posts/<dir>/` を作ってmainへpush(既存の `publish.yml` がこれを検知して投稿する)

- [ ] **Step 1: ワークフローファイルを作成する**

`.github/workflows/auto-company-post.yml`:

```yaml
# 平日JST12:30に自動起動し、Gemini APIだけでresearcher/director/producer/inspector相当の
# 処理(scripts/run-auto-pipeline.mjs)を行い、合格したらposts/<dir>/を作ってmainへpushする。
# 実際のInstagram投稿はこのワークフローでは行わない。push後に既存のpublish.ymlが検知して行う。
# 設計書: docs/superpowers/specs/2026-08-14-auto-post-pipeline-design.md
name: auto-company-post

on:
  schedule:
    - cron: '30 3 * * 1-5' # UTC 03:30 = JST 12:30、月〜金
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'trueならposts/への書き込み・pushをせず、Issue作成と自己検収までを確認する'
        type: boolean
        default: true

permissions:
  contents: write
  issues: write

concurrency:
  group: auto-company-post
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: 依存関係のインストール
        run: npm ci

      - name: 幕1〜4相当を実行(Gemini APIのみ)
        id: pipeline
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_MODEL: ${{ vars.GEMINI_MODEL || 'gemini-2.5-flash' }}
          CHATWORK_API_TOKEN: ${{ secrets.CHATWORK_API_TOKEN }}
          CHATWORK_ROOM_ID: ${{ secrets.CHATWORK_ROOM_ID }}
          GH_TOKEN: ${{ github.token }}
          DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run || false }}
        run: |
          if [ "$DRY_RUN" = "true" ]; then
            node scripts/run-auto-pipeline.mjs --mock
          else
            node scripts/run-auto-pipeline.mjs
          fi

      - name: 画像化(Playwright)
        if: ${{ steps.pipeline.outputs.published == 'true' }}
        env:
          BRAND: ${{ vars.BRAND || 'own' }}
          SLUG: ${{ steps.pipeline.outputs.slug }}
        run: |
          npx playwright install chromium --with-deps
          node scripts/slides-to-post.mjs --slug "$SLUG"
          npm run render

      - name: posts/へ配置してmainへpush
        if: ${{ steps.pipeline.outputs.published == 'true' }}
        env:
          DIR: ${{ steps.pipeline.outputs.dir }}
          SLUG: ${{ steps.pipeline.outputs.slug }}
        run: |
          mkdir -p "posts/$DIR"
          cp "work/$SLUG/slides.json" "work/$SLUG/inspection.md" "posts/$DIR/"
          cp output/slide-*.png "posts/$DIR/"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add "posts/$DIR"
          git commit -m "自動投稿(AI社員パイプライン): $DIR"
          success=false
          for i in 1 2 3; do
            if git push; then
              success=true
              break
            fi
            echo "push失敗、リトライします ($i/3)"
            git pull --rebase || true
            sleep 5
          done
          if [ "$success" != "true" ]; then
            echo "::error::posts/$DIR のpushに失敗しました"
            exit 1
          fi

      - name: 失敗をChatworkに通知
        if: ${{ failure() }}
        env:
          CHATWORK_API_TOKEN: ${{ secrets.CHATWORK_API_TOKEN }}
          CHATWORK_ROOM_ID: ${{ secrets.CHATWORK_ROOM_ID }}
        run: |
          curl -s -X POST "https://api.chatwork.com/v2/rooms/$CHATWORK_ROOM_ID/messages" \
            -H "X-ChatWorkToken: $CHATWORK_API_TOKEN" \
            --data-urlencode "body=[info][title]自動投稿パイプライン失敗[/title]auto-company-post ワークフローが失敗しました。Actionsのログを確認してください。[/info]"
```

- [ ] **Step 2: YAMLとして構文が正しいことをローカルで確認する**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/auto-company-post.yml', 'utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: commit**

```bash
git add .github/workflows/auto-company-post.yml
git commit -m "自動投稿パイプラインのGitHub Actionsワークフローを新設"
```

- [ ] **Step 4: (実装完了後、ユーザーに確認してから)workflow_dispatchのdry_run: trueで手動実行して動作確認する**

これはCLAUDE.mdの禁止事項5番(GitHub上の設定変更はユーザー確認後)に該当するため、実装担当は
このステップを勝手に実行せず、ユーザーに実行してよいか確認すること。

---

## Task 16: 旧`daily-post.yml`の削除

**Files:**
- Delete: `.github/workflows/daily-post.yml`

**Interfaces:** なし(独立した削除)

- [ ] **Step 1: ファイルが今どこからも参照されていないことを確認する**

Run: `grep -rn "daily-post" --include="*.md" --include="*.yml" --include="*.json" . --exclude-dir=node_modules --exclude-dir=.git`
Expected: `docs/`配下の過去の設計書・進捗.mdなど「経緯としての言及」以外に、現行の動作に関わる参照が無いことを確認する(あれば個別に判断する)

- [ ] **Step 2: 削除する**

```bash
git rm .github/workflows/daily-post.yml
```

- [ ] **Step 3: commit**

```bash
git commit -m "役目を終えたdaily-post.ymlを削除"
```

---

## Task 17: 手動経路から「第2幕の構成承認待ち」を撤廃(`director.md`)

**Files:**
- Modify: `.claude/agents/director.md`

- [ ] **Step 1: 「終わったら」節を書き換える**

現在の記述:

```markdown
## 終わったら

これは waiting の幕です。**PM に構成案を渡して停止する。**
社長の承認なしに第3幕へ進んではならない。
```

を次に置き換える:

```markdown
## 終わったら

PM に構成案を渡し、そのまま第3幕(producer)へ進める。
社長の承認待ちで止まる必要はない(2026-08-14決定。第4幕inspectorの検収が唯一の品質ゲート)。
```

- [ ] **Step 2: 「記録」節から `blocked` の例を削除する**

現在の記述:

```markdown
## 記録

`structure.md` を書き出したら output、社長の承認待ちで停止するときは blocked を記録する。

```
node scripts/emit-event.mjs --actor director --event output --phase structure --target work/<slug>/structure.md --message "構成案8枚"
node scripts/emit-event.mjs --actor director --event blocked --phase structure --ticket <Issue番号> --message "社長のテーマ承認待ち"
```
```

を次に置き換える:

```markdown
## 記録

`structure.md` を書き出したら output を記録する。

```
node scripts/emit-event.mjs --actor director --event output --phase structure --target work/<slug>/structure.md --message "構成案8枚"
```
```

- [ ] **Step 3: commit**

```bash
git add .claude/agents/director.md
git commit -m "director.mdから第2幕の承認待ちを撤廃"
```

---

## Task 18: 手動経路から「第2幕の構成承認待ち」を撤廃(`pm.md`)

**Files:**
- Modify: `.claude/agents/pm.md`

- [ ] **Step 1: 「仕事の進め方」から承認待ちの手順を削除する**

現在の記述:

```markdown
## 仕事の進め方

1. Issue を読み、どの幕から始めるか判断する
2. 該当する社員に委譲する（researcher / director / producer / inspector / publisher）
3. 成果物を受け取り、次の幕へ進めるか判定する
4. waiting の幕に到達したら**必ず止まり**、社長に承認を求める

## 承認を求めるときの書き方

何を承認してほしいのかを1行目に明記すること。
社長は忙しいので、判断に必要な情報だけを出す。

```
【承認依頼】第2幕の構成案です。この方向で制作に進んでよいですか。
【テーマ】〇〇
【根拠ソース】3件（最新: 8/10公開）
【構成】1枚目 〜 / 2枚目 〜 ...
【懸念】あれば1行
```
```

を次に置き換える(「承認を求めるときの書き方」節ごと削除する):

```markdown
## 仕事の進め方

1. Issue を読み、どの幕から始めるか判断する
2. 該当する社員に委譲する（researcher / director / producer / inspector / publisher）
3. 成果物を受け取り、次の幕へ進めるか判定する

第2幕(構成案)は承認待ちで止まらず、そのまま第3幕へ進む(2026-08-14決定。
第4幕inspectorの検収が唯一の品質ゲート)。社長への報告は、投稿完了後の結果報告と、
エスカレーション(検収3回不合格・一次ソース不足など)が必要になったときのみでよい。
```

- [ ] **Step 2: commit**

```bash
git add .claude/agents/pm.md
git commit -m "pm.mdから第2幕の承認待ちを撤廃"
```

---

## Task 19: `AGENTS.md` の説明文を更新

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 2条(停止のルール)の説明を更新する**

現在の記述:

```markdown
- 外部に公開される操作(メール送信、リポジトリの公開設定変更など)。**ただしSNS投稿(Instagramカルーセル)は対象外**: 第2幕の構成承認で社長確認が済んでおり、第4幕inspectorの検収が最終ゲートのため、投稿直前の追加停止は不要(2026-08-14決定、詳細は進捗.md参照)
```

を次に置き換える:

```markdown
- 外部に公開される操作(メール送信、リポジトリの公開設定変更など)。**ただしSNS投稿(Instagramカルーセル)は対象外**: 第4幕inspectorの検収が唯一かつ最終の品質ゲートのため、投稿直前の追加停止は不要(2026-08-14決定。同日、第2幕の構成承認待ちも撤廃した。詳細は進捗.md参照)
```

- [ ] **Step 2: 6条(投稿が外に出る条件)の説明を更新する**

現在の記述:

```markdown
**2026-08-14決定: publisherはinspectorの検収合格後、Pull Requestを作らず`posts/<日付>-<slug>/`を直接`main`へコミット・pushしてよい。**
理由: 第2幕(構成案)で社長の承認を得ており、第4幕(inspector)が文言・デザイン両面の最終品質ゲートとして機能しているため、投稿直前のPRレビューは二重チェックであり必須ではないと社長が判断した(経緯は進捗.md参照)。
ただし、コード自体の変更(`src/`・`scripts/`・テンプレート等)は従来通りレビューを推奨する。
```

を次に置き換える:

```markdown
**2026-08-14決定: publisherはinspectorの検収合格後、Pull Requestを作らず`posts/<日付>-<slug>/`を直接`main`へコミット・pushしてよい。**
理由: 第4幕(inspector)が文言・デザイン両面の最終品質ゲートとして機能しているため、投稿直前のPRレビューは二重チェックであり必須ではないと社長が判断した(同日、第2幕の構成承認待ちも撤廃し、inspectorの検収のみが品質ゲートとなった。経緯は進捗.md参照)。
ただし、コード自体の変更(`src/`・`scripts/`・テンプレート等)は従来通りレビューを推奨する。
```

- [ ] **Step 3: commit**

```bash
git add AGENTS.md
git commit -m "AGENTS.mdの承認フロー説明を第2幕承認撤廃に合わせて更新"
```

---

## Task 20: 全体動作確認とテスト実行

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm test`
Expected: 新規追加分を含め全件PASS(既存の約28件 + Task 1〜13で追加した約57件)

- [ ] **Step 2: mockモードでオーケストレーター全体をもう一度通しで確認する**

Run: `node scripts/run-auto-pipeline.mjs --mock && cat work/mock-post/inspection.md && rm -rf work/mock-post`
Expected: `inspection.md` の中身が `# 検収結果: 合格` で始まる

- [ ] **Step 3: 進捗.mdを更新する**

`進捗.md` の「今の状況」節の先頭に、以下を追記する(既存の内容は残したまま、新しい項目として追加):

```markdown
- **完了: 幕1〜5の完全自動化(Gemini API単独経路)を実装(実装日はコミット履歴を参照)**
  - 設計書: `docs/superpowers/specs/2026-08-14-auto-post-pipeline-design.md`
  - 実装計画: `docs/superpowers/plans/2026-08-14-auto-post-pipeline.md`
  - GitHub Actions(`auto-company-post.yml`)が平日JST12:30に起動し、`scripts/run-auto-pipeline.mjs`が
    Gemini APIのみでresearcher/director/producer/inspector相当の処理を行い、合格したら既存の
    `publish.yml`経由でInstagram投稿まで無人完結する
  - 手動経路(Claude Codeエージェント)から「第2幕の構成承認待ち」を撤廃し、inspectorの検収のみが
    品質ゲートになった(`director.md`/`pm.md`/`AGENTS.md`)
  - 旧`daily-post.yml`は削除
  - **未実施(要ユーザー確認)**: `workflow_dispatch`の`dry_run: true`での実地動作確認、
    その後の本番スケジュール実行の有効化確認
```

- [ ] **Step 4: commit**

```bash
git add 進捗.md
git commit -m "自動投稿パイプライン実装完了を進捗.mdに反映"
```

---

## 未実施として残る作業(このプランのスコープ外)

- `workflow_dispatch`(`dry_run: true`)での実地動作確認、および本番cronの初回実行確認は、GitHub上の操作(Secrets登録確認・Actions実行)を伴うため、CLAUDE.mdの禁止事項5番によりユーザーの確認を取ってから行う
- `GEMINI_API_KEY`にGoogle検索グラウンディング機能の利用権限があるか(APIプランによって有効/無効が異なる場合がある)は、実際にresearch.mjsを本番実行するまで確認できない。もし使えない場合は、`scripts/auto/research.mjs`のプロンプト・パースロジックの調整が別途必要になる
