import { isPragueWeekend } from '../prague-time';
import type { ParseResult, Restaurant } from './types';

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function runScraper(opts: {
  name: string;
  url: string;
  fetch: () => Promise<string>;
  parse: (html: string) => ParseResult;
}): Promise<Restaurant> {
  const base: Restaurant = {
    name: opts.name, url: opts.url,
    soup: null, extra: null, items: [], error: null,
  };

  if (isPragueWeekend()) {
    return { ...base, error: 'Víkend – polední menu nedostupné' };
  }

  try {
    const { soup, extra, items } = opts.parse(await opts.fetch());
    return { ...base, soup, extra: extra ?? null, items };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'Chyba scrapeingu' };
  }
}
