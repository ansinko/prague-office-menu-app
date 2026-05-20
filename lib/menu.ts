import type { Restaurant } from './scrapers/types';

const LATEST_URL =
  'https://k4iu9zkxljm5kpot.public.blob.vercel-storage.com/menu/latest.json';

export async function getMenus(): Promise<Restaurant[]> {
  try {
    const res = await fetch(LATEST_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { restaurants: Restaurant[] };
    return data.restaurants;
  } catch {
    return [
      { name: 'Krušovická Chalupa', url: 'https://krusovickachalupa.cz/menu/', soup: null, items: [], error: 'Menu se nepodařilo načíst' },
      { name: 'Restaurant Kandelábr', url: 'https://www.restaurantkandelabr.cz/poledni-menu/', soup: null, items: [], error: 'Menu se nepodařilo načíst' },
      { name: 'U Smrtáka', url: 'https://usmrtaka.cz/jidelni-listek/', soup: null, items: [], error: 'Menu se nepodařilo načíst' },
    ];
  }
}
