export function PickBanner({
  winnerName,
  topVotes,
  totalVotes,
  totalVoters,
  tiedCount,
}: {
  winnerName: string | null;
  topVotes: number;
  totalVotes: number;
  totalVoters: number;
  tiedCount: number;
}) {
  if (!winnerName) return null;
  const tied = tiedCount > 1;
  return (
    <div className="pick-banner">
      <span className="pick-banner-label">
        {tied ? '$ today.winner = roll(' : '$ today.winner ='}
      </span>
      <span className="pick-banner-names">{winnerName}</span>
      {tied && (
        <span className="pick-banner-roll" title={`Z ${tiedCount} reštik si kocky vybrali túto.`}>
          ) --tied={tiedCount}
        </span>
      )}
      <span className="pick-banner-count">
        [ {topVotes} / {totalVoters} ]
        {totalVotes !== topVotes && <span className="pick-banner-clicks"> · {totalVotes} klikov</span>}
      </span>
    </div>
  );
}
