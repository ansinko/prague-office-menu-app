'use client';

import { useMemo } from 'react';
import type { Restaurant } from '@/lib/scrapers/types';
import { slugify } from '@/lib/slug';
import { useIdentity } from '@/lib/use-identity';
import { useVotes } from '@/lib/use-votes';
import { IdentityBar } from './IdentityBar';
import { PickBanner } from './PickBanner';
import { RestaurantCard } from './RestaurantCard';

export function VotingApp({ restaurants }: { restaurants: Restaurant[] }) {
  const { me, setMe, ready } = useIdentity();
  const { votes, cast } = useVotes();

  const tally = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [voter, slug] of Object.entries(votes)) {
      const arr = m.get(slug) ?? [];
      arr.push(voter);
      m.set(slug, arr);
    }
    return m;
  }, [votes]);

  const total = Object.keys(votes).length;
  const slugByCard = useMemo(
    () => restaurants.map((r) => slugify(r.name)),
    [restaurants],
  );

  const leaderCount = Math.max(0, ...Array.from(tally.values(), (v) => v.length));
  const leaderSlugs =
    leaderCount > 0
      ? Array.from(tally.entries())
          .filter(([, voters]) => voters.length === leaderCount)
          .map(([slug]) => slug)
      : [];
  const leaderNames = leaderSlugs
    .map((s) => restaurants.find((r, i) => slugByCard[i] === s)?.name)
    .filter((n): n is string => !!n);

  const onToggle = (slug: string) => {
    if (!me) return;
    const current = votes[me];
    cast(me, current === slug ? null : slug);
  };

  const handleSetMe = async (next: string | null) => {
    const previousVote = me ? votes[me] : undefined;
    if (me && previousVote) {
      await cast(me, null);
    }
    setMe(next);
    if (next && previousVote) {
      await cast(next, previousVote);
    }
  };

  return (
    <>
      {ready && <IdentityBar me={me} onSet={handleSetMe} />}
      <PickBanner leaders={leaderNames} count={leaderCount} total={total} />
      <main className="grid">
        {restaurants.map((r, i) => {
          const slug = slugByCard[i];
          const voters = tally.get(slug) ?? [];
          const picked = !!me && votes[me] === slug;
          const isLeader = leaderCount > 0 && leaderSlugs.includes(slug);
          return (
            <RestaurantCard
              key={r.name}
              restaurant={r}
              slug={slug}
              voters={voters}
              picked={picked}
              isLeader={isLeader}
              isTie={isLeader && leaderSlugs.length > 1}
              me={me}
              canVote={!!me}
              onToggle={() => onToggle(slug)}
            />
          );
        })}
      </main>
    </>
  );
}
