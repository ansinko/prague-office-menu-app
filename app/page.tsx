import { getMenus } from '@/lib/menu';
import { RestaurantCard } from '@/components/RestaurantCard';
import { MatrixRain } from '@/components/MatrixRain';
import { MatrixFooter } from '@/components/MatrixFooter';

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const MONTHS = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

function czechDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default async function HomePage() {
  const restaurants = await getMenus();
  const now = new Date();
  const date = czechDate(now);
  const iso = isoDate(now);

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

      <main className="grid">
        {restaurants.map((r) => (
          <RestaurantCard key={r.name} restaurant={r} />
        ))}
      </main>

        <MatrixFooter />
      </div>
    </>
  );
}
