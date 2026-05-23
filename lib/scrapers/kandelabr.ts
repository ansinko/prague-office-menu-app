import { isPragueWeekend } from '../prague-time';
import type { MenuItem, ParseResult, Restaurant } from './types';

const NAME = 'Restaurant Kandelábr';
const URL = 'https://www.restaurantkandelabr.cz/poledni-menu/';
const ENTITY_ID_FALLBACK = '16506739';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function parseZomato(html: string): ParseResult {
  const todayMatch = html.match(
    /class="date inner-layer">[^<]*\(Dnes\)[^<]*<\/div>([\s\S]*?)(?=class="date inner-layer"|$)/,
  );
  const section = todayMatch ? todayMatch[1] : html;

  const names: string[] = [];
  const prices: string[] = [];
  const nameRe = /class\s*=\s*"left-div item-name">([\s\S]*?)<\/div>/g;
  const priceRe = /class="right-div item-price">([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;

  while ((m = nameRe.exec(section)) !== null)
    names.push(m[1].replace(/\/\d[,\d]*\//g, '').replace(/\s+/g, ' ').trim());
  while ((m = priceRe.exec(section)) !== null)
    prices.push(m[1].replace(/\s+/g, ' ').trim());

  let soup: string | null = null;
  const items: MenuItem[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const price = prices[i] ?? '';
    if (!name || name.length < 4) continue;

    if (/^POLÉVKA/i.test(name)) {
      if (!soup) soup = name.replace(/^POLÉVKA\s*[-–]\s*/i, '');
      continue;
    }
    if (!price.match(/\d+\s*Kč/i)) continue;

    items.push({
      name: name.replace(/^\d+\.\s*/, '').replace(/^\d+G\s+/i, '').trim(),
      price,
    });
  }

  return { soup, items };
}

async function findEntityId(): Promise<string> {
  try {
    const res = await fetch(URL, { cache: 'no-store', headers: { 'User-Agent': UA } });
    const html = await res.text();
    return html.match(/iframe[^>]*src="[^"]*zomato\.com[^"]*entity_id=(\d+)/)?.[1]
      ?? ENTITY_ID_FALLBACK;
  } catch {
    return ENTITY_ID_FALLBACK;
  }
}

export async function scrapeKandelabr(): Promise<Restaurant> {
  const result: Restaurant = { name: NAME, url: URL, soup: null, extra: null, items: [], error: null };

  if (isPragueWeekend()) {
    return { ...result, error: 'Víkend – polední menu nedostupné' };
  }

  try {
    const entityId = await findEntityId();
    const res = await fetch(
      `https://www.zomato.com/cs/widgets/daily_menu.php?entity_id=${entityId}`,
      { headers: { Referer: URL, 'User-Agent': UA }, cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { soup, items } = parseZomato(await res.text());
    return { ...result, soup, items };
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : 'Chyba scrapeingu' };
  }
}
