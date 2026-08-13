# スライド解説キャラクター追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カルーセルの表紙・本文スライド右下に、使い回し可能な解説キャラクター(ポーズ違い6種)を配置する。

**Architecture:** 参考画像(`assets/mirai01.png`/`assets/mirai-ad.png`)をもとに、新規スクリプトでGemini画像生成モデル(`gemini-2.5-flash-image`)からポーズ違い画像を6枚事前生成し `assets/character/` にコミットする。自動投稿フロー(`npm run render`)は画像生成を行わず、この6枚をスライド順に割り当てて埋め込むだけ。`config/brand.own.json` の `character` 設定で有効・無効を切り替えられ、無効時は従来のアイコン表示にフォールバックする。

**Tech Stack:** Node.js 20以上 / ESM。新規npmパッケージの追加なし(既存の`fetch`・`GEMINI_API_KEY`を流用)。テストは既存と同じNode組み込み `node --test`。

## Global Constraints

- 新規npmパッケージは追加しない(`src/generate.js` と同じ `fetch` ベースでGemini画像生成APIを呼ぶ)
- `character.enabled: true` なのにポーズ画像ファイルが存在しない場合、`npm run render` はエラーで停止する(壊れたスライドを生成しない)
- ポーズ画像の生成スクリプトは自動投稿フロー(GitHub Actions)には組み込まない。手動実行のみ
- まとめスライド・ブランド固定スライド(ロゴ)にはキャラクターを表示しない(対象は表紙・本文スライドのみ)
- 参考画像 `assets/mirai01.png` / `assets/mirai-ad.png` の人物は、ユーザー本人がAIで生成した架空の人物であるとの説明を前提とする(詳細: `docs/superpowers/specs/2026-08-13-character-slide-design.md`)
- コミットメッセージは1行の日本語でシンプルに

---

### Task 1: ポーズ割り当てロジック(`src/lib/characterPoses.js`)

**Files:**
- Create: `src/lib/characterPoses.js`
- Test: `src/lib/characterPoses.test.mjs`
- Modify: `package.json:9`(`test` スクリプトのglobに `src/lib/*.test.mjs` を追加)

**Interfaces:**
- Produces: `assignCharacterPoses(slides: Array<{type: string}>, poseUris: string[]): Array<string | undefined>` — `slides` と同じ長さの配列を返す。`summary` タイプのスライドは常に `undefined`。ポーズが無い(空配列)場合は全要素 `undefined`。それ以外は `poseUris` を先頭から順番に(足りなければ循環して)割り当てる

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/characterPoses.test.mjs` を作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignCharacterPoses } from './characterPoses.js';

test('ポーズ画像が無ければ全スライドundefined', () => {
  const slides = [{ type: 'cover' }, { type: 'body' }];
  const result = assignCharacterPoses(slides, []);
  assert.deepEqual(result, [undefined, undefined]);
});

test('cover・bodyスライドには順番にポーズを割り当て、summaryは対象外', () => {
  const slides = [{ type: 'cover' }, { type: 'body' }, { type: 'summary' }, { type: 'body' }];
  const result = assignCharacterPoses(slides, ['A', 'B']);
  assert.deepEqual(result, ['A', 'B', undefined, 'A']);
});

test('ポーズ数よりスライドが多い場合は循環する', () => {
  const slides = [{ type: 'cover' }, { type: 'body' }, { type: 'body' }];
  const result = assignCharacterPoses(slides, ['A']);
  assert.deepEqual(result, ['A', 'A', 'A']);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test src/lib/characterPoses.test.mjs`
Expected: FAIL(`characterPoses.js` が存在しないためモジュール解決エラー)

- [ ] **Step 3: 最小実装を書く**

`src/lib/characterPoses.js` を作成する。

```javascript
// カルーセル内のスライドに、使い回すキャラクター画像(ポーズ)を順番に割り当てる。
// まとめスライド(summary)にはキャラクターを付けない。
export function assignCharacterPoses(slides, poseUris) {
  if (!poseUris || poseUris.length === 0) return slides.map(() => undefined);
  let i = 0;
  return slides.map((slide) => {
    if (slide.type === 'summary') return undefined;
    const uri = poseUris[i % poseUris.length];
    i += 1;
    return uri;
  });
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `node --test src/lib/characterPoses.test.mjs`
Expected: PASS(3 tests)

- [ ] **Step 5: `package.json` のテストスクリプトを更新する**

`package.json` の9行目付近、`"test"` スクリプトを次のように変更する。

変更前:
```json
    "test": "node --test scripts/*.test.mjs"
```

変更後:
```json
    "test": "node --test scripts/*.test.mjs src/lib/*.test.mjs"
```

- [ ] **Step 6: 全テストを実行して壊れていないことを確認する**

Run: `npm test`
Expected: PASS(既存の`scripts/*.test.mjs`のテストに加え、`src/lib/characterPoses.test.mjs`の3テストも実行されすべてPASS)

- [ ] **Step 7: コミット**

```bash
git add src/lib/characterPoses.js src/lib/characterPoses.test.mjs package.json
git commit -m "キャラクターのポーズ割り当てロジックを追加"
```

---

### Task 2: ポーズ画像生成スクリプト(`scripts/generate-character-poses.mjs`)

**Files:**
- Create: `scripts/generate-character-poses.mjs`

**Interfaces:**
- Consumes: `assets/mirai01.png`, `assets/mirai-ad.png`(参考画像、既存ファイル)
- Produces: 実行すると `assets/character/pose-01.<ext>` 〜 `pose-06.<ext>` を生成する(`<ext>` は応答のmimeTypeに応じて `png` または `jpg`)。CLI引数 `--pose <1〜6>` で特定のポーズだけ再生成できる

- [ ] **Step 1: スクリプトを作成する**

`scripts/generate-character-poses.mjs` を作成する。

```javascript
// 参考画像(assets/mirai01.png, assets/mirai-ad.png)をもとに、同一人物・同一服装でポーズ違いの
// 画像を6枚生成し、assets/character/ に保存する。自動投稿フローには含まれない、手動の一回限りスクリプト。
// 使い方:
//   node scripts/generate-character-poses.mjs          … 6枚すべて生成
//   node scripts/generate-character-poses.mjs --pose 3 … 3番目のポーズだけ再生成
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets/character');
const REFERENCE_IMAGES = ['assets/mirai01.png', 'assets/mirai-ad.png'];

const POSES = [
  { id: 1, text: 'お辞儀をしながら笑顔で挨拶しているポーズ' },
  { id: 2, text: '人差し指でカメラ側を指さしているポーズ' },
  { id: 3, text: '両手を軽く広げて説明しているジェスチャー' },
  { id: 4, text: '片手で親指を立てているポーズ' },
  { id: 5, text: 'メモボードのようなものを胸の高さで提示しているポーズ' },
  { id: 6, text: '腕を組んで考えているポーズ' },
];

const IDENTITY_PROMPT = `添付の参考画像と同一人物として、新しいポーズの写真を1枚生成してください。

厳守してください:
- 髪型・髪色・メイク・顔立ちは参考画像と完全に同一にする
- 服装(ベージュのテーラードジャケット、白いインナー、ワインレッドのタイトスカート、パールピアス)も参考画像と完全に同一にする
- 背景は無地の白(#FFFFFF)一色。スタジオ機材・家具・小物は写り込ませない
- 構図はバストアップ〜ニーアップの縦長ポートレート、1人のみ
- 表情は明るい笑顔基調

今回のポーズ: {POSE}

出力は画像のみ。説明文は不要です。`;

function readImageBase64(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath)).toString('base64');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini APIは一時的な過負荷(429/5xx)で失敗することがあるためリトライする(src/generate.jsと同じ方針)。
function isRetryable(err) {
  if (err.status === 429 || err.status >= 500) return true;
  if (!err.status) return true;
  return false;
}

async function callGeminiImageOnce(promptText) {
  const model = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const parts = [
    { text: promptText },
    ...REFERENCE_IMAGES.map((p) => ({ inline_data: { mime_type: 'image/png', data: readImageBase64(p) } })),
  ];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4' } },
    }),
  });
  if (!res.ok) {
    const err = new Error(`Gemini画像生成APIエラー: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function callGeminiImage(promptText, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await callGeminiImageOnce(promptText);
    } catch (e) {
      lastErr = e;
      if (i === attempts || !isRetryable(e)) throw e;
      const waitMs = 2000 * 2 ** (i - 1);
      console.warn(`Gemini呼び出し失敗(${i}/${attempts}回目、${waitMs}ms後に再試行): ${e.message}`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

function extractImagePart(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) return part.inlineData;
    if (part.inline_data?.data) return part.inline_data;
  }
  return null;
}

async function generatePose(pose) {
  const promptText = IDENTITY_PROMPT.replace('{POSE}', pose.text);
  console.log(`ポーズ${pose.id}を生成中: ${pose.text}`);
  const data = await callGeminiImage(promptText);
  const image = extractImagePart(data);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!image) {
    const debugPath = path.join(OUT_DIR, `debug-raw-response-pose${pose.id}.json`);
    fs.writeFileSync(debugPath, JSON.stringify(data, null, 2));
    throw new Error(`ポーズ${pose.id}: 画像データが応答に含まれていません(${debugPath} に生データを保存)`);
  }
  const ext = image.mimeType?.includes('png') ? 'png' : 'jpg';
  const outPath = path.join(OUT_DIR, `pose-${String(pose.id).padStart(2, '0')}.${ext}`);
  fs.writeFileSync(outPath, Buffer.from(image.data, 'base64'));
  console.log(`保存: ${path.relative(ROOT, outPath)}`);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY が設定されていません');
  const poseArgIndex = process.argv.indexOf('--pose');
  const targetId = poseArgIndex !== -1 ? Number(process.argv[poseArgIndex + 1]) : null;
  const targets = targetId ? POSES.filter((p) => p.id === targetId) : POSES;
  if (targetId && targets.length === 0) throw new Error(`--pose ${targetId} は存在しません(1〜${POSES.length}を指定してください)`);

  for (const pose of targets) {
    await generatePose(pose);
  }
  console.log(`完了: ${targets.length}枚のポーズ画像を生成しました`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: 構文エラーが無いことを確認する**

Run: `node --check scripts/generate-character-poses.mjs`
Expected: 何も出力されない(構文エラー無し)

- [ ] **Step 3: コミット**

```bash
git add scripts/generate-character-poses.mjs
git commit -m "キャラクターのポーズ画像を生成するスクリプトを追加"
```

---

### Task 3: ポーズ画像を実際に生成する

**このタスクは実際にGemini画像生成APIを呼び、課金が発生する。実行前に必ずユーザーに確認すること。**

**Files:**
- Create(生成物): `assets/character/pose-01.<ext>` 〜 `pose-06.<ext>`

**Interfaces:**
- Consumes: Task 2の `scripts/generate-character-poses.mjs`
- Produces: `assets/character/` 配下の実ファイル。Task 4以降はこのファイル名(拡張子込み)をそのまま `config/brand.own.json` の `character.poses` に書く

- [ ] **Step 1: ユーザーに実行の許可を得る**

「Gemini画像生成APIを6回呼び出します(課金が発生します)。実行してよいですか?」とユーザーに確認する。承認を得てから次に進む。

- [ ] **Step 2: スクリプトを実行する**

Run: `node scripts/generate-character-poses.mjs`
Expected: `保存: assets/character/pose-01.png` 〜 `pose-06.png`(またはjpg)のログが6回出て、最後に `完了: 6枚のポーズ画像を生成しました` と表示される

- [ ] **Step 3: 生成結果を目視確認する**

生成された6枚それぞれを開いて確認する:
- 顔立ち・髪型・服装が6枚とも同一人物に見えるか
- 背景が無地の白になっているか(スタジオ機材等が写り込んでいないか)
- 指示したポーズになっているか

崩れているポーズがあれば `node scripts/generate-character-poses.mjs --pose <番号>` で個別に再生成する。

- [ ] **Step 4: 実際のファイル名を記録する**

`ls assets/character/` を実行し、実際に生成されたファイル名(拡張子)を確認する。Task 4で `config/brand.own.json` に書く際、この実際のファイル名と一致させる。

- [ ] **Step 5: コミット**

```bash
git add assets/character/
git commit -m "キャラクターのポーズ画像を追加"
```

---

### Task 4: `render.js` でのキャラクター画像読み込みと `brand.own.json` 設定

**Files:**
- Modify: `config/brand.own.json`
- Modify: `src/render.js`(全体)

**Interfaces:**
- Consumes: `assignCharacterPoses`(Task 1、`src/lib/characterPoses.js`)、`assets/character/*`(Task 3)
- Produces: `renderSlide(brand, headerTitle, slide, characterUri)` の第4引数として呼び出す(Task 5で`components.js`側が受け取れるようにする)

- [ ] **Step 1: `config/brand.own.json` に `character` 設定を追加する**

`brandSlide` の直後に以下を追加する(Task 3で確認した実際のファイル名に置き換えること。ここでは `.png` を仮定):

```json
  "character": {
    "enabled": true,
    "dir": "assets/character",
    "poses": ["pose-01.png", "pose-02.png", "pose-03.png", "pose-04.png", "pose-05.png", "pose-06.png"]
  }
```

- [ ] **Step 2: `src/render.js` を書き換える**

`src/render.js` の全体を次の内容に置き換える。

```javascript
// output/post.json を読み、スライドごとにHTMLを組み立てて
// Playwright(Chromium)で1080x1080のPNGにする。
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { renderSlide, brandSlide } from './lib/components.js';
import { assignCharacterPoses } from './lib/characterPoses.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'output');
const BRAND = process.env.BRAND || 'own';

async function main() {
  const post = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'post.json'), 'utf8'));
  const brand = JSON.parse(fs.readFileSync(path.join(ROOT, `config/brand.${BRAND}.json`), 'utf8'));
  const headerTitle = post.header_title || post.slides.find((s) => s.type === 'cover')?.title_lines?.join('') || 'お役立ち情報';

  const poseUris = loadCharacterPoseUris(brand.character);
  const characterUris = assignCharacterPoses(post.slides, poseUris);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });

  const htmlSlides = post.slides.map((slide, i) => renderSlide(brand, headerTitle, slide, characterUris[i]));
  if (brand.brandSlide?.enabled) {
    htmlSlides.push(brandSlide(brand, headerTitle, loadImageDataUri(brand.brandSlide.logo)));
  }

  for (let i = 0; i < htmlSlides.length; i++) {
    const html = htmlSlides[i];
    fs.writeFileSync(path.join(OUT_DIR, `slide-${i + 1}.html`), html); // デバッグ用に残す
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready); // Webフォント読み込み完了を待つ
    const file = path.join(OUT_DIR, `slide-${i + 1}.png`);
    await page.screenshot({ path: file });
    console.log(`生成: output/slide-${i + 1}.png`);
  }
  await browser.close();
  console.log(`完了: ${htmlSlides.length}枚のスライドを生成しました`);
}

// character.enabled が true なのに列挙されたファイルが無ければ、壊れたスライドを作る前に止める。
function loadCharacterPoseUris(character) {
  if (!character?.enabled) return [];
  return character.poses.map((file) => {
    const relativePath = path.join(character.dir, file);
    if (!fs.existsSync(path.join(ROOT, relativePath))) {
      throw new Error(`キャラクター画像が見つかりません: ${relativePath}(config/brand.${BRAND}.jsonのcharacter.posesを確認してください)`);
    }
    return loadImageDataUri(relativePath);
  });
}

function loadImageDataUri(relativePath) {
  const imgPath = path.join(ROOT, relativePath);
  const ext = path.extname(imgPath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext || 'png';
  const base64 = fs.readFileSync(imgPath).toString('base64');
  return `data:image/${mime};base64,${base64}`;
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: 構文エラーが無いことを確認する**

Run: `node --check src/render.js`
Expected: 何も出力されない

- [ ] **Step 4: 実際に動かして壊れていないことを確認する**

Run: `npm run render`
Expected: Task 3の画像が実在すればエラーなく完走する(この時点ではまだ`components.js`が第4引数を使わないため、見た目はTask 5完了前と同じ)。もしTask 3の画像が無い/ファイル名が違う場合は「キャラクター画像が見つかりません」というエラーで停止する(想定通りの動作)。

- [ ] **Step 5: コミット**

```bash
git add config/brand.own.json src/render.js
git commit -m "render.jsでキャラクター画像を読み込みスライドに割り当てる"
```

---

### Task 5: `components.js` でのキャラクター表示(表紙・本文スライド)

**Files:**
- Modify: `src/lib/components.js`(全体)

**Interfaces:**
- Consumes: `renderSlide(brand, headerTitle, slide, characterUri)` の第4引数(Task 4から渡される)
- Produces: `characterUri` が指定されたスライドは右下にキャラクター画像を表示し、無指定(`undefined`)なら従来のアイコン表示にフォールバックする

- [ ] **Step 1: `src/lib/components.js` を次の内容に書き換える**

`baseCss` 関数内、`.title-row` 〜 `.big-ic .badge` のブロックを次のように変更する(`.title-sub`は既に削除済みのためそのまま、`.card`に`position: relative`を追加し、`.cover-character`・`.body-character`・`.has-character`を新規追加):

```javascript
  .card { background: #fff; border-radius: 14px; flex: 1;
    padding: 26px 34px 22px; display: flex; flex-direction: column; gap: 16px; min-height: 0;
    position: relative; }
  .card.has-character .panel { padding-right: 300px; }

  .title-row { display: flex; gap: 24px; align-items: center; }
  .no { position: relative; flex-shrink: 0; width: 76px; height: 76px; background: ${c.primary};
    color: #fff; font-size: 40px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
  .no::after { content: ''; position: absolute; right: -12px; bottom: -12px;
    width: 76px; height: 76px; background: ${c.yellow}; z-index: -1; }
  .title-main { min-width: 0; }
  .title-main h2 { font-size: 44px; font-weight: 900; line-height: 1.3; }
  .title-visual { margin-left: auto; flex-shrink: 0; }
  .big-ic { width: 120px; height: 120px; border: 5px solid ${c.primary}; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 64px; color: ${c.primary};
    position: relative; background: #fff; }
  .big-ic .badge { position: absolute; right: -10px; bottom: -4px; width: 46px; height: 46px;
    border-radius: 50%; background: ${c.primary}; color: #fff; font-size: 26px;
    display: flex; align-items: center; justify-content: center; }

  .body-character { position: absolute; right: 16px; bottom: 0; height: 460px; width: auto;
    object-fit: contain; object-position: bottom; z-index: 2; }
  .cover-character { position: absolute; right: 10px; bottom: 0; height: 620px; width: auto;
    object-fit: contain; object-position: bottom; }
```

`.cover-visual`ブロックはそのまま残す(キャラクター無効時のフォールバックで使い続けるため削除しない)。

次に、`coverSlide` 関数を次のように変更する。

```javascript
/** 表紙スライド */
export function coverSlide(brand, headerTitle, slide, characterUri) {
  const lines = (slide.title_lines || []).map((line, i) =>
    i === (slide.marker_line ?? 0)
      ? `<span class="marker-line">${esc(stripInlineMarkup(line))}</span>`
      : esc(stripInlineMarkup(line))
  ).join('<br>');
  const visual = characterUri
    ? `<img class="cover-character" src="${characterUri}" alt="">`
    : `<div class="cover-visual"><i class="ti ${safeIcon(slide.icon)}"></i>
        <div class="x-badge"><i class="ti ti-x"></i></div></div>`;
  const body = `
    ${header(headerTitle)}
    <div class="card"><div class="cover-body">
      <div class="cover-title">${lines}</div>
      ${visual}
    </div></div>
    ${footer(brand)}`;
  return page(brand, body);
}
```

次に、`bodySlide` 関数を次のように変更する。

```javascript
/** 本文スライド(番号 + タイトル + 1要素のブロック + キャラクター) */
export function bodySlide(brand, headerTitle, slide, characterUri) {
  const blocks = (slide.blocks || []).map(renderBlock);
  const grid = `<div class="body-grid"><div class="col">${blocks.join('')}</div></div>`;
  const topicIcon = `<div class="title-visual"><div class="big-ic"><i class="ti ${safeIcon(slide.icon)}"></i>
    <div class="badge"><i class="ti ti-question-mark"></i></div></div></div>`;
  const character = characterUri ? `<img class="body-character" src="${characterUri}" alt="">` : '';
  const body = `
    ${header(headerTitle)}
    <div class="card${characterUri ? ' has-character' : ''}">
      <div class="title-row">
        <div class="no">${esc(slide.number || '')}</div>
        <div class="title-main"><h2>${richTitle(slide.title)}</h2></div>
        ${characterUri ? '' : topicIcon}
      </div>
      ${grid}
      ${character}
    </div>
    ${footer(brand)}`;
  return page(brand, body);
}
```

最後に、`renderSlide` 関数を次のように変更する。

```javascript
/** post.json のスライド1枚をHTML文字列に変換する */
export function renderSlide(brand, headerTitle, slide, characterUri) {
  if (slide.type === 'cover') return coverSlide(brand, headerTitle, slide, characterUri);
  if (slide.type === 'summary') return summarySlide(brand, headerTitle, slide);
  return bodySlide(brand, headerTitle, slide, characterUri);
}
```

(`summarySlide`・`brandSlide`・`renderBlock`・`compareHtml`・`header`・`footer`・`page`・`baseCss`の他の部分・`stripInlineMarkup`は変更しない)

- [ ] **Step 2: 構文エラーが無いことを確認する**

Run: `node --check src/lib/components.js`
Expected: 何も出力されない

- [ ] **Step 3: `npm test` が壊れていないことを確認する**

Run: `npm test`
Expected: PASS(全テスト)

- [ ] **Step 4: コミット**

```bash
git add src/lib/components.js
git commit -m "表紙・本文スライドにキャラクター表示を追加"
```

---

### Task 6: 統合確認

**Files:** (変更なし。動作確認のみ)

**Interfaces:**
- Consumes: Task 1〜5すべて

- [ ] **Step 1: mockデータで生成・レンダリングする**

Run: `npm run generate -- --mock && npm run render`
Expected: エラーなく完走し、`output/slide-*.png` が生成される

- [ ] **Step 2: 生成された画像を目視確認する**

`output/slide-1.png`(表紙)と本文スライド(`slide-2.png`以降)を開き、以下を確認する:
- 表紙・本文スライドの右下にキャラクターが表示されている
- 本文スライドでキャラクターがチェックリスト/説明文の上に重なりすぎて文字が読めなくなっていないか
- 同じ投稿内で同じポーズが連続していないか(ポーズが順番に変わっているか)

崩れている場合は `src/lib/components.js` の `.body-character`/`.cover-character` のサイズ・位置(`height`/`right`/`bottom`)や `.card.has-character .panel` の `padding-right` を調整し、再度 `npm run render` して確認する。

- [ ] **Step 3: 実際のGemini生成でも確認する**

Run: `npm run generate && npm run render`
Expected: 実データでもレイアウトが崩れないことを確認する

- [ ] **Step 4: 最終確認としてユーザーに画像を見せる**

生成されたPNGをユーザーに提示し、問題なければこのタスクを完了とする。修正依頼があれば該当タスクに戻って調整する。
