# イベントログのスキーマ

`logs/events.jsonl` は1行1JSON（JSON Lines）。
**このファイルが AI社員と表示層（3Dオフィス等）の唯一の接点です。**

表示層はここだけを読む。エージェントの実装を知る必要はない。
逆に、このスキーマを変えると表示層が壊れるため、変更は慎重に行うこと。

## フィールド

| キー | 型 | 説明 |
|---|---|---|
| `ts` | string | ISO8601のタイムスタンプ |
| `actor` | string | 社員名。`pm` `researcher` `director` `producer` `inspector` `publisher` |
| `event` | string | 下表参照 |
| `phase` | string \| null | `research` `structure` `produce` `inspect` `publish` |
| `ticket` | string \| null | Issue番号（例 `#12`） |
| `target` | string \| null | 対象ファイルパス |
| `message` | string | 人間が読む一言。3Dでは吹き出しになる |

## event の種類

| 値 | 意味 | 3Dでの表現（想定） |
|---|---|---|
| `start` | 作業開始 | アバターが着席する |
| `progress` | 作業中の途中経過 | 吹き出しを出す |
| `output` | ファイルを生成した | 成果物モニターに追加 |
| `handoff` | 次の社員へ引き継いだ | アバター間に矢印 |
| `blocked` | 承認待ちで停止 | アバターが待機姿勢になる |
| `reject` | 検収で差し戻した | 赤い演出 |
| `done` | 担当分が完了 | アバターが退勤する |

## 例

```json
{"ts":"2026-08-12T04:00:00.000Z","actor":"researcher","event":"start","phase":"research","ticket":"#12","target":null,"message":"ソース収集を開始"}
{"ts":"2026-08-12T04:06:12.000Z","actor":"researcher","event":"output","phase":"research","ticket":"#12","target":"sources/2026-08-12-openai-api.md","message":"一次ソース3件を確保"}
{"ts":"2026-08-12T04:20:00.000Z","actor":"inspector","event":"reject","phase":"inspect","ticket":"#12","target":"work/openai-api/slides.json","message":"4枚目が72字。上限超過"}
```

## 表示層を作るときの前提

- 追記のみ。既存行を書き換えない
- 表示層はファイルを `fs.watch` で監視し、追記分だけを読む
- ログが欠けても表示層は落ちないこと（欠損に強く作る）
