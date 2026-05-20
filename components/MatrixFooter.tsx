'use client';

import { useEffect, useState } from 'react';

function pad(n: number) { return String(n).padStart(2, '0'); }

export function MatrixFooter() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : '--:--:--';

  return (
    <footer className="page-foot">
      <span className="foot-dot" aria-hidden="true" />
      <span>[ LOADED @ <span style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span> ] — wake up, Neo…</span>
    </footer>
  );
}
