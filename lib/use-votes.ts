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
          const toggled = list.includes(restaurant)
            ? list.filter((s) => s !== restaurant)
            : [...list, restaurant];
          if (toggled.length === 0) delete next[name];
          else next[name] = toggled;
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
