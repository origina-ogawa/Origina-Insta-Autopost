---
name: office-view
description: 3Dオフィス表示層を起動して、AI社員の作業状況を可視化する。「オフィスを見せて」「今どうなってる」「進捗を可視化して」と言われたら使う。表示層が未実装の場合はログの要約を返す。
---

# オフィス表示

`logs/events.jsonl` を読み、AI社員の作業状況を可視化します。

## 実装状況

表示層（3Dオフィス）は**フェーズ2の実装対象**です。
現時点では未実装のため、このスキルはログの要約を返します。

## いま行うこと

1. `logs/events.jsonl` の直近50行を読む
2. 社員ごとの最新状態を集計する
3. 以下の形式で表示する

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

## 表示層が実装されたら

`viewer/` ディレクトリのローカルサーバーを起動し、ブラウザで開く。

```bash
npm --prefix viewer run dev
```

表示層は `logs/events.jsonl` を `fs.watch` で監視するだけで、
エージェント側の実装には一切依存しません。
ログのスキーマは `logs/SCHEMA.md` を参照してください。
