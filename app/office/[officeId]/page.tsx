import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getMenus } from '@/lib/menu';
import { getOffice } from '@/lib/offices';
import { isOfficeUnlocked, lockOffice } from '@/lib/auth';
import { VotingApp } from '@/components/VotingApp';
import { MatrixRain } from '@/components/MatrixRain';
import { MatrixFooter } from '@/components/MatrixFooter';

export const dynamic = 'force-dynamic';

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
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(d);
}
function pragueHour(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: 'numeric', hour12: false });
  return Number(fmt.formatToParts(d).find(p => p.type === 'hour')?.value ?? 0);
}

export default async function OfficePage({
  params,
}: {
  params: Promise<{ officeId: string }>;
}) {
  const { officeId } = await params;
  const office = getOffice(officeId);
  if (!office) notFound();
  if (!(await isOfficeUnlocked(office.id))) redirect('/');

  const now = new Date();
  const date = pragueDate(now);
  const iso = pragueIsoDate(now);
  // MENU_DATE_OVERRIDE (dev-only opt-in via .env.local) implies we're previewing
  // a specific day's menu, so bypass the 09:00 gate as well.
  const menuReady = !!process.env.MENU_DATE_OVERRIDE || pragueHour(now) >= 9;

  const restaurants = menuReady ? await getMenus(office.id) : [];

  return (
    <>
      <MatrixRain />
      <div className="scanlines" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="page">
        <div className="page-topbar">
          <Link href="/" className="topbar-btn">← Mapa</Link>
          <span className="topbar-office">{office.name}</span>
          <form
            action={async () => {
              'use server';
              await lockOffice(office.id);
              redirect('/');
            }}
          >
            <button className="topbar-btn topbar-btn--lock" type="submit">Zamknout</button>
          </form>
        </div>

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
          <VotingApp restaurants={restaurants} officeId={office.id} />
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
