import { ACTORS, ACTOR_COLORS, ACTOR_LABELS } from "../theme";

// このステップではログ未接続のため、状態は全員プレースホルダー("-")表示。
export function StatusPanel() {
  return (
    <section className="panel panel--status">
      <h2>社員ステータス</h2>
      <ul className="status-list">
        {ACTORS.map((actor) => (
          <li key={actor}>
            <span>
              <span className="status-dot" style={{ background: ACTOR_COLORS[actor] }} />
              {ACTOR_LABELS[actor]}
            </span>
            <span>-</span>
          </li>
        ))}
      </ul>
      <p className="placeholder-note">ログ未接続(次のステップで実装予定)</p>
    </section>
  );
}
