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

- 3Dシーン: 横3×縦2のグリッドに並んだ6卓(奥列 researcher→director→producer、手前列
  inspector→publisher→pm。第1〜5幕+PMの順で並び、全員カメラの方を向く)+ グリッド奥に
  「社長席」(ユーザーを表す固定の空席。アバターは表示されない)。名札は机の前面に置き、
  常にカメラの方を向く(Billboard)。AI社員6人にはそれぞれひらがなの個人名
  (例: researcherは「あかり」)があり、名札には「名前(大きめ)+役職(小さめ)」の2行が
  表示される(社長席の名札のみ「社長」の1行)
- 社長席の上には、社長から今動いているClaude Codeセッションへ指示・一時停止依頼を
  送るための「社長モニター」(`PresidentMonitor.tsx`)がある。テキスト入力欄・送信履歴・
  一時停止ボタンを持ち、送信内容は`logs/instructions.jsonl`(git管理対象外)に追記される。
  Claude Code側は`Monitor`ツールで同ファイルを`tail -f`することで内容を受け取る
  (詳細は`.claude/skills/office-view/SKILL.md`参照)。一時停止は実行中の処理を強制的に
  中断するものではなく、次の区切りで気づいて手を止める「ソフトストップ」。
- HTMLオーバーレイ(`src/ui/`):
  - `TitlePanel`: タイトル(左上)
  - 画面右端の縦長サイドパネル(`.sidebar`)に以下2つを縦に並べる
    - `StatusPanel`: 社員ステータス一覧(`logs/events.jsonl` の最新イベントを反映)
    - `ActivityPanel`: 直近8件のアクティビティログ(残りの縦幅いっぱいにスクロール表示、
      折り返し表示で文字は省略されない)

## `logs/events.jsonl` の反映内容(`logs/SCHEMA.md` の7イベント)

動きはすべて控えめ(ease-in-out、0.5〜0.7秒。出社/退社の歩行のみ約1.2秒)。過剰な演出は入れていない。

頭上の吹き出し(`SpeechBubble`)は単なる長方形ではなく、角丸+下向きの「しっぽ」を持つ
コミック風の形状(`src/scene/SpeechBubble.tsx` で `THREE.Shape` から組み立てる)。
サイズはメッセージの文字数から動的に計算する(`src/lib/bubbleSize.ts`)。全角文字(ひらがな・
カタカナ・漢字など)と半角文字(英数字など)で幅の重みを分けて見積もるため、日本語中心の
メッセージでも背景が文字からはみ出しにくい。

各社員は「これまでに一度もイベントを受け取っていない」間はアバターを表示せず机だけを表示する。
away状態で最初のイベントを受け取ると、机の左右どちらか(担当ごとに固定、`src/theme.ts` の
`WALK_DIR`)から歩いて出社してくる。その後 `done` イベントを受け取ると、出社時と同じ側へ歩いて
画面外へ退社し、アバターは非表示に戻る(机だけの状態)。

| event | 演出 |
|---|---|
| (最初のイベント) | 机の左右どちらかから歩いて出社してくる(スライド移動+上下バウンス、約1.2秒) |
| `start` | 着席の弾み(スケールがふわっと1になる)、色がアクティブ(担当色)になる |
| `progress` | 頭上に吹き出しで `message` を表示(4秒で自動的に消える) |
| `output` | 吹き出し表示 + 机の上に紙が1枚増える + アクティビティログ(成果物モニター)に`target`のファイル名付きで1行追加 |
| `handoff` | 吹き出し表示 + 次の社員(researcher→director→producer→inspector→publisher)の方向へ控えめに身を乗り出して戻る |
| `blocked` | 色が少し白っぽくくすむ(待機姿勢)+ 吹き出しが消えた後、頭の脇に「!」バッジが残る |
| `reject` | 体が赤くフラッシュする + 差し戻し先(1つ前の社員)の方向へ身を乗り出して戻る + 吹き出しで理由を表示 |
| `done` | 出社時と同じ側へ歩いて画面外へ退社し、アバターを非表示にする(机だけの状態に戻る) |

作業中(`active`かつ `blocked`/`done` 以外)は、実際のイベントメッセージの吹き出しが表示されていない
間、6〜9秒程度のランダムな間隔で役職ごとの小ネタ「面白いセリフ」(`src/data/flavorLines.ts`)を
クリーム色の吹き出しで表示する(約3秒で消える)。実際のイベントメッセージが届くと即座にそちらへ
差し替わる(常に実メッセージ優先)。

`handoff`/`reject` の「次の社員」「差し戻し先」は `logs/SCHEMA.md` に明示的な宛先フィールドが無いため、
`researcher→director→producer→inspector→publisher` という固定の幕の流れから推測している(`src/theme.ts` の
`PIPELINE_NEXT`/`PIPELINE_PREV`)。

ページを開いた瞬間に過去の全イベントを一気に反映するため、同一社員の中間状態(例:
`start`→`progress`→`output` のうち `output` 以外)は表示されず、**各社員の最終状態のみ**が
一度に反映される(吹き出しは最終イベントの `message` のみ表示される。ただし机の上の紙の枚数は
`output` イベントの累計回数を保持しているため、中間分も反映される)。この初回一括反映では
出社/退社の歩行アニメーションも再生されず、最終状態がそのまま(机だけ、または着席済みで)
表示される。イベントが1件ずつリアルタイムで届く実運用では、これらの演出がそれぞれ個別に発火する。

## 構成

```
viewer/
  index.html
  vite.config.ts        /api/events(logs/events.jsonlを配信する開発用ミドルウェア)を含む
  tsconfig.json
  src/
    main.tsx        エントリポイント
    App.tsx           3D Canvas + オーバーレイの土台、useOfficeStateを起動
    theme.ts            配色・actor一覧・机の配置・出社/退社の方向(単一の情報源)
    lib/
      eventLog.ts          logs/events.jsonl の取得。パース(parseNewEvents)と取得方式
                             (fetchPollingSource)を分離し、将来fs.watch+WebSocketに
                             差し替えられる構造にしている
      bubbleSize.ts          吹き出し(SpeechBubble)の板サイズをテキスト長から動的計算する
    data/
      flavorLines.ts          役職ごとの「面白いセリフ」(作業中のランダムな小ネタ)
    state/
      officeState.ts        actorごとの最新状態(outputCount含む)・直近イベント一覧を保持するreducer。
                             未知のactor/eventは無視する
    scene/
      Scene.tsx            Canvas・カメラ・ライティング
      Room.tsx              床(畳グリッド)・壁
      Desk.tsx               木製デスク
      Avatar.tsx              ローポリのチビキャラ(顔・腕・手・脚、出社/退社アニメーション、
                               面白いセリフを含むイベント演出)
      SpeechBubble.tsx         頭上の吹き出し描画(実イベントのmessage/面白いセリフ共通)
      OutputStack.tsx          outputイベントで積み上がる紙
      Office.tsx               机のレイアウトと名札
      PresidentMonitor.tsx      社長モニター(指示入力・一時停止ボタン、logs/instructions.jsonlへ送信)
    ui/
      Overlay.tsx              タイトル(左上)+ 右端サイドパネルの配置
      TitlePanel.tsx / StatusPanel.tsx / ActivityPanel.tsx
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
- `handoff`/`reject` は「身を乗り出す」動きのみで、机の間を実際に紙が飛んでいくような演出は無い
- 実際の `researcher`/`director` 等の本番イベントはまだ本番の `logs/events.jsonl` に記録されていない
  (各エージェントが `scripts/emit-event.mjs` を呼ぶ運用に乗ってから確認できる)
- グリッド配置(横3×縦2)の中央列(director/publisher)は、出社/退社で歩く際に右列(producer/pm)の
  机・アバターを一直線に通り抜けるため、一瞬視覚的に重なって見える(半円配置ではz座標が
  社員ごとに異なっていたため発生しなかった、グリッド化の副作用)
