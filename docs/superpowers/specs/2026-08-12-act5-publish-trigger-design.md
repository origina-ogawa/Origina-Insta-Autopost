# 第5幕以降(投稿トリガー)の再設計

作成日: 2026-08-12

## 背景

`AGENTS.md` / `CLAUDE.scaffold.md` により、この会社は「researcher → director → producer → inspector → publisher」の5幕構成で動く前提になった。第5幕(publisher)は検収合格後にPRを作るところまでを担当し、**実際のInstagram投稿はPRがmainにマージされたときにGitHub Actionsが行う**設計である。

しかし現行の `.github/workflows/daily-post.yml` は「生成→画像化→mainへ直接コミット→投稿」を1本のジョブで行っており、PRベースの新フローとは別物になっている。この不足分(`scripts/detect-pending.mjs` と新設の `publish.yml`)を実装するための設計。

## スコープ

この設計が扱うのは**第5幕から先(検収合格→PR→マージ→投稿)のみ**。以下は別プロジェクトとして後日扱う。

- 第1・2幕のディレクトリ運用整備(`sources/` の雛形、ブランチ運用の実運用ルール)
- 第2〜3幕のスキーマ統合(`producer.md` の `slides.json` と `render.js` が読む `post.json` の形式差異)

幕1〜4の起動方式(手動 or Issue自動起動)についても、まず手動運用で確立してから判断する方針のため、本設計では扱わない。

## posts/<dir>/ のファイル契約

inspectorが検収合格時に `work/<slug>/` から `posts/YYYY-MM-DD-<slug>/` へ以下を揃えて移動する前提とする。

```
posts/2026-08-13-ai-agent-basics/
  slides.json      # producer.mdの出力(caption, hashtags, slides[])をそのまま使う
  slide-1.png ... slide-N.png
  inspection.md    # 「検収結果: 合格」を含む
  published.json   # ← publish.ymlが投稿成功後に追加する。このファイルの有無が「投稿済みか」の判定基準
```

`slides.json` の `caption` / `hashtags` フィールドは既に `producer.md` の仕様に含まれているため、スキーマ統合(別プロジェクト)を待たずに読める。

既存の `posts/YYYY-MM-DD/`(スラグなし・旧 `daily-post.yml` で投稿済み)は形式が異なるため、フォルダ名のパターンで区別して対象外にする(下記参照)。

## scripts/detect-pending.mjs

- `posts/` 配下を走査し、フォルダ名が `^\d{4}-\d{2}-\d{2}-.+$`(日付+ハイフン+スラグ)にマッチするものだけを対象にする。日付のみの旧形式フォルダは無条件で除外する
- 対象の中から `published.json` が無いものを「未投稿」として抽出する
- 追加の安全策として、`inspection.md` に「検収結果: 合格」の文字列が無いフォルダは未投稿候補から除外する(検収前のものが誤ってmainに紛れ込んでも投稿されないようにするため)
- 判定結果:
  - **0件**: 「未投稿なし」を出力して正常終了。以降のステップは何もしない
  - **1件**: そのフォルダパスを `GITHUB_OUTPUT` に書き出す
  - **2件以上**: エラーで異常終了する。該当フォルダ一覧をログに出し、自動投稿はしない。人間が `workflow_dispatch` の `dir` 入力で対象を1つ指定して再実行する
- `--dir <path>` 引数を受け付け、指定時はスキャンをスキップしてそのフォルダを対象にする(手動再実行・複数件エラー時の解消に使う)

## scripts/publish-instagram.mjs(`src/publish.js` を移設・改修)

現行 `src/publish.js` のGraph API処理(子コンテナ作成→親コンテナ作成→publish の2段階、ステータスポーリング、リトライ、Chatwork通知)はそのまま流用する。変更点のみ以下。

- 読み込み元を `output/post.json` から `posts/<dir>/slides.json` に変更(`caption` / `hashtags` フィールドはそのまま使える)
- 画像は `posts/<dir>/slide-*.png` を対象にする
- `IMAGE_BASE_URL` はワークフロー側で組み立てて環境変数で渡す: `https://raw.githubusercontent.com/<repo>/<マージ後のSHA>/posts/<dir>`
- 投稿成功後、`posts/<dir>/published.json`(`{ "postedAt": ISO8601, "mediaId": string }`)を書き出す
- 失敗時は例外を投げて終了(現行通り)。この場合 `published.json` は作られないため、次回実行時も「未投稿」として検出され、再試行できる

## .github/workflows/publish.yml(新設)

- トリガー: `push`(`main`ブランチ、`paths: posts/**`)+ `workflow_dispatch`(`dir` 入力: 対象フォルダの手動指定、`dry_run` 入力: 既定 `true`)
- `concurrency`: `daily-post` とは別グループ(例 `publish-instagram`、`cancel-in-progress: false`)にし、既存ワークフローと干渉しないようにする
- ステップ:
  1. checkout
  2. `detect-pending.mjs` 実行(`workflow_dispatch` で `dir` 指定があればそれを使う)→ 対象フォルダ決定。0件なら以降をスキップして正常終了
  3. `dry_run: true` の場合はここで終了(対象フォルダの特定確認のみ、Graph APIは呼ばない)
  4. `publish-instagram.mjs` 実行(Secrets: `IG_USER_ID`, `IG_ACCESS_TOKEN`, `CHATWORK_API_TOKEN`, `CHATWORK_ROOM_ID`。`IMAGE_BASE_URL` は上記のSHAベースで組み立てる)
  5. 投稿成功後、`published.json` を `github-actions[bot]` としてmainへコミット&push

## エラー処理

- Graph API投稿が失敗 → 例外で終了、`published.json` は作られない → 次回同じフォルダが「未投稿」として再検出され、再実行で自然にリトライできる
- 投稿は成功したが `published.json` のcommit&pushが失敗した場合(まれ) → 数回リトライする。それでも失敗したら**ワークフローを失敗扱いにして**Chatworkへ「投稿は成功したが記録に失敗。手動で `published.json` を追加してください」と通知する。ここで自動再試行させると二重投稿になるため、あえて失敗のままにして人が止める設計にする

## AGENTS.md の例外事項

AGENTS.mdは「mainへの直接コミット禁止」を定めているが、`publish.yml` が投稿成功の事実を記録するために行う `published.json` のみのコミット(`github-actions[bot]` による機械的な記録)は、この禁止事項の例外として扱う。人間やAIエージェントが制作物を勢いでmainに入れることを防ぐのが本来の趣旨であり、投稿完了の記録はそれとは別種の操作であるため。

## daily-post.yml との共存

- 現行のまま変更しない(ユーザーの判断)。生成→画像化→mainへ直接コミット→投稿を1本で行う経路として残す
- `workflow_dispatch` 手動実行(`dry_run` 既定 `true`)であり、`publish.yml` とは別ジョブ・別concurrencyグループのため、通常運用で誤って同時に投稿が走ることはない
- ワークフローのコメントに「新フロー(publish.yml)稼働後は、テスト目的以外で `dry_run: false` 実行しないこと」という一言を追記する(コード変更ではなくコメントのみ)

## テスト方法

- `detect-pending.mjs`: `posts/` 配下にダミーフォルダ(`published.json`あり/なし、`inspection.md`合格/不合格などのパターン)を作り、`node scripts/detect-pending.mjs` をローカル実行して判定を確認する。Instagram APIを呼ばないため自由に試せる
- `publish.yml` 全体: `workflow_dispatch` の `dry_run: true` で対象フォルダの検出だけ確認できる
- 実際のInstagram投稿を伴うテスト(`dry_run: false`)は、CLAUDE.mdの禁止事項4番の通り、必ず事前にユーザーへ確認してから実行する

## 未解決事項(申し送り)

- 第1・2幕のディレクトリ運用整備、第2〜3幕のスキーマ統合は別プロジェクトとして後日ブレインストーミングする
- 幕1〜4のIssue自動起動化も、手動運用での実績確認後に別途検討する
