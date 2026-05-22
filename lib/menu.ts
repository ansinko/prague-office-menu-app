import type { Restaurant } from './scrapers/types';

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

export async function getMenus(): Promise<Restaurant[]> {
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
