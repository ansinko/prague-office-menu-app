# Next.js Menu Picker – Design Spec

**Date:** 2026-05-20

## Overview

Prevod existujúceho CLI POC-u na Next.js webovú appku. Appka scrapuje obedové menu z 3 pražských reštaurácií a zobrazuje ho na jednej stránke. Nasadenie lokálne.

## Architecture

Prístup: **Server Component + priame scrapovanie s `unstable_cache`**.

```
app/
  page.tsx              ← async Server Component, volá getMenus()
  layout.tsx            ← root layout s Tailwind
  globals.css
lib/
  scrapers/
    krusovicka.ts
    kandelabr.ts
    usmrtaka.ts
    types.ts            ← Restaurant, MenuItem typy
  menu.ts               ← getMenus() obalené v unstable_cache
```

Žiadne API routes. Stránka sa renderuje kompletne na serveri. Žiadny client-side JS.

## Data Flow

```
page.tsx
  └─ getMenus()           ← Promise.all, cached na celý deň
       ├─ scrapeKrusovicka()   fetch → cheerio → Restaurant
       ├─ scrapeKandelabr()    fetch Zomato widget → regex → Restaurant
       └─ scrapeUsmrtaka()     fetch → cheerio/text → Restaurant
  └─ <RestaurantCard />    ← presentational komponent
```

### Shared type

```ts
interface MenuItem { name: string; price: string }
interface Restaurant {
  name: string;
  url: string;
  soup: string | null;
  items: MenuItem[];
  error: string | null;
}
```

### Caching

`getMenus()` je obalená v `unstable_cache` s `revalidate` nastaveným na čas do polnoci aktuálneho dňa (v sekundách). Cache key obsahuje dnešný dátum, takže nový deň automaticky invaliduje cache.

## Scrapers

Playwright sa odstraňuje. Všetky scrapers používajú `fetch` + `cheerio` (alebo regex pre Kandelábr, ktorý má HTML bez DOM závislostí).

| Reštaurácia | Zdroj | Parser |
|---|---|---|
| Krušovická Chalupa | `krusovickachalupa.cz/menu/` | cheerio – TablePress tabuľka |
| Kandelábr | Zomato widget (entity ID z kandelabr.cz alebo fallback) | regex – existujúca logika z POC |
| U Smrtáka | `usmrtaka.cz/jidelni-listek/` | cheerio – text parsing |

Každý scraper vracia `Restaurant`. Pri víkende alebo chybe nastaví `error`, `items` zostane `[]`.

## Components

- **`page.tsx`** – volá `getMenus()`, renderuje header s dnešným dátumom a grid kariet
- **`RestaurantCard`** – dostáva `Restaurant` prop, zobrazuje polievku, položky, ceny; pri chybe/víkende zobrazí chybovú hlášku s nižšou opacitou

## Styling

Tailwind CSS. Rovnaké vizuálne rozloženie ako POC HTML:
- Tmavé pozadie (`bg-gray-100`), biele karty s tieňom
- Žltá ľavá linka pre polievku
- Zelená cena
- Responzívny grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)

## Dependencies

```json
{
  "next": "latest",
  "react": "latest",
  "react-dom": "latest",
  "cheerio": "latest",
  "tailwindcss": "latest"
}
```

Playwright sa odstraňuje z `dependencies`.

## Error Handling

- Každý scraper má `try/catch` – chyba sa uloží do `restaurant.error`, appka nespadne
- Ak všetky 3 scrapers zlyhajú, stránka stále zobrazí 3 chybové karty
- Víkend: každý scraper vráti `error: 'Víkend – polední menu nedostupné'`
