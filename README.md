# Menu Picker

Stránka s dnešným poludným menu z troch reštaurácií v okolí: Krušovická Chalupa, Restaurant Kandelábr a U Smrtáka. Menu sa scrapuje raz denne cez GitHub Action a ukladá do Vercel Blobu; Next.js appka číta JSON a renderuje ho.

🌐 https://menu-picker-three.vercel.app

## Architektúra

```
GitHub Action (cron 10:30 Po-Pia)
  → npm run scrape
  → scrapne 3 weby
  → uloží menu/latest.json + menu/YYYY-MM-DD.json do Vercel Blobu

Next.js app
  → fetchuje menu/latest.json (public URL)
  → renderuje (revalidate 5 min)
```

## Lokálny vývoj

```bash
npm install
vercel env pull .env.local --yes   # stiahne BLOB_READ_WRITE_TOKEN
npm run dev                         # http://localhost:3000
```

## Scripty

| Script | Čo robí |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Produkčný build |
| `npm run scrape` | Spustí scraping a uploadne JSON do Blobu |
| `npm test` | Vitest run |

## Manuálne spustenie scrape-u

**Lokálne** (prepíše Blob okamžite):
```bash
npm run scrape
```

**Cez GitHub Action** (beží z GitHub IP, simuluje reálny cron):
GitHub repo → **Actions** → „Scrape menus" → **Run workflow**.

## Troubleshooting

**Stránka ukazuje staré menu**
Appka kešuje JSON 5 min (`revalidate = 300` v `app/page.tsx`). Počkaj alebo cache-bust: `?cb=<timestamp>`.

**Reštaurácia má „fetch failed" / „HTTP 4xx"**
Scrape pre konkrétnu reštauráciu zlyhal — pravdepodobne dočasný problém na ich strane alebo blokácia IP. Skús znova `npm run scrape`. Ak to zlyháva opakovane, pozri logy v Actions tabe a uprav príslušný scraper v `lib/scrapers/`.

**`Vercel Blob: No blob credentials found`**
`.env.local` nemá `BLOB_READ_WRITE_TOKEN`. Spusti `vercel env pull .env.local --yes`. Ak je hodnota prázdna, na Verceli chýba premenná v *Development* env — pridaj cez dashboard alebo `vercel env add BLOB_READ_WRITE_TOKEN development`.

**Cron na GitHube nepustil scrape**
GitHub Actions cron beží v UTC a v repách s nízkou aktivitou ho GitHub niekedy oneskorí o pár minút (občas aj viac). Workflow vždy vieš spustiť manuálne (Actions → Run workflow).

**Pridanie novej reštaurácie**
1. Nový súbor v `lib/scrapers/` podľa vzoru existujúcich.
2. Pridať volanie do `Promise.all(...)` v `scripts/scrape.ts`.
3. Nasadiť + spustiť scrape.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, Vercel Blob, GitHub Actions, TypeScript, Vitest.
