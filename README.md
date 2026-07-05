# origina-auto-sns

Instagramカルーセル投稿(お役立ち系デザイン)を自動生成し、平日お昼(JST 12:30ごろ)に自動投稿するシステム。

- 文章: Gemini Flash(無料枠)が topics.yml のテーマからスライド原稿をJSONで生成。ハッシュタグは最大3個(2025年末以降のInstagram公式推奨に準拠)
- 画像: HTMLテンプレート + Playwright のスクリーンショットで 1080x1080 PNG を生成(文字崩れなし・無料)。末尾に固定のブランディングスライド(ロゴ)を自動付与
- 投稿: Instagram公式API(Content Publishing)でカルーセル投稿
- 実行: GitHub Actions の cron(平日のみ、お昼休み前後)。**PCの電源を入れておく必要はありません**

設計の詳細は [docs/システム構想.md](docs/システム構想.md)、開発ルールは [CLAUDE.md](CLAUDE.md) を参照。

## フォルダ構成

```
topics.yml              投稿テーマのリスト(日替わりローテーション)
config/brand.*.json     ブランド設定(自社用 own / 代行用 agency: 配色・フッター・トーン)
src/generate.js         テーマ選択 + Gemini で post.json 生成(--mock でAPIなしテスト)
src/render.js           post.json → スライドPNG生成
src/publish.js          Instagram カルーセル投稿 + Chatwork 通知
src/lib/components.js   スライドHTMLの部品(デザインはここで固定)
src/lib/icons.js        AIが選べる Tabler アイコンのホワイトリスト
assets/                 固定ブランドスライド用のロゴ画像
templates/              デザイン検証用のデモ
output/                 生成物(git管理外)
posts/YYYY-MM-DD/       投稿済み画像(公開URL用にコミットされる)
.github/workflows/      自動実行スケジュール
```

## ローカルでのテスト(APIキー不要・無料)

```bash
npm install
npx playwright install chromium
npm run generate -- --mock   # 固定データで output/post.json を作る
npm run render               # output/slide-*.png を生成
open output/slide-1.png
```

Geminiで実際に文章生成する場合は `.env.example` を `.env` にコピーし、
[Google AI Studio](https://aistudio.google.com/apikey)(無料)で取得したキーを `GEMINI_API_KEY` に設定して `npm run generate`。

## 本番セットアップ手順

### 1. Instagram側の準備
1. Instagramアカウントを**プロアカウント**(ビジネス/クリエイター)に切り替える
2. [Meta for Developers](https://developers.facebook.com/) でアプリを作成(タイプ: ビジネス)
3. Instagram APIをセットアップし、`instagram_business_basic` と `instagram_business_content_publish` の権限でアクセストークンを取得
4. **長期トークン(60日有効)**に交換し、IGユーザーIDと一緒に控える

### 2. GitHub側の準備
1. このフォルダを **publicリポジトリ** としてGitHubにpush(画像の公開URLに raw.githubusercontent.com を使うため)
2. リポジトリの Settings → Secrets and variables → Actions で登録:
   - Secrets: `GEMINI_API_KEY` / `IG_USER_ID` / `IG_ACCESS_TOKEN` / (任意) `CHATWORK_API_TOKEN` `CHATWORK_ROOM_ID`
   - Variables(任意): `BRAND`(own/agency) / `GEMINI_MODEL`
3. Actionsタブ → daily-instagram-post → **Run workflow(dry_run: true)** で生成だけ試す
   → Artifactsから画像をダウンロードして確認
4. 問題なければ dry_run: false で手動投稿テスト → 以降は毎平日お昼12:30に自動実行

### 3. アクセストークンの自動更新(初回のみ設定)
Instagramのアクセストークンは60日で失効するが、`refresh-instagram-token`ワークフロー(月2回・1日と15日に自動実行)が失効前に自動延長する。
これがSecretsを書き換えるには、通常のGITHUB_TOKENより強い権限の**個人アクセストークン(PAT)**が1つだけ必要。

1. https://github.com/settings/personal-access-tokens/new を開く(Fine-grained personal access token)
2. Token name: 任意(例: `origina-insta-autopost-secrets`)
3. Expiration: 最大(1年など)
4. Repository access: **Only select repositories** → `Origina-Insta-Autopost` のみを選択
5. Permissions → Repository permissions → **Secrets** を **Read and write** に設定(他の権限は不要)
6. Generate token → 表示された文字列をコピーし、Secretsに `GH_PAT` として登録

このPATは「Secretsの書き換え」しかできないよう絞ってあるので、万一漏れても被害範囲は限定的。ただしPAT自体にも有効期限があるため、期限が来たら同じ手順で作り直してSecretsを更新する。

### 4. 運用
- テーマを増やす: `topics.yml` に追記するだけ(多いほど内容の重複が減る)
- アクセストークンは上記の自動更新で維持されるが、`refresh-instagram-token`ワークフローの実行結果(Actionsタブ)は時々確認する
- 投稿を止めたいとき: Actionsタブでワークフローを Disable する

### 5. 固定ブランドスライドの設定
毎回のカルーセル末尾に「AI & DX支援ならオリジナ」+ロゴの固定スライドを自動で1枚追加する。
- ロゴ画像は `assets/logo-origina.png` に配置する(白背景 or 透過PNG推奨。横長すぎない比率が収まりやすい)
- 表示文言は `config/brand.own.json` の `brandSlide.tagline` で変更できる(`==文字==`で黄色マーカー)
- 代行発信用(`config/brand.agency.json`)はデフォルトで無効(`enabled: false`)。クライアントごとに出したい場合は同様に `enabled: true` + ロゴパスを設定する

## コスト

| 項目 | 費用 |
|---|---|
| Gemini Flash(1日1回) | 無料枠内 = 0円 |
| GitHub Actions / Playwright / Instagram API | 0円 |

## 注意(規約)

- 投稿は必ず公式APIのみ。非公式ツールやブラウザ自動操作は使わない(凍結リスク)
- API投稿の上限は約100件/24時間(カルーセルは1件扱い)。1日1件なら問題なし
- 代行アカウントへの投稿は、相手のOAuth認可 + (正式には)Metaアプリ審査が必要
