# 幕1〜5の完全自動化(Gemini API単独経路)設計

作成日: 2026-08-14

## 背景

`docs/superpowers/specs/2026-08-13-issue-auto-trigger-decision.md` で「幕1〜4のIssue自動起動化は今は見送る」と決定していたが、
イベント記録の実績確認(進捗.md参照)や社長モニター機能の完成など前提条件が揃ってきたことを受け、社長から「投稿時間を決めて発火させ、投稿完了まで自動化したい」という指示があった。
あわせて、これまで唯一の人間関与ポイントだった「第2幕(構成案)の社長承認」も撤廃し、社長の関与は「手動で別途投稿させたいときに指示する」場合のみに絞る。

ヒアリングの結果、以下が判明しゴールの形が変わった。

- 現行の researcher/director/producer/inspector/publisher(`.claude/agents/*.md`)は **Claude Code 特有の仕組み**であり、これを GitHub Actions のような無人環境で動かすには Anthropic API(従量課金)が必要になる
- 社長は Anthropic API の追加課金を避け、既存の `GEMINI_API_KEY` のみで自動経路を完結させたい
- 3D オフィスビュー(`viewer/`)はローカルの `logs/events.jsonl` をリアルタイムに読む仕組みのため、GitHub Actions 上の実行はそもそもリアルタイム表示できない。社長はこれを許容し、「手動指示のときだけ3Dビューで見られればよい」という整理で合意した

これを踏まえ、**手動経路(Claude Codeエージェント)と自動経路(Gemini API直叫び)を完全に別実装として並存させる**方針とする。

## スコープ

含む:
- GitHub Actions による時刻トリガー(Issue駆動ではない)の新設
- 自動経路用スクリプト(一次ソース収集・構成案作成・文言清書・自己検収の4段階、Gemini API直叫び)
- 自動経路から実際のInstagram投稿までの接続(既存 `publish.yml` を再利用)
- 手動経路(`director.md`/`pm.md`/`AGENTS.md`)から「第2幕の構成承認」待ちを撤廃
- 無人実行が詰まった場合のエスカレーション(GitHub Issueコメント + Chatwork通知)

含まない:
- Claude Code を GitHub Actions 上で無人実行する仕組み(コスト面の理由で不採用)
- 3D オフィスビューへの自動経路のリアルタイム反映(将来的な検討事項として申し送りのみ)
- `src/generate.js` / `daily-post.yml` 以外の既存スクリプト(`detect-pending.mjs`・`publish-instagram.mjs`・`render.js`・`slides-to-post.mjs`)の変更

## 全体アーキテクチャ

```
【手動経路】社長がチャットでpmに指示
  → Claude Code の researcher/director/producer/inspector/publisher が動く
  → 3Dビューでリアルタイムに見える(今まで通り)
  → 第2幕の構成承認待ちは廃止。inspectorの検収のみが品質ゲート

【自動経路】GitHub Actions が平日 JST 12:30 に起動
  → Gemini API を直接呼ぶ新しいスクリプトが同じ5段階を再現する
  → 3Dビューにはリアルタイム反映されない(events.jsonlはコミットされないため事後確認もしない。将来検討)
  → Anthropic API(Claude)は一切使わない
```

両経路は実装を共有しないが、判定基準の食い違いを防ぐため以下は共通で参照する。

- `rubric/carousel.md`(検収基準)
- `templates/carousel/tokens.json`(文字数上限などのデザイン制約)
- `topics.yml`(曜日別テーマ・週替わりローテーション)
- `config/brand.*.json`(ブランド設定)
- `src/lib/icons.js`(アイコンのホワイトリスト)

## 自動経路の詳細フロー

トリガー: `.github/workflows/auto-company-post.yml`(新設)、`cron: '30 3 * * 1-5'`(UTC。JST 12:30 月〜金)+ `workflow_dispatch`(`dry_run`入力、既定 `true`)。

```
①GitHub Issue自動作成
   タイトル例: "自動投稿 2026-08-14 AIに選ばれるHP"
   本文にカテゴリ・テーマ・実行run URLを記載。以降の経過はこのIssueへコメントしていく

②一次ソース収集(researcher相当)
   Gemini APIの検索グラウンディング機能で、その日のテーマに関する情報を検索させる。
   応答に含まれる grounding の引用元から、3件以上の異なるURL(日付・タイトル付き)を抽出する。
   3件に満たない場合 → ①のIssueに「一次ソース不足のため見送り」とコメントし、
   **Issueはクローズせず開いたまま**Chatwork通知して終了する(その日は投稿しない。
   3回リトライなどはしない。開いたままにするのは、社長が後で見返して手動投稿するか
   判断できるようにするため)

③構成案作成(director相当)
   ②のソースをもとに、director.mdと同じ型(フック→前提共有→本文→まとめ)で
   8〜10枚のスライド構成をGeminiに作らせる。各スライドに根拠ソース(②のURL)を紐付ける

④文言清書(producer相当)
   ③の構成案をもとに、producer.mdが出力する slides.json と同じスキーマ
  (caption / hashtags / slides[])で文言をGeminiに書かせる。
   プロンプトの文字数制約・アイコン制約は tokens.json / icons.js を読み込んで動的に埋め込む
  (src/generate.js の buildPrompt() と同じ考え方)

⑤自己検収(inspector相当。2段階)
   (a) 機械チェック(コードで判定。Geminiに数えさせない):
       - スライド枚数が8〜10枚か
       - 各テキストが tokens.json の文字数上限以内か
       - iconが src/lib/icons.js のホワイトリスト内か
       - hashtagsが3個以内か
   (b) Gemini判定: rubric/carousel.md の残りの定性項目(情報鮮度・トーン・スライドとソースの
       紐付けなど)をGeminiに判定させ、不合格なら理由を返させる
   (a)(b)いずれかで不合格 → ④へ差し戻し、不合格理由をプロンプトに含めて再生成。
   最大3回(既存inspector.mdの「3回目の不合格」ルールと同じ回数)。
   3回とも不合格 → ①のIssueにコメントし、**Issueはクローズせず開いたまま**
   Chatwork通知して終了する(その日は投稿しない)

⑥画像化・コミット(publisher相当)
   合格したら Playwright(src/render.js、既存の scripts/slides-to-post.mjs 経由)で画像化し、
   `posts/YYYY-MM-DD-<slug>/`(slides.json・slide-*.png・inspection.md相当の自己検収結果)を
   揃えて main へ直接コミット・push する

⑦Instagram投稿(既存 publish.yml が担当。変更なし)
   push をきっかけに既存の publish.yml が起動し、detect-pending.mjs → publish-instagram.mjs の
   流れでInstagramへ投稿する。リトライ・Chatwork通知・published.json記録はすべて既存のまま

⑧結果をIssueに記録してクローズ
   投稿成功後、①のIssueに完了コメントを付けてクローズする
```

## 手動経路(Claude Codeエージェント)側の変更

- `.claude/agents/director.md`: 「これは waiting の幕です。PM に構成案を渡して停止する。社長の承認なしに第3幕へ進んではならない」を削除し、構成案作成後は自動的にproducerへ引き継ぐ記述に変更する。「記録」セクションの `blocked`(承認待ち)の例も削除する
- `.claude/agents/pm.md`: 「4. waiting の幕に到達したら必ず止まり、社長に承認を求める」を削除する。「承認を求めるときの書き方」セクションも不要になるため削除する
- `AGENTS.md`:
  - 2条(停止のルール)の「SNS投稿は対象外」の理由説明を「第4幕inspectorの検収のみが品質ゲート」という表現に更新する
  - 6条の「第2幕(構成案)で社長の承認を得ており」という理由説明も同様に更新する
- inspectorの「3回不合格でPMにエスカレーション」ルールは手動経路・自動経路共通の安全弁として維持し、変更しない

## 既存ファイルへの影響

| ファイル | 変更内容 |
|---|---|
| `.github/workflows/daily-post.yml` | 削除(新ワークフローに役目を引き継ぐため) |
| `.github/workflows/publish.yml` | 変更なし |
| `scripts/detect-pending.mjs` | 変更なし |
| `scripts/publish-instagram.mjs` | 変更なし |
| `src/render.js` | 変更なし |
| `scripts/slides-to-post.mjs` | 変更なし |
| `src/generate.js`(`npm run generate --mock`) | 変更なし。CLAUDE.mdに書かれたテスト手順として引き続き利用する |

## 新規シークレット・権限・依存パッケージ

- 新規シークレットは追加しない。既存の `GEMINI_API_KEY`・`CHATWORK_API_TOKEN`・`CHATWORK_ROOM_ID` をそのまま使う
- 新設ワークフローに `issues: write` 権限を追加する(Issue自動作成・コメントのため)
- 新規npmパッケージは追加しない。Gemini検索グラウンディングは既存の `generateContent` APIへのオプション追加で呼び出せ、`fetch`はNode標準機能で足りる

## エラー処理

| 状況 | 挙動 |
|---|---|
| 一次ソースが3件集まらない | Issueコメント(Issueは開いたまま) + Chatwork通知して終了。その日は投稿しない |
| 自己検収が3回とも不合格 | Issueコメント(Issueは開いたまま) + Chatwork通知して終了。その日は投稿しない |
| Gemini APIが一時的に失敗(429/5xx) | `src/generate.js` の `callGemini()` と同様、指数バックオフでリトライする |
| 画像化(Playwright)が失敗 | ワークフローを失敗扱いにし、Issueコメント(開いたまま) + Chatwork通知。`posts/`へは何もコミットしない |
| mainへのpush自体が失敗 | ワークフローを失敗扱いにし、Issueコメント(開いたまま) + Chatwork通知。手動での再実行(`workflow_dispatch`)を促す |
| publish.yml側の投稿失敗 | 既存の設計(2026-08-12設計書参照)通り。`published.json`が作られないため次回検出時に再試行可能 |

いずれの失敗も、投稿を無理に成立させず「その日は投稿しない」を選ぶ。既存のpublisher.md/inspector.mdの思想(通すことより落とすことが仕事)を自動経路にも引き継ぐ。

## テスト方法

- 新スクリプトは `--mock` 相当のドライラン引数を用意し、Gemini APIを呼ばずに固定データで「ソース不足→見送り」「3回不合格→エスカレーション」などの分岐をローカルで確認できるようにする
- 新設ワークフローは `workflow_dispatch` の `dry_run: true`(既定値)で、実際の投稿・実際のIssueクローズをせずに一連の流れを確認できるようにする
- 実際の自動投稿を伴うテスト(`dry_run: false`)は、CLAUDE.mdの禁止事項4番の通り、必ず事前に社長へ確認してから実行する

## 未解決事項(申し送り)

- 自動経路の実行内容を3Dビューで事後確認できるようにするかどうかは今回のスコープ外。必要になれば、ワークフロー終了時に `logs/events.jsonl` へ追記してコミットする方式などを別途検討する
- 一次ソース収集(Gemini検索グラウンディング)の精度が researcher.md が期待する「鮮度・信頼性」の基準をどこまで満たせるかは、実運用で数回試してから調整が必要になる可能性がある
