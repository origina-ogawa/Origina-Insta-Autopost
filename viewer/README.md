# AI社員オフィス(3D表示層)

`logs/events.jsonl` を読み取って、AI社員(pm / researcher / director / producer /
inspector / publisher)の作業状況を和室オフィスのジオラマとして可視化するローカル専用ビューア。

## 技術構成

- Vite + React + TypeScript
- 3D描画: [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) + [@react-three/drei](https://github.com/pmndrs/drei)
- 3Dシーンの上にHTMLオーバーレイでUIパネルを重ねる構成
- データ取得: `logs/events.jsonl` を2秒間隔でポーリング(devサーバーの `/api/events` 経由)

## アートディレクション

- アイソメトリック調のローポリ、俯瞰45度前後の固定カメラ(操作不可、パースは弱め)
- 「和室オフィスのジオラマ」。畳/生成り色の床、木製デスク、障子風のアクセント壁
- パレットは低彩度の暖色ニュートラル(床 `#E8E0D3` / 木 `#B08D5E` / 壁 `#F2EDE4`、詳細は `src/theme.ts`)
- 金属光沢や強い反射は使わず、マット質感(roughness高め・metalness 0)で統一
- キャラクターは低ポリのチビキャラ(顔・机に置いた手・靴先までの脚を持つ)。外部3Dモデル不使用

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
  + 奥にPM)。名札は机の前面に置き、常にカメラの方を向く(Billboard)
- HTMLオーバーレイ4種(`src/ui/`):
  - `TitlePanel`: タイトル(左上)
  - `StatusPanel`: 社員ステータス一覧(右上、`logs/events.jsonl` の最新イベントを反映)
  - `ActivityPanel`: 直近8件のアクティビティログ(左下)
  - `LegendPanel`: 社員の色分け凡例・操作説明(右下)

## `logs/events.jsonl` の反映内容(`logs/SCHEMA.md` の7イベント)

| event | 演出 |
|---|---|
| `start` | 着席の弾みアニメーション、色がアクティブ(担当色)になる |
| `progress` / `output` / `handoff` | 頭上に吹き出しで `message` を表示(4秒で自動的に消える) |
| `blocked` | 吹き出しが消えた後、頭の脇に「!」バッジが残る |
| `reject` | 一瞬だけ体が赤くフラッシュする + 吹き出しで理由を表示 |
| `done` | 色がアイドル(グレー)に戻り、頭の脇に「✓」バッジが残る |

ページを開いた瞬間に過去の全イベントを一気に反映するため、同一社員の中間状態(例:
`start`→`progress`→`output` のうち `output` 以外)は表示されず、**各社員の最終状態のみ**が
一度に反映される(吹き出しは最終イベントの `message` のみ表示される)。イベントが1件ずつ
リアルタイムで届く実運用では、これらの演出がそれぞれ個別に発火する。

## 構成

```
viewer/
  index.html
  vite.config.ts        /api/events(logs/events.jsonlを配信する開発用ミドルウェア)を含む
  tsconfig.json
  src/
    main.tsx        エントリポイント
    App.tsx           3D Canvas + オーバーレイの土台、useOfficeStateを起動
    theme.ts            配色・actor一覧・机の配置(単一の情報源)
    lib/
      eventLog.ts          logs/events.jsonl のポーリング取得(useEventPolling)
    state/
      officeState.ts        actorごとの最新状態・直近イベント一覧を保持するreducer
    scene/
      Scene.tsx            Canvas・カメラ・ライティング
      Room.tsx              床(畳グリッド)・壁
      Desk.tsx               木製デスク
      Avatar.tsx              ローポリのチビキャラ(顔・腕・手・脚、イベント演出)
      Office.tsx               机のレイアウトと名札
    ui/
      Overlay.tsx              4パネルの配置
      TitlePanel.tsx / StatusPanel.tsx / ActivityPanel.tsx / LegendPanel.tsx
      panels.css
```

## 動作確認したいとき

疑似イベントを流し込むには、ルートの `scripts/emit-event.mjs` を使う(本番と同じスクリプト)。

```bash
node ../scripts/emit-event.mjs --actor researcher --event start --phase research --message "テスト"
```

1本の投稿が第1〜5幕を通しで流れるサンプルとして `logs/events.sample.jsonl`(reject 1回込み)も
用意している。試すときは `logs/events.jsonl` を一時的に差し替える(確認後は元に戻すこと)。

## 今できていないこと(既知の制限)

- ネット上へのデプロイは未対応(ローカル専用)
- `handoff` イベントで実際に隣の机へ何かが飛ぶような演出はまだ無い(吹き出しのメッセージのみ)
- 実際の `researcher`/`director` 等の本番イベントはまだ本番の `logs/events.jsonl` に記録されていない
  (各エージェントが `scripts/emit-event.mjs` を呼ぶ運用に乗ってから確認できる)
