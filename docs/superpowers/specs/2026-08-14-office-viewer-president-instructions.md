# 3Dオフィス表示層(viewer/) 社長からの指示入力機能 設計メモ

作成日: 2026-08-14
関連: `viewer/README.md`、`logs/SCHEMA.md`、`.claude/skills/office-view/SKILL.md`

## 背景・目的

以前のUI改修(`docs/superpowers/specs/2026-08-14-office-viewer-ui-update.md`)で
社長から要望のあった「指示入力欄」は、当時「viewerが`logs/events.jsonl`を読むだけの
一方向の仕組みであるため、実現方式の検討が必要」としてスコープ外にしていた。

今回、実現方式を含めて改めて設計する。想定する利用シーンは、**今まさに動いている
Claude Codeのターミナルセッションに対して、ブラウザの3Dビューからも指示や
一時停止依頼を送れるようにする**こと(社長が3Dビューを見ながら、ターミナルに
戻らずその場でフィードバック・ストップができるようにしたい、という要望)。

将来の無人実行(Issue自動起動、進捗.md残タスク8)への対応や、送信内容の
既読管理は今回のスコープ外。

## 全体アーキテクチャ

```
[3Dビュー(ブラウザ)]
   社長席の上の「モニター」オブジェクト
   ├─ 送信履歴表示
   ├─ テキスト入力欄 + 送信ボタン(kind: instruction)
   └─ 「一時停止」ボタン(赤・即時送信、kind: stop)
          │ POST /api/instructions
          ▼
[Vite dev server ミドルウェア(viewer/vite.config.ts)]
   logs/instructions.jsonl に1行追記(GETで全文も返す)
          │
          ▼
[logs/instructions.jsonl]  ← ローカルのみ・gitignore対象
          │
          ▼ tail -f (Claude CodeのMonitorツール)
[今動いているターミナルセッション]
   新しい行が来ると通知が届く → その場で読んで反応する
```

既存の`/api/events`(`logs/events.jsonl`を読むだけ)と対称的に、`/api/instructions`は
POSTで書き込みも受け付ける点が新規。ローカルのdevサーバー限定の仕組みであり、
認証・APIキーは不要(既存の`/api/events`と同じ扱い)。

**「一時停止」の性質(合意済みの制約)**: ブラウザから送った内容をこのセッションが
検知する仕組みは作れるが、今まさに実行中のツール呼び出し(コード編集・コマンド実行等)
を強制的に即座に中断させることはできない。次の区切り(ツール呼び出しの合間)で
気づいて手を止め、内容を確認してから再開する「ソフトストップ」とする。

## `logs/instructions.jsonl`のスキーマ

`logs/SCHEMA.md`に`events.jsonl`と並記する形で追記する。

```json
{"ts":"2026-08-14T05:00:00.000Z","kind":"instruction","message":"3枚目の見出しをもっと短くして"}
{"ts":"2026-08-14T05:02:00.000Z","kind":"stop","message":"作業を一時停止してください"}
```

| キー | 型 | 説明 |
|---|---|---|
| `ts` | string | ISO8601のタイムスタンプ |
| `kind` | string | `"instruction"`(自由記述の指示) \| `"stop"`(一時停止ボタン。メッセージは固定文言) |
| `message` | string | 本文 |

- `events.jsonl`と違い、AI社員の成果物ログではなく「今のセッションへの一時的な
  操作ログ」であるため、**`.gitignore`に追加してgit管理対象外にする**
  (`output/`や`work/*`と同じ扱い)
- 追記のみ、既存行は書き換えない(`events.jsonl`と同じ運用)
- ファイルが存在しない場合(初回)は空として扱う

## Vite dev serverミドルウェアの拡張(`viewer/vite.config.ts`)

既存の`eventsApiPlugin`と同じ構造で`instructionsApiPlugin`を追加する。

- `GET /api/instructions`: `logs/instructions.jsonl`の生テキストを返す
  (ファイル無しの場合は空文字。既存の`/api/events`と同じエラー処理方針)
- `POST /api/instructions`: リクエストボディ(JSON、`{ kind, message }`)を受け取り、
  サーバー側で`ts`を付与した1行JSONを`logs/instructions.jsonl`に追記する。
  レスポンスは成功可否のみ(本文は返さない)

## viewer側の実装

### `lib/instructionLog.ts`(新規)

`eventLog.ts`と対になる構造にする。

- `useInstructionLog()`: `/api/instructions`を2秒間隔でポーリングし
  (`eventLog.ts`の`fetchPollingSource`と同じ方式)、パースした全件を履歴として返す
- `sendInstruction(kind: "instruction" | "stop", message: string): Promise<void>`:
  `POST /api/instructions`を呼ぶ

### `scene/PresidentMonitor.tsx`(新規)

社長席(`theme.ts`の`PRESIDENT_DESK_POSITION`)の上に配置する、モニター風の3Dオブジェクト。

- 見た目: モニター風(スタンド+画面パネル)。和室の中でもデジタル機器として
  違和感なく見える程度のマット質感に抑える(既存の低彩度・マット質感の
  デザイン言語を踏襲)
- 画面パネルの位置に`@react-three/drei`の`<Html transform occlude={false}>`で
  HTMLパネルを重ね、以下を表示する:
  - 送信履歴(直近数件、時系列。`stop`は視覚的に区別できる色にする)
  - テキスト入力欄(`<textarea>`)+ 送信ボタン(`kind: "instruction"`で送信)
  - 「一時停止」ボタン(赤・独立ボタン。クリックで固定文言
    `"作業を一時停止してください"`を`kind: "stop"`として即時送信)
- カメラは固定(操作不可)のため、`Html transform`の位置・スケールは実装時に
  ブラウザで見た目を確認しながら調整する
- 吹き出し(`SpeechBubble`)は使わない(合意済み)。社長席にアバターは表示しない
  (既存仕様のまま)

### `Office.tsx`への組み込み

既存の社長席(名札「社長」)のレンダリング箇所に`PresidentMonitor`を追加する。

## Claude Code側の運用(`.claude/skills/office-view/SKILL.md`の更新)

3Dビューを起動する案内をする際、「社長モニターからの指示も監視するか」を
併せて確認する一文を追加する。監視する場合:

- `Monitor`ツールで`tail -f logs/instructions.jsonl`を`persistent: true`で起動する
- 新しい行(通知)が届いたら内容を読み、`kind: "stop"`なら現在の作業を
  次の区切りで一旦止めて内容を確認する。`kind: "instruction"`なら
  内容を踏まえて対応する

## 動作確認方法

`npm --prefix viewer run dev`を起動し、ブラウザで以下を確認する。

- 社長席の上にモニター風オブジェクトが表示され、テキスト入力欄・送信ボタン・
  一時停止ボタンが操作できること
- テキストを入力して送信すると、`logs/instructions.jsonl`に
  `kind: "instruction"`の行が追記され、モニターの履歴表示に反映されること
- 「一時停止」ボタンを押すと、`kind: "stop"`の行が追記され、履歴表示に
  視覚的に区別できる形で反映されること
- Claude Code側で`Monitor`ツールにより`tail -f logs/instructions.jsonl`を
  起動した状態で、ブラウザから送信した内容が通知として届くこと

## スコープ外(今回はやらない)

- 指示が「読まれた/対応済み」かをブラウザ側に表示する既読機能
  (同じ人がターミナルとブラウザ両方を見ている前提のため不要と判断)
- 将来の無人実行(Issue自動起動)時の対応(進捗.md残タスク8と同様、別途検討)
- 強制的な即時中断(ソフトストップで合意済み)
- `logs/instructions.jsonl`の内容をAIエージェント(`.claude/agents/*.md`)の
  実装から参照する仕組み(今回はviewerとClaude Codeセッションの運用のみ)
