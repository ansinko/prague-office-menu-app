import { fetchText, runScraper } from './run';
import type { MenuItem, ParseResult, Restaurant } from './types';

const NAME = 'Restaurant Kandelábr';
const URL = 'https://www.restaurantkandelabr.cz/poledni-menu/';
const ENTITY_ID_FALLBACK = '16506739';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="120", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'iframe',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Upgrade-Insecure-Requests': '1',
};

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
    const html = await fetchText(URL, { headers: BROWSER_HEADERS });
    return html.match(/iframe[^>]*src="[^"]*zomato\.com[^"]*entity_id=(\d+)/)?.[1]
      ?? ENTITY_ID_FALLBACK;
  } catch {
    return ENTITY_ID_FALLBACK;
  }
}

export function scrapeKandelabr(): Promise<Restaurant> {
  return runScraper({
    name: NAME,
    url: URL,
    fetch: async () => {
      const entityId = await findEntityId();
      return fetchText(
        `https://www.zomato.com/cs/widgets/daily_menu.php?entity_id=${entityId}`,
        { headers: { ...BROWSER_HEADERS, Referer: URL } },
      );
    },
    parse: parseZomato,
  });
}
