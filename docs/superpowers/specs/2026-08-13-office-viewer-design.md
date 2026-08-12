# 3Dオフィス表示層(viewer/) 設計メモ

作成日: 2026-08-13
関連: `.claude/skills/office-view/SKILL.md`, `logs/SCHEMA.md`, `AGENTS.md`, `CLAUDE.scaffold.md`

## 目的

AI社員(pm / researcher / director / producer / inspector / publisher)の作業状況を、
`logs/events.jsonl` を読み取って3Dオフィスとして可視化する。社長(ユーザー)が
「今どうなってる?」を見た目で直感的に把握できるようにする。

## 利用シーン(確定事項)

- **ローカルPC専用。** ホスティングはしない。`npm --prefix viewer run dev` で開発サーバーを起動し、
  ブラウザで `http://localhost:5173` 相当を開いて見る。
- 表示層はエージェントの実装を一切知らず、`logs/events.jsonl` だけを見る(SCHEMA.md の前提通り)。

## 技術選定

- **Three.js + Vite**(素のJS、Reactは使わない)。`viewer/` にルートとは別の独立した
  npm プロジェクトを作る(`viewer/package.json`)。依存はルートに混ぜない。
- 依存パッケージ: `three`, `vite` の2つのみ。
- カメラ操作は `three/examples/jsm/controls/OrbitControls.js`(three本体に同梱、追加依存なし)を使い、
  マウスドラッグで視点を軽く回せるようにする。基本は固定の見下ろし視点(あつまれどうぶつの森風)。

## データ取得方式

- **ポーリング方式。** true な `fs.watch`/WebSocketは今回はやらない(YAGNI)。
  ブラウザ側から2秒間隔で `logs/events.jsonl` を `fetch` し、行数が増えていたら差分だけ処理する。
- Vite の `server.fs.allow` にリポジトリルートを追加し、`viewer/` の外にある `logs/events.jsonl` を
  開発サーバー経由で配信できるようにする。
- ログの欠損・不正行があっても表示層は落ちない(SCHEMA.mdの前提通り、1行パース失敗はスキップ)。

## ビジュアルスタイル

- あつまれどうぶつの森/ドラクエ風。木目の床、パステルカラーの壁、暖色の照明。
- キャラクターは**低ポリのチビキャラを Three.js のプリミティブ(Box/Sphere)だけでコードから組み立てる**。
  外部3Dモデルファイルは使わない(ライセンス管理不要・依存ゼロ)。
- actorごとの固定カラー:
  - pm: ゴールド
  - researcher: 水色
  - director: オレンジ
  - producer: グリーン
  - inspector: パープル
  - publisher: ピンク

## オフィスレイアウト

- 6卓を半円状に配置。手前から researcher → director → producer → inspector → publisher の順
  (パイプラインの流れが左から右、または奥に向かって進むように並べる)。pm は最奥中央で全体を見渡す配置。
- 各机の上に名前入りの小さな看板(canvasテクスチャの平面)を立てる。

## イベント→演出マッピング(`logs/SCHEMA.md` の「3Dでの表現」列に準拠)

| event | 演出 |
|---|---|
| `start` | 着席してアクティブ状態(明るい色)になる |
| `progress` | 頭上に吹き出し(`message` をcanvasテクスチャで表示) |
| `output` | 机の上に紙(平面)がポップアップ、`target` のファイル名を表示 |
| `handoff` | 対象の社員間に矢印/紙が飛ぶアニメーション |
| `blocked` | 「!」アイコン表示+待機ポーズ、少しくすんだ色になる |
| `reject` | 赤いフラッシュ演出 |
| `done` | 席を立って退勤(フェードアウト) |

まだ一度もイベントが無い社員は空席・グレーアウト表示。

## 動作確認方法

専用のモックは作らない。既存の `scripts/emit-event.mjs` を使って疑似イベントを
`logs/events.jsonl` に追記し、表示に反映されることを確認する。

```bash
node scripts/emit-event.mjs --actor researcher --event start --phase research --message "ソース収集を開始"
```

## スコープ外(今回はやらない)

- ネット上へのデプロイ(GitHub Pages等)
- 本格的な `fs.watch`/WebSocketによるリアルタイム更新(ポーリングで十分)
- 歩行のパスファインディング・当たり判定
- サウンド
- 外部3Dモデル/アセットの利用

## 追記(2026-08-13深夜・方針転換): React Three Fiber + 和室アートディレクションへ

社長から、より具体的なアートディレクション指示があり、実装方針を以下のように変更した。
**このリポジトリ本体(`src/`, `.claude/`, `scripts/`)には一切手を入れず、`viewer/` 配下のみを作り直した。**

- 技術構成を素のThree.jsから **Vite + React + TypeScript + @react-three/fiber + @react-three/drei** に変更
- ビジュアルコンセプトを「あつまれどうぶつの森風」の汎用チビキャラから、**「和室オフィスのジオラマ」** に変更
  - 畳/生成り色の床(`#E8E0D3`)、木製デスク(`#B08D5E`)、壁(`#F2EDE4`)
  - 低彩度の暖色ニュートラル。金属光沢・強い反射は使わず、マット質感(roughness高め・metalness 0)で統一
  - アイソメトリック調のローポリ、俯瞰45度前後の**固定カメラ**(ユーザーが回せるOrbitControlsは廃止)、パースは弱め(FOVを絞って疑似アイソに寄せる)
- 3Dの上にHTMLオーバーレイでUIパネルを重ねる構成に変更(4種: タイトル/社員ステータス/アクティビティログ/凡例)
- **このステップ(第一弾)は見た目だけ。** ログ読み込み・イベント演出アニメーションは実装していない
  (社員は全員デスクに座った静止ポーズ)。旧実装にあった `logs/events.jsonl` ポーリングやイベント演出は
  一旦削除し、次のステップで新構成に作り直す

### 判断に迷った点(要レビュー)

指示文の一部(HTMLオーバーレイ「4種」の具体的な内訳を説明する行)が文字化け・途中切れしており、
何を表示すべきか正確には読み取れなかった。社長が就寝中で確認が取れなかったため、
以下の4種を妥当な内容として仮決めして実装した。**意図と違っていたら差し替える。**

1. タイトル/ヘッダー(左上)
2. 社員ステータス一覧(右上、現状はプレースホルダー)
3. アクティビティログ欄(左下、現状は枠のみ)
4. 凡例・操作説明(右下)

## 今後の課題(進捗.mdにも転記)

- 実際の `pm/researcher/director/producer/inspector/publisher` イベントはまだ1件も
  `logs/events.jsonl` に記録されていない(現状は全て `actor: "system"` のフックログ)。
  実運用でエージェントが `scripts/emit-event.mjs` を呼ぶようになるまでは、
  表示確認は手動投入したイベントに頼ることになる。
