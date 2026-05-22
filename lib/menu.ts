import type { Restaurant } from './scrapers/types';
import { getOffice } from './offices';

const LATEST_URL =
  'https://k4iu9zkxljm5kpot.public.blob.vercel-storage.com/menu/latest.json';
const USOTONU_URL =
  'https://k4iu9zkxljm5kpot.public.blob.vercel-storage.com/usotonu.json';

const USOTONU_FALLBACK: Restaurant = {
  name: 'U Sotonů',
  url: 'https://www.facebook.com/usotonu',
  soup: null,
  extra: null,
  items: [],
  error: 'Menu nebylo nahráno',
};

async function getAllMenus(): Promise<Restaurant[]> {
  const [mainResult, usotonuResult] = await Promise.allSettled([
    fetch(LATEST_URL, { cache: 'no-store' }).then((r) => {
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
      ? mainResult.value.restaurants
      : [
          { name: 'Krušovická Chalupa', url: 'https://krusovickachalupa.cz/menu/', soup: null, extra: null, items: [], error: 'Menu se nepodařilo načíst' },
          { name: 'Restaurant Kandelábr', url: 'https://www.restaurantkandelabr.cz/poledni-menu/', soup: null, extra: null, items: [], error: 'Menu se nepodařilo načíst' },
          { name: 'U Smrtáka', url: 'https://usmrtaka.cz/jidelni-listek/', soup: null, extra: null, items: [], error: 'Menu se nepodařilo načíst' },
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
