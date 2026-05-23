import * as cheerio from 'cheerio';
import { pragueDayIndex } from '../prague-time';
import { fetchText, runScraper } from './run';
import type { MenuItem, ParseResult, Restaurant } from './types';

const NAME = 'Krušovická Chalupa';
const URL = 'https://krusovickachalupa.cz/menu/';
const CZECH_DAYS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

export function parseKrusovicka(html: string, dayIndex: number): ParseResult & { error: string | null } {
  const $ = cheerio.load(html);
  const todayCzech = CZECH_DAYS[dayIndex];

  const todayH6 = $('h6')
    .filter((_, el) => $(el).text().trim().startsWith(todayCzech))
    .first();

  if (!todayH6.length) {
    return { soup: null, items: [], error: `Sekce "${todayCzech}" nenalezena` };
  }

  let soup: string | null = null;
  let extra: string | null = null;
  const items: MenuItem[] = [];
  let tr = todayH6.closest('tr').next('tr');

  while (tr.length) {
    if (tr.find('h6').length) break;

    const tds = tr.find('td');
    if (tds.length < 3) break;

    const col0 = $(tds[0]).text().trim();
    const col1 = $(tds[1]).text().trim();
    const col2 = $(tds[2]).text().trim();
    const col3 = tds.length > 3 ? $(tds[3]).text().trim() : '';

    if (!col0 && !col1 && !col2 && !col3) break;

    if (!soup && /^\d+[.,]\d+l$/i.test(col1) && col2) {
      soup = col2;
    } else if (soup && !extra && !col0 && !col1 && col2 && !/Kč/i.test(col3)) {
      extra = col2;
    } else if (/^Menu\s*\d/i.test(col0) && col2) {
      const price = col3.match(/(\d+)\s*Kč/i);
      if (price) items.push({ name: col2, price: price[1] + ' Kč' });
    }

    tr = tr.next('tr');
  }

  return { soup, extra, items, error: null };
}

export function scrapeKrusovicka(): Promise<Restaurant> {
  return runScraper({
    name: NAME,
    url: URL,
    fetch: () => fetchText(URL),
    parse: (html) => {
      const r = parseKrusovicka(html, pragueDayIndex());
      if (r.error) throw new Error(r.error);
      return r;
    },
  });
}
