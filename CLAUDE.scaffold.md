# origina-autopost

Instagram カルーセル投稿を AI社員が制作し、社長の承認を経て自動投稿するリポジトリ。

## 憲法

@AGENTS.md

上記のルールは絶対。このファイルの記述と矛盾する場合は AGENTS.md を優先する。

## 社員構成

| 社員 | エージェント | 担当 | 幕 |
|---|---|---|---|
| PM | `pm` | 委譲・進行管理・社長への報告 | 全幕 |
| リサーチ | `researcher` | 一次ソースの収集と鮮度確認 | 第1幕 |
| ディレクター | `director` | 構成案（8〜10枚のスライド設計） | 第2幕 |
| 制作 | `producer` | スライド文言と画像の生成 | 第3幕 |
| 目利き | `inspector` | ルーブリックによる検収 | 第4幕 |
| 配信 | `publisher` | PR作成。投稿はActionsが行う | 第5幕 |

## 幕（ワークフロー）

### 第1幕 リサーチ
- 担当: researcher
- 入口: Issue が `todo` ラベルで作成される
- 出口: `sources/YYYY-MM-DD-<slug>.md` に候補ソースが3件以上ある
- **すべてのソースに公開日とURLが必須。14日以内の一次ソースのみ採用**

### 第2幕 構成
- 担当: director
- 出口: `work/<slug>/structure.md` にスライド構成がある
- ⚠️ **この幕の終わりで waiting。社長のテーマ承認を待つ**

### 第3幕 制作
- 担当: producer
- 出口: `work/<slug>/slides.json` と生成画像
- 文字数上限は `templates/carousel/tokens.json` に従う。**フォントサイズは変更禁止**

### 第4幕 検収
- 担当: inspector
- `rubric/carousel.md` の全項目を判定
- 不合格 → 第3幕へ差し戻し
- **同一Issueで3回不合格になったら、PMが社長にエスカレーションする**
- 合格 → `posts/YYYY-MM-DD-<slug>/` へ移動

### 第5幕 配信
- 担当: publisher
- `posts/<日付>-<slug>/` を `main` へ直接コミット・push して終了(2026-08-14よりPR無し。詳細はAGENTS.md 6条・進捗.md参照)
- `main` への push で GitHub Actions (`publish.yml`) が実際にInstagramへ投稿する

## ブランチ運用

- 第1〜4幕の作業(`sources/`・`work/`)はローカルの`main`ブランチ上で行ってよい
- `posts/` への投稿確定コミットも、inspector検収合格後は`main`へ直接pushする(PR不要)
- コード自体の変更(`src/`・`scripts/`・`templates/`等)は引き続きレビューを推奨する

## チケット

GitHub Issue を使う。ラベルでステータスを表す。

`todo` → `doing` → `waiting` → `done`

`waiting` は社長の確認待ちを意味する。社員は `waiting` のチケットに触らない。

## ディレクトリ

```
sources/    収集した一次ソース（コミット）
work/       途中の作業（git管理外）
posts/      検収合格した完成品（コミット）
memory/     判断基準・失敗・気づき・社長の好み
rubric/     検収基準
templates/  スライドテンプレートとデザイントークン
logs/       イベントログ
scripts/    補助スクリプト
```

## 禁止事項

- 非公式APIやスクレイピングによる投稿（規約違反・BANリスク）
- `templates/carousel/tokens.json` のフォントサイズ変更
- ソースURLのない投稿の制作
- `main` への直接push
