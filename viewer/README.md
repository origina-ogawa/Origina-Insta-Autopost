# AI社員オフィス(3D表示層)

`logs/events.jsonl` を読み取って、AI社員(pm / researcher / director / producer /
inspector / publisher)の作業状況を和室オフィスのジオラマとして可視化する予定の
ローカル専用ビューア。

**現状(2026-08-13時点)は見た目だけを実装したステップ。** ログの読み込み・イベントに応じた
アニメーションはまだ実装していない。社員は全員デスクに座った静止状態で表示される。

## 技術構成

- Vite + React + TypeScript
- 3D描画: [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [@react-three/drei](https://github.com/pmndrs/drei)
- 3Dシーンの上にHTMLオーバーレイでUIパネルを重ねる構成

## アートディレクション

- アイソメトリック調のローポリ、俯瞰45度前後の固定カメラ(操作不可、パースは弱め)
- 「和室オフィスのジオラマ」。畳/生成り色の床、木製デスク、障子風のアクセント壁
- パレットは低彩度の暖色ニュートラル(床 `#E8E0D3` / 木 `#B08D5E` / 壁 `#F2EDE4`、詳細は `src/theme.ts`)
- 金属光沢や強い反射は使わず、マット質感(roughness高め・metalness 0)で統一

## 使い方

```bash
npm --prefix viewer install   # 初回のみ
npm --prefix viewer run dev
```

表示されたURL(例: `http://localhost:5173`)をブラウザで開く。

```bash
npm --prefix viewer run build   # 型チェック + 本番ビルド
```

## 画面構成

- 3Dシーン: 半円状に並んだ6卓(第1〜5幕 researcher→director→producer→inspector→publisher
  + 奥にPM)。名札は常にカメラの方を向く(Billboard)
- HTMLオーバーレイ4種(`src/ui/`):
  - `TitlePanel`: タイトル(左上)
  - `StatusPanel`: 社員ステータス一覧、現状はプレースホルダー(右上)
  - `ActivityPanel`: アクティビティログ欄、現状は枠のみ(左下)
  - `LegendPanel`: 社員の色分け凡例・操作説明(右下)

## 構成

```
viewer/
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx        エントリポイント
    App.tsx           3D Canvas + オーバーレイの土台
    theme.ts            配色・actor一覧・机の配置(単一の情報源)
    scene/
      Scene.tsx            Canvas・カメラ・ライティング
      Room.tsx              床(畳グリッド)・壁
      Desk.tsx               木製デスク
      Avatar.tsx              ローポリのチビキャラ(プリミティブのみ、静止ポーズ)
      Office.tsx               机のレイアウトと名札
    ui/
      Overlay.tsx              4パネルの配置
      TitlePanel.tsx / StatusPanel.tsx / ActivityPanel.tsx / LegendPanel.tsx
      panels.css
```

## 次のステップ(未着手)

- `logs/events.jsonl` の読み込み(ポーリング or 専用API)
- `logs/SCHEMA.md` の7イベント(`start`/`progress`/`output`/`handoff`/`blocked`/`reject`/`done`)を
  アニメーション・オーバーレイの実データに反映する
- 動作確認用に `logs/events.sample.jsonl`(1本の投稿が第1〜5幕を通る、reject 1回込みのサンプル)を用意済み
