import { ACTORS, ACTOR_COLORS, ACTOR_LABELS, ACTOR_NAMES } from "../theme";
import type { ActorState } from "../state/officeState";

const EVENT_LABEL: Record<string, string> = {
  start: "作業中",
  progress: "作業中",
  output: "作業中",
  handoff: "引き継ぎ",
  blocked: "承認待ち",
  reject: "差し戻し",
};

export function StatusPanel({ actors }: { actors: Record<(typeof ACTORS)[number], ActorState> }) {
  return (
    <section className="panel">
      <h2>社員ステータス</h2>
      <ul className="status-list">
        {ACTORS.map((actor) => {
          const state = actors[actor];
          // active=false は「未出社(まだ着手していない)」「done で退社済み」のどちらも含む
          const label = state.active && state.event ? (EVENT_LABEL[state.event] ?? state.event) : "未出社";
          return (
            <li key={actor}>
              <span>
                <span className="status-dot" style={{ background: ACTOR_COLORS[actor] }} />
                {ACTOR_NAMES[actor]}({ACTOR_LABELS[actor]})
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
