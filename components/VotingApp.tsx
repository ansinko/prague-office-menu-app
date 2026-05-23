'use client';

import { useMemo } from 'react';
import type { Restaurant } from '@/lib/scrapers/types';
import { useIdentity } from '@/lib/use-identity';
import { useVotes } from '@/lib/use-votes';
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
  const { votes, cast } = useVotes(officeId);

  const tally = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [voter, slug] of Object.entries(votes)) {
      const arr = m.get(slug) ?? [];
      arr.push(voter);
      m.set(slug, arr);
    }
    return m;
  }, [votes]);

  const { leaderCount, leaderSlugs, leaderNames } = useMemo(() => {
    let max = 0;
    for (const voters of tally.values()) {
      if (voters.length > max) max = voters.length;
    }
    if (max === 0) return { leaderCount: 0, leaderSlugs: new Set<string>(), leaderNames: [] as string[] };
    const slugs = new Set<string>();
    for (const [slug, voters] of tally.entries()) {
      if (voters.length === max) slugs.add(slug);
    }
    const names = restaurants.filter((r) => slugs.has(r.slug)).map((r) => r.name);
    return { leaderCount: max, leaderSlugs: slugs, leaderNames: names };
  }, [tally, restaurants]);

  const total = Object.keys(votes).length;

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

  const isTie = leaderSlugs.size > 1;

  return (
    <>
      {ready && <IdentityBar me={me} onSet={handleSetMe} />}
      <PickBanner leaders={leaderNames} count={leaderCount} total={total} />
      <main className="grid">
        {restaurants.map((r) => {
          const voters = tally.get(r.slug) ?? [];
          const picked = !!me && votes[me] === r.slug;
          const isLeader = leaderCount > 0 && leaderSlugs.has(r.slug);
          return (
            <RestaurantCard
              key={r.name}
              restaurant={r}
              voters={voters}
              picked={picked}
              isLeader={isLeader}
              isTie={isLeader && isTie}
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
