# Menu Picker

Stránka s dnešným poludným menu z reštaurácií v okolí office-u. Užívatelia hlasujú za výber, výsledok sa zdieľa cez Redis. Podpora viacerých office-ov, každý zamknutý vlastným heslom.

🌐 https://menu-picker-three.vercel.app

Aktuálne office-y a ich reštaurácie sú v [`lib/offices.ts`](lib/offices.ts):
- **innovis (Mocha)** — Krušovická Chalupa, Restaurant Kandelábr, U Smrtáka, U Sotonů

## Architektúra

```
Vercel cron (06:55 UTC, Po-Pia)
  → GET /api/scrape (Bearer CRON_SECRET)
  → scrape 3 webov paralelne
  → scrape U Sotonů z verejnej Facebook fotky + Gemini OCR
  → put → menu/latest.json + menu/YYYY-MM-DD.json (Vercel Blob)
  → put → usotonu.json pri úspešnom OCR (Vercel Blob)
  → revalidateTag('menu', 'max')

GitHub Action (07:00 UTC, Po-Pia) — záložný cron
  → npm run scrape (rovnaký výstup do Blobu, bez revalidate tagu)

Next.js app
  → GET / → mapa office-ov (klikni → zadaj heslo)
  → GET /office/[id] → SSR cez getMenus()
       fetch blobu s next.tags=['menu'], revalidate 300s
  → voting cez /api/votes (Upstash Redis, polling 10s)
```

Prague čas, dátum a víkend gate sú v jednom helperi: [`lib/prague-time.ts`](lib/prague-time.ts). Scrapery sú tenké okolo [`runScraper`](lib/scrapers/run.ts) — exportujú parsovaciu funkciu + config.
U Sotonů je špeciálny prípad: menu publikujú ako fotku na Facebooku, preto [`lib/scrapers/usotonu-facebook.ts`](lib/scrapers/usotonu-facebook.ts) hľadá verejný obrázok a cez Gemini ho prevádza na rovnaký JSON tvar. Ak Facebook alebo OCR zlyhá, `usotonu.json` sa neprepíše a appka nechá posledné dobré menu.

## Lokálny vývoj

```bash
npm install
vercel env pull .env.local --yes   # BLOB_READ_WRITE_TOKEN, KV_REST_*, AUTH_SECRET, CRON_SECRET, GEMINI_API_KEY
npm run dev                         # http://localhost:3000
```

Pre náhľad konkrétneho dňa mimo scrape hodín:
```bash
# .env.local
MENU_DATE_OVERRIDE=2025-05-23
```

## Scripty

| Script | Čo robí |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Produkčný build |
| `npm run scrape` | Spustí scraping a uploadne JSON do Blobu (cez `scripts/scrape.ts`) |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

## Manuálne spustenie scrape-u

**Lokálne** (prepíše Blob, ale neinvaliduje Next cache):
```bash
npm run scrape
```

**Cez `/api/scrape` na Verceli** (rovnaké ako prod cron — aj invaliduje cache tag):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://menu-picker-three.vercel.app/api/scrape
```

**Cez GitHub Action** (záloha keby Vercel cron neprešiel):
GitHub repo → **Actions** → „Scrape menus" → **Run workflow**.

## Pridanie reštaurácie do office-u

1. Pridať pin do `lib/offices.ts` (`restaurants: [{ name, coords }]`).
2. Ak ide o novú reštauráciu (nie len pin do iného office-u):
   - Nový scraper v `lib/scrapers/*.ts` podľa vzoru (parsing fn + `runScraper` wrapper).
   - Registrovať volanie v `app/api/scrape/route.ts` (`Promise.all`) **a** v `scripts/scrape.ts`.
   - Pridať fallback do `lib/menu.ts` (`emptyRestaurant(...)`).
3. `name` v `OFFICES` musí presne zodpovedať `name` ktorý vracia scraper — `getMenus` matchuje stringom.

## Pridanie office-u

Stačí entry v `OFFICES` v `lib/offices.ts` — `id`, `name`, `coords`, `passwordHash`, zoznam reštaurácií. Hash hesla:
```bash
node -e "console.log(require('crypto').createHmac('sha256', process.env.AUTH_SECRET).update('HESLO').digest('hex'))"
```

## Troubleshooting

**Stránka ukazuje staré menu**
Next kešuje menu blob 300s s tagom `menu`. Cron route po uspešnom scrape invaliduje tag. Ak si scrape pustil cez `npm run scrape` (lokálne / GitHub Action), tag sa neinvaliduje — počkaj 5 min alebo zavolaj `/api/scrape`.

**Reštaurácia má „fetch failed" / „HTTP 4xx"**
Scrape jednej reštaurácie zlyhal — dočasný problém / blok. Skús znova. Ak opakovane, pozri logy a uprav scraper.

**U Sotonů sa neaktualizovalo**
Automatika berie poslednú verejnú Facebook fotku a posiela ju do Gemini. Ak Facebook skryje obsah, zmení HTML, vráti nerelevantný obrázok alebo chýba `GEMINI_API_KEY`, scrape vypíše chybu v `usotonu` diagnostike a neprepíše posledné dobré `usotonu.json`. Voliteľne môžeš zmeniť zdroj cez `USOTONU_FACEBOOK_URL`.

**`Vercel Blob: No blob credentials found`**
`.env.local` nemá `BLOB_READ_WRITE_TOKEN`. Spusti `vercel env pull .env.local --yes`.

**`AUTH_SECRET is not set` po unlocku**
Chýba `AUTH_SECRET` v env (používa sa na podpis cookie a hash hesla).

**Cron na GitHube nepustil scrape**
GitHub cron beží v UTC a pri nízkej aktivite ho GitHub občas oneskorí. Vercel cron je primárny, GitHub je záloha. Workflow vždy vieš spustiť manuálne.

## Stack

Next.js 16 (App Router, Cache Components fetch tags), React 19, TypeScript, Tailwind 4, Vercel Blob, Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`), Leaflet (mapa), jose (HS256 JWT v cookie), GitHub Actions + Vercel cron, Vitest.
