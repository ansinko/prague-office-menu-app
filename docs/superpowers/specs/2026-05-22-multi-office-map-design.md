# Multi-office mapa + password gate — design

## Cieľ

Pred vstupom do denného menu zobraziť mapu Prahy s pinmi kancelárií. Hover nad
kanceláriou odhalí, kam sa z nej dá ísť na obed (reštaurácie + spojnice). Klik na
kanceláriu otvorí password modal; po zadaní správneho hesla sa kancelária odomkne
(denne) a používateľ uvidí jej menu + existujúcu hlasovaciu logiku.

Teraz je reálna jedna kancelária (**Mo-cha**) so 4 reštauráciami. Celá multi-office
logika sa stavia tak, aby pridanie ďalšej kancelárie bola len zmena configu — žiadne
nové scrapery v tomto kroku.

## Súčasný stav (východisko)

- Jedna implicitná kancelária, 4 reštaurácie: Krušovická Chalupa, Kandelábr,
  U Smrtáka (scrapované), U Sotonů (manuálne cez `/api/usotonu`).
- Menu v Vercel Blob (`menu/latest.json`, `usotonu.json`).
- Hlasy v Upstash Redis, kľúč `votes:YYYY-MM-DD`.
- `/` zobrazuje menu priamo, gate-nuté na 09:00 Prague.
- Žiadna SQL DB, žiadny bcrypt/jose.

## Architektúra

### Dátová vrstva — `lib/offices.ts`

Statický TS config je jediný zdroj pravdy pre kancelárie.

```ts
interface OfficeRestaurant {
  name: string;            // musí zodpovedať názvu z menu dát (kvôli slug matchu)
  coords: [number, number];
}

interface Office {
  id: string;              // "mocha"
  name: string;            // "Mo-cha"
  coords: [number, number];
  passwordHash: string;    // hex HMAC-SHA256(heslo, AUTH_SECRET)
  restaurants: OfficeRestaurant[];
}

export const OFFICES: Office[];
export function listOffices(): Office[];          // bez passwordHash do klienta
export function getOffice(id: string): Office | undefined;
```

Mo-cha hodnoty (súradnice z handoffu NEXTJS.md):

| Entita | Lat | Lng |
|---|---|---|
| Mo-cha (kancelária) | 50.05948178104082 | 14.429651742327714 |
| Krušovická Chalupa | 50.060470859502686 | 14.432690840274141 |
| Kandelábr | 50.05990557578166 | 14.429985525902246 |
| U Smrtáka | 50.060572239939226 | 14.427500574268853 |

U Sotonů — doplniť reálne súradnice (placeholder blízko Mo-cha, korigovať pri impl).

`listOffices()` vracia verejný tvar bez `passwordHash` (klient nikdy nevidí hash).

### Routing

```
/                      → MapScreen (server component)
/office/[officeId]     → existujúca menu+voting obrazovka, za gate-om
```

- `/` načíta `listOffices()` + odomknuté office ID z cookie, vyrenderuje mapu.
- `/office/[officeId]`: ak office neexistuje → `notFound()`; ak nie je odomknutá →
  `redirect("/")`. 09:00 Prague gate sa presúva sem (z `/`).
- Mapa sama o sebe nie je časovo gate-nutá; gate na 09:00 platí len pre menu.

### Password gate — `lib/auth.ts` (server actions)

Bez bcrypt, bez DB.

- **Overenie hesla**: `HMAC-SHA256(heslo, AUTH_SECRET)` cez Web Crypto
  (`crypto.subtle`), konštantné porovnanie hex výstupu s `office.passwordHash`.
  Heslo nikdy neopúšťa server.
- **Cookie** `menu-unlocked`: JWT (jose, HS256) s `{ ids: string[] }`, `httpOnly`,
  `sameSite: "lax"`, `secure` v produkcii, **expirácia o polnoci Prague** (denne —
  konzistentné s denným resetom hlasov; využije sa `secondsUntilPragueMidnight()`
  z `lib/redis.ts`).

```ts
getUnlockedOfficeIds(): Promise<string[]>
isOfficeUnlocked(officeId): Promise<boolean>
unlockOffice(officeId, password): Promise<{ ok: true } | { ok: false; error: "bad-password" }>
lockOffice(officeId): Promise<void>
```

Nová závislosť: `jose` (malá, edge-friendly). Nový env: `AUTH_SECRET`.

**Prečo tento variant:** plain cookie by umožnil sfalšovať odomknutie bez hesla
(podpis JWT to bráni). bcrypt je pomalý a zbytočný pre jedno zdieľané heslo na
kanceláriu; HMAC-SHA256 cez Web Crypto stačí a nepridáva native dep.

**Generovanie hashu:** malý skript / jednorázový snippet `node` ktorý vypíše
`HMAC-SHA256(heslo, AUTH_SECRET)` hex, výsledok sa vloží do `offices.ts`.

### Komponenty (port z design handoffu)

- **`PragueMap.tsx`** (client, `dynamic({ ssr: false })`) — Leaflet, port `map.jsx`
  prakticky 1:1. Init mapy, CartoDB dark tiles, zoom control, office piny +
  (pre odomknuté office) restaurant piny + spojnice. Hover na office pin odhalí
  jeho reštaurácie + čiary — použije sa **JS-driven `is-active` variant** z
  gotchas (nie literal `data-hover-office="mocha"` CSS), keďže offices je N.
- **`MapScreen.tsx`** (client wrapper) — drží `pwdFor` stav. Klik na pin:
  ak je office v `unlockedIds` → `router.push("/office/<id>")`, inak otvorí
  `PasswordModal`.
- **`PasswordModal.tsx`** — port z `menu.jsx`, submit cez `unlockOffice` server
  action v `useTransition`; pri úspechu `router.push`, pri chybe shake + error.
- **Štýly**: import `leaflet/dist/leaflet.css` v layoute; bloky
  `/* MAP SCREEN */`, `/* PASSWORD MODAL */`, `/* MENU VIEW TOPBAR */` z handoff
  `styles.css` do `app/globals.css` (využívajú existujúce tokeny `--accent`,
  `--bg`, `--card-bg`, `--hair`).

Nové závislosti: `leaflet` + `@types/leaflet`.

### Voting scoping (per-office)

Hlasy sa viažu na kanceláriu, aby sa Mo-cha hlasy nemiešali s budúcimi office.

- Redis kľúč: `votes:<officeId>:YYYY-MM-DD` (úprava `todayKey(officeId)` v
  `lib/redis.ts`).
- `/api/votes` — GET aj POST prijmú `officeId` (query param / telo), validujú že
  office existuje a že `restaurant` slug patrí do reštaurácií danej kancelárie.
- `useVotes(officeId)` — fetch/POST s officeId.
- `getMenus(officeId)` — vráti reštaurácie danej kancelárie. Pre Mo-cha vráti
  existujúce 4 (blob štruktúra zostáva); config určuje, ktoré reštaurácie patria
  kancelárii.
- `VotingApp` dostane `officeId` a posunie ho do `useVotes`.

### Topbar v menu obrazovke

`← Mapa` (router.push "/") + názov kancelárie + `Zamknout` (form → `lockOffice`
server action → redirect "/").

## Dátový tok

```
/  ──(server)──> listOffices() + cookie ids ──> MapScreen
                                                   │ klik pin
                          odomknuté? ──áno──> /office/[id]
                              │ nie
                         PasswordModal ──submit──> unlockOffice (server action)
                              │ ok                     │ set signed cookie
                              └──> router.push("/office/[id]")

/office/[id] ──(server)──> getOffice + isOfficeUnlocked + 09:00 gate
                              │
                       getMenus(id) ──> VotingApp(officeId)
                                            │
                                   useVotes(id) ⇄ /api/votes?office=id ⇄ Redis votes:id:date
```

## Error handling

- Nesprávne heslo → modal shake + error hláška, žiadny redirect.
- Neznáme office na `/office/[id]` → `notFound()`.
- Nezamknutá office → `redirect("/")`.
- Menu pred 09:00 → existujúca hláška „MENU SE ZOBRAZÍ OD 09:00".
- Leaflet sa nikdy nesmie SSR-ovať (`dynamic ssr:false`), inak runtime chyba.
- Votes API: neznámy office alebo reštaurácia mimo kancelárie → 400.

## Testovanie

- `lib/auth.ts`: HMAC hash overenie (správne/nesprávne heslo), podpis+verify
  cookie, expirácia.
- `lib/offices.ts`: `listOffices()` nevracia `passwordHash`; `getOffice`.
- `/api/votes`: validácia officeId + restaurant slug per office; per-office izolácia
  kľúčov.
- Manuálne v prehliadači: mapa, hover-reveal, password flow, redirect gate, voting
  v rámci office, topbar lock → späť na mapu.

## Mimo rozsah (YAGNI)

- Žiadne nové scrapery ani druhá reálna kancelária teraz.
- Žiadna SQL DB.
- Žiadny audit log hlasov, žiadne 30-dňové cookie, žiadna registrácia užívateľov.
```

