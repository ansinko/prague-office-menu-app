import * as cheerio from 'cheerio';
import type { MenuItem, ParseResult, Restaurant } from './types';

const NAME = 'U Smrtáka';
const URL = 'https://usmrtaka.cz/jidelni-listek/';

export function parseUsmrtaka(html: string): ParseResult {
  const $ = cheerio.load(html);
  const lines = $('body')
    .text()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const soups: string[] = [];
  const items: MenuItem[] = [];
  let inDailySection = false;
  let inMenu = false;
  let menuCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^Denní nabídka/i.test(line)) { inDailySection = true; continue; }
    if (!inDailySection) continue;

    if (!inMenu) {
      const pm = line.match(/(\d+)\s*Kč/i);
      if (pm && line.length > 10 && !/^Menu\s*\d/i.test(line)) {
        soups.push(line.replace(/\(\d[,\d]*\)/g, '').replace(/\d+\s*Kč/i, '').trim());
      }
    }

    if (/^Menu\s*\d/i.test(line)) {
      inMenu = true;
      if (menuCount >= 4) break;

      const nameInline = line.replace(/^Menu\s*\d+[:\s.-]*/i, '').trim();
      if (nameInline.length <= 3) continue;

      const pm = nameInline.match(/(\d+)\s*Kč/i);
      if (pm) {
        const name = nameInline.replace(/\(\d[,\d]*\)/g, '').replace(/\d+\s*Kč/i, '').trim();
        if (name.length > 3) { items.push({ name, price: pm[1] + ' Kč' }); menuCount++; }
      } else {
        let full = nameInline;
        let j = i + 1;
        while (j < lines.length && j < i + 5) {
          const pm2 = lines[j].match(/(\d+)\s*Kč/i);
          if (pm2) {
            const name = (full + ' ' + lines[j])
              .replace(/\(\d[,\d]*\)/g, '')
              .replace(/\d+\s*Kč/i, '')
              .replace(/\(\d+g\)/gi, '')
              .trim();
            if (name.length > 3) { items.push({ name, price: pm2[1] + ' Kč' }); menuCount++; }
            i = j;
            break;
          }
          full += ' ' + lines[j++];
        }
      }
    }
  }

  return { soup: soups.length > 0 ? soups.join(' / ') : null, items };
}

export async function scrapeUsmrtaka(): Promise<Restaurant> {
  const result: Restaurant = { name: NAME, url: URL, soup: null, items: [], error: null };
  const day = new Date().getDay();

  if (day === 0 || day === 6) {
    return { ...result, error: 'Víkend – polední menu nedostupné' };
  }

  try {
    const res = await fetch(URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { soup, items } = parseUsmrtaka(await res.text());
    return { ...result, soup, items };
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : 'Chyba scrapeingu' };
  }
}
