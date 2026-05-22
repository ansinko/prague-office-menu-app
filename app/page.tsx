import { getMenus } from '@/lib/menu';
import { VotingApp } from '@/components/VotingApp';
import { MatrixRain } from '@/components/MatrixRain';
import { MatrixFooter } from '@/components/MatrixFooter';

export const revalidate = 300;


function pragueDate(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('cs-CZ', {
      timeZone: 'Europe/Prague',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).formatToParts(d).map(p => [p.type, p.value])
  );
  return `${parts.weekday} ${parts.day}. ${parts.month} ${parts.year}`;
}
function pragueIsoDate(d: Date) {
  const s = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(d);
  return s; // returns "YYYY-MM-DD"
}
function pragueHour(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: 'numeric', hour12: false });
  return Number(fmt.formatToParts(d).find(p => p.type === 'hour')?.value ?? 0);
}

export default async function HomePage() {
  const now = new Date();
  const date = pragueDate(now);
  const iso = pragueIsoDate(now);
  const hour = pragueHour(now);
  const menuReady = hour >= 9;

  const restaurants = menuReady ? await getMenus() : [];

  return (
    <>
      <MatrixRain />
      <div className="scanlines" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="page">
        <header className="page-head">
        <div className="term-line">
          <span>$ cat /menu/{iso}.json | render</span>
          <span className="term-line-status">[OK 200]</span>
        </div>
        <h1 className="page-title">
          <span className="glitch" data-text="Dnešní obědy">Dnešní obědy</span>
          <span className="caret" aria-hidden="true" />
        </h1>
        <div className="page-date">&gt;&gt;&gt; {date.toUpperCase()}</div>
      </header>

      {menuReady ? (
        <VotingApp restaurants={restaurants} />
      ) : (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 14, padding: '48px 0', letterSpacing: '0.08em' }}>
          &gt; MENU SE ZOBRAZÍ OD 09:00 _
        </p>
      )}

        <MatrixFooter />
      </div>
    </>
  );
}
