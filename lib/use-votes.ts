'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoteMap = Record<string, string>;

const POLL_MS = 10_000;

export function useVotes(officeId: string) {
  const [votes, setVotes] = useState<VoteMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
      const { votes: next } = (await res.json()) as { votes: VoteMap };
      setVotes(next);
      setError(null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [officeId]);

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
      const prev = votes;
      const next = { ...prev };
      if (restaurant === null) delete next[name];
      else next[name] = restaurant;
      setVotes(next);
      try {
        const res = await fetch('/api/votes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, restaurant, officeId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { votes: server } = (await res.json()) as { votes: VoteMap };
        setVotes(server);
        setError(null);
      } catch (e) {
        setVotes(prev);
        setError((e as Error).message);
      }
    },
    [votes, officeId],
  );

  return { votes, cast, loading, error, refresh: fetchVotes };
}
