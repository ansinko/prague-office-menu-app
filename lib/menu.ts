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

const todayKey = new Date().toISOString().slice(0, 10);

export const getMenus = unstable_cache(
  () => Promise.all([scrapeKrusovicka(), scrapeKandelabr(), scrapeUsmrtaka()]),
  ['menus', todayKey],
  { revalidate: secondsUntilMidnight() },
);
