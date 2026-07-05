# origina-auto-sns プロジェクトルール

Instagramカルーセル投稿を自動生成・自動投稿するシステム。
方式: HTMLテンプレート + Gemini Flash(文章生成) + Playwright(画像化) + Instagram公式API + GitHub Actions(平日毎朝実行)。
全体像は docs/システム構想.md を参照。

## 基本方針

- 必ず日本語で応対する。ユーザーは開発初心者なので、専門用語はかみ砕いて説明する
- 変更前に docs/システム構想.md と README.md で現状の設計を確認する

## 禁止事項(必ず守る)

1. **このフォルダ(/Users/ogawadaisuke/APPS/origina-auto-sns)の外のファイルを作成・変更・削除しない。** 読み取りも原則このフォルダ内のみ
2. **APIキー・アクセストークンをコードやコミット対象ファイルに直接書かない。** 機密情報は `.env`(ローカル)と GitHub Secrets(Actions)のみ。ドキュメントに書く必要がある場合は `.gitignore` 済みのファイルにのみ書く
3. **Instagramへの投稿は公式API(graph.facebook.com / Instagram API)のみ使用する。** 非公式ライブラリ(instagrapi等)やブラウザ自動操作による投稿・いいね・フォロー操作は絶対に実装しない(アカウント凍結リスク)
4. **ユーザーの明示的な指示なしに本番のInstagramアカウントへ投稿しない。** テスト時は必ずユーザーに確認してから実行する
5. **git push・GitHub上の設定変更(Secrets登録等)はユーザーの確認を取ってから行う**
6. 依存パッケージは最小限にする。新しいパッケージを追加するときは理由を説明する

## 技術的な約束事

- 実行環境: Node.js 20以上、ESM(`"type": "module"`)
- スライド画像は 1080x1080px、`output/` に生成する(`output/` はgit管理外)
- 投稿済み画像は `posts/YYYY-MM-DD/` にコミットし、raw.githubusercontent.com のURLをInstagram APIに渡す(このリポジトリはpublic前提)
- アイコンは Tabler Icons のみ。使用可能なアイコン名は src/lib/icons.js のホワイトリストで管理し、AIが不正な名前を出したらフォールバックする
- AIが生成した文章はHTMLエスケープしてからテンプレートに埋め込む(`**強調**`→赤字、`==マーカー==`→黄色マーカーのみ許可)
- コミットメッセージは1行の日本語でシンプルに

## テスト方法

- `npm run generate -- --mock` : Gemini APIを呼ばずに固定データで post.json を作る
- `npm run render` : output/post.json からスライドPNGを生成する(APIキー不要・無料)
- 本番投稿のテストは GitHub Actions の workflow_dispatch(手動実行)で行う
