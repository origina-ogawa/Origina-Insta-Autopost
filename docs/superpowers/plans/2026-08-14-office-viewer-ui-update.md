# 3Dオフィス表示層(viewer/) UI改修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `viewer/`(AI社員オフィスの3Dビュー)のオーバーレイUIとアバター演出を改修する。
凡例パネル削除・アクティビティログのサイドパネル化と折り返し、吹き出しのはみ出し修正、
社員の出社/退社アニメーション、作業中のランダムな小ネタ吹き出しを追加する。

**Architecture:** 既存の `viewer/` (Vite + React + TypeScript + @react-three/fiber) の構成は変えない。
`Overlay.tsx`/`panels.css` でHTMLオーバーレイのレイアウトを刷新し、`Avatar.tsx` に出社/退社の
アニメーション状態機械と吹き出し関連の演出を追加する。新規の純粋ロジック(吹き出しサイズ計算、
出社/退社の方向ベクトル)は独立したモジュールに切り出し、Node標準テストランナーで検証する。

**Tech Stack:** Vite, React 19, TypeScript, @react-three/fiber, @react-three/drei, three.js。
新規の外部パッケージは追加しない。

## Global Constraints

- **このフォルダ(`/Users/ogawadaisuke/APPS/origina-auto-sns`)の外のファイルを作成・変更・削除しない。**
- APIキー・アクセストークンをコードに書かない(本タスクでは扱わない)。
- 依存パッケージは最小限にする。**本計画では新しいnpmパッケージを一切追加しない。**
- コミットメッセージは1行の日本語でシンプルにする。
- `viewer/` には自動テストの仕組みが存在しない(vitest等未導入)。ルートプロジェクトが
  `node --test scripts/*.test.mjs src/lib/*.test.mjs`(Node標準テストランナー、追加パッケージ無し)を
  使っている慣習を踏襲し、**純粋ロジック(React/Three.jsに依存しない計算処理)のみ**
  `node --test` で自動検証する。React/Three.jsのコンポーネント・アニメーション・タイマー処理は
  自動テスト対象にせず、`npm run build`(`tsc --noEmit && vite build`、viewer/配下で実行)による
  型チェックと、`npm run dev` + `scripts/emit-event.mjs` を使った手動の目視確認で検証する
  (`viewer/README.md`の既存の動作確認方法を踏襲)。
- Node.js v23系ではTypeScriptファイルの型ストリッピングが有効なため、`.test.ts` ファイルを
  ビルドなしで直接 `node --test` に渡せる(本計画ではこれを利用する)。
- 動作確認の手順で `logs/events.jsonl` を一時的に書き換える場合は、**確認後に必ず元の内容へ戻すこと**
  (`git status` で意図しない差分が残っていないか確認してからコミットする)。

---

## File Structure Overview

- `viewer/src/ui/Overlay.tsx` — 変更(レイアウト刷新、LegendPanel参照削除)
- `viewer/src/ui/LegendPanel.tsx` — 削除
- `viewer/src/ui/panels.css` — 変更(サイドパネルレイアウト、折り返し、凡例用スタイル削除)
- `viewer/src/lib/bubbleSize.ts` — 新規(吹き出しサイズの動的計算、純粋関数)
- `viewer/src/lib/bubbleSize.test.ts` — 新規
- `viewer/src/scene/SpeechBubble.tsx` — 新規(吹き出し描画コンポーネント、Avatar.tsxから切り出し)
- `viewer/src/data/flavorLines.ts` — 新規(役職ごとの小ネタセリフ)
- `viewer/src/data/flavorLines.test.ts` — 新規
- `viewer/src/theme.ts` — 変更(出社/退社の方向ベクトル `WALK_DIR` を追加)
- `viewer/src/theme.test.ts` — 新規
- `viewer/src/scene/Avatar.tsx` — 変更(吹き出し・面白いセリフ・出社/退社アニメーション)
- `viewer/package.json` — 変更(`test` スクリプト追加)

---

### Task 1: オーバーレイレイアウト刷新(凡例削除・サイドパネル化・文字折り返し)

**Files:**
- Delete: `viewer/src/ui/LegendPanel.tsx`
- Modify: `viewer/src/ui/Overlay.tsx`(全文置き換え)
- Modify: `viewer/src/ui/panels.css`(全文置き換え)

**Interfaces:**
- Consumes: `TitlePanel`/`StatusPanel`/`ActivityPanel`(既存、無変更)、`OfficeState`型(`../state/officeState`、既存)
- Produces: (他タスクはこのタスクの成果物に依存しない。独立したタスク)

- [ ] **Step 1: `Overlay.tsx` を書き換える**

`viewer/src/ui/Overlay.tsx` の内容を丸ごと以下に置き換える。

```tsx
import { TitlePanel } from "./TitlePanel";
import { StatusPanel } from "./StatusPanel";
import { ActivityPanel } from "./ActivityPanel";
import type { OfficeState } from "../state/officeState";

// 3Dシーンの上に重ねるHTMLオーバーレイ。左上にタイトル、右端に社員ステータス+
// アクティビティログをまとめた縦長サイドパネルを配置する(凡例パネルは廃止)。
export function Overlay({ office }: { office: OfficeState }) {
  return (
    <div className="overlay">
      <TitlePanel />
      <aside className="sidebar">
        <StatusPanel actors={office.actors} />
        <ActivityPanel events={office.recentEvents} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: `panels.css` を書き換える**

`viewer/src/ui/panels.css` の内容を丸ごと以下に置き換える。

```css
:root {
  --floor: #e8e0d3;
  --wood: #b08d5e;
  --wall: #f2ede4;
  --ink: #4a3b2a;
  --ink-soft: #7a6a54;
  --border: #cbb98f;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  height: 100%;
  font-family: "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif;
  color: var(--ink);
}

.app {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.canvas-layer {
  position: absolute;
  inset: 0;
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.sidebar {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 300px;
  max-width: 300px;
  height: calc(100% - 32px);
}

.panel {
  pointer-events: auto;
  background: rgba(242, 237, 228, 0.9);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(74, 59, 42, 0.12);
  padding: 12px 16px;
  backdrop-filter: blur(2px);
}

.panel h2 {
  margin: 0 0 6px;
  font-size: 14px;
  letter-spacing: 0.02em;
}

.panel p,
.panel li {
  margin: 0;
  font-size: 12px;
  color: var(--ink-soft);
  line-height: 1.6;
}

.panel--title {
  max-width: 260px;
}

.panel--activity {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.status-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.activity-list li {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
}

.activity-icon {
  flex: none;
  width: 16px;
  text-align: center;
}

.activity-actor {
  flex: none;
  font-weight: bold;
  color: var(--ink);
}

.activity-message {
  color: var(--ink-soft);
  overflow-wrap: break-word;
  white-space: normal;
}

.placeholder-note {
  margin-top: 6px;
  font-size: 11px;
  color: var(--ink-soft);
  opacity: 0.8;
}
```

変更点の要旨: `.overlay` をグリッドからflexに変更しタイトルと右端サイドバーの2要素だけにする。
`.sidebar` を新設し、`StatusPanel`+`ActivityPanel` を縦に並べる。`.panel--status`/`.panel--legend`/
`.legend-swatches` は使われなくなるため削除。`.activity-message` の `white-space: nowrap` と
`text-overflow: ellipsis` を削除し、`overflow-wrap: break-word` で折り返す。`.activity-list` の
`max-height: 150px` を `flex: 1` に変更し、サイドバーの残り高さいっぱいに広げる。

- [ ] **Step 3: `LegendPanel.tsx` を削除する**

```bash
rm viewer/src/ui/LegendPanel.tsx
```

- [ ] **Step 4: 型チェック・ビルドを実行して確認する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する(`LegendPanel` への参照が残っていないこと)。

- [ ] **Step 5: 目視で確認する**

```bash
npm --prefix viewer run dev
```
ブラウザで表示されたURLを開き、以下を確認する。

- 画面右端に社員ステータスとアクティビティログがまとまった縦長パネルが表示され、凡例パネルが無いこと
- 3Dシーンが左〜中央に広く表示されること
- 長いメッセージを流し込んでもアクティビティログの文字が省略されず折り返されること
  (別ターミナルで以下を実行)

```bash
node scripts/emit-event.mjs --actor researcher --event output --phase research --target "sources/2026-08-14-test.md" --message "動作確認用の少し長めのメッセージをここに入れてアクティビティログの折り返しを確認する"
```

- [ ] **Step 6: コミットする**

```bash
git add viewer/src/ui/Overlay.tsx viewer/src/ui/panels.css
git rm viewer/src/ui/LegendPanel.tsx
git commit -m "viewerの凡例削除とアクティビティログのサイドパネル化・折り返し修正"
```

---

### Task 2: 吹き出しの動的サイズ計算(はみ出し修正)

**Files:**
- Create: `viewer/src/lib/bubbleSize.ts`
- Create: `viewer/src/lib/bubbleSize.test.ts`
- Create: `viewer/src/scene/SpeechBubble.tsx`
- Modify: `viewer/src/scene/Avatar.tsx`
- Modify: `viewer/package.json`

**Interfaces:**
- Produces: `computeBubbleSize(text: string): { width: number; height: number; maxTextWidth: number }`
  (`viewer/src/lib/bubbleSize.ts`)。Task 3で面白いセリフの吹き出しにも同じ関数を使う
- Produces: `SpeechBubble({ text: string; bg?: string })` コンポーネント(`viewer/src/scene/SpeechBubble.tsx`)。
  Task 3で面白いセリフ表示にも使う

- [ ] **Step 1: 失敗するテストを書く**

`viewer/src/lib/bubbleSize.test.ts` を新規作成する。

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBubbleSize } from "./bubbleSize.ts";

test("短いメッセージはコンパクトな最小サイズになる", () => {
  const { width, height, maxTextWidth } = computeBubbleSize("テスト");
  assert.equal(width, 1.0);
  assert.ok(Math.abs(height - 0.42) < 0.001);
  assert.ok(Math.abs(maxTextWidth - 0.7) < 0.001);
});

test("長いメッセージは最大幅でクランプされ、複数行分の高さになる", () => {
  const longText =
    "金曜『SNS集客術』は14日基準を満たすソースが見つからずブロック。鮮度の高い木曜カテゴリへ差し替え";
  const { width, height } = computeBubbleSize(longText);
  assert.equal(width, 2.6);
  assert.ok(Math.abs(height - 0.82) < 0.001);
});

test("幅は常に最小1.0〜最大2.6の範囲に収まる", () => {
  for (const text of ["", "a", "あ".repeat(3), "あ".repeat(100)]) {
    const { width } = computeBubbleSize(text);
    assert.ok(width >= 1.0 && width <= 2.6);
  }
});
```

- [ ] **Step 2: `package.json` にテストスクリプトを追加する**

`viewer/package.json` の `"scripts"` に以下を追加する(既存の `dev`/`build`/`preview` はそのまま残す)。
パターンは必ずダブルクォートで囲み、シェルではなくNode自身にglobを展開させる
(`src/**/*.test.ts` のように複数階層にマッチするパターンをシェルが展開しようとすると、
一致するファイルが無い時点で `zsh: no matches found` 等のエラーになるため)。

```json
    "test": "node --test \"src/**/*.test.ts\""
```

- [ ] **Step 3: テストを実行して失敗を確認する**

```bash
cd viewer && npm test
```
Expected: `bubbleSize.ts` が存在せず `ERR_MODULE_NOT_FOUND` 等でFAILする。

- [ ] **Step 4: `computeBubbleSize` を実装する**

`viewer/src/lib/bubbleSize.ts` を新規作成する。

```ts
// 吹き出しの板(plane)サイズを、テキストの文字数から見積もる。
// drei の <Text> は maxWidth で自動折り返しするため、ここで求めた maxTextWidth を
// Text の maxWidth に渡すことで、板のサイズと折り返し行数の見積もりを一致させる。
// 全角(日本語)・半角混在を厳密には区別しない簡易ヒューリスティックであり、
// ピクセル単位で正確な計算ではない点に注意(視覚確認で十分な余裕を持たせている)。
const CHAR_WIDTH = 0.1; // 1文字あたりの目安幅(fontSize 0.15基準)
const H_PADDING = 0.3; // 左右の余白合計
const V_PADDING = 0.22; // 上下の余白合計
const LINE_HEIGHT = 0.2;
const MIN_WIDTH = 1.0;
const MAX_WIDTH = 2.6;

export type BubbleSize = { width: number; height: number; maxTextWidth: number };

export function computeBubbleSize(text: string): BubbleSize {
  const rawWidth = text.length * CHAR_WIDTH + H_PADDING;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawWidth));
  const maxTextWidth = width - H_PADDING;
  const charsPerLine = Math.max(1, Math.floor(maxTextWidth / CHAR_WIDTH));
  const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine));
  const height = lineCount * LINE_HEIGHT + V_PADDING;
  return { width, height, maxTextWidth };
}
```

- [ ] **Step 5: テストを実行して成功を確認する**

```bash
npm test
```
Expected: 3件のテストすべてPASS(`src/data/*.test.ts`, `src/*.test.ts` に該当ファイルが無いことによる
警告が出る場合があるが、`bubbleSize.test.ts` の3テストがPASSしていればよい)。

- [ ] **Step 6: `SpeechBubble` コンポーネントを新規作成する**

`viewer/src/scene/SpeechBubble.tsx` を新規作成する。

```tsx
import { Billboard, Text } from "@react-three/drei";
import { PALETTE } from "../theme";
import { computeBubbleSize } from "../lib/bubbleSize";

const DEFAULT_BG = "#ffffff";

// 社員アバターの頭上に表示する吹き出し。テキストの文字数に応じて板のサイズを変える。
// bgを変えることで、実際のイベントメッセージと演出用の小ネタ(面白いセリフ)を視覚的に区別できる。
export function SpeechBubble({ text, bg = DEFAULT_BG }: { text: string; bg?: string }) {
  const { width, height, maxTextWidth } = computeBubbleSize(text);
  return (
    <Billboard position={[0, 2.05, 0]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={bg} roughness={1} metalness={0} />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.15}
        color={PALETTE.ink}
        anchorX="center"
        anchorY="middle"
        maxWidth={maxTextWidth}
      >
        {text}
      </Text>
    </Billboard>
  );
}
```

- [ ] **Step 7: `Avatar.tsx` の吹き出しJSXを `SpeechBubble` に置き換える**

`viewer/src/scene/Avatar.tsx` の先頭のimportに以下を追加する。

```tsx
import { SpeechBubble } from "./SpeechBubble";
```

同ファイル末尾付近、次の既存ブロックを:

```tsx
      {/* 吹き出し(message) */}
      {bubble && (
        <Billboard position={[0, 2.05, 0]}>
          <mesh>
            <planeGeometry args={[1.6, 0.5]} />
            <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
          </mesh>
          <Text position={[0, 0, 0.01]} fontSize={0.15} color={PALETTE.ink} anchorX="center" anchorY="middle" maxWidth={1.4}>
            {bubble}
          </Text>
        </Billboard>
      )}
```

以下に置き換える。

```tsx
      {/* 吹き出し(message) */}
      {bubble && <SpeechBubble text={bubble} />}
```

`Text`/`Billboard` のimportは `StatusBadge` コンポーネントで引き続き使用しているため、削除しない。

- [ ] **Step 8: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 9: 目視で確認する**

```bash
npm --prefix viewer run dev
```
別ターミナルで短いメッセージと長いメッセージを流し込み、どちらも吹き出しの板からテキストが
はみ出さないことを確認する。

```bash
node scripts/emit-event.mjs --actor producer --event progress --phase produce --message "了解"
node scripts/emit-event.mjs --actor producer --event progress --phase produce --message "本文を6枚とも44〜49字に収まるよう再調整しています。もう少しお待ちください"
```

- [ ] **Step 10: コミットする**

```bash
git add viewer/src/lib/bubbleSize.ts viewer/src/lib/bubbleSize.test.ts viewer/src/scene/SpeechBubble.tsx viewer/src/scene/Avatar.tsx viewer/package.json
git commit -m "吹き出しのサイズをメッセージ長に応じて動的計算しはみ出しを解消"
```

---

### Task 3: 「面白いセリフ」演出の追加

**Files:**
- Create: `viewer/src/data/flavorLines.ts`
- Create: `viewer/src/data/flavorLines.test.ts`
- Modify: `viewer/src/scene/Avatar.tsx`

**Interfaces:**
- Consumes: `SpeechBubble`(Task 2で作成)、`computeBubbleSize`は`SpeechBubble`経由で間接利用
- Consumes: `ActorId`型(`../theme`、既存)
- Produces: `FLAVOR_LINES: Record<ActorId, string[]>`(`viewer/src/data/flavorLines.ts`)

- [ ] **Step 1: 失敗するテストを書く**

`viewer/src/data/flavorLines.test.ts` を新規作成する。

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTORS } from "../theme.ts";
import { FLAVOR_LINES } from "./flavorLines.ts";

test("全アクターに6件以上のセリフが用意されている", () => {
  for (const actor of ACTORS) {
    assert.ok(Array.isArray(FLAVOR_LINES[actor]), `${actor} の配列が無い`);
    assert.ok(FLAVOR_LINES[actor].length >= 6, `${actor} のセリフが6件未満`);
  }
});

test("各アクター内でセリフが重複していない", () => {
  for (const actor of ACTORS) {
    const lines = FLAVOR_LINES[actor];
    assert.equal(new Set(lines).size, lines.length, `${actor} に重複したセリフがある`);
  }
});

test("すべてのセリフが空文字でない", () => {
  for (const actor of ACTORS) {
    for (const line of FLAVOR_LINES[actor]) {
      assert.ok(line.trim().length > 0);
    }
  }
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd viewer && npm test
```
Expected: `flavorLines.ts` が存在せずFAILする。

- [ ] **Step 3: `FLAVOR_LINES` を実装する**

`viewer/src/data/flavorLines.ts` を新規作成する。

```ts
import type { ActorId } from "../theme";

// 作業中、実際のイベントメッセージが無い間にランダムに喋らせる小ネタ。
// 実際の業務内容とは無関係な演出用のセリフ(役職の雰囲気に合わせたもの)。
export const FLAVOR_LINES: Record<ActorId, string[]> = {
  pm: [
    "スケジュール、あと1ミリも遅らせられません",
    "今日も元気に進捗確認するぞ",
    "全員の机、ちゃんと見えてるからね",
    "締切から逆算すると今が正念場",
    "会議は手短に、が信条です",
    "今日のタスク、頭の中で並べ替え中",
  ],
  researcher: [
    "一次ソース、もう1件くらい欲しいな",
    "鮮度が命。3日前の情報でも古い",
    "この数字、裏取りしないと出せない",
    "検索ワード、もう少し絞ろうか",
    "信頼できる情報源、また見つけた",
    "捏造だけは絶対にしない主義です",
  ],
  director: [
    "構成、8枚がいいか10枚がいいか悩む",
    "経営者目線、経営者目線…",
    "この並び、もう一声きれいにできそう",
    "起承転結、ちゃんと効いてるかな",
    "社長のフィードバック、反映するぞ",
    "見出し、もっと引きが欲しいな",
  ],
  producer: [
    "文字数、あと3文字削れば収まる",
    "テンプレへの流し込み、慎重に",
    "締切、今日中には出したい",
    "この一文、赤字にすると映えるな",
    "画像レンダリング、うまくいきますように",
    "細部までこだわりたいタイプです",
  ],
  inspector: [
    "この文字数、本当に上限内?数えます",
    "画像も実際に見ないと判断できない",
    "表面上OKでも、私は満足しません",
    "差し戻すの、心苦しいけど品質優先",
    "ルーブリック、隅々まで確認中",
    "今回は合格点、出せるといいな",
  ],
  publisher: [
    "投稿ボタン、押す瞬間はいつも緊張する",
    "画像URL、ちゃんと届いてるか確認中",
    "mainへpush、慎重に慎重に",
    "投稿後の反応、ちょっと楽しみ",
    "Instagram APIも今日は元気に応答してほしい",
    "公式APIのみ。ここは絶対に譲れない",
  ],
};
```

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
npm test
```
Expected: `flavorLines.test.ts` の3テストがPASS。

- [ ] **Step 5: `Avatar.tsx` に面白いセリフのタイマー処理と表示を追加する**

`viewer/src/scene/Avatar.tsx` の先頭のimportに以下を追加する。

```tsx
import { FLAVOR_LINES } from "../data/flavorLines";
```

`BUBBLE_MS = 4000;` の行の近くに以下の定数を追加する。

```tsx
const FLAVOR_MIN_INTERVAL_MS = 6000;
const FLAVOR_MAX_INTERVAL_MS = 9000;
const FLAVOR_DURATION_MS = 3000;
const FLAVOR_BG = "#fff6d9";
```

`const [bubble, setBubble] = useState<string | null>(null);` の直後に以下を追加する。

```tsx
  const [flavor, setFlavor] = useState<string | null>(null);
  const bubbleRef = useRef<string | null>(null);
  const eventRef = useRef(state.event);
  const lastFlavorRef = useRef<string | null>(null);

  useEffect(() => {
    bubbleRef.current = bubble;
  }, [bubble]);

  useEffect(() => {
    eventRef.current = state.event;
  }, [state.event]);

  useEffect(() => {
    if (!state.active) {
      setFlavor(null);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let hideTimeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const delay = FLAVOR_MIN_INTERVAL_MS + Math.random() * (FLAVOR_MAX_INTERVAL_MS - FLAVOR_MIN_INTERVAL_MS);
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        const canSpeak = !bubbleRef.current && eventRef.current !== "blocked" && eventRef.current !== "done";
        if (canSpeak) {
          const lines = FLAVOR_LINES[actor];
          const candidates = lines.filter((line) => line !== lastFlavorRef.current);
          const line = candidates[Math.floor(Math.random() * candidates.length)] ?? lines[0];
          lastFlavorRef.current = line;
          setFlavor(line);
          hideTimeoutId = setTimeout(() => {
            if (!cancelled) setFlavor(null);
          }, FLAVOR_DURATION_MS);
        }
        tick();
      }, delay);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearTimeout(hideTimeoutId);
    };
  }, [state.active, actor]);
```

吹き出しの描画部分(Task 2で `{bubble && <SpeechBubble text={bubble} />}` に置き換えた箇所)を、
以下に置き換える。

```tsx
      {/* 吹き出し(実イベントのmessageを優先。無い間は面白いセリフを表示) */}
      {bubble && <SpeechBubble text={bubble} />}
      {!bubble && flavor && <SpeechBubble text={flavor} bg={FLAVOR_BG} />}
```

- [ ] **Step 6: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 7: 目視で確認する**

```bash
npm --prefix viewer run dev
```

```bash
node scripts/emit-event.mjs --actor director --event start --phase structure --message "着席"
```

実イベントメッセージの吹き出し(白背景)が4秒で消えたあと、director が作業中(`blocked`/`done`
以外)の間、6〜9秒以内にクリーム色の吹き出しで小ネタが表示されることを確認する。表示中に以下を
実行し、実メッセージが即座に上書き表示されることも確認する。

```bash
node scripts/emit-event.mjs --actor director --event progress --phase structure --message "構成案を検討中です"
```

- [ ] **Step 8: コミットする**

```bash
git add viewer/src/data/flavorLines.ts viewer/src/data/flavorLines.test.ts viewer/src/scene/Avatar.tsx
git commit -m "作業中にランダムな小ネタを吹き出しで喋る演出を追加"
```

---

### Task 4: 出社/退社の即時表示切り替え(アニメーション無し)

**Files:**
- Modify: `viewer/src/scene/Avatar.tsx`

**Interfaces:**
- Produces: `presentRef`(Avatar内部のref、Task 5で参照・拡張する)

- [ ] **Step 1: `DONE_OPACITY` によるフェードアウト処理を削除する**

`viewer/src/scene/Avatar.tsx` 冒頭の定数から以下の行を削除する。

```tsx
const DONE_OPACITY = 0.4; // done(退勤)でのフェードアウト先の不透明度
```

次の宣言を削除する。

```tsx
  const opacityAnim = useRef<OpacityAnim | null>(null);
  const opacityTarget = useRef(1);
```

型定義 `type OpacityAnim = { start: number; from: number; to: number };` を削除する。

大きな `useEffect(() => { ... }, [state.seq]);` の中から、以下のブロックを削除する。

```tsx
    const nextOpacityTarget = state.event === "done" ? DONE_OPACITY : 1;
    if (nextOpacityTarget !== opacityTarget.current) {
      opacityAnim.current = { start: performance.now(), from: bodyMaterial.opacity, to: nextOpacityTarget };
      opacityTarget.current = nextOpacityTarget;
    }
```

`useFrame` 内から、以下のブロックを削除する。

```tsx
    if (opacityAnim.current) {
      const { start, from, to } = opacityAnim.current;
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const val = from + (to - from) * easeInOutCubic(t);
      bodyMaterial.opacity = val;
      skinMaterial.opacity = val;
      if (t >= 1) opacityAnim.current = null;
    }
```

- [ ] **Step 2: 出社/退社の即時表示切り替えを追加する**

`groupRef`/`flashRef`/`flashMatRef` の宣言の近くに、以下のrefを追加する。

```tsx
  const presentRef = useRef(false); // 出社しているか(true=机にいる状態)
```

大きな `useEffect(() => { ... }, [state.seq]);` の冒頭、`if (state.seq === 0) return;` の直後に
以下を追加する。

```tsx
    presentRef.current = state.event !== "done";
    if (groupRef.current) groupRef.current.visible = presentRef.current;
```

コンポーネントの戻り値の一番外側の `<group>` タグを:

```tsx
    <group ref={groupRef} position={[0, 0.32, 0]}>
```

以下に変更する(初期状態は「未出社」なので非表示から始める)。

```tsx
    <group ref={groupRef} position={[0, 0.32, 0]} visible={false}>
```

- [ ] **Step 3: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 4: 目視で確認する**

`logs/events.jsonl` を一時的にバックアップしてから空にし、確認後に必ず元へ戻す。

```bash
cp logs/events.jsonl /tmp/events.jsonl.bak
: > logs/events.jsonl
```

```bash
npm --prefix viewer run dev
```

ブラウザで開き、全社員が机だけ(アバター非表示)であることを確認する。別ターミナルで以下を実行し、
そのアバターが即座に(アニメーション無しで)表示されることを確認する。

```bash
node scripts/emit-event.mjs --actor researcher --event start --phase research --message "着席"
```

続けて以下を実行し、そのアバターが即座に非表示に戻る(机だけになる)ことを確認する。

```bash
node scripts/emit-event.mjs --actor researcher --event done --phase research --message "完了"
```

確認が終わったら元のログに戻す。

```bash
cp /tmp/events.jsonl.bak logs/events.jsonl
git status
```
Expected: `git status` で `logs/events.jsonl` に差分が無い(元通り)こと。

- [ ] **Step 5: コミットする**

```bash
git add viewer/src/scene/Avatar.tsx
git commit -m "社員の出社前/退社後はアバターを表示せず机だけにする"
```

---

### Task 5: 出社/退社にスライド+バウンスのアニメーションを追加

**Files:**
- Modify: `viewer/src/theme.ts`
- Create: `viewer/src/theme.test.ts`
- Modify: `viewer/src/scene/Avatar.tsx`

**Interfaces:**
- Consumes: `presentRef`(Task 4で追加済み)
- Produces: `WALK_DIR: Record<ActorId, { x: number; z: number }>`(`viewer/src/theme.ts`)

- [ ] **Step 1: 失敗するテストを書く**

`viewer/src/theme.test.ts` を新規作成する。

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTORS, WALK_DIR } from "./theme.ts";

test("WALK_DIRは全アクター分そろっており、単位ベクトルになっている", () => {
  for (const actor of ACTORS) {
    const dir = WALK_DIR[actor];
    assert.ok(dir, `${actor} のWALK_DIRが無い`);
    const magnitude = Math.hypot(dir.x, dir.z);
    assert.ok(Math.abs(magnitude - 1) < 1e-9, `${actor} のWALK_DIRが単位ベクトルでない: ${magnitude}`);
  }
});

test("researcher(左寄りの机)の退出方向を検証する", () => {
  const dir = WALK_DIR.researcher;
  assert.ok(Math.abs(dir.x - 0.587785) < 0.001);
  assert.ok(Math.abs(dir.z - -0.809017) < 0.001);
});

test("inspector(右寄りの机)の退出方向を検証する", () => {
  const dir = WALK_DIR.inspector;
  assert.ok(Math.abs(dir.x - -0.891007) < 0.001);
  assert.ok(Math.abs(dir.z - -0.453990) < 0.001);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd viewer && npm test
```
Expected: `WALK_DIR` が存在せずFAILする。

- [ ] **Step 3: `theme.ts` に `WALK_DIR` を追加する**

`viewer/src/theme.ts` の `LEAN_TO_PREV` の定義の後(ファイル末尾)に以下を追加する。

```ts
// 出社/退社アニメーションで歩いていくワールド空間の方向。机が中心より左の社員は左へ、
// 右の社員は右へ歩く。中央寄り(pm, producer)は右に固定する。
const EXIT_WORLD_DIR: Record<ActorId, { x: number; z: number }> = Object.fromEntries(
  ACTORS.map((actor) => [actor, DESK_POSITIONS[actor].x < 0 ? { x: -1, z: 0 } : { x: 1, z: 0 }]),
) as Record<ActorId, { x: number; z: number }>;

// 出社/退社の方向を、社員自身のローカル座標系(机の正面=-z)に変換した単位ベクトル。
// LEAN_TO_NEXT/LEAN_TO_PREVと同じ変換(localDirectionTo)を、固定のワールド方向に対して適用する。
export const WALK_DIR: Record<ActorId, { x: number; z: number }> = Object.fromEntries(
  ACTORS.map((actor) => {
    const theta = DESK_POSITIONS[actor].rotY;
    const world = EXIT_WORLD_DIR[actor];
    return [
      actor,
      {
        x: world.x * Math.cos(theta) - world.z * Math.sin(theta),
        z: world.x * Math.sin(theta) + world.z * Math.cos(theta),
      },
    ];
  }),
) as Record<ActorId, { x: number; z: number }>;
```

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
npm test
```
Expected: `theme.test.ts` の3テストがPASS。

- [ ] **Step 5: `Avatar.tsx` に出社/退社のアニメーションを追加する**

`viewer/src/scene/Avatar.tsx` のimportで `theme` から取り込んでいる箇所を:

```tsx
import { PALETTE, LEAN_TO_NEXT, LEAN_TO_PREV, type ActorId } from "../theme";
```

以下に変更する。

```tsx
import { PALETTE, LEAN_TO_NEXT, LEAN_TO_PREV, WALK_DIR, type ActorId } from "../theme";
```

`TWEEN_MS`/`LEAN_DISTANCE` の定義の近くに以下の定数を追加する。

```tsx
const WALK_MS = 1200; // 出社/退社の所要時間
const WALK_DISTANCE = 5; // 出社前/退社後のローカルオフセット距離
const WALK_BOB_HEIGHT = 0.08; // 歩行中の上下バウンス幅
```

`type LeanAnim = { start: number; dir: { x: number; z: number } };` の近くに以下の型を追加する。

```tsx
type WalkAnim = { start: number; from: number; to: number; dir: { x: number; z: number } };
```

`const leanAnim = useRef<LeanAnim | null>(null);` の直後に以下を追加する。

```tsx
  const walkAnim = useRef<WalkAnim | null>(null);
```

Task 4で追加した以下のブロックを:

```tsx
    presentRef.current = state.event !== "done";
    if (groupRef.current) groupRef.current.visible = presentRef.current;
```

以下に置き換える。

```tsx
    const shouldBePresent = state.event !== "done";
    if (shouldBePresent !== presentRef.current) {
      const dir = WALK_DIR[actor];
      if (dir) {
        if (shouldBePresent) {
          presentRef.current = true;
          if (groupRef.current) groupRef.current.visible = true;
          walkAnim.current = { start: performance.now(), from: WALK_DISTANCE, to: 0, dir };
        } else {
          walkAnim.current = { start: performance.now(), from: 0, to: WALK_DISTANCE, dir };
          presentRef.current = false;
        }
      } else {
        presentRef.current = shouldBePresent;
        if (groupRef.current) groupRef.current.visible = shouldBePresent;
      }
    }
```

`useFrame` 内、`if (leanAnim.current) { ... }` のブロックを:

```tsx
      if (leanAnim.current) {
        const { start, dir } = leanAnim.current;
        const t = Math.min(1, (now - start) / TWEEN_MS);
        const amount = pulse(t) * LEAN_DISTANCE;
        groupRef.current.position.x = dir.x * amount;
        groupRef.current.position.z = dir.z * amount;
        if (t >= 1) leanAnim.current = null;
      }
```

以下に置き換える(`walkAnim` を `leanAnim` より優先する)。

```tsx
      if (walkAnim.current) {
        const { start, from, to, dir } = walkAnim.current;
        const t = Math.min(1, (now - start) / WALK_MS);
        const eased = easeInOutCubic(t);
        const amount = from + (to - from) * eased;
        groupRef.current.position.x = dir.x * amount;
        groupRef.current.position.z = dir.z * amount;
        groupRef.current.position.y = 0.32 + Math.sin(t * Math.PI) * WALK_BOB_HEIGHT;
        if (t >= 1) {
          walkAnim.current = null;
          groupRef.current.position.y = 0.32;
          if (!presentRef.current) groupRef.current.visible = false;
        }
      } else if (leanAnim.current) {
        const { start, dir } = leanAnim.current;
        const t = Math.min(1, (now - start) / TWEEN_MS);
        const amount = pulse(t) * LEAN_DISTANCE;
        groupRef.current.position.x = dir.x * amount;
        groupRef.current.position.z = dir.z * amount;
        if (t >= 1) leanAnim.current = null;
      }
```

- [ ] **Step 6: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 7: 目視で確認する**

`logs/events.jsonl` を一時的にバックアップしてから空にし、確認後に必ず元へ戻す。

```bash
cp logs/events.jsonl /tmp/events.jsonl.bak
: > logs/events.jsonl
npm --prefix viewer run dev
```

```bash
node scripts/emit-event.mjs --actor researcher --event start --phase research --message "着席"
```
Expected: researcherの机が画面左寄りにあり、左側から歩いてきて(上下に軽くバウンスしながら)
中央の定位置まで約1.2秒かけて移動する。

```bash
node scripts/emit-event.mjs --actor researcher --event done --phase research --message "完了"
```
Expected: 同じ左側へ歩いて画面外へ消え、机だけになる。

```bash
node scripts/emit-event.mjs --actor inspector --event start --phase inspect --message "着席"
```
Expected: inspectorは右寄りの机なので、右側から歩いてくる。

確認が終わったら元のログに戻す。

```bash
cp /tmp/events.jsonl.bak logs/events.jsonl
git status
```
Expected: `logs/events.jsonl` に差分が無いこと。

- [ ] **Step 8: コミットする**

```bash
git add viewer/src/theme.ts viewer/src/theme.test.ts viewer/src/scene/Avatar.tsx
git commit -m "出社/退社を机の左右へ歩いて出入りするアニメーションにする"
```

---

### Task 6: ページ読み込み直後の初回一括反映ではアニメーションを再生しない

**Files:**
- Modify: `viewer/src/scene/Avatar.tsx`

**Interfaces:**
- (このタスクの成果物に依存する後続タスクは無い)

- [ ] **Step 1: 初回一括反映を判定するrefを追加する**

`const presentRef = useRef(false);` の直後に以下を追加する。

```tsx
  const initializedRef = useRef(false); // 初回のイベント一括反映(ページ読み込み直後)かどうか
```

大きな `useEffect(() => { ... }, [state.seq]);` の冒頭を:

```tsx
    if (state.seq === 0) return;

    const shouldBePresent = state.event !== "done";
```

以下に変更する(`isInitialCatchUp` を計算し、`shouldBePresent` の判定より前に`initializedRef`を更新する)。

```tsx
    if (state.seq === 0) return;

    const isInitialCatchUp = !initializedRef.current;
    initializedRef.current = true;

    const shouldBePresent = state.event !== "done";
```

Task 5で書いた出社/退社トリガーのブロックを:

```tsx
    if (shouldBePresent !== presentRef.current) {
      const dir = WALK_DIR[actor];
      if (dir) {
        if (shouldBePresent) {
          presentRef.current = true;
          if (groupRef.current) groupRef.current.visible = true;
          walkAnim.current = { start: performance.now(), from: WALK_DISTANCE, to: 0, dir };
        } else {
          walkAnim.current = { start: performance.now(), from: 0, to: WALK_DISTANCE, dir };
          presentRef.current = false;
        }
      } else {
        presentRef.current = shouldBePresent;
        if (groupRef.current) groupRef.current.visible = shouldBePresent;
      }
    }
```

以下に置き換える(`isInitialCatchUp` のときはアニメせず即座に切り替える)。

```tsx
    if (shouldBePresent !== presentRef.current) {
      const dir = WALK_DIR[actor];
      if (isInitialCatchUp || !dir) {
        presentRef.current = shouldBePresent;
        if (groupRef.current) groupRef.current.visible = shouldBePresent;
      } else if (shouldBePresent) {
        presentRef.current = true;
        if (groupRef.current) groupRef.current.visible = true;
        walkAnim.current = { start: performance.now(), from: WALK_DISTANCE, to: 0, dir };
      } else {
        walkAnim.current = { start: performance.now(), from: 0, to: WALK_DISTANCE, dir };
        presentRef.current = false;
      }
    }
```

- [ ] **Step 2: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 3: 目視で確認する**

今回は `logs/events.jsonl` を書き換えず、リポジトリに既にある実績データ(`director`/`inspector`等に
`done`まで到達した履歴がある)のまま確認する。

```bash
npm --prefix viewer run dev
```

ブラウザでページを開き、以下を確認する。

- 既に `done` まで完了している社員(例: `researcher`, `director`)が、出社→即退社のような
  ちらつきを起こさず、**最初から机だけ**の状態で表示されること
- ページを開いたまま、以下を実行し、その社員が今度は**歩いて出社してくる**アニメーションが
  再生されることを確認する(2回目以降のイベントはアニメーション対象になる)

```bash
node scripts/emit-event.mjs --actor researcher --event start --phase research --message "新しい投稿の着席"
```

確認後、テスト用に追記したイベントが残るため、必要であれば元の状態に戻す。

```bash
git status logs/events.jsonl
git diff logs/events.jsonl
```
Expected: 追記したテスト用イベント行だけが差分として見える場合は `git checkout -- logs/events.jsonl`
で元に戻す(このコマンドは確認用の追記を破棄するだけであり、`logs/events.jsonl` 以外には影響しない)。

- [ ] **Step 4: コミットする**

```bash
git add viewer/src/scene/Avatar.tsx
git commit -m "ページ読み込み直後の初回反映では出社/退社アニメーションを再生しないようにする"
```

---

## Self-Review Notes

- **Spec coverage**: 設計書(`docs/superpowers/specs/2026-08-14-office-viewer-ui-update.md`)の
  ①レイアウト刷新→Task 1、②出社/退社→Task 4〜6、③吹き出し(はみ出し修正+面白いセリフ)→Task 2〜3。
  producer表記は変更不要と確認済みのためタスク無し。Claude Code関連(要望7・8)はスコープ外として
  設計書に明記済み。
- **Placeholder scan**: 各ステップに具体的なコード・コマンド・期待結果を記載済み。「TODO」等は無し。
- **Type consistency**: `computeBubbleSize`の戻り値型`BubbleSize`をTask 2で定義し、`SpeechBubble`・
  Task 3の面白いセリフ表示で同じ形状(`width`/`height`/`maxTextWidth`)を使用。`WALK_DIR`の型
  `Record<ActorId, { x: number; z: number }>`はTask 5で定義し、Task 5・6のAvatar.tsx内で
  一貫して`dir: { x: number; z: number }`として使用。`presentRef`(Task 4)・`walkAnim`(Task 5)・
  `initializedRef`(Task 6)は導入したタスク以降で一貫した名前・型で参照している。
