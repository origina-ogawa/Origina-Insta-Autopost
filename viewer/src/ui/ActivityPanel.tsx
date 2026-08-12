// このステップではログ読み込み・アニメーションを実装しないため、枠だけのプレースホルダー。
export function ActivityPanel() {
  return (
    <section className="panel panel--activity">
      <h2>アクティビティログ</h2>
      <p>まだ接続されていません。</p>
      <p className="placeholder-note">logs/events.jsonl の読み込みは次のステップで実装予定</p>
    </section>
  );
}
