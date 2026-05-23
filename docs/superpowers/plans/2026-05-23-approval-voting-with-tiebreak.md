# Approval Voting + Random Tiebreak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each voter to pick multiple restaurants (approval voting) and automatically resolve any ties via a deterministic seeded random pick, with no server data migration and no API surface break.

**Architecture:** Two new pure-function modules (`lib/tiebreak.ts`, `lib/tally.ts`) drive the logic; client state moves from `Record<voter, slug>` to `Record<voter, slug[]>`. The Redis hash stores CSV slugs per voter (backwards-compatible with the existing single-slug entries). POST semantics flip from *replace* to *toggle*; rename action remains pipeline-atomic.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Upstash Redis (`@upstash/redis` multi pipeline), Vitest for pure-function tests.

**Spec:** [`docs/superpowers/specs/2026-05-23-approval-voting-with-tiebreak-design.md`](../specs/2026-05-23-approval-voting-with-tiebreak-design.md)

**Branch:** `feature/mutiple-votes` (already checked out)

---

## File Structure

| File | Role |
|---|---|
| `lib/tiebreak.ts` (new) | `pickFromTied(slugs, dateKey)` — deterministic FNV-1a seeded picker |
| `lib/tally.ts` (new) | `parseCsvVotes`, `computeTally`, `computeWinner`; exports `VoteMap = Record<string, string[]>` |
| `__tests__/tiebreak.test.ts` (new) | Vitest unit tests for `pickFromTied` |
| `__tests__/votes-tally.test.ts` (new) | Vitest unit tests for tally + parsing |
| `app/api/votes/route.ts` | POST toggles slug in voter's CSV instead of replacing |
| `lib/use-votes.ts` | `VoteMap` array-valued, CSV parse on response, toggle optimistic update |
| `components/VotingApp.tsx` | Uses `computeTally` + `computeWinner`; passes new props down |
| `components/PickBanner.tsx` | Single-winner display + ASCII `$ roll --tied=N` hint when tiebreaker fired |
| `components/RestaurantCard.tsx` | `picked` from array; new `card--winner` / `card--tied` / `card--rolled` classes (renaming `card--leader`) |
| `components/IdentityBar.tsx` | `[ N picks ]` counter when N > 0 |
| `app/globals.css` | Class rename + new winner/tied/rolled / roll-hint styles |

Test scope: pure functions only (`lib/tiebreak.ts`, `lib/tally.ts`). UI verified manually in the dev browser per CLAUDE.md.

---

## Task 1: `pickFromTied` deterministic tiebreak picker

**Files:**
- Create: `lib/tiebreak.ts`
- Test: `__tests__/tiebreak.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/tiebreak.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickFromTied } from '@/lib/tiebreak';

describe('pickFromTied', () => {
  it('is deterministic for the same input', () => {
    const a = pickFromTied(['krusovicka', 'kandelabr'], '2026-05-23');
    const b = pickFromTied(['krusovicka', 'kandelabr'], '2026-05-23');
    expect(a).toBe(b);
  });

  it('is order-insensitive on the tied set', () => {
    const a = pickFromTied(['krusovicka', 'kandelabr'], '2026-05-23');
    const b = pickFromTied(['kandelabr', 'krusovicka'], '2026-05-23');
    expect(a).toBe(b);
  });

  it('returns the only element for a singleton set', () => {
    expect(pickFromTied(['solo'], '2026-05-23')).toBe('solo');
  });

  it('always returns a slug from the tied set', () => {
    const tied = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      const date = `2026-05-${String(i + 1).padStart(2, '0')}`;
      expect(tied).toContain(pickFromTied(tied, date));
    }
  });

  it('distributes roughly evenly across many date keys', () => {
    const tied = ['a', 'b', 'c'];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 900; i++) {
      const date = `seed-${i}`;
      counts[pickFromTied(tied, date)]++;
    }
    // Each bucket should be within ±20% of expected 300 (loose sanity)
    for (const k of ['a', 'b', 'c']) {
      expect(counts[k]).toBeGreaterThan(240);
      expect(counts[k]).toBeLessThan(360);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tiebreak
```

Expected: FAIL (module not found / cannot import `@/lib/tiebreak`).

- [ ] **Step 3: Implement `lib/tiebreak.ts`**

```ts
export function pickFromTied(tiedSlugs: string[], dateKey: string): string {
  const sorted = [...tiedSlugs].sort();
  const seed = `${dateKey}|${sorted.join('|')}`;
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return sorted[Math.abs(hash) % sorted.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tiebreak
```

Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tiebreak.ts __tests__/tiebreak.test.ts
git commit -m "feat: deterministic seeded tiebreak picker"
```

---

## Task 2: `lib/tally.ts` — VoteMap type, CSV parse, tally + winner

**Files:**
- Create: `lib/tally.ts`
- Test: `__tests__/votes-tally.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/votes-tally.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCsvVotes, computeTally, computeWinner } from '@/lib/tally';

describe('parseCsvVotes', () => {
  it('returns empty map for empty input', () => {
    expect(parseCsvVotes({})).toEqual({});
  });

  it('parses a single slug string into a one-element array (backwards-compat)', () => {
    expect(parseCsvVotes({ Andrej: 'krusovicka' })).toEqual({ Andrej: ['krusovicka'] });
  });

  it('parses CSV slugs into an array', () => {
    expect(parseCsvVotes({ Andrej: 'krusovicka,kandelabr' })).toEqual({
      Andrej: ['krusovicka', 'kandelabr'],
    });
  });

  it('filters empty entries from malformed CSV', () => {
    expect(parseCsvVotes({ Andrej: ',krusovicka,,kandelabr,' })).toEqual({
      Andrej: ['krusovicka', 'kandelabr'],
    });
  });
});

describe('computeTally', () => {
  it('returns empty tally for empty votes', () => {
    expect(computeTally({})).toEqual(new Map());
  });

  it('counts a single voter with a single pick', () => {
    const t = computeTally({ Andrej: ['krusovicka'] });
    expect(t.get('krusovicka')).toEqual(['Andrej']);
    expect(t.size).toBe(1);
  });

  it('counts a single voter with multiple picks', () => {
    const t = computeTally({ Andrej: ['krusovicka', 'kandelabr'] });
    expect(t.get('krusovicka')).toEqual(['Andrej']);
    expect(t.get('kandelabr')).toEqual(['Andrej']);
  });

  it('aggregates voters per slug', () => {
    const t = computeTally({
      Andrej: ['krusovicka'],
      Bara: ['krusovicka', 'kandelabr'],
    });
    expect(t.get('krusovicka')).toEqual(['Andrej', 'Bara']);
    expect(t.get('kandelabr')).toEqual(['Bara']);
  });
});

describe('computeWinner', () => {
  const date = '2026-05-23';

  it('returns null winner when no votes', () => {
    const r = computeWinner(new Map(), date);
    expect(r.winnerSlug).toBeNull();
    expect(r.topVotes).toBe(0);
    expect(r.tiedCount).toBe(0);
    expect(r.tiedSlugs).toEqual([]);
  });

  it('returns solo winner with tiedCount=1', () => {
    const tally = new Map([
      ['krusovicka', ['Andrej', 'Bara']],
      ['kandelabr', ['Cyril']],
    ]);
    const r = computeWinner(tally, date);
    expect(r.winnerSlug).toBe('krusovicka');
    expect(r.topVotes).toBe(2);
    expect(r.tiedCount).toBe(1);
  });

  it('breaks a 2-way tie deterministically', () => {
    const tally = new Map([
      ['krusovicka', ['Andrej']],
      ['kandelabr', ['Bara']],
    ]);
    const r1 = computeWinner(tally, date);
    const r2 = computeWinner(tally, date);
    expect(r1.winnerSlug).toBe(r2.winnerSlug);
    expect(['krusovicka', 'kandelabr']).toContain(r1.winnerSlug);
    expect(r1.tiedCount).toBe(2);
    expect(r1.tiedSlugs.sort()).toEqual(['kandelabr', 'krusovicka']);
  });

  it('breaks a 4-way tie', () => {
    const tally = new Map([
      ['a', ['x']],
      ['b', ['x']],
      ['c', ['x']],
      ['d', ['x']],
    ]);
    const r = computeWinner(tally, date);
    expect(['a', 'b', 'c', 'd']).toContain(r.winnerSlug);
    expect(r.tiedCount).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- votes-tally
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/tally.ts`**

```ts
import { pickFromTied } from './tiebreak';

export type VoteMap = Record<string, string[]>;

export interface WinnerResult {
  winnerSlug: string | null;
  topVotes: number;
  tiedCount: number;
  tiedSlugs: string[];
}

export function parseCsvVotes(raw: Record<string, string>): VoteMap {
  const out: VoteMap = {};
  for (const [voter, csv] of Object.entries(raw)) {
    out[voter] = csv.split(',').filter(Boolean);
  }
  return out;
}

export function computeTally(votes: VoteMap): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [voter, slugs] of Object.entries(votes)) {
    for (const slug of slugs) {
      const arr = m.get(slug) ?? [];
      arr.push(voter);
      m.set(slug, arr);
    }
  }
  return m;
}

export function computeWinner(tally: Map<string, string[]>, dateKey: string): WinnerResult {
  let topVotes = 0;
  for (const voters of tally.values()) {
    if (voters.length > topVotes) topVotes = voters.length;
  }
  if (topVotes === 0) {
    return { winnerSlug: null, topVotes: 0, tiedCount: 0, tiedSlugs: [] };
  }
  const tiedSlugs: string[] = [];
  for (const [slug, voters] of tally.entries()) {
    if (voters.length === topVotes) tiedSlugs.push(slug);
  }
  const winnerSlug = tiedSlugs.length === 1 ? tiedSlugs[0] : pickFromTied(tiedSlugs, dateKey);
  return { winnerSlug, topVotes, tiedCount: tiedSlugs.length, tiedSlugs };
}
```

- [ ] **Step 4: Run all tests to verify pass**

```bash
npm test
```

Expected: PASS (existing 18 tests + new tiebreak + new tally tests = ~30 total).

- [ ] **Step 5: Commit**

```bash
git add lib/tally.ts __tests__/votes-tally.test.ts
git commit -m "feat: VoteMap type and pure tally + winner helpers"
```

---

## Task 3: Server toggle semantics + CSV storage

**Files:**
- Modify: `app/api/votes/route.ts`

Current POST replaces the voter's value. New behavior: toggle the slug in the voter's CSV list. Existing single-slug data is read as a one-element list (backwards-compatible).

- [ ] **Step 1: Replace the POST handler's slug branch**

Open `app/api/votes/route.ts`. Find the section beginning with `const validSlugs` and ending with `return NextResponse.json({ votes: data ?? {} });`.

Replace that entire section (the "non-null restaurantRaw" branch) with:

```ts
  const validSlugs = new Set(office.restaurants.map((r) => slugify(r.name)));
  if (!validSlugs.has(restaurantRaw)) {
    return NextResponse.json({ error: 'Unknown restaurant' }, { status: 400 });
  }

  const currentCsv = (await redis.hget<string>(key, name)) ?? '';
  const current = currentCsv.split(',').filter(Boolean);
  const next = current.includes(restaurantRaw)
    ? current.filter((s) => s !== restaurantRaw)
    : [...current, restaurantRaw];

  if (next.length === 0) {
    const [, data] = await redis
      .multi()
      .hdel(key, name)
      .hgetall<VoteMap>(key)
      .exec<[number, VoteMap | null]>();
    return NextResponse.json({ votes: data ?? {} });
  }

  const [, , data] = await redis
    .multi()
    .hset(key, { [name]: next.join(',') })
    .expire(key, secondsUntilPragueMidnight())
    .hgetall<VoteMap>(key)
    .exec<[number, number, VoteMap | null]>();

  return NextResponse.json({ votes: data ?? {} });
```

The `restaurantRaw === null || restaurantRaw === ''` branch (clears all votes for voter) stays unchanged — it already deletes the voter's field. The rename branch above it also stays unchanged.

- [ ] **Step 2: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify existing tests still pass**

```bash
npm test
```

Expected: 18 existing tests + new tiebreak/tally tests still pass. Server has no test file in this codebase.

- [ ] **Step 4: Commit**

```bash
git add app/api/votes/route.ts
git commit -m "feat: toggle slug semantics with CSV storage in votes route"
```

---

## Task 4: Client multi-vote — `use-votes` + `VotingApp` + `PickBanner` + `RestaurantCard`

This task ships as one commit because the type change to `VoteMap` cascades through these four files; intermediate states wouldn't typecheck.

**Files:**
- Modify: `lib/use-votes.ts`
- Modify: `components/VotingApp.tsx`
- Modify: `components/PickBanner.tsx`
- Modify: `components/RestaurantCard.tsx`

- [ ] **Step 1: Rewrite `lib/use-votes.ts`**

Replace the file contents with:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCsvVotes, type VoteMap } from '@/lib/tally';

export type { VoteMap };

const POLL_MS = 10_000;

function votesEqual(a: VoteMap, b: VoteMap): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) {
    const av = a[k];
    const bv = b[k];
    if (!bv || av.length !== bv.length) return false;
    for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return false;
  }
  return true;
}

export function useVotes(officeId: string) {
  const [votes, setVotes] = useState<VoteMap>({});
  const abortRef = useRef<AbortController | null>(null);

  const applyServerVotes = useCallback((raw: Record<string, string>) => {
    const next = parseCsvVotes(raw);
    setVotes((prev) => (votesEqual(prev, next) ? prev : next));
  }, []);

  const fetchVotes = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/votes?office=${encodeURIComponent(officeId)}`, {
        signal: ac.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { votes: next } = (await res.json()) as { votes: Record<string, string> };
      applyServerVotes(next);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }, [officeId, applyServerVotes]);

  useEffect(() => {
    fetchVotes();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id != null) return;
      id = setInterval(fetchVotes, POLL_MS);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchVotes();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', fetchVotes);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', fetchVotes);
      abortRef.current?.abort();
    };
  }, [fetchVotes]);

  const cast = useCallback(
    async (name: string, restaurant: string | null) => {
      let snapshot: VoteMap = {};
      setVotes((current) => {
        snapshot = current;
        const next = { ...current };
        if (restaurant === null) {
          delete next[name];
        } else {
          const list = current[name] ?? [];
          next[name] = list.includes(restaurant)
            ? list.filter((s) => s !== restaurant)
            : [...list, restaurant];
          if (next[name].length === 0) delete next[name];
        }
        return next;
      });
      try {
        const res = await fetch('/api/votes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, restaurant, officeId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { votes: server } = (await res.json()) as { votes: Record<string, string> };
        applyServerVotes(server);
      } catch {
        setVotes(snapshot);
      }
    },
    [officeId, applyServerVotes],
  );

  const renameVoter = useCallback(
    async (from: string, to: string) => {
      if (from === to) return;
      let snapshot: VoteMap = {};
      setVotes((current) => {
        snapshot = current;
        const value = current[from];
        if (value === undefined) return current;
        const next = { ...current };
        delete next[from];
        next[to] = value;
        return next;
      });
      try {
        const res = await fetch('/api/votes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ officeId, rename: { from, to } }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { votes: server } = (await res.json()) as { votes: Record<string, string> };
        applyServerVotes(server);
      } catch {
        setVotes(snapshot);
      }
    },
    [officeId, applyServerVotes],
  );

  return { votes, cast, renameVoter, refresh: fetchVotes };
}
```

- [ ] **Step 2: Rewrite `components/VotingApp.tsx`**

Replace the file contents with:

```tsx
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
```

- [ ] **Step 3: Rewrite `components/PickBanner.tsx`**

First inspect the current file to learn its render shape:

```bash
sed -n '1,80p' components/PickBanner.tsx
```

Then replace the file with:

```tsx
'use client';

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

  return (
    <div className="pick-banner">
      <span className="pick-banner-arrow" aria-hidden="true">&gt;&gt;</span>
      <span className="pick-banner-name">{winnerName}</span>
      <span className="pick-banner-verb">vyhráva</span>
      <span className="pick-banner-stats">
        {topVotes} {topVotes === 1 ? 'hlas' : topVotes < 5 ? 'hlasy' : 'hlasov'}
        {' · '}
        {totalVoters} {totalVoters === 1 ? 'hlasujúci' : 'hlasujúcich'}
        {totalVotes !== topVotes && ` · ${totalVotes} klikov`}
      </span>
      {tiedCount > 1 && (
        <span className="pick-banner-roll" title={`Z ${tiedCount} reštik si kocky vybrali túto.`}>
          $ roll --tied={tiedCount}
        </span>
      )}
    </div>
  );
}
```

If the current file uses different class names than `pick-banner*` (verify in Step 3a below), update both this file and the matching CSS in Task 6 to use a consistent naming. The existing CSS likely already has `pick-banner` styles to inherit from.

- [ ] **Step 3a: Check current PickBanner CSS class names**

```bash
grep -n "pick-banner\|pickbanner\|.pick" app/globals.css | head -20
```

If existing classes are different (e.g. `.pick`, `.pick-leaders`), align the JSX with the existing prefix to avoid losing styling. Use the most-used existing prefix from the grep output.

- [ ] **Step 4: Modify `components/RestaurantCard.tsx`**

Find the prop signature block (around line 15):

```tsx
export function RestaurantCard({
  restaurant: r,
  voters,
  picked,
  isLeader,
  isTie,
  me,
  canVote,
  onToggle,
}: {
  restaurant: Restaurant;
  voters: string[];
  picked: boolean;
  isLeader: boolean;
  isTie: boolean;
  me: string | null;
  canVote: boolean;
  onToggle: () => void;
}) {
```

Replace it with:

```tsx
export function RestaurantCard({
  restaurant: r,
  voters,
  picked,
  isWinner,
  isTied,
  wasRolled,
  me,
  canVote,
  onToggle,
}: {
  restaurant: Restaurant;
  voters: string[];
  picked: boolean;
  isWinner: boolean;
  isTied: boolean;
  wasRolled: boolean;
  me: string | null;
  canVote: boolean;
  onToggle: () => void;
}) {
```

Find the classes section:

```tsx
  const classes = ['card'];
  if (isError) classes.push('card--error');
  if (picked) classes.push('card--picked');
  if (isLeader) classes.push('card--leader');
```

Replace with:

```tsx
  const classes = ['card'];
  if (isError) classes.push('card--error');
  if (picked) classes.push('card--picked');
  if (isWinner) classes.push('card--winner');
  if (wasRolled) classes.push('card--rolled');
  if (isTied) classes.push('card--tied');
```

Find the badge section:

```tsx
      {isLeader && (
        <span className="card-pick-badge">{isTie ? '[ TIE ]' : '[ WINNER ]'}</span>
      )}
```

Replace with:

```tsx
      {isWinner && (
        <span className="card-pick-badge">
          {wasRolled ? '[ WINNER × ROLL ]' : '[ WINNER ]'}
        </span>
      )}
      {isTied && (
        <span className="card-pick-badge card-pick-badge--tied">[ TIED ]</span>
      )}
```

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If `IdentityBar` prop type error appears (we pass `pickCount` not yet accepted), that's expected — Task 5 fixes it. To verify *only* the wired files in isolation: keep going to Step 6.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 18 existing + tiebreak + tally still pass.

- [ ] **Step 7: Commit (after Task 5 closes the typecheck loop)**

This commit is paired with Task 5. Do **not** commit yet — proceed to Task 5 immediately, then commit both together.

---

## Task 5: `IdentityBar` `[ N picks ]` counter

**Files:**
- Modify: `components/IdentityBar.tsx`

- [ ] **Step 1: Add `pickCount` prop**

Find the component signature:

```tsx
export function IdentityBar({
  me,
  onSet,
}: {
  me: string | null;
  onSet: (name: string | null) => void;
}) {
```

Replace with:

```tsx
export function IdentityBar({
  me,
  onSet,
  pickCount,
}: {
  me: string | null;
  onSet: (name: string | null) => void;
  pickCount: number;
}) {
```

- [ ] **Step 2: Render counter in the "has name" branch**

Find the JSX in the bottom (non-editing) branch:

```tsx
  return (
    <div className="identity-bar">
      <span className="identity-label">$ whoami</span>
      <span className="identity-name">{me}</span>
      <button
        type="button"
        className="identity-btn"
        onClick={() => {
          setDraft(me);
          setEditing(true);
        }}
      >
        [ rename ]
      </button>
    </div>
  );
```

Replace with:

```tsx
  return (
    <div className="identity-bar">
      <span className="identity-label">$ whoami</span>
      <span className="identity-name">{me}</span>
      {pickCount > 0 && (
        <span className="identity-picks">[ {pickCount} pick{pickCount === 1 ? '' : 's'} ]</span>
      )}
      <button
        type="button"
        className="identity-btn"
        onClick={() => {
          setDraft(me);
          setEditing(true);
        }}
      >
        [ rename ]
      </button>
    </div>
  );
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all green.

- [ ] **Step 5: Commit Task 4 + Task 5 together**

```bash
git add lib/use-votes.ts components/VotingApp.tsx components/PickBanner.tsx \
        components/RestaurantCard.tsx components/IdentityBar.tsx
git commit -m "feat: multi-vote approval + winner derivation with tiebreak"
```

---

## Task 6: CSS — rename `card--leader`, add `card--winner` / `card--tied` / `card--rolled` / banner roll hint

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Find existing leader/banner styles**

```bash
grep -n "card--leader\|card-pick-badge\|pick-banner" app/globals.css
```

Note the line numbers and CSS rules currently associated with each selector.

- [ ] **Step 2: Strict-rename `card--leader` to `card--winner` across the file**

For every line that contains `card--leader`, replace the selector with `card--winner`. Use the Edit tool with `replace_all: true` on the single string `card--leader` (verify there are no incidental matches outside CSS first via the grep in Step 1 — the only producer/consumer was `RestaurantCard.tsx` which Task 4 already updated).

- [ ] **Step 3: Add `card--tied`, `card--rolled`, badge tied modifier, picks counter, banner roll hint**

Append to `app/globals.css` (after the existing card styles, before the `menu-pending` / `dish-empty` block added in the recent refactor):

```css
.card--tied {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.card--rolled .card-pick-badge {
  letter-spacing: 0.04em;
}

.card-pick-badge--tied {
  opacity: 0.6;
  border-style: dashed;
}

.identity-picks {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.06em;
  margin-left: 8px;
}

.pick-banner-roll {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.04em;
  margin-left: 12px;
  opacity: 0.8;
}
```

If the existing banner uses different class structure (e.g. `.pick-banner` parent, `.pick-banner-name` child), align the new `.pick-banner-roll` to live alongside as a sibling. Adjust the actual styling values only if visually obvious during Task 7.

- [ ] **Step 4: Verify build + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "style: winner/tied/rolled card classes + roll banner hint"
```

---

## Task 7: Manual smoke test in dev browser

**Files:** none modified

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Wait for "Ready in …" message. Note the port (usually `http://localhost:3000`).

- [ ] **Step 2: Open browser and unlock office**

Open `http://localhost:3000` in a private/incognito window. Click an office pin. Enter the office password. You should land on `/office/<id>`.

- [ ] **Step 3: Verify backwards compatibility with existing votes**

If there are pre-existing votes for today's date in Redis, they should render with each voter showing on exactly one restaurant card (their single legacy slug). Identity bar shows `[ 1 pick ]` if it's your name; otherwise no counter.

- [ ] **Step 4: Test multi-vote**

Enter a name in the identity bar (or use existing one). Click restaurant card A. The card highlights as picked, counter goes to `[ 1 pick ]`. Click restaurant card B without un-clicking A. Card B also highlights as picked. Counter goes to `[ 2 picks ]`. Both A and B show your name in their voter list.

- [ ] **Step 5: Test toggle off**

Click card A again. A unhighlights. Counter goes to `[ 1 pick ]`. Your name disappears from A's voter list but stays on B's.

- [ ] **Step 6: Test winner display (solo case)**

Make sure your picks tally so one restaurant has clearly more votes than others. Banner shows `>> <name> vyhráva  N hlasov · M hlasujúcich` — **no** `$ roll --tied=N` text. Card shows `[ WINNER ]` badge.

- [ ] **Step 7: Test tiebreak**

Create a tie: in a second incognito window with a different name, vote for a different restaurant so two restaurants have equal top counts. Banner shows the deterministically-chosen winner plus the `$ roll --tied=2` hint. The non-winning tied card shows `[ TIED ]` badge and dashed border. Refresh both windows — same winner appears in both (determinism).

- [ ] **Step 8: Test rename with multiple picks**

With 2+ picks, click `[ rename ]` in the identity bar. Enter a new name. After submit: counter still shows your pick count, both cards still show your new name in voter lists. Open Redis (if you have CLI) and confirm the new name has CSV value with both slugs; old name is gone.

- [ ] **Step 9: Stop dev server, commit nothing (no files changed)**

If you discovered any UI styling fixes that need additional CSS tweaks, apply them and amend the Task 6 commit (or create a follow-up commit `style: smoke-test fixes`).

---

## Verification Summary

After all tasks:
- 5 commits on `feature/mutiple-votes`: tiebreak, tally, server toggle, multi-vote client wiring, CSS
- `npm test` shows ~30 passing tests (18 original + tiebreak + tally)
- `npx tsc --noEmit` clean
- Manual flow: multi-vote works, tiebreak deterministic across clients, rename preserves picks
- No Redis migration needed; old single-slug entries render correctly

## Out of Scope (per spec)

- Roll animation (CSS dice rotation)
- Tooltip "Z 2 reštik si kocky vybrali túto" (basic `title` attribute is set; richer tooltip not built)
- Historical winner view
- Weighted tiebreak (least-recent-winner)
