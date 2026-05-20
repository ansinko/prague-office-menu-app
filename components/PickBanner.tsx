export function PickBanner({
  leaders,
  count,
  total,
}: {
  leaders: string[];
  count: number;
  total: number;
}) {
  if (total === 0) return null;
  const tie = leaders.length > 1;
  return (
    <div className="pick-banner">
      <span className="pick-banner-label">
        {tie ? '$ today.tie =' : '$ today.winner ='}
      </span>
      <span className="pick-banner-names">
        {tie ? leaders.join(' || ') : leaders[0]}
      </span>
      <span className="pick-banner-count">
        [ {count} / {total} ]
      </span>
    </div>
  );
}
