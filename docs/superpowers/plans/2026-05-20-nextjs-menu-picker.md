# Next.js Menu Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Previesť CLI POC na Next.js webovú appku, ktorá scrapuje obedové menu zo 3 reštaurácií a zobrazuje ho na jednej stránke.

**Architecture:** Async Server Component (`app/page.tsx`) volá `getMenus()` priamo — žiadna API vrstva. Scraping beží na serveri pomocou `fetch` + `cheerio` (Playwright sa odstraňuje). Dáta sú cachované na celý deň pomocou `unstable_cache`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, cheerio, Vitest

---

## File Map

```
app/
  page.tsx              ← async Server Component, renderuje grid kariet
  layout.tsx            ← root layout, metadata
  globals.css           ← Tailwind directives
components/
  RestaurantCard.tsx    ← presentational karta reštaurácie
lib/
  scrapers/
    types.ts            ← Restaurant, MenuItem, ParseResult typy
    krusovicka.ts       ← parseKrusovicka() + scrapeKrusovicka()
    kandelabr.ts        ← parseZomato() + scrapeKandelabr()
    usmrtaka.ts         ← parseUsmrtaka() + scrapeUsmrtaka()
  menu.ts               ← getMenus() obalené v unstable_cache
__tests__/
  fixtures/
    krusovicka.html     ← fixture HTML pre testy
    kandelabr-zomato.html
    usmrtaka.html
  scrapers/
    krusovicka.test.ts
    kandelabr.test.ts
    usmrtaka.test.ts
vitest.config.ts
```

---

## Task 1: Pripraviť adresár a scaffoldovať Next.js projekt

**Files:**
- Delete: `package.json`, `package-lock.json`, `node_modules/`
- Create: Next.js project files

- [ ] **Step 1: Odstrániť starý POC závislosť**

```bash
rm -rf node_modules package.json package-lock.json
```

- [ ] **Step 2: Scaffoldovať Next.js projekt**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Pri prompte „The directory contains files that could conflict" zadaj `y`. Na ostatné otázky (TypeScript, ESLint, Tailwind, App Router) odpovedz `Yes` (alebo sú prednastavené flagmi).

- [ ] **Step 3: Overiť štruktúru**

```bash
ls -la
```

Očakávaný výstup: `app/`, `public/`, `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`.

- [ ] **Step 4: Odstrániť boilerplate obsah**

Nahraď `app/page.tsx` prázdnym placeholderom:

```tsx
export default function HomePage() {
  return <main>Loading...</main>;
}
```

Vymaž `app/globals.css` obsah okrem Tailwind direktív (ponechaj prvé 3 riadky):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project"
```

---

## Task 2: Pridať závislosti a nastaviť testovanie

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Nainštalovať cheerio a vitest**

```bash
npm install cheerio
npm install -D vitest
```

- [ ] **Step 2: Pridať test script do package.json**

V `package.json` pridaj do `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Vytvoriť vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 4: Overiť že vitest beží**

```bash
npm test
```

Očakávaný výstup: `No test files found` (žiadna chyba konfigurácie).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add cheerio and vitest"
```

---

## Task 3: Definovať typy

**Files:**
- Create: `lib/scrapers/types.ts`

- [ ] **Step 1: Vytvoriť types.ts**

```typescript
export interface MenuItem {
  name: string;
  price: string;
}

export interface Restaurant {
  name: string;
  url: string;
  soup: string | null;
  items: MenuItem[];
  error: string | null;
}

export interface ParseResult {
  soup: string | null;
  items: MenuItem[];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scrapers/types.ts
git commit -m "feat: add scraper types"
```

---

## Task 4: Krušovická Chalupa scraper (TDD)

**Files:**
- Create: `__tests__/fixtures/krusovicka.html`
- Create: `__tests__/scrapers/krusovicka.test.ts`
- Create: `lib/scrapers/krusovicka.ts`

Krušovická používa TablePress WordPress plugin. HTML štruktúra: `<table>` kde každý deň začína riadkom s `<h6>` obsahujúcim deň (napr. „Středa 20.5."). Nasledujúce riadky obsahujú polievku (col1 = objem napr. „0,33l") a menu položky (col0 = „Menu 1", col3 = cena „168 Kč").

- [ ] **Step 1: Vytvoriť fixture HTML**

```bash
mkdir -p __tests__/fixtures __tests__/scrapers
```

Súbor `__tests__/fixtures/krusovicka.html`:

```html
<!DOCTYPE html>
<html>
<body>
<table>
  <tr><td colspan="4"><h6>Pondělí 19.5.</h6></td></tr>
  <tr><td>Polévka</td><td>0,33l</td><td>Hovězí vývar</td><td></td></tr>
  <tr><td>Menu 1</td><td></td><td>Svíčková na smetaně</td><td>165 Kč</td></tr>
  <tr><td colspan="4"><h6>Středa 20.5.</h6></td></tr>
  <tr><td>Polévka</td><td>0,33l</td><td>Chalupářská</td><td></td></tr>
  <tr><td>Menu 1</td><td></td><td>Kuřecí závitek plněný šunkou</td><td>168 Kč</td></tr>
  <tr><td>Menu 2</td><td></td><td>Holandský řízek</td><td>179 Kč</td></tr>
  <tr><td colspan="4"><h6>Čtvrtek 21.5.</h6></td></tr>
  <tr><td>Polévka</td><td>0,33l</td><td>Rajská</td><td></td></tr>
</table>
</body>
</html>
```

- [ ] **Step 2: Napísať test (musí zlyhať)**

Súbor `__tests__/scrapers/krusovicka.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseKrusovicka } from '@/lib/scrapers/krusovicka';

const fixture = readFileSync(join(__dirname, '../fixtures/krusovicka.html'), 'utf-8');

describe('parseKrusovicka', () => {
  it('parses soup and menu items for the correct day', () => {
    const result = parseKrusovicka(fixture, 3); // 3 = Středa
    expect(result.error).toBeNull();
    expect(result.soup).toBe('Chalupářská');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ name: 'Kuřecí závitek plněný šunkou', price: '168 Kč' });
    expect(result.items[1]).toEqual({ name: 'Holandský řízek', price: '179 Kč' });
  });

  it('does not include items from adjacent days', () => {
    const result = parseKrusovicka(fixture, 3);
    const hasMonday = result.items.some(i => i.name.includes('Svíčková'));
    expect(hasMonday).toBe(false);
  });

  it('returns error when day section is not found', () => {
    const result = parseKrusovicka(fixture, 5); // 5 = Pátek, nie je vo fixture
    expect(result.error).toContain('nenalezena');
    expect(result.items).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Spustiť test — musí zlyhať**

```bash
npm test
```

Očakávaný výstup: `Cannot find module '@/lib/scrapers/krusovicka'`

- [ ] **Step 4: Implementovať scraper**

Súbor `lib/scrapers/krusovicka.ts`:

```typescript
import * as cheerio from 'cheerio';
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
    } else if (/^Menu\s*\d/i.test(col0) && col2) {
      const price = col3.match(/(\d+)\s*Kč/i);
      if (price) items.push({ name: col2, price: price[1] + ' Kč' });
    }

    tr = tr.next('tr');
  }

  return { soup, items, error: null };
}

export async function scrapeKrusovicka(): Promise<Restaurant> {
  const result: Restaurant = { name: NAME, url: URL, soup: null, items: [], error: null };
  const dayIndex = new Date().getDay();

  if (dayIndex === 0 || dayIndex === 6) {
    return { ...result, error: 'Víkend – polední menu nedostupné' };
  }

  try {
    const res = await fetch(URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { soup, items, error } = parseKrusovicka(await res.text(), dayIndex);
    return { ...result, soup, items, error };
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : 'Chyba scrapeingu' };
  }
}
```

- [ ] **Step 5: Spustiť test — musí prejsť**

```bash
npm test
```

Očakávaný výstup: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add __tests__/fixtures/krusovicka.html __tests__/scrapers/krusovicka.test.ts lib/scrapers/krusovicka.ts
git commit -m "feat: add Krusovicka scraper with tests"
```

---

## Task 5: Kandelábr scraper (TDD)

**Files:**
- Create: `__tests__/fixtures/kandelabr-zomato.html`
- Create: `__tests__/scrapers/kandelabr.test.ts`
- Create: `lib/scrapers/kandelabr.ts`

Kandelábr zobrazuje menu cez Zomato widget (iframe). Logika: fetch stránky → nájdi entity_id v iframe src (alebo fallback) → fetch Zomato widget HTML → regex parsing.

- [ ] **Step 1: Vytvoriť fixture HTML**

Súbor `__tests__/fixtures/kandelabr-zomato.html`:

```html
<div class="date inner-layer">pondělí 19. května</div>
<div class="left-div item-name">POLÉVKA - HOVĚZÍ VÝVAR</div>
<div class="right-div item-price">zdarma</div>
<div class="left-div item-name">1. SVÍČKOVÁ NA SMETANĚ /1,3/</div>
<div class="right-div item-price">185 Kč</div>
<div class="date inner-layer">středa 21. května (Dnes)</div>
<div class="left-div item-name">POLÉVKA - ZELNÁ S PAPRIKOVOU KLOBÁSOU</div>
<div class="right-div item-price">zdarma</div>
<div class="left-div item-name">1. HOVĚZÍ KOSTKY NA ČESNEKU, BRAMBOROVÉ KNEDLÍKY /1,3/</div>
<div class="right-div item-price">195 Kč</div>
<div class="left-div item-name">2. SMAŽENÁ TILÁPIE V BYLINKOVÉM TĚSTÍČKU</div>
<div class="right-div item-price">195 Kč</div>
<div class="left-div item-name">3. GRILOVANÝ HERMELÍN, PEČENÉ GRENAILLE</div>
<div class="right-div item-price">175 Kč</div>
```

- [ ] **Step 2: Napísať test (musí zlyhať)**

Súbor `__tests__/scrapers/kandelabr.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseZomato } from '@/lib/scrapers/kandelabr';

const fixture = readFileSync(join(__dirname, '../fixtures/kandelabr-zomato.html'), 'utf-8');

describe('parseZomato', () => {
  it('parses today\'s section marked with (Dnes)', () => {
    const result = parseZomato(fixture);
    expect(result.soup).toBe('ZELNÁ S PAPRIKOVOU KLOBÁSOU');
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({ name: 'HOVĚZÍ KOSTKY NA ČESNEKU, BRAMBOROVÉ KNEDLÍKY', price: '195 Kč' });
  });

  it('does not include items from other days', () => {
    const result = parseZomato(fixture);
    const hasMonday = result.items.some(i => i.name.includes('SVÍČKOVÁ'));
    expect(hasMonday).toBe(false);
  });

  it('strips numbering prefix from item names', () => {
    const result = parseZomato(fixture);
    expect(result.items[0].name).not.toMatch(/^1\./);
  });

  it('excludes items without Kč price', () => {
    const result = parseZomato(fixture);
    const withZdarma = result.items.some(i => i.price === 'zdarma');
    expect(withZdarma).toBe(false);
  });
});
```

- [ ] **Step 3: Spustiť test — musí zlyhať**

```bash
npm test
```

Očakávaný výstup: `Cannot find module '@/lib/scrapers/kandelabr'`

- [ ] **Step 4: Implementovať scraper**

Súbor `lib/scrapers/kandelabr.ts`:

```typescript
import type { MenuItem, ParseResult, Restaurant } from './types';

const NAME = 'Restaurant Kandelábr';
const URL = 'https://www.restaurantkandelabr.cz/poledni-menu/';
const ENTITY_ID_FALLBACK = '16506739';

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
    const res = await fetch(URL, { cache: 'no-store' });
    const html = await res.text();
    return html.match(/iframe[^>]*src="[^"]*zomato\.com[^"]*entity_id=(\d+)/)?.[1]
      ?? ENTITY_ID_FALLBACK;
  } catch {
    return ENTITY_ID_FALLBACK;
  }
}

export async function scrapeKandelabr(): Promise<Restaurant> {
  const result: Restaurant = { name: NAME, url: URL, soup: null, items: [], error: null };
  const day = new Date().getDay();

  if (day === 0 || day === 6) {
    return { ...result, error: 'Víkend – polední menu nedostupné' };
  }

  try {
    const entityId = await findEntityId();
    const res = await fetch(
      `https://www.zomato.com/cs/widgets/daily_menu.php?entity_id=${entityId}`,
      { headers: { Referer: URL }, cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { soup, items } = parseZomato(await res.text());
    return { ...result, soup, items };
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : 'Chyba scrapeingu' };
  }
}
```

- [ ] **Step 5: Spustiť test — musí prejsť**

```bash
npm test
```

Očakávaný výstup: `7 passed`

- [ ] **Step 6: Commit**

```bash
git add __tests__/fixtures/kandelabr-zomato.html __tests__/scrapers/kandelabr.test.ts lib/scrapers/kandelabr.ts
git commit -m "feat: add Kandelabr scraper with tests"
```

---

## Task 6: U Smrtáka scraper (TDD)

**Files:**
- Create: `__tests__/fixtures/usmrtaka.html`
- Create: `__tests__/scrapers/usmrtaka.test.ts`
- Create: `lib/scrapers/usmrtaka.ts`

U Smrtáka má text-based parsing. Hľadá sekciu „Denní nabídka", potom nachádzá polievky (riadky s cenou pred prvým „Menu N:") a menu položky.

- [ ] **Step 1: Vytvoriť fixture HTML**

Súbor `__tests__/fixtures/usmrtaka.html`:

```html
<!DOCTYPE html>
<html>
<body>
<div class="content">
<p>Denní nabídka</p>
<p>Kuřecí vývar s nudličkami / Bramboračka 55 Kč</p>
<p>Menu 1: Vepřové nudličky stroganof, hranolky (1,7,10) 193 Kč</p>
<p>Menu 2: Krůtí játra restovaná na cibulce, rýže (1) 193 Kč</p>
<p>Menu 3: Kuřecí řízek, bramborový salát (1,3,7,10) 179 Kč</p>
<p>Menu 4: Smažený sýr, tatarská omáčka, hranolky (1,3,7,10) 169 Kč</p>
<p>Menu 5: Tento by sa nemal zobraziť 155 Kč</p>
</div>
</body>
</html>
```

- [ ] **Step 2: Napísať test (musí zlyhať)**

Súbor `__tests__/scrapers/usmrtaka.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseUsmrtaka } from '@/lib/scrapers/usmrtaka';

const fixture = readFileSync(join(__dirname, '../fixtures/usmrtaka.html'), 'utf-8');

describe('parseUsmrtaka', () => {
  it('parses soup from priced lines before Menu items', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.soup).toBe('Kuřecí vývar s nudličkami / Bramboračka');
  });

  it('parses up to 4 menu items', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.items).toHaveLength(4);
  });

  it('strips allergen codes from item names', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.items[0].name).not.toContain('(1,7,10)');
  });

  it('parses price correctly', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.items[0]).toEqual({ name: 'Vepřové nudličky stroganof, hranolky', price: '193 Kč' });
  });
});
```

- [ ] **Step 3: Spustiť test — musí zlyhať**

```bash
npm test
```

Očakávaný výstup: `Cannot find module '@/lib/scrapers/usmrtaka'`

- [ ] **Step 4: Implementovať scraper**

Súbor `lib/scrapers/usmrtaka.ts`:

```typescript
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

    if (inDailySection && !inMenu) {
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
```

- [ ] **Step 5: Spustiť test — musí prejsť**

```bash
npm test
```

Očakávaný výstup: `11 passed`

- [ ] **Step 6: Commit**

```bash
git add __tests__/fixtures/usmrtaka.html __tests__/scrapers/usmrtaka.test.ts lib/scrapers/usmrtaka.ts
git commit -m "feat: add U Smrtaka scraper with tests"
```

---

## Task 7: getMenus() s cacheovaním

**Files:**
- Create: `lib/menu.ts`

- [ ] **Step 1: Vytvoriť menu.ts**

```typescript
import { unstable_cache } from 'next/cache';
import { scrapeKrusovicka } from './scrapers/krusovicka';
import { scrapeKandelabr } from './scrapers/kandelabr';
import { scrapeUsmrtaka } from './scrapers/usmrtaka';

function secondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

const todayKey = new Date().toISOString().slice(0, 10); // "2026-05-20"

export const getMenus = unstable_cache(
  () => Promise.all([scrapeKrusovicka(), scrapeKandelabr(), scrapeUsmrtaka()]),
  ['menus', todayKey],
  { revalidate: secondsUntilMidnight() },
);
```

- [ ] **Step 2: Commit**

```bash
git add lib/menu.ts
git commit -m "feat: add getMenus with daily cache"
```

---

## Task 8: RestaurantCard komponent

**Files:**
- Create: `components/RestaurantCard.tsx`

- [ ] **Step 1: Vytvoriť komponent**

```tsx
import type { Restaurant } from '@/lib/scrapers/types';

export function RestaurantCard({ restaurant: r }: { restaurant: Restaurant }) {
  const isError = !!r.error && r.items.length === 0;

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm${isError ? ' opacity-55' : ''}`}>
      <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
        <h2 className="font-bold text-base">{r.name}</h2>
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          web ↗
        </a>
      </div>

      {r.soup && (
        <div className="bg-amber-50 border-l-[3px] border-amber-400 px-3 py-2 mb-3 rounded-r-md text-sm">
          <span className="font-semibold text-amber-900 mr-1">Polévka</span>
          {r.soup}
        </div>
      )}

      {r.items.length > 0 ? (
        <div className="flex flex-col divide-y divide-gray-50">
          {r.items.map((item, i) => (
            <div key={i} className="flex justify-between items-baseline gap-3 py-2 text-sm">
              <span className="flex-1 leading-snug">{item.name}</span>
              <span className="font-bold text-green-600 whitespace-nowrap">{item.price}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-3">
          {r.error ?? 'Žádné položky k dispozici'}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RestaurantCard.tsx
git commit -m "feat: add RestaurantCard component"
```

---

## Task 9: page.tsx a layout.tsx

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Aktualizovať layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Menu Picker',
  description: 'Dnešní obědové menu z okolních restaurací',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Aktualizovať page.tsx**

```tsx
import { getMenus } from '@/lib/menu';
import { RestaurantCard } from '@/components/RestaurantCard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const restaurants = await getMenus();

  const dateStr = new Date().toLocaleDateString('cs-CZ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Dnešní obědy</h1>
        <p className="text-gray-500 mt-1 text-sm capitalize">{dateStr}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {restaurants.map((r) => (
          <RestaurantCard key={r.name} restaurant={r} />
        ))}
      </div>

      <footer className="text-center mt-8 text-gray-300 text-xs">
        Načteno {new Date().toLocaleTimeString('cs-CZ')}
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: implement main page with restaurant grid"
```

---

## Task 10: Spustiť a overiť

- [ ] **Step 1: Spustiť všetky testy**

```bash
npm test
```

Očakávaný výstup: `11 passed, 0 failed`

- [ ] **Step 2: Spustiť dev server**

```bash
npm run dev
```

Otvor http://localhost:3000 v prehliadači. Overiť:
- Zobrazia sa 3 karty reštaurácií
- Každá karta má názov, link na web, polievku a menu položky s cenami
- Chybná reštaurácia (ak network chyba) zobrazí chybový text s nižšou opacitou
- Layout je responzívny (1/2/3 stĺpce podľa šírky)

- [ ] **Step 3: Odstrániť starý POC kód (voliteľné)**

```bash
rm -f index.js menu.html
rm -rf lib/scrapers/krusovicka.js lib/scrapers/kandelabr.js lib/scrapers/usmrtaka.js
rm -f lib/render.js lib/utils.js lib/http.js
rmdir lib/scrapers lib 2>/dev/null || true
```

- [ ] **Step 4: Finálny commit**

```bash
git add -A
git commit -m "chore: remove old POC files"
```
