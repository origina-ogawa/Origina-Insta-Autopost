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

export function ActivityPanel({ events }: { events: LogEvent[] }) {
  return (
    <section className="panel panel--activity">
      <h2>アクティビティログ</h2>
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
              <span className="activity-message">{ev.message || ev.event}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
