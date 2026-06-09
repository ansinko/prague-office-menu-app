'use client';

import { useMemo } from 'react';
import type { Restaurant } from '@/lib/scrapers/types';
import { useIdentity } from '@/lib/use-identity';
import { useVotes } from '@/lib/use-votes';
import { computeTally, computeWinner } from '@/lib/tally';
import { pragueIsoDate } from '@/lib/prague-time';
import { IdentityBar } from './IdentityBar';
import { PickBanner } from './PickBanner';
import { RestaurantCard } from './RestaurantCard';

export function VotingApp({
  restaurants,
  officeId,
}: {
  restaurants: Restaurant[];
  officeId: string;
}) {
  const { me, setMe, ready } = useIdentity();
  const { votes, cast, renameVoter } = useVotes(officeId);

  const tally = useMemo(() => computeTally(votes), [votes]);

  const winner = useMemo(
    () => computeWinner(tally, pragueIsoDate()),
    [tally],
  );

  const winnerName = useMemo(() => {
    if (!winner.winnerSlug) return null;
    return restaurants.find((r) => r.slug === winner.winnerSlug)?.name ?? null;
  }, [winner.winnerSlug, restaurants]);

  const tiedSlugSet = useMemo(() => new Set(winner.tiedSlugs), [winner.tiedSlugs]);

  const totalVotes = useMemo(
    () => Array.from(tally.values()).reduce((sum, voters) => sum + voters.length, 0),
    [tally],
  );
  const totalVoters = Object.keys(votes).length;
  const myPicks = me ? (votes[me] ?? []) : [];

  const onToggle = (slug: string) => {
    if (!me) return;
    cast(me, slug);
  };

  const handleSetMe = async (next: string | null) => {
    if (me && next && me !== next && (votes[me]?.length ?? 0) > 0) {
      await renameVoter(me, next);
    } else if (me && !next && (votes[me]?.length ?? 0) > 0) {
      await cast(me, null);
    }
    setMe(next);
  };

  return (
    <>
      {ready && <IdentityBar me={me} onSet={handleSetMe} pickCount={myPicks.length} />}
      <PickBanner
        winnerName={winnerName}
        topVotes={winner.topVotes}
        totalVotes={totalVotes}
        totalVoters={totalVoters}
        tiedCount={winner.tiedCount}
      />
      <main className="grid">
        {restaurants.map((r) => {
          const voters = tally.get(r.slug) ?? [];
          const picked = myPicks.includes(r.slug);
          const isWinner = winner.winnerSlug === r.slug;
          const isTied = tiedSlugSet.has(r.slug);
          const wasRolled = isWinner && winner.tiedCount > 1;
          return (
            <RestaurantCard
              key={r.name}
              restaurant={r}
              voters={voters}
              picked={picked}
              isWinner={isWinner}
              isTied={isTied && !isWinner}
              wasRolled={wasRolled}
              me={me}
              canVote={!!me}
              onToggle={() => onToggle(r.slug)}
            />
          );
        })}
      </main>
    </>
  );
}
