---
name: office-view
description: 3Dオフィス表示層(viewer/)を起動して、AI社員の作業状況を可視化する。「オフィスを見せて」「今どうなってる」「進捗を可視化して」と言われたら使う。URL案内とあわせてログの要約もテキストで返す。
---

# オフィス表示

`logs/events.jsonl` を読み、AI社員の作業状況を可視化します。

## 実装状況

表示層(3Dオフィス、`viewer/`)は**実装済み**(2026-08-13、和室ジオラマ調)。
`logs/events.jsonl` を2秒間隔でポーリングし、`start/progress/output/handoff/blocked/reject/done` の
7イベントに応じてキャラクターが反応する(吹き出し・状態バッジ・赤フラッシュ等)。
設計は `docs/superpowers/specs/2026-08-13-office-viewer-design.md` を参照。

## いま行うこと

1. `viewer/` にローカルサーバーを起動する(初回は `npm --prefix viewer install` も必要)

   ```bash
   npm --prefix viewer run dev
   ```

2. 表示されたURL(例: `http://localhost:5173`)をユーザーに伝える
   (Claude Codeからブラウザを直接開けないため、URLの案内のみ行う)
3. あわせて `logs/events.jsonl` の直近50行から社員ごとの最新状態をテキストでも要約する
   (3D表示と併用。ブラウザをすぐ開けない状況でも状況が伝わるように)

```
【第N幕 <phase>】

● researcher   done      ソース3件を確保
● director     blocked   構成案を提出、承認待ち
○ producer     -
○ inspector    -
○ publisher    -

直近の成果物:
- sources/2026-08-12-xxx.md
- work/xxx/structure.md

社長の承認待ち: 1件
```

## 表示層の中身

表示層は `logs/events.jsonl` をポーリングで監視するだけで、
エージェント側の実装には一切依存しません。
ログのスキーマは `logs/SCHEMA.md` を参照してください。
実装の詳細・既知の制限は `viewer/README.md` を参照。
