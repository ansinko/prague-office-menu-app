import type { Restaurant } from './scrapers/types';
import { getOffice } from './offices';
import { slugify } from './slug';

const BLOB_BASE =
  'https://k4iu9zkxljm5kpot.public.blob.vercel-storage.com';

/** Dev override: set MENU_DATE_OVERRIDE=YYYY-MM-DD in .env.local to fetch that
 *  day's archived menu file instead of `latest.json`. Handy for previewing the
 *  UI against real data outside scraping hours. */
function mainMenuUrl(): string {
  const override = process.env.MENU_DATE_OVERRIDE?.trim();
  return override
    ? `${BLOB_BASE}/menu/${override}.json`
    : `${BLOB_BASE}/menu/latest.json`;
}
const USOTONU_URL = `${BLOB_BASE}/usotonu.json`;

function emptyRestaurant(name: string, url: string, error: string | null): Restaurant {
  return { name, slug: slugify(name), url, soup: null, extra: null, items: [], error };
}

const USOTONU_FALLBACK = emptyRestaurant(
  'U Sotonů',
  'https://www.facebook.com/usotonu',
  'Menu nebylo nahráno',
);

async function getAllMenus(): Promise<Restaurant[]> {
  const [mainResult, usotonuResult] = await Promise.allSettled([
    fetch(mainMenuUrl(), { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ restaurants: Restaurant[] }>;
    }),
    fetch(USOTONU_URL, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ soup: string | null; extra: string | null; items: Restaurant['items'] }>;
    }),
  ]);

  const mainRestaurants =
    mainResult.status === 'fulfilled'
      ? mainResult.value.restaurants.map((r) => ({ ...r, slug: r.slug ?? slugify(r.name) }))
      : [
          emptyRestaurant('Krušovická Chalupa', 'https://krusovickachalupa.cz/menu/', 'Menu se nepodařilo načíst'),
          emptyRestaurant('Restaurant Kandelábr', 'https://www.restaurantkandelabr.cz/poledni-menu/', 'Menu se nepodařilo načíst'),
          emptyRestaurant('U Smrtáka', 'https://usmrtaka.cz/jidelni-listek/', 'Menu se nepodařilo načíst'),
        ];

  const usotonu: Restaurant =
    usotonuResult.status === 'fulfilled'
      ? {
          ...USOTONU_FALLBACK,
          soup: usotonuResult.value.soup,
          extra: usotonuResult.value.extra ?? null,
          items: usotonuResult.value.items,
          error: null,
        }
      : USOTONU_FALLBACK;

  return [...mainRestaurants, usotonu];
}

/**
 * Restaurants for a given office, ordered and filtered by its config.
 * Currently all real menu data belongs to Mo-cha; the office config maps
 * which restaurants belong where, so adding an office is config-only.
 */
export async function getMenus(officeId: string): Promise<Restaurant[]> {
  const office = getOffice(officeId);
  if (!office) return [];
  const all = await getAllMenus();
  const byName = new Map(all.map((r) => [r.name, r]));
  return office.restaurants
    .map((or) => byName.get(or.name))
    .filter((r): r is Restaurant => !!r);
}
