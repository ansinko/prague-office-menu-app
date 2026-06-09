import { put } from '@vercel/blob';
import { scrapeKrusovicka } from '../lib/scrapers/krusovicka';
import { scrapeKandelabr } from '../lib/scrapers/kandelabr';
import { scrapeUsmrtaka } from '../lib/scrapers/usmrtaka';
import { scrapeUsotonuFacebookMenu } from '../lib/scrapers/usotonu-facebook';

async function putUsotonuMenu() {
  try {
    const menu = await scrapeUsotonuFacebookMenu();
    const blob = await put('usotonu.json', JSON.stringify(menu), {
      access: 'public',
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 300,
    });
    console.log(`✓ usotonu.json → ${blob.url}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'U Sotonů scrape failed';
    console.warn(`! usotonu.json unchanged → ${message}`);
  }
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const [restaurants] = await Promise.all([
    Promise.all([
      scrapeKrusovicka(),
      scrapeKandelabr(),
      scrapeUsmrtaka(),
    ]),
    putUsotonuMenu(),
  ]);
  const payload = JSON.stringify({ date, restaurants }, null, 2);

  for (const pathname of [`menu/${date}.json`, 'menu/latest.json']) {
    const blob = await put(pathname, payload, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 300,
    });
    console.log(`✓ ${pathname} → ${blob.url}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
