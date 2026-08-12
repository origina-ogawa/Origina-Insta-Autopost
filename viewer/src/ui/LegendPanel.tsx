import { ACTORS, ACTOR_COLORS, ACTOR_LABELS } from "../theme";

export function LegendPanel() {
  return (
    <section className="panel panel--legend">
      <h2>凡例</h2>
      <ul className="legend-swatches">
        {ACTORS.map((actor) => (
          <li key={actor}>
            <span className="status-dot" style={{ background: ACTOR_COLORS[actor] }} />
            {ACTOR_LABELS[actor]}
          </li>
        ))}
      </ul>
      <p className="placeholder-note">カメラは固定です(俯瞰・アイソメトリック調)</p>
    </section>
  );
}
