# Approval voting + náhodný tiebreaker — design

## Cieľ

Rozšíriť hlasovanie tak, aby používateľ mohol odkliknúť **viacero** reštaurácií
(approval voting) a aby sa **remízy automaticky rozsekli** deterministickým
náhodným výberom, bez nutnosti manuálneho zásahu.

Súčasné správanie: jeden hlas per voter (Redis HSET `voter → slug`). Pri zhode
hlasov sa zobrazí `[ TIE ]` badge; rozhodnutie spravia ľudia v reáli ("poďme
do X"). Tým že hlasov v small office býva 4–8, remízy nie sú zriedkavé.

Nový stav: voter môže pridať/odobrať ľubovoľný počet reštik (`{0..N}`). Víťaz
= reštaurácia s najvyšším súčtom kliknutí. Pri remíze deterministicky seeded
hash vyberie jednu z remízových reštik podľa Prague dátumu, takže všetci
používatelia naprieč zariadeniami a polling-cyklami vidia ten istý výber.

## Súčasný stav (východisko)

- `VoteMap = Record<string, string>` — voter mapuje na jeden slug
- `app/api/votes/route.ts` POST: `{officeId, name, restaurant}` má **replace**
  semantiku; `restaurant: null` zmaže
- `app/api/votes/route.ts` rename: pipeline HGET + HSET + HDEL (atomické)
- `components/VotingApp.tsx` derivuje `leaderSlugs: string[]`,
  `leaderNames: string[]`; banner ukazuje všetky pri remíze
- `components/RestaurantCard.tsx` má `picked = votes[me] === slug` (boolean)
- `components/PickBanner.tsx` ukazuje `[ TIE ]` keď `leaders.length > 1`

## Architektúra

### Dátová vrstva — Redis

Hash štruktúra ostáva (`votes:{officeId}:{pragueIsoDate}`), len **value** sa
zmení zo single slug na **CSV slugov**:

```
Pred: HSET key Andrej "krusovicka"
Po:   HSET key Andrej "krusovicka,kandelabr"
```

**Backwards-compatible:** existujúci `"krusovicka"` sa parsne ako 1-prvkové
pole `["krusovicka"]` cez `csv.split(',').filter(Boolean)`. Žiadna migrácia.

**Slug safety:** `slugify()` produkuje len `[a-z0-9_]+` (testované), čiarka je
bezpečný separator.

### Algoritmus — `lib/tiebreak.ts` (nový)

```ts
export function pickFromTied(tiedSlugs: string[], dateKey: string): string {
  const sorted = [...tiedSlugs].sort();
  const seed = `${dateKey}|${sorted.join('|')}`;
  let hash = 2166136261;          // FNV-1a 32-bit
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return sorted[Math.abs(hash) % sorted.length];
}
```

**Vlastnosti:**
- Pure function, deterministická
- Vstupy normalizované sortom → poradie remízových slugov nehrá rolu
- Date-keyed seed → keď zmeníš deň, výsledok môže byť iný (Krušovická vs
  Kandelábr remíza dnes vyhrá Krušovická; rovnaká remíza zajtra môže
  vyhrať Kandelábr)
- Bez perzistencie, bez DB write, bez API
- Reaktívne — keď sa tied set zmení (nový hlas), seed input sa zmení,
  výber sa prepočíta

### Tally / víťaz výpočet — `VotingApp.tsx`

```ts
// Vstup
votes: Record<string, string[]>      // voter → list of picked slugs

// Tally
tally = new Map<string, string[]>()  // slug → voters who picked it
for (const [voter, slugs] of Object.entries(votes))
  for (const slug of slugs)
    tally.get(slug).push(voter)

// Winner
maxCount = max(tally.values().map(v => v.length))
tied = tally.entries().filter(([_, v]) => v.length === maxCount).map(([s]) => s)
winnerSlug = tied.length === 1 ? tied[0] : pickFromTied(tied, pragueIsoDate())
```

**Tally semantika:** 1 point per pick (štandardné approval voting). Voter
ktorý klikne 3 reštiky prispieva 3 hlasy. Spravodlivosť je daná tým, že
každý má rovnaký ceiling (= všetky reštiky).

### API — `app/api/votes/route.ts`

POST tvar nezmenený:
```ts
{ officeId: string, name: string, restaurant: string | null }
```

Sémantika sa mení z **replace** na **toggle**:
- `restaurant: 'krusovicka'` → ak voter má `krusovicka`, odober; inak pridaj
- `restaurant: null` → vymaž všetky hlasy voteru (`HDEL`)

Server flow (toggle vetva):
```
1. HGET key voterName → currentCsv (alebo "")
2. parse: current = currentCsv.split(',').filter(Boolean)
3. toggled = current.includes(slug)
              ? current.filter(s => s !== slug)
              : [...current, slug]
4. ak toggled.length === 0:
     HDEL key voterName
   inak:
     multi().hset(key, { [voterName]: toggled.join(',') })
            .expire(key, secondsUntilPragueMidnight()).exec()
5. HGETALL key → vráť ako nový stav
```

Rename action — beze zmeny v shape, jediná pipeline operácia (HSET nového
CSV value, HDEL starého) ostáva atomická.

Validácia: každý slug v togglovanom payloade sa kontroluje proti
`validSlugs` z office configu (rovnako ako dnes).

### Client — `lib/use-votes.ts`

Type zmena:
```ts
export type VoteMap = Record<string, string[]>;
```

Parsing CSV pri GET odpovedi (server vracia stringy):
```ts
function parseServerVotes(raw: Record<string, string>): VoteMap {
  const out: VoteMap = {};
  for (const [voter, csv] of Object.entries(raw))
    out[voter] = csv.split(',').filter(Boolean);
  return out;
}
```

Optimistic update v `cast`: namiesto `next[name] = restaurant` toggle-uje
v poli — pridá ak chýba, odoberie ak je v ňom.

`shallowEqual` musí porovnávať polia, nie strings. Preto premenovať na
`votesEqual(prev, next)` ktorá pre každý voter porovná dĺžku a obsah set-u.

### UI komponenty

**`RestaurantCard.tsx`:**
- `picked = !!me && (votes[me] ?? []).includes(slug)` (jediná zmena)
- Class zmeny:
  - `card--leader` → strict rename na `card--winner` (vrátane CSS, žiadny alias)
  - `card--tied` — nový — bol v remíze ale kocky nevybrali, jemnejší styling (dashed border)
  - `card--rolled` — nový modifier pre víťaza ktorý vzišiel z tiebreaku (subtle dice subbadge)

Badge logika:
- solo winner → `[ WINNER ]`
- rolled winner → `[ WINNER × ROLL ]`
- tied non-winner → `[ TIED ]`

**`PickBanner.tsx`:**

Nové props:
```ts
{
  winnerName: string | null,
  topVotes: number,
  totalVotes: number,
  totalVoters: number,
  tiedCount: number,
}
```

Vizuál:
```
Solo:    >> Krušovická vyhráva   5 hlasov · 4 hlasujúci
Rolled:  >> Krušovická vyhráva   3 hlasov · 4 hlasujúci   $ roll --tied=2
None:    (bez banneru, ako dnes)
```

**`IdentityBar.tsx`:** small counter "[ N picks ]" napravo od mena pre
organic discoverability multi-vote. Skrytý keď N=0.

**`globals.css`:** nové classes (`card--winner`, `card--tied`, `card--rolled`),
banner roll hint styling. Žiadna iná zmena vizuálu.

## Edge cases

| Situácia | Správanie |
|---|---|
| 0 hlasov | `winner = null`, žiadny banner |
| 1 voter, 1 pick | solo winner |
| 1 voter, všetky reštiky | N-way tie, kocky vyberú |
| Duplicate slug v toggle requeste | Server toggle je idempotent (set semantika) |
| Voter má 0 hlasov po toggle | `HDEL` field |
| Voter rename s N pickmi | Existujúca pipeline funguje s CSV |
| Old Redis dáta (single slug bez čiarky) | Parser `split(',').filter(Boolean)` vráti pole 1 prvku |
| Slug obsahuje `,` | Nemožné — `slugify()` produkuje `[a-z0-9_]+` |
| Dátum sa zmení uprostred dňa | Nemožné — `pragueIsoDate()` stable, kľúč obsahuje dátum |
| Tied set sa zmení medzi pollami | Seed input sa zmení, nový výber — predstavuje skutočnú novú realitu |

## Testovanie

**Nový `__tests__/tiebreak.test.ts`:**
- Deterministickosť: rovnaký vstup → rovnaký výstup pri opakovaných volaniach
- Date-keying: rôzny `dateKey` na rovnakom tied sete → môže dať iný výber
- Order insensitivity: `['a','b']` a `['b','a']` produkujú rovnaký výber
- Single-element: `['a']` → `'a'`
- Distribučný sanity check: 1000 rôznych date keys cez 3-prvkový tied set
  → rozdelenie zhruba 33/33/33 (tolerancia ±10%)

**Nový `__tests__/votes-tally.test.ts`** (cez extrahovaný pure helper z
`VotingApp` — napr. `lib/tally.ts`):
- Prázdny vote map → `winner = null`
- 1 voter, 1 pick → solo winner, `tiedCount = 1`
- 3 voters, všetci `'krusovicka'` → `winner = 'krusovicka'`, `topVotes = 3`
- 2 voters, 1 vs 1 do rôznych reštik → 2-way tie, kocky vyberú deterministicky
- 1 voter, 3 picks → 3-way tie naprieč pickami, kocky vyberú
- Mixed: jeden voter má 2 picky, druhý má 1 pick (presek) → presek vyhráva
- Backwards-compat parser: `"krusovicka"` aj `"krusovicka,kandelabr"` → správne polia

Existujúce testy (`scrapers`, `redis`, `offices`) zostávajú zelené —
nedotknuté zmenami.

## Dotknuté súbory

**Nové:**
- `lib/tiebreak.ts`
- `lib/tally.ts` (extrakt pure tally helperu z `VotingApp` pre testovateľnosť)
- `__tests__/tiebreak.test.ts`
- `__tests__/votes-tally.test.ts`

**Upravené:**
- `lib/use-votes.ts` — `VoteMap` na pole, CSV parse, equality helper
- `app/api/votes/route.ts` — toggle semantika cez HGET + dedupe + HSET / HDEL
- `components/VotingApp.tsx` — multi-pick tally, derivácia winnera cez `pickFromTied`
- `components/PickBanner.tsx` — nové props, ASCII roll hint
- `components/RestaurantCard.tsx` — `picked` derivácia z poľa; nové classes
- `components/IdentityBar.tsx` — `[ N picks ]` counter
- `app/globals.css` — nové classes pre winner / tied / rolled

**Nezasiahnuté:**
- Scrapery, redis.ts, auth.ts, offices.ts, menu.ts, prague-time.ts
- Routing, layout, mapa, password gate

## Out of scope (zachovať pre prípadný follow-up)

- Roll animation pri zmene víťaza cez tiebreak (1× CSS dice rotation 0.5s)
- Tooltip na badge "Z 2 reštik si kocky vybrali túto"
- Historical view "ktoré reštiky vyhrali tento týždeň"
- Weighted tiebreak (napr. "vyhrá tá ktorá najmenej vyhrávala")

## Zhrnutie scope

- ~9 súborov dotknutých, 4 nové (2 lib helpers, 2 testy)
- Žiadna data migrácia (CSV parser je backwards-kompatibilný)
- Žiadne nové dependencies
- Žiadny config / build change
- Žiadny API surface breakage — POST shape ostáva, len sémantika sa mení
  z replace na toggle (klient sa volá rovnako)
