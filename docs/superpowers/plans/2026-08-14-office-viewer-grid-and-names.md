# 3Dオフィス表示層(viewer/) デスクグリッド化・命名・吹き出し再改修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `viewer/`の吹き出しデザイン(幅計算の再修正+角丸+しっぽ形状)、デスクレイアウトの
3×2グリッド化+社長席新設、AI社員6人への個人名付与を実装する。

**Architecture:** 既存の`viewer/`(Vite + React + TypeScript + @react-three/fiber)の構成は
変えない。吹き出しの幅計算(`bubbleSize.ts`)は全角/半角の重み付けを追加して再修正、
形状(`SpeechBubble.tsx`)はTHREE.Shapeで角丸+しっぽ付きに変更する。デスク配置は
`theme.ts`の`DESK_POSITIONS`をグリッド用の値に差し替えるだけで、出社/退社アニメーション・
handoff/reject演出は既存の計算ロジック(`WALK_DIR`/`WALK_DISTANCE`/`LEAN_TO_NEXT`/
`LEAN_TO_PREV`、いずれも`DESK_POSITIONS`から自動計算)がそのまま追従する。

**Tech Stack:** Vite, React 19, TypeScript, @react-three/fiber, @react-three/drei, three.js。
新規の外部パッケージは追加しない。

## Global Constraints

- **このフォルダ(`/Users/ogawadaisuke/APPS/origina-auto-sns`)の外のファイルを作成・変更・削除しない。**
- 依存パッケージは最小限にする。**本計画では新しいnpmパッケージを一切追加しない。**
- コミットメッセージは1行の日本語でシンプルにする。
- `viewer/`には自動テストの仕組みが限定的にしかない(vitest等は未導入。Node標準テストランナー
  `node --test`のみ、`viewer/package.json`の`"test": "node --test \"src/**/*.test.ts\""`)。
  **純粋ロジック(React/Three.jsに依存しない計算処理)のみ**自動テスト対象とし、
  React/Three.jsのコンポーネント・レイアウトの見た目は`npm run build`(`tsc --noEmit && vite build`、
  `viewer/`配下で実行)による型チェックと、`npm run dev` + `scripts/emit-event.mjs`を使った
  手動の目視確認で検証する。
- 動作確認で`logs/events.jsonl`を一時的に書き換える場合は、**確認後に必ず元の内容へ戻すこと**
  (`git status`で意図しない差分が残っていないか確認する)。
- 手動確認でdevサーバーを起動した場合、停止は**起動した特定のPIDのみ**を対象にする。
  `pkill -f vite`等の広範囲なプロセスkillは絶対に使わない(他のセッション・worktreeの
  devサーバーを巻き込む恐れがあるため)。
- worktreeで作業する場合、操作前に`pwd`と`git branch --show-current`でカレントディレクトリが
  意図したworktree(メインの`/Users/ogawadaisuke/APPS/origina-auto-sns`ではない)であることを
  確認すること。

---

## File Structure Overview

- `viewer/src/lib/bubbleSize.ts` — 変更(全角/半角の重み付けで幅計算を再修正)
- `viewer/src/lib/bubbleSize.test.ts` — 変更(新しい計算式に合わせて期待値を更新、重み付けの
  回帰テストを追加)
- `viewer/src/scene/SpeechBubble.tsx` — 変更(角丸+しっぽ付きの吹き出し形状に変更)
- `viewer/src/theme.ts` — 変更(`DESK_POSITIONS`をグリッド配置に差し替え、`PRESIDENT_DESK_POSITION`
  と`ACTOR_NAMES`を追加)
- `viewer/src/theme.test.ts` — 変更(新しい配置に合わせて`WALK_DIR`の期待値を更新)
- `viewer/src/scene/Office.tsx` — 変更(社長席の描画を追加、名札を名前+役職の2行表示に変更)
- `viewer/src/scene/Scene.tsx` — 変更(カメラをやや左寄りにシフトし、サイドバーに机が
  隠れないようにする)

---

### Task 1: 吹き出しサイズ計算の全角/半角重み付け対応

**Files:**
- Modify: `viewer/src/lib/bubbleSize.ts`
- Modify: `viewer/src/lib/bubbleSize.test.ts`

**Interfaces:**
- Consumes/Produces: `computeBubbleSize(text: string): BubbleSize`(既存のシグネチャ・戻り値の
  形は変えない。`SpeechBubble.tsx`(Task 2で変更)から呼ばれる)

- [ ] **Step 1: 既存テストを新しい期待値に書き換える(失敗させる)**

`viewer/src/lib/bubbleSize.test.ts`の内容を丸ごと以下に置き換える。

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

test("長いメッセージ(全角中心)は最大幅でクランプされ、複数行分の高さになる", () => {
  const longText =
    "金曜『SNS集客術』は14日基準を満たすソースが見つからずブロック。鮮度の高い木曜カテゴリへ差し替え";
  const { width, height } = computeBubbleSize(longText);
  assert.equal(width, 2.6);
  assert.ok(Math.abs(height - 1.02) < 0.001);
});

test("全角と半角で幅の重みが異なる(全角の方が幅を要する)", () => {
  const fullwidth = computeBubbleSize("あいうえお");
  const halfwidth = computeBubbleSize("abcde");
  assert.ok(fullwidth.width > halfwidth.width);
});

test("幅は常に最小1.0〜最大2.6の範囲に収まる", () => {
  for (const text of ["", "a", "あ".repeat(3), "あ".repeat(100)]) {
    const { width } = computeBubbleSize(text);
    assert.ok(width >= 1.0 && width <= 2.6);
  }
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd viewer && npm test
```
Expected: 「長いメッセージ」テストが`height`の不一致でFAILする(現行の実装は旧計算式のまま
のため)。「全角と半角で幅の重みが異なる」テストも、現行実装は文字種を区別しないため
FAILする(`fullwidth.width`と`halfwidth.width`が同じ値になる)。

- [ ] **Step 3: `computeBubbleSize`を全角/半角の重み付けに書き換える**

`viewer/src/lib/bubbleSize.ts`の内容を丸ごと以下に置き換える。

```ts
// 吹き出しの板(plane)サイズを、テキストの文字幅から見積もる。
// drei の <Text> は maxWidth で自動折り返しするため、ここで求めた maxTextWidth を
// Text の maxWidth に渡すことで、板のサイズと折り返し行数の見積もりを一致させる。
// 全角文字(ひらがな・カタカナ・漢字・全角記号)は半角文字より幅を取るため、
// 文字ごとに重みを分けて幅を見積もる簡易ヒューリスティックであり、
// ピクセル単位で正確な計算ではない点に注意(視覚確認で十分な余裕を持たせている)。
const FULLWIDTH_UNIT = 0.17; // 全角1文字あたりの目安幅(fontSize 0.15+字間の余裕)
const HALFWIDTH_WEIGHT = 0.55; // 半角文字の重み(全角=1.0との相対値)
const H_PADDING = 0.3; // 左右の余白合計
const V_PADDING = 0.22; // 上下の余白合計
const LINE_HEIGHT = 0.2;
const MIN_WIDTH = 1.0;
const MAX_WIDTH = 2.6;

export type BubbleSize = { width: number; height: number; maxTextWidth: number };

// 全角判定: ひらがな・カタカナ・全角記号(0x3000-0x30FF)、漢字(0x4E00-0x9FFF)、
// 全角英数・記号(0xFF00-0xFF60)、全角記号の一部(0xFFE0-0xFFE6)を全角とみなす。
// それ以外(半角英数・半角記号など)は半角として扱う。
function isFullWidth(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x3000 && code <= 0x30ff) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

function weightedLength(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += isFullWidth(ch) ? 1 : HALFWIDTH_WEIGHT;
  }
  return w;
}

export function computeBubbleSize(text: string): BubbleSize {
  const wLen = weightedLength(text);
  const rawWidth = wLen * FULLWIDTH_UNIT + H_PADDING;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawWidth));
  const maxTextWidth = width - H_PADDING;
  const charsPerLine = Math.max(0.001, maxTextWidth / FULLWIDTH_UNIT);
  const lineCount = Math.max(1, Math.ceil(wLen / charsPerLine));
  const height = lineCount * LINE_HEIGHT + V_PADDING;
  return { width, height, maxTextWidth };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
npm test
```
Expected: `bubbleSize.test.ts`の4テストすべてPASS。

- [ ] **Step 5: 型チェック・ビルドを実行する**

```bash
npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 6: コミットする**

```bash
git add viewer/src/lib/bubbleSize.ts viewer/src/lib/bubbleSize.test.ts
git commit -m "吹き出しの幅計算を全角/半角の重み付けに修正しはみ出しを再解消"
```

---

### Task 2: 吹き出しを角丸+しっぽ付きの形状に変更

**Files:**
- Modify: `viewer/src/scene/SpeechBubble.tsx`

**Interfaces:**
- Consumes: `computeBubbleSize`(Task 1で変更済み、シグネチャは不変)
- Produces: `SpeechBubble({ text, bg })`(既存の呼び出し側`Avatar.tsx`は変更不要。propsの
  形は変えない)

- [ ] **Step 1: `SpeechBubble.tsx`を書き換える**

`viewer/src/scene/SpeechBubble.tsx`の内容を丸ごと以下に置き換える。

```tsx
import { useMemo } from "react";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "../theme";
import { computeBubbleSize } from "../lib/bubbleSize";

const DEFAULT_BG = "#ffffff";
const CORNER_RADIUS = 0.08; // 角丸の半径(吹き出しが小さい場合は幅・高さに応じて縮める)
const TAIL_WIDTH = 0.14; // しっぽの付け根の幅
const TAIL_HEIGHT = 0.16; // しっぽの高さ(下辺からどれだけ突き出すか)

// 角丸長方形+下向きのしっぽを持つ吹き出し形状を組み立てる。
// しっぽは下辺中央から下(アバターの頭側)に向けて突き出す。
function buildBubbleShape(width: number, height: number): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(CORNER_RADIUS, w * 0.3, h * 0.3);
  const tailHalf = Math.min(TAIL_WIDTH / 2, w * 0.3);

  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(-tailHalf, -h);
  shape.lineTo(0, -h - TAIL_HEIGHT);
  shape.lineTo(tailHalf, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

// 社員アバターの頭上に表示する吹き出し。テキストの文字幅に応じて板のサイズを変える。
// bgを変えることで、実際のイベントメッセージと演出用の小ネタ(面白いセリフ)を視覚的に区別できる。
export function SpeechBubble({ text, bg = DEFAULT_BG }: { text: string; bg?: string }) {
  const { width, height, maxTextWidth } = computeBubbleSize(text);
  const geometry = useMemo(() => new THREE.ShapeGeometry(buildBubbleShape(width, height)), [width, height]);

  return (
    <Billboard position={[0, 2.05, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={bg} roughness={1} metalness={0} side={THREE.DoubleSide} />
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

- [ ] **Step 2: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 3: 目視で確認する**

```bash
npm --prefix viewer run dev
```
別ターミナルで短いメッセージ・長いメッセージを流し込み、吹き出しが角丸+しっぽ付きの形状に
なっており、テキストが背景からはみ出さないことを確認する。

```bash
node scripts/emit-event.mjs --actor director --event progress --phase structure --message "了解です"
node scripts/emit-event.mjs --actor director --event progress --phase structure --message "本文を6枚とも44〜49字に収まるよう再調整しています。もう少しお待ちください"
```

- [ ] **Step 4: コミットする**

```bash
git add viewer/src/scene/SpeechBubble.tsx
git commit -m "吹き出しを角丸+しっぽ付きの形状に変更"
```

---

### Task 3: デスクレイアウトを3×2グリッド化し社長席を新設

**Files:**
- Modify: `viewer/src/theme.ts`
- Modify: `viewer/src/theme.test.ts`
- Modify: `viewer/src/scene/Office.tsx`

**Interfaces:**
- Produces: `PRESIDENT_DESK_POSITION: { x: number; z: number; rotY: number }`(`viewer/src/theme.ts`、
  Task 5では使わないがOffice.tsxが参照する)
- `DESK_POSITIONS`・`WALK_DIR`・`WALK_DISTANCE`・`LEAN_TO_NEXT`・`LEAN_TO_PREV`の型・エクスポート名は
  変えない(値だけが新しい配置に応じて変わる)

- [ ] **Step 1: 失敗するテストに書き換える**

`viewer/src/theme.test.ts`の内容を丸ごと以下に置き換える(新しいグリッド配置での期待値)。

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

test("researcher(左列)は左へ退出する", () => {
  const dir = WALK_DIR.researcher;
  assert.ok(Math.abs(dir.x - 1) < 0.001);
  assert.ok(Math.abs(dir.z - 0) < 0.001);
});

test("pm(右列)は右へ退出する", () => {
  const dir = WALK_DIR.pm;
  assert.ok(Math.abs(dir.x - -1) < 0.001);
  assert.ok(Math.abs(dir.z - 0) < 0.001);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd viewer && npm test
```
Expected: 「researcher」「pm」のテストが、現行の半円配置由来の値と新しい期待値が一致せず
FAILする。

- [ ] **Step 3: `theme.ts`の`DESK_POSITIONS`をグリッド配置に差し替え、`PRESIDENT_DESK_POSITION`を追加する**

`viewer/src/theme.ts`の以下のブロックを:

```ts
// 半円状のオフィスレイアウト。pm は最奥中央で全体を見渡す配置。
export const DESK_POSITIONS: Record<ActorId, { x: number; z: number; rotY: number }> = {
  pm: { x: 0, z: -6.5, rotY: Math.PI },
  researcher: { x: -6.2, z: -1, rotY: Math.PI * 0.7 },
  director: { x: -3.4, z: 1.8, rotY: Math.PI * 0.85 },
  producer: { x: 0, z: 2.8, rotY: Math.PI },
  inspector: { x: 3.4, z: 1.8, rotY: -Math.PI * 0.85 },
  publisher: { x: 6.2, z: -1, rotY: -Math.PI * 0.7 },
};
```

以下に置き換える。

```ts
// 横3×縦2のグリッド配置。全員カメラの方(rotY: Math.PI)を向く。
// 奥列(z=-3.5): researcher→director→producer(幕1〜3の順)
// 手前列(z=1.0): inspector→publisher→pm(幕4〜5+PM)
export const DESK_POSITIONS: Record<ActorId, { x: number; z: number; rotY: number }> = {
  researcher: { x: -3.6, z: -3.5, rotY: Math.PI },
  director: { x: 0, z: -3.5, rotY: Math.PI },
  producer: { x: 3.6, z: -3.5, rotY: Math.PI },
  inspector: { x: -3.6, z: 1.0, rotY: Math.PI },
  publisher: { x: 0, z: 1.0, rotY: Math.PI },
  pm: { x: 3.6, z: 1.0, rotY: Math.PI },
};

// 社長席(ユーザーを表す飾りの机)。PMの旧位置(半円配置時の奥中央)を踏襲し、
// グリッド全体を見渡す位置に置く。イベントログとは連動しない固定オブジェクト。
export const PRESIDENT_DESK_POSITION = { x: 0, z: -6.5, rotY: Math.PI };
```

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
npm test
```
Expected: `theme.test.ts`の3テストすべてPASS。

- [ ] **Step 5: `Office.tsx`に社長席の描画を追加する**

`viewer/src/scene/Office.tsx`のimport行を:

```tsx
import { ACTORS, ACTOR_COLORS, ACTOR_LABELS, DESK_POSITIONS, PALETTE, type ActorId } from "../theme";
```

以下に変更する。

```tsx
import {
  ACTORS,
  ACTOR_COLORS,
  ACTOR_LABELS,
  DESK_POSITIONS,
  PALETTE,
  PRESIDENT_DESK_POSITION,
  type ActorId,
} from "../theme";
```

`NameSign`関数の直後(Office関数の直前)に、社長席専用の名札コンポーネントを追加する。

```tsx
// 社長席の名札。AI社員の名札とは違い役職の2行目は無く、常に「社長」とだけ表示する。
function PresidentNameSign() {
  return (
    <Billboard position={[0, 0.98, -0.58]}>
      <mesh>
        <planeGeometry args={[0.9, 0.32]} />
        <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.19} color={PALETTE.ink} anchorX="center" anchorY="middle">
        社長
      </Text>
    </Billboard>
  );
}
```

`Office`関数の`return`文を:

```tsx
  return (
    <group>
      {ACTORS.map((actor) => {
        const pos = DESK_POSITIONS[actor];
        return (
          <group key={actor} position={[pos.x, 0, pos.z]} rotation={[0, pos.rotY, 0]}>
            <Desk />
            <NameSign actor={actor} />
            <OutputStack count={actors[actor].outputCount} />
            <group position={[0, 0, 0.55]}>
              <Avatar actor={actor} color={ACTOR_COLORS[actor]} state={actors[actor]} batchCount={batchCount} />
            </group>
          </group>
        );
      })}
    </group>
  );
```

以下に置き換える(社長席を追加)。

```tsx
  return (
    <group>
      {ACTORS.map((actor) => {
        const pos = DESK_POSITIONS[actor];
        return (
          <group key={actor} position={[pos.x, 0, pos.z]} rotation={[0, pos.rotY, 0]}>
            <Desk />
            <NameSign actor={actor} />
            <OutputStack count={actors[actor].outputCount} />
            <group position={[0, 0, 0.55]}>
              <Avatar actor={actor} color={ACTOR_COLORS[actor]} state={actors[actor]} batchCount={batchCount} />
            </group>
          </group>
        );
      })}
      <group
        position={[PRESIDENT_DESK_POSITION.x, 0, PRESIDENT_DESK_POSITION.z]}
        rotation={[0, PRESIDENT_DESK_POSITION.rotY, 0]}
      >
        <Desk />
        <PresidentNameSign />
      </group>
    </group>
  );
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
ブラウザで開き、以下を確認する。

- 6卓が横3×縦2のグリッドに並び、全員が同じ向き(カメラ側)を向いていること
- グリッドの奥、中央付近に「社長」という名札の付いた空席の机があること
- 出社/退社アニメーション・handoff/rejectの身を乗り出す演出が壊れていないこと
  (左列の社員は左へ、右列の社員は右へ出社/退社することを確認する)

```bash
node scripts/emit-event.mjs --actor researcher --event start --phase research --message "着席"
node scripts/emit-event.mjs --actor pm --event handoff --phase research --message "リサーチを依頼"
```

- [ ] **Step 8: コミットする**

```bash
git add viewer/src/theme.ts viewer/src/theme.test.ts viewer/src/scene/Office.tsx
git commit -m "デスクを横3x縦2のグリッドに変更し社長席を新設"
```

---

### Task 4: サイドバーに机が隠れないようカメラを調整

**Files:**
- Modify: `viewer/src/scene/Scene.tsx`

**Interfaces:**
- (このタスクの成果物に依存する後続タスクは無い)

- [ ] **Step 1: カメラ位置・注視点を左寄りにシフトする**

`viewer/src/scene/Scene.tsx`の以下の行を:

```tsx
const CAMERA_POSITION: [number, number, number] = [0, 15, 17.5];
```

以下に変更する。

```tsx
const CAMERA_POSITION: [number, number, number] = [-2, 15, 17.5];
```

同ファイルの以下の行を:

```tsx
      onCreated={({ camera }) => camera.lookAt(0, 1, -1.5)}
```

以下に変更する。

```tsx
      onCreated={({ camera }) => camera.lookAt(-2, 1, -1.5)}
```

- [ ] **Step 2: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 3: 目視で確認する(ブラウザの幅を変えながら)**

```bash
npm --prefix viewer run dev
```
ブラウザで開き、右端のサイドバー(社員ステータス+アクティビティログ)の下に、どの机も
隠れていないことを確認する。ウィンドウ幅を狭めた場合にも大きく崩れないか確認する。
**隠れている机がある場合は、`CAMERA_POSITION`と`camera.lookAt`のx値(現在は-2)を
-1〜-3の範囲で調整し、隠れなくなる値を探す**(この微調整は実装時の目視確認に委ねる)。

- [ ] **Step 4: コミットする**

```bash
git add viewer/src/scene/Scene.tsx
git commit -m "サイドバーに机が隠れないようカメラを左寄りに調整"
```

---

### Task 5: AI社員への個人名付与+名札の2行表示

**Files:**
- Modify: `viewer/src/theme.ts`
- Modify: `viewer/src/scene/Office.tsx`

**Interfaces:**
- Produces: `ACTOR_NAMES: Record<ActorId, string>`(`viewer/src/theme.ts`)

- [ ] **Step 1: `theme.ts`に`ACTOR_NAMES`を追加する**

`viewer/src/theme.ts`の`ACTOR_LABELS`の定義の直後に、以下を追加する。

```ts
// 職業から連想した個人名(ひらがな表記)。3Dの名札は小さいため視認性を優先し、
// 漢字ではなくひらがなで表示する(由来は下記コメント参照)。
export const ACTOR_NAMES: Record<ActorId, string> = {
  pm: "つかさ", // 司 - 全体を取り仕切る役
  researcher: "あかり", // 灯 - 情報を照らして見つけ出す役
  director: "ゆい", // 結 - ソースを構成として結びつける役
  producer: "たくみ", // 匠 - 手を動かして作り上げる役
  inspector: "さえ", // 冴 - 鋭く厳しい目でチェックする役
  publisher: "つばさ", // 翼 - 世の中へ送り出す役
};
```

- [ ] **Step 2: `NameSign`を名前+役職の2行表示に変更する**

`viewer/src/scene/Office.tsx`のimport行に`ACTOR_NAMES`を追加する。

```tsx
import {
  ACTORS,
  ACTOR_COLORS,
  ACTOR_LABELS,
  ACTOR_NAMES,
  DESK_POSITIONS,
  PALETTE,
  PRESIDENT_DESK_POSITION,
  type ActorId,
} from "../theme";
```

`NameSign`関数を:

```tsx
function NameSign({ actor }: { actor: (typeof ACTORS)[number] }) {
  return (
    <Billboard position={[0, 0.98, -0.58]}>
      <mesh>
        <planeGeometry args={[0.9, 0.32]} />
        <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.19} color={PALETTE.ink} anchorX="center" anchorY="middle">
        {ACTOR_LABELS[actor]}
      </Text>
    </Billboard>
  );
}
```

以下に置き換える(名前を大きく上段、役職を小さく下段に表示。板のサイズも2行分に拡張)。

```tsx
function NameSign({ actor }: { actor: (typeof ACTORS)[number] }) {
  return (
    <Billboard position={[0, 1.0, -0.58]}>
      <mesh>
        <planeGeometry args={[0.9, 0.44]} />
        <meshStandardMaterial color={PALETTE.wallShoji} roughness={1} metalness={0} />
      </mesh>
      <Text position={[0, 0.09, 0.01]} fontSize={0.19} color={PALETTE.ink} anchorX="center" anchorY="middle">
        {ACTOR_NAMES[actor]}
      </Text>
      <Text position={[0, -0.1, 0.01]} fontSize={0.12} color={PALETTE.ink} anchorX="center" anchorY="middle">
        {ACTOR_LABELS[actor]}
      </Text>
    </Billboard>
  );
}
```

- [ ] **Step 3: 型チェック・ビルドを実行する**

```bash
cd viewer && npm run build
```
Expected: エラー無く終了する。

- [ ] **Step 4: 目視で確認する**

```bash
npm --prefix viewer run dev
```
ブラウザで開き、各社員の名札に「ひらがなの名前(大きめ)」と「役職(小さめ)」の2行が
重ならず表示されていること、社長席の名札(1行、「社長」)には影響が無いことを確認する。
**2行が窮屈・重なって見える場合は、`NameSign`のフォントサイズ・Y位置・板の高さ(0.44)を
実装時に微調整してよい。**

- [ ] **Step 5: コミットする**

```bash
git add viewer/src/theme.ts viewer/src/scene/Office.tsx
git commit -m "AI社員に個人名を付与し名札を名前+役職の2行表示に変更"
```

---

## Self-Review Notes

- **Spec coverage**: 設計書(`docs/superpowers/specs/2026-08-14-office-viewer-grid-and-names.md`)の
  ①吹き出しデザイン→Task 1・2、②デスクグリッド化+社長席+サイドバー回避→Task 3・4、
  ③個人名付与→Task 5。すべて対応済み。
- **Placeholder scan**: 各ステップに具体的なコード・コマンド・期待結果を記載済み。数値の
  微調整が必要な箇所(カメラのx値、名札のフォントサイズ)は「実装時の目視確認に委ねる」旨を
  明記し、開始値も具体的に与えているため、「TBD」のような未確定のプレースホルダーではない。
- **Type consistency**: `computeBubbleSize`の戻り値型`BubbleSize`(`width`/`height`/`maxTextWidth`)は
  Task 1で変更後も変わらず、Task 2の`SpeechBubble`はそのまま同じ形で受け取る。`DESK_POSITIONS`・
  `PRESIDENT_DESK_POSITION`の型`{ x: number; z: number; rotY: number }`はTask 3内で一貫。
  `ACTOR_NAMES`の型`Record<ActorId, string>`はTask 5で定義し`ACTOR_LABELS`と同じ形にしている。
