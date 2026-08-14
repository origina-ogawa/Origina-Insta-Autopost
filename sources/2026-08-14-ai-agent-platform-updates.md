# AIエージェント最前線: 直近2週間のプラットフォームアップデート(Anthropic/OpenAI/Google)

## ソース1
- URL: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md (v2.1.232、npmレジストリで公開日時を確認: https://www.npmjs.com/package/@anthropic-ai/claude-code)
- 公開日: 2026-08-13(npm registryのpublish timestampで確認: 2026-08-13T21:30:53Z)
- 発信元: Anthropic(Claude Code公式リポジトリ)
- 要点: サブエージェントの「フォーク」機能がデフォルトで有効になり、フォークされたサブエージェントは親の会話全体とプロンプトキャッシュをそのまま引き継げるようになった。プロンプト内で `@` を入力して別のClaudeセッションをメンションし、`SendMessage` で直接やり取りできるクロスセッション連携機能も追加。GitLabトークン系のシークレット保護やマーケットプレイス連携の強化も同時実施。
- 確度: 確定(公式CHANGELOGへの実装済み変更、npm公開済みバージョン)

## ソース2
- URL: https://learn.chatgpt.com/docs/changelog (Codex CLI Release: 0.147.0の項目。developers.openai.com/codex/changelog からリダイレクト)
- 公開日: 2026-08-07
- 発信元: OpenAI(Codex公式changelog、ChatGPT/Codex開発者ドキュメント)
- 要点: Codex CLI 0.147.0で、エージェント向けの可搬型「Agent Plugins」をインストール・横断検索できる機能を追加。MCP 2026-07-28プロトコル(ページネーション付きディスカバリ、非ブロッキングのサーバー起動)へのオプトイン対応や、Amazon Bedrock向けのキャッシュ付きWeb検索・会話圧縮にも対応した。
- 確度: 確定(公式リリースノート、バージョン番号・インストールコマンド明記)

## ソース3
- URL: https://developers.googleblog.com/agent-and-model-evaluations-in-gemini-enterprise-agent-platform-are-now-ga/
- 公開日: 2026-07-31
- 発信元: Google Developers Blog(プロダクトマネージャー Alex Martin, Dima Melnyk名義)
- 要点: Gemini Enterprise Agent Platformの「エージェント/モデル評価」機能が一般提供(GA)開始。品質・安全性・グラウンディング・ツール使用など20以上の事前構築メトリクスに加え、評価ケースごとに合否テストを自動生成する「適応型ルーブリック」、本番トラフィックを継続監視するオンラインモニタリング機能を提供し、Agent Platform SDK/CLI/コンソール/ADKから利用可能になった。
- 確度: 確定(公式ブログでのGA発表)

## ソース4(補足)
- URL: https://learn.chatgpt.com/docs/changelog (Linux desktop preview and agent importsの項目)
- 公開日: 2026-08-11
- 発信元: OpenAI(ChatGPT公式changelog)
- 要点: ChatGPTデスクトップアプリのLinuxプレビュー版(Ubuntu/Debian/Fedora、x64/ARM64)を公開。Claude CodeやCursorなど他社のエージェントツールからセットアップ内容・直近の作業履歴をインポートし、自動同期できる機能を追加した点が、エージェント間の相互運用性の動きとして注目される。
- 確度: 確定(公式リリースノート)

## 注意点
- MCP(Model Context Protocol)の「2026-07-28スペック」自体の公開・Anthropicによる統合発表(claude.com/blog、blog.modelcontextprotocol.io)は2026年7月28日付であり、今回の採用基準(2026-07-31以降)からは3日ほど外れるため、独立ソースとしては採用していない。ただしソース2(OpenAI Codex CLI 0.147.0)がこの2026-07-28スペックへの対応を明記しており、業界全体でMCP新スペックへの追随が進んでいる文脈として参考情報になる。
- Microsoft(Copilot/Agent 365)についても直近アップデートを調査したが、確認できた一次情報(Microsoft Learn released-notesやTech Community記事)は2026-07-15〜7-29付のものが中心で、採用基準の14日以内(2026-07-31以降)に収まる公式一次ソースを確認できなかったため、今回は見送った。
