# 3Dオフィス表示層(viewer/) 社長からの指示入力機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3Dビュー(`viewer/`)の社長席の上に、社長が今動いているClaude Codeセッションへ指示・一時停止依頼を送れるモニター風UIを追加する。

**Architecture:** Viteのdevサーバーミドルウェアに`/api/instructions`(GET/POST)を追加し、ブラウザからの送信を`logs/instructions.jsonl`へ追記する。3D側は新規`PresidentMonitor`コンポーネントが`Html`(drei)でテキスト入力欄・送信履歴・一時停止ボタンを表示する。Claude Code側は`Monitor`ツールで同ファイルを`tail -f`し、新しい行を通知として受け取る(強制中断ではなく、次の区切りで気づいて手を止める「ソフトストップ」)。

**Tech Stack:** 既存の`viewer/`(Vite + React + TypeScript + @react-three/fiber + @react-three/drei)のみ。新規npm依存は追加しない。

## Global Constraints

- 日本語で応対・日本語UIラベルを使う(プロジェクトCLAUDE.md)
- 新規npm依存パッケージを追加しない(`@react-three/drei`の`Html`/`Billboard`など既存パッケージのみ使用)
- コミットメッセージは1行の日本語でシンプルに
- APIキー・トークンの類は一切扱わない(ローカルdevサーバー限定の機能のため元々不要)
- `logs/instructions.jsonl`は`.gitignore`に追加し、git管理対象外にする(運用中の一時データのため)
- 3Dオブジェクトの配色・質感は`viewer/src/theme.ts`の`PALETTE`(低彩度・マット質感、roughness高め・metalness 0)に合わせる
- カメラは固定(操作不可)。カメラの方を向く必要があるオブジェクトは既存の`Billboard`パターン(`NameSign`/`SpeechBubble`)に倣う
- 「一時停止」は強制的な即時中断ではなく、次の区切りで気づいて手を止める「ソフトストップ」(設計メモで合意済み)

---

## Task 1: ログスキーマ・gitignore・devサーバーAPI拡張

**Files:**
- Modify: `logs/SCHEMA.md`
- Modify: `.gitignore`
- Modify: `viewer/vite.config.ts`

**Interfaces:**
- Produces: `GET /api/instructions`(`logs/instructions.jsonl`の生テキストをそのまま返す。ファイル無しなら空文字)、`POST /api/instructions`(リクエストボディ`{"kind": "instruction" | "stop", "message": string}`のJSONを受け取り、サーバー側で`ts`(ISO8601)を付与した1行JSON`{ts, kind, message}`を`logs/instructions.jsonl`に追記。成功時200、`kind`が不正またはJSONパース失敗時400)
- 後続タスク(Task 2)はこのAPI契約を前提にfetchする

- [ ] **Step 1: `logs/SCHEMA.md`に`instructions.jsonl`のスキーマを追記する**

`logs/SCHEMA.md`の末尾に以下を追記する(既存の「表示層を作るときの前提」セクションの後ろに追加):

```markdown

## `logs/instructions.jsonl`(社長からの指示・一時停止)

`logs/events.jsonl`とは別の、3Dビュー(viewer/)の社長モニターからClaude Codeセッションへの
一方向の入力用ログ。1行1JSON(JSON Lines)。**git管理対象外**(`.gitignore`参照。運用中の
一時データのため、AI社員の成果物ログである`events.jsonl`とは扱いを分けている)。

| キー | 型 | 説明 |
|---|---|---|
| `ts` | string | ISO8601のタイムスタンプ(devサーバー側で付与) |
| `kind` | string | `"instruction"`(自由記述の指示) \| `"stop"`(一時停止ボタン。メッセージは固定文言) |
| `message` | string | 本文 |

### 例

```json
{"ts":"2026-08-14T05:00:00.000Z","kind":"instruction","message":"3枚目の見出しをもっと短くして"}
{"ts":"2026-08-14T05:02:00.000Z","kind":"stop","message":"作業を一時停止してください"}
```

Claude Codeセッション側でこのファイルを`tail -f`等で監視することで、動いているセッションに
指示を届けられる。ただし実行中のツール呼び出しを強制的に中断させることはできない
(次の区切りで気づいて手を止める「ソフトストップ」)。
```

- [ ] **Step 2: `.gitignore`に`logs/instructions.jsonl`を追加する**

`.gitignore`の`*.log`の行の下に1行追加する:

```
node_modules/
.env
output/
.playwright-mcp/
*.log
logs/instructions.jsonl
.DS_Store
.superpowers/
viewer/dist/
work/*
!work/.gitkeep
```

- [ ] **Step 3: `viewer/vite.config.ts`に`/api/instructions`のミドルウェアを追加する**

既存の`eventsApiPlugin`と同じファイルに、以下を追加する形で全体を書き換える:

```typescript
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// logs/events.jsonl はリポジトリルート(viewer/の外)にある。
// ビルド成果物には含めず、開発サーバーのAPIとしてだけ生データを返す。
function eventsApiPlugin(): Plugin {
  const eventsPath = resolve(import.meta.dirname, "../logs/events.jsonl");

  return {
    name: "events-api",
    configureServer(server) {
      server.middlewares.use("/api/events", (_req, res) => {
        let body = "";
        try {
          body = readFileSync(eventsPath, "utf8");
        } catch {
          // ログがまだ無い場合も表示層は落とさない
          body = "";
        }
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(body);
      });
    },
  };
}

// logs/instructions.jsonl はリポジトリルート(viewer/の外)にあり、git管理対象外
// (.gitignore参照)。社長モニターからの指示・一時停止をここに追記し、Claude Code
// セッション側の tail -f で拾えるようにする。
function instructionsApiPlugin(): Plugin {
  const instructionsPath = resolve(import.meta.dirname, "../logs/instructions.jsonl");

  return {
    name: "instructions-api",
    configureServer(server) {
      server.middlewares.use("/api/instructions", (req, res) => {
        if (req.method === "POST") {
          let raw = "";
          req.on("data", (chunk) => {
            raw += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(raw) as { kind?: unknown; message?: unknown };
              if (
                (parsed.kind !== "instruction" && parsed.kind !== "stop") ||
                typeof parsed.message !== "string" ||
                parsed.message.length === 0
              ) {
                res.statusCode = 400;
                res.end();
                return;
              }
              const line =
                JSON.stringify({ ts: new Date().toISOString(), kind: parsed.kind, message: parsed.message }) + "\n";
              appendFileSync(instructionsPath, line, "utf8");
              res.statusCode = 200;
              res.end();
            } catch {
              res.statusCode = 400;
              res.end();
            }
          });
          return;
        }

        let body = "";
        try {
          body = readFileSync(instructionsPath, "utf8");
        } catch {
          body = "";
        }
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(body);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), eventsApiPlugin(), instructionsApiPlugin()],
});
```

- [ ] **Step 4: 手動でAPIを確認する**

```bash
npm --prefix viewer run dev
```

表示されたURL(例: `http://localhost:5173`)を確認したうえで、別ターミナルで:

```bash
curl -s -X POST http://localhost:5173/api/instructions \
  -H "content-type: application/json" \
  -d '{"kind":"instruction","message":"動作確認テスト"}'
echo "---"
curl -s http://localhost:5173/api/instructions
echo "---"
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5173/api/instructions \
  -H "content-type: application/json" \
  -d '{"kind":"invalid","message":"x"}'
```

Expected:
- 1つ目のcurl: 空のレスポンス(200、本文なし)
- 2つ目のcurl: `{"ts":"...","kind":"instruction","message":"動作確認テスト"}`を含む行が出力される
- 3つ目のcurl: `400`が出力される(不正な`kind`は拒否される)

確認後、`logs/instructions.jsonl`に書き込まれたテスト行を削除しておく(git管理対象外だが、
以後の動作確認を汚さないため):

```bash
rm -f logs/instructions.jsonl
```

devサーバーは次のタスクでも使うため、起動したままでよい(不要なら`Ctrl-C`で止める)。

- [ ] **Step 5: コミット**

```bash
git add logs/SCHEMA.md .gitignore viewer/vite.config.ts
git commit -m "指示ログ用のdevサーバーAPIを追加"
```

---

## Task 2: `instructionLog.ts`(パース関数+ポーリングフック)

**Files:**
- Create: `viewer/src/lib/instructionLog.ts`
- Test: `viewer/src/lib/instructionLog.test.ts`

**Interfaces:**
- Consumes: Task 1の`GET/POST /api/instructions`(契約は上記参照)
- Produces:
  ```typescript
  export type InstructionEntry = { ts: string; kind: "instruction" | "stop"; message: string };
  export function parseInstructions(fullText: string): InstructionEntry[];
  export function useInstructionLog(): {
    history: InstructionEntry[];
    send: (kind: "instruction" | "stop", message: string) => Promise<void>;
  };
  ```
  Task 3はこの`InstructionEntry`型と`useInstructionLog`をそのまま使う。

- [ ] **Step 1: 失敗するテストを書く**

`viewer/src/lib/instructionLog.test.ts`を新規作成:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInstructions } from "./instructionLog.ts";

test("正常な行をパースする", () => {
  const text =
    '{"ts":"2026-08-14T05:00:00.000Z","kind":"instruction","message":"3枚目を短く"}\n' +
    '{"ts":"2026-08-14T05:02:00.000Z","kind":"stop","message":"作業を一時停止してください"}\n';
  const result = parseInstructions(text);
  assert.equal(result.length, 2);
  assert.equal(result[0].kind, "instruction");
  assert.equal(result[0].message, "3枚目を短く");
  assert.equal(result[1].kind, "stop");
});

test("不正なJSON行はスキップする", () => {
  const text = '{"ts":"2026-08-14T05:00:00.000Z","kind":"instruction","message":"ok"}\nnot json\n';
  const result = parseInstructions(text);
  assert.equal(result.length, 1);
});

test("kindが未知の行はスキップする", () => {
  const text = '{"ts":"2026-08-14T05:00:00.000Z","kind":"unknown","message":"x"}\n';
  const result = parseInstructions(text);
  assert.equal(result.length, 0);
});

test("空文字列は空配列を返す", () => {
  assert.deepEqual(parseInstructions(""), []);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm --prefix viewer test`
Expected: FAIL(`instructionLog.ts`が存在しないため`Cannot find module`のようなエラー)

- [ ] **Step 3: `instructionLog.ts`を実装する**

`viewer/src/lib/instructionLog.ts`を新規作成:

```typescript
import { useCallback, useEffect, useState } from "react";

export type InstructionEntry = {
  ts: string;
  kind: "instruction" | "stop";
  message: string;
};

// logs/instructions.jsonl の生テキスト(JSON Lines)から、パース可能な行だけを取り出す。
// events.jsonl(eventLog.ts)と同じ方針で、不正な行(パース失敗・未知のkind)はスキップし
// 表示層は落とさない。
export function parseInstructions(fullText: string): InstructionEntry[] {
  return fullText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line): InstructionEntry | null => {
      try {
        const parsed = JSON.parse(line);
        if (
          typeof parsed.ts === "string" &&
          (parsed.kind === "instruction" || parsed.kind === "stop") &&
          typeof parsed.message === "string"
        ) {
          return parsed as InstructionEntry;
        }
        return null;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is InstructionEntry => entry !== null);
}

const POLL_INTERVAL_MS = 2000;

// logs/instructions.jsonl の全件をポーリング取得するフック(eventLog.tsの差分方式とは異なり、
// 履歴表示のため常に全文を読み直す。ファイルは小さく運用中のみのデータのため問題ない)。
// sendInstructionはPOSTで新しい指示を送る(送信後の反映は次回ポーリングを待つ)。
export function useInstructionLog(): {
  history: InstructionEntry[];
  send: (kind: "instruction" | "stop", message: string) => Promise<void>;
} {
  const [history, setHistory] = useState<InstructionEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/instructions", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (!cancelled) setHistory(parseInstructions(text));
      } catch {
        // devサーバー再起動中など。次のポーリングで復帰する
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const send = useCallback(async (kind: "instruction" | "stop", message: string) => {
    await fetch("/api/instructions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, message }),
    });
  }, []);

  return { history, send };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm --prefix viewer test`
Expected: PASS(4件のテストすべて成功)

- [ ] **Step 5: 型チェックを確認する**

Run: `npm --prefix viewer run build`
Expected: エラー無く完了する(この時点では`instructionLog.ts`はどこからも使われていないが、
未使用exportによる型エラーは出ない)

- [ ] **Step 6: コミット**

```bash
git add viewer/src/lib/instructionLog.ts viewer/src/lib/instructionLog.test.ts
git commit -m "指示ログのパースとポーリングフックを追加"
```

---

## Task 3: `PresidentMonitor`コンポーネントと配線

**Files:**
- Create: `viewer/src/scene/PresidentMonitor.tsx`
- Modify: `viewer/src/ui/panels.css`
- Modify: `viewer/src/scene/Office.tsx`
- Modify: `viewer/src/scene/Scene.tsx`
- Modify: `viewer/src/App.tsx`

**Interfaces:**
- Consumes: Task 2の`InstructionEntry`型・`useInstructionLog()`(`../lib/instructionLog`からimport)
- Produces: `PresidentMonitor({ history, send }: { history: InstructionEntry[]; send: (kind: "instruction" | "stop", message: string) => Promise<void> })`コンポーネント。`Office`/`Scene`/`App`のprops契約が変わる(下記参照)

この3Dビジュアル部分はコード品質としてはユニットテストしないタスクの範囲(既存の`Avatar.tsx`等の
3D演出コンポーネントと同じ扱い)。`npm run build`の型チェックと、ブラウザでの目視確認で検証する。

- [ ] **Step 1: `panels.css`に社長モニター用のスタイルを追記する**

`viewer/src/ui/panels.css`の末尾に追記する:

```css

.president-monitor {
  width: 280px;
  padding: 10px 12px;
  background: rgba(58, 53, 48, 0.94);
  border-radius: 6px;
  color: #f2ede4;
  font-family: "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.president-monitor__history {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 90px;
  overflow-y: auto;
}

.president-monitor__empty {
  margin: 0;
  font-size: 11px;
  color: #b8ab94;
}

.president-monitor__entry,
.president-monitor__entry--stop {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: break-word;
}

.president-monitor__entry {
  color: #f2ede4;
}

.president-monitor__entry--stop {
  color: #e08a7d;
  font-weight: bold;
}

.president-monitor__input {
  width: 100%;
  min-height: 44px;
  resize: none;
  border-radius: 4px;
  border: 1px solid #6b6155;
  background: #f2ede4;
  color: var(--ink);
  font-family: inherit;
  font-size: 12px;
  padding: 6px;
  box-sizing: border-box;
}

.president-monitor__buttons {
  display: flex;
  gap: 6px;
}

.president-monitor__send,
.president-monitor__stop {
  flex: 1;
  border: none;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  color: #fff;
}

.president-monitor__send {
  background: var(--wood);
}

.president-monitor__stop {
  background: #b23b2f;
}

.president-monitor__send:disabled,
.president-monitor__stop:disabled {
  opacity: 0.5;
  cursor: default;
}
```

- [ ] **Step 2: `PresidentMonitor.tsx`を実装する**

`viewer/src/scene/PresidentMonitor.tsx`を新規作成:

```tsx
import { useState } from "react";
import { Billboard, Html } from "@react-three/drei";
import { PALETTE } from "../theme";
import type { InstructionEntry } from "../lib/instructionLog";

const STOP_MESSAGE = "作業を一時停止してください";
const HISTORY_LIMIT = 5;

// 社長席の上に置く、モニター風の3Dオブジェクト。画面部分にHTMLパネル(Html transform)を重ね、
// 指示入力欄・送信履歴・一時停止ボタンを表示する。カメラは固定のため、画面パネルは
// Billboardで常にカメラへ正対させる(NameSign/SpeechBubbleと同じパターン)。
export function PresidentMonitor({
  history,
  send,
}: {
  history: InstructionEntry[];
  send: (kind: "instruction" | "stop", message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      await send("instruction", message);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  async function handleStop() {
    if (sending) return;
    setSending(true);
    try {
      await send("stop", STOP_MESSAGE);
    } finally {
      setSending(false);
    }
  }

  const recent = history.slice(-HISTORY_LIMIT);

  return (
    <group position={[0, 1.35, -0.1]}>
      <mesh position={[0, -0.55, 0]} castShadow>
        <boxGeometry args={[0.06, 0.5, 0.06]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.85} metalness={0} />
      </mesh>
      <Billboard>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.85, 0.04]} />
          <meshStandardMaterial color="#3A3530" roughness={0.7} metalness={0} />
        </mesh>
        <Html transform occlude={false} position={[0, 0, 0.03]} scale={0.0035} style={{ pointerEvents: "auto" }}>
          <div className="president-monitor">
            <div className="president-monitor__history">
              {recent.length === 0 ? (
                <p className="president-monitor__empty">まだ指示はありません</p>
              ) : (
                recent.map((entry, i) => (
                  <p
                    key={`${entry.ts}-${i}`}
                    className={entry.kind === "stop" ? "president-monitor__entry--stop" : "president-monitor__entry"}
                  >
                    {entry.message}
                  </p>
                ))
              )}
            </div>
            <textarea
              className="president-monitor__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="指示を入力..."
            />
            <div className="president-monitor__buttons">
              <button
                type="button"
                className="president-monitor__send"
                onClick={handleSend}
                disabled={sending || draft.trim().length === 0}
              >
                送信
              </button>
              <button type="button" className="president-monitor__stop" onClick={handleStop} disabled={sending}>
                一時停止
              </button>
            </div>
          </div>
        </Html>
      </Billboard>
    </group>
  );
}
```

- [ ] **Step 3: `Office.tsx`に組み込む**

`viewer/src/scene/Office.tsx`を変更する。importとprops、社長席のレンダリング部分を以下のように変更する:

```typescript
import { Billboard, Text } from "@react-three/drei";
import {
  ACTORS,
  ACTOR_COLORS,
  ACTOR_LABELS,
  ACTOR_NAMES,
  DESK_POSITIONS,
  PALETTE,
  PRESIDENT_DESK_POSITION,
  PRESIDENT_LABEL,
  type ActorId,
} from "../theme";
import { Desk } from "./Desk";
import { Avatar } from "./Avatar";
import { OutputStack } from "./OutputStack";
import { PresidentMonitor } from "./PresidentMonitor";
import type { ActorState } from "../state/officeState";
import type { InstructionEntry } from "../lib/instructionLog";
```

(`NameSign`関数定義はそのまま変更しない)

```typescript
// 横3×縦2のグリッドに並んだ6卓+社長席のオフィス。logs/events.jsonl の状態に応じて各社員が反応する。
export function Office({
  actors,
  batchCount,
  instructionHistory,
  sendInstruction,
}: {
  actors: Record<ActorId, ActorState>;
  batchCount: number;
  instructionHistory: InstructionEntry[];
  sendInstruction: (kind: "instruction" | "stop", message: string) => Promise<void>;
}) {
  return (
    <group>
      {ACTORS.map((actor) => {
        const pos = DESK_POSITIONS[actor];
        return (
          <group key={actor} position={[pos.x, 0, pos.z]} rotation={[0, pos.rotY, 0]}>
            <Desk />
            <NameSign name={ACTOR_NAMES[actor]} role={ACTOR_LABELS[actor]} />
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
        <NameSign name={PRESIDENT_LABEL} />
        <PresidentMonitor history={instructionHistory} send={sendInstruction} />
      </group>
    </group>
  );
}
```

- [ ] **Step 4: `Scene.tsx`にpropsを通す**

`viewer/src/scene/Scene.tsx`を以下のように変更する:

```tsx
import { Canvas } from "@react-three/fiber";
import { Room } from "./Room";
import { Office } from "./Office";
import type { OfficeState } from "../state/officeState";
import type { InstructionEntry } from "../lib/instructionLog";

// アイソメトリック調のローポリ表現。俯瞰45度前後の固定カメラで、パースは弱め(FOVを絞って擬似アイソに寄せる)。
// カメラは固定で、ユーザーが回転させる操作は付けない。
const CAMERA_POSITION: [number, number, number] = [2, 15, 17.5];
const CAMERA_FOV = 24;

export function Scene({
  office,
  instructionHistory,
  sendInstruction,
}: {
  office: OfficeState;
  instructionHistory: InstructionEntry[];
  sendInstruction: (kind: "instruction" | "stop", message: string) => Promise<void>;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      onCreated={({ camera }) => camera.lookAt(2, 1, -1.5)}
    >
      <color attach="background" args={["#F2EDE4"]} />
      <hemisphereLight args={["#FFF3E0", "#9C8A6A", 0.9]} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={0.9}
        color="#FFE6B8"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <ambientLight intensity={0.35} />
      <Room />
      <Office
        actors={office.actors}
        batchCount={office.batchCount}
        instructionHistory={instructionHistory}
        sendInstruction={sendInstruction}
      />
    </Canvas>
  );
}
```

- [ ] **Step 5: `App.tsx`で`useInstructionLog`を使う**

`viewer/src/App.tsx`を以下のように変更する:

```tsx
import { Scene } from "./scene/Scene";
import { Overlay } from "./ui/Overlay";
import { useOfficeState } from "./state/officeState";
import { useInstructionLog } from "./lib/instructionLog";
import "./ui/panels.css";

export function App() {
  const office = useOfficeState();
  const { history: instructionHistory, send: sendInstruction } = useInstructionLog();

  return (
    <div className="app">
      <div className="canvas-layer">
        <Scene office={office} instructionHistory={instructionHistory} sendInstruction={sendInstruction} />
      </div>
      <Overlay office={office} />
    </div>
  );
}
```

- [ ] **Step 6: 型チェックとビルドを確認する**

Run: `npm --prefix viewer run build`
Expected: エラー無く完了する

- [ ] **Step 7: ブラウザで目視確認する**

```bash
npm --prefix viewer run dev
```

表示されたURLをブラウザで開き、以下を確認する:

- 社長席の上に、モニター風のオブジェクト(暗色のパネル)が表示される
- パネル上にテキスト入力欄・「送信」ボタン・赤い「一時停止」ボタンが表示される
- 入力欄にテキストを入れて「送信」を押すと、2秒程度以内に送信履歴に反映される
- `logs/instructions.jsonl`が新規作成され、送信した内容の行(`kind: "instruction"`)が追記されている
- 「一時停止」ボタンを押すと、`kind: "stop"`の行が追記され、履歴表示が他と区別できる色
  (赤系)で表示される
- 画面の見た目(パネルのサイズ・位置)が机や名札と重なりすぎていないか確認し、
  もしバランスが悪ければ`PresidentMonitor.tsx`の`position`/`scale`やbox寸法を調整する
  (既存の吹き出し・名札と同じく、実装時にブラウザで見た目を確認しながら微調整してよい)

確認後、テスト用に増えた`logs/instructions.jsonl`の中身は次のタスクの確認にも使うため、
そのままでよい(git管理対象外)。

- [ ] **Step 8: コミット**

```bash
git add viewer/src/scene/PresidentMonitor.tsx viewer/src/ui/panels.css \
  viewer/src/scene/Office.tsx viewer/src/scene/Scene.tsx viewer/src/App.tsx
git commit -m "社長モニターの3D UIを追加"
```

---

## Task 4: ドキュメント更新と通し確認

**Files:**
- Modify: `viewer/README.md`
- Modify: `.claude/skills/office-view/SKILL.md`

**Interfaces:**
- Consumes: Task 1〜3で完成した機能一式
- Produces: なし(ドキュメントのみ)。このタスクの完了をもって機能実装は完了

- [ ] **Step 1: `viewer/README.md`の「画面構成」に社長モニターの説明を追記する**

`viewer/README.md`の「画面構成」セクション(3Dシーンの説明の直後)に1段落追記する:

```markdown
  社長席の上には、社長から今動いているClaude Codeセッションへ指示・一時停止依頼を
  送るための「社長モニター」(`PresidentMonitor.tsx`)がある。テキスト入力欄・送信履歴・
  一時停止ボタンを持ち、送信内容は`logs/instructions.jsonl`(git管理対象外)に追記される。
  Claude Code側は`Monitor`ツールで同ファイルを`tail -f`することで内容を受け取る
  (詳細は`.claude/skills/office-view/SKILL.md`参照)。一時停止は実行中の処理を強制的に
  中断するものではなく、次の区切りで気づいて手を止める「ソフトストップ」。
```

「構成」セクションのファイルツリーにも1行追加する:

```
      Office.tsx               机のレイアウトと名札
      PresidentMonitor.tsx      社長モニター(指示入力・一時停止ボタン、logs/instructions.jsonlへ送信)
```

- [ ] **Step 2: `.claude/skills/office-view/SKILL.md`に社長モニターの案内を追記する**

「いま行うこと」セクションの末尾(手順3の後)に手順を追加する:

```markdown
4. 社長モニター(3Dビュー上、社長席の上のパネル)から指示や一時停止依頼が送られてくる
   ことがある。今のセッションでも受け取りたい場合は、`Monitor`ツールで以下を起動する
   (`persistent: true`で、このセッションが続く間ずっと監視する):

   ```bash
   tail -f logs/instructions.jsonl
   ```

   新しい行が通知として届いたら内容を読み、`kind: "stop"`なら現在の作業を次の区切りで
   一旦止めて内容を確認する。`kind: "instruction"`なら内容を踏まえて対応する
   (強制的な即時中断ではなく、次の区切りで気づいて止まる「ソフトストップ」)
```

- [ ] **Step 3: 通しの動作確認**

```bash
npm --prefix viewer run build
npm --prefix viewer test
```

Expected: どちらもエラー無く成功する

続けてブラウザ確認(Task 3 Step 7と同じ手順が通ることを再確認)と、Claude Code側の
受信確認を行う。この計画を実行しているエージェント自身が、`Monitor`ツールで
`tail -f logs/instructions.jsonl`(`persistent: false`, 短めの`timeout_ms`でよい)を
起動した状態でブラウザから1件送信し、通知が届くことを確認する。

- [ ] **Step 4: コミット**

```bash
git add viewer/README.md .claude/skills/office-view/SKILL.md
git commit -m "社長モニター機能をドキュメントに反映"
```
