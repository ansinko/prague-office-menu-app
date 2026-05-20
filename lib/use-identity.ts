'use client';

import { useCallback, useEffect, useState } from 'react';

const ME_KEY = 'menu-app:me';

export function useIdentity() {
  const [me, setMeState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ME_KEY);
      if (stored) setMeState(stored);
    } catch {}
    setReady(true);
  }, []);

  const setMe = useCallback((name: string | null) => {
    setMeState(name);
    try {
      if (name) localStorage.setItem(ME_KEY, name);
      else localStorage.removeItem(ME_KEY);
    } catch {}
  }, []);

  return { me, setMe, ready };
}
