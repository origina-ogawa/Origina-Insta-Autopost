import { useEffect, useRef } from "react";

// logs/SCHEMA.md に対応する型。actorは"system"等、AI社員以外の値も来ることがある。
export type LogEvent = {
  ts: string;
  actor: string;
  event: "start" | "progress" | "output" | "handoff" | "blocked" | "reject" | "done" | (string & {});
  phase: string | null;
  ticket: string | null;
  target: string | null;
  message: string;
};

// logs/events.jsonl の生テキスト(JSON Lines・追記のみ)から、前回より増えた行だけを取り出す。
// 不正な行(パース失敗)はスキップし、表示層は落とさない(logs/SCHEMA.mdの前提)。
export function parseNewEvents(fullText: string, previousLineCount: number): { events: LogEvent[]; lineCount: number } {
  const lines = fullText.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < previousLineCount) {
    // ログが巻き戻った(再作成された等) → 最初から読み直す
    return parseNewEvents(fullText, 0);
  }
  const newLines = lines.slice(previousLineCount);
  const events = newLines
    .map((line): LogEvent | null => {
      try {
        return JSON.parse(line) as LogEvent;
      } catch {
        return null; // 未知のactor/eventはここでは弾かない(officeState側で無視する)
      }
    })
    .filter((e): e is LogEvent => e !== null);
  return { events, lineCount: lines.length };
}

// --- 取得方式(トランスポート) ---
// 開発中はfetchポーリング。将来 logs/events.jsonl を fs.watch し、WebSocketで
// 差分をpushする方式に差し替えるときは、この型と同じシグネチャの実装に置き換えるだけでよい
// (onEvents を呼ぶ購読関数を作り、購読解除用のクリーンアップ関数を返す)。
export type EventLogSource = (onEvents: (events: LogEvent[]) => void) => () => void;

const POLL_INTERVAL_MS = 2000;

export const fetchPollingSource: EventLogSource = (onEvents) => {
  let cancelled = false;
  let lineCount = 0;

  async function poll() {
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const text = await res.text();
      const result = parseNewEvents(text, lineCount);
      lineCount = result.lineCount;
      if (result.events.length > 0) onEvents(result.events);
    } catch {
      // devサーバー再起動中など。次のポーリングで復帰する
    }
  }

  poll();
  const id = setInterval(poll, POLL_INTERVAL_MS);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
};

// logs/events.jsonl の更新をReactに配線するフック。
// 現状は fetchPollingSource を使う。トランスポートを差し替えるときはここだけ変更すればよい。
export function useEventLog(onNewEvents: (events: LogEvent[]) => void) {
  const callbackRef = useRef(onNewEvents);
  callbackRef.current = onNewEvents;

  useEffect(() => {
    return fetchPollingSource((events) => callbackRef.current(events));
  }, []);
}
