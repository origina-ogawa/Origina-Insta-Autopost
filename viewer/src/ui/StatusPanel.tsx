import { ACTORS, ACTOR_COLORS, ACTOR_LABELS } from "../theme";
import type { ActorState } from "../state/officeState";

const EVENT_LABEL: Record<string, string> = {
  start: "作業中",
  progress: "作業中",
  output: "作業中",
  handoff: "引き継ぎ",
  blocked: "承認待ち",
  reject: "差し戻し",
  done: "完了",
};

export function StatusPanel({ actors }: { actors: Record<(typeof ACTORS)[number], ActorState> }) {
  return (
    <section className="panel">
      <h2>社員ステータス</h2>
      <ul className="status-list">
        {ACTORS.map((actor) => {
          const state = actors[actor];
          const label = state.event ? (EVENT_LABEL[state.event] ?? state.event) : "-";
          return (
            <li key={actor}>
              <span>
                <span className="status-dot" style={{ background: ACTOR_COLORS[actor] }} />
                {ACTOR_LABELS[actor]}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
      <p className="placeholder-note">logs/events.jsonl を2秒ごとに反映</p>
    </section>
  );
}
