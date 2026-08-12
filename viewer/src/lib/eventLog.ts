import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 2000;

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

// logs/events.jsonl を2秒間隔でポーリングし、前回より増えた行だけをコールバックに渡す。
// 不正な行(パース失敗)はスキップし、表示層は落とさない(logs/SCHEMA.mdの前提)。
export function useEventPolling(onNewEvents: (events: LogEvent[]) => void) {
  const lastLineCount = useRef(0);
  const callbackRef = useRef(onNewEvents);
  callbackRef.current = onNewEvents;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const text = await res.text();
        const lines = text.split("\n").filter((l) => l.trim().length > 0);

        if (lines.length > lastLineCount.current) {
          const newLines = lines.slice(lastLineCount.current);
          lastLineCount.current = lines.length;
          const events = newLines
            .map((line): LogEvent | null => {
              try {
                return JSON.parse(line) as LogEvent;
              } catch {
                return null;
              }
            })
            .filter((e): e is LogEvent => e !== null);
          if (events.length > 0) callbackRef.current(events);
        } else if (lines.length < lastLineCount.current) {
          // ログが巻き戻った(再作成された等) → 最初から読み直す
          lastLineCount.current = 0;
        }
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
  }, []);
}
