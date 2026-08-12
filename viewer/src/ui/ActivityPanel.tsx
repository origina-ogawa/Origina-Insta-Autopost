import { ACTOR_LABELS, type ActorId } from "../theme";
import type { LogEvent } from "../lib/eventLog";

const EVENT_ICON: Record<string, string> = {
  start: "▶",
  progress: "…",
  output: "📄",
  handoff: "→",
  blocked: "!",
  reject: "✕",
  done: "✓",
};

// output(成果物)は、logs/SCHEMA.mdの「成果物モニターに追加」に対応する行として
// ファイル名も併記する。それ以外はmessageのみ。
function describe(ev: LogEvent): string {
  if (ev.event === "output" && ev.target) {
    // targetが "posts/xxx/" のようにディレクトリ(末尾スラッシュ)のこともある
    const fileName = ev.target.replace(/\/+$/, "").split("/").pop();
    if (!fileName) return ev.message || ev.event;
    return ev.message ? `${ev.message}(${fileName})` : fileName;
  }
  return ev.message || ev.event;
}

export function ActivityPanel({ events }: { events: LogEvent[] }) {
  return (
    <section className="panel panel--activity">
      <h2>アクティビティログ(成果物モニター)</h2>
      {events.length === 0 ? (
        <>
          <p>まだイベントがありません。</p>
          <p className="placeholder-note">logs/events.jsonl を2秒ごとに確認しています</p>
        </>
      ) : (
        <ul className="activity-list">
          {events.map((ev, i) => (
            <li key={`${ev.ts}-${i}`}>
              <span className="activity-icon">{EVENT_ICON[ev.event] ?? "・"}</span>
              <span className="activity-actor">{ACTOR_LABELS[ev.actor as ActorId] ?? ev.actor}</span>
              <span className="activity-message">{describe(ev)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
