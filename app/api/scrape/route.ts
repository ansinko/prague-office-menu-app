import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { scrapeKrusovicka } from '@/lib/scrapers/krusovicka';
import { scrapeKandelabr } from '@/lib/scrapers/kandelabr';
import { scrapeUsmrtaka } from '@/lib/scrapers/usmrtaka';
import { scrapeUsotonuFacebookMenu } from '@/lib/scrapers/usotonu-facebook';
import { pragueIsoDate } from '@/lib/prague-time';
import { MENU_CACHE_TAG } from '@/lib/menu';
import { timingSafeEqual } from '@/lib/timing-safe-equal';

export const maxDuration = 120;

async function putUsotonuMenu() {
  try {
    const menu = await scrapeUsotonuFacebookMenu();
    await put('usotonu.json', JSON.stringify(menu), {
      access: 'public',
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 300,
    });
    return { ok: true as const, count: menu.items.length };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'U Sotonů scrape failed',
    };
  }
}

export async function GET(req: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = req.headers.get('authorization') ?? '';
  if (!timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = pragueIsoDate();
  const [restaurants, usotonu] = await Promise.all([
    Promise.all([
      scrapeKrusovicka(),
      scrapeKandelabr(),
      scrapeUsmrtaka(),
    ]),
    putUsotonuMenu(),
  ]);
  const payload = JSON.stringify({ date, restaurants }, null, 2);

  await Promise.all(
    [`menu/${date}.json`, 'menu/latest.json'].map((pathname) =>
      put(pathname, payload, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 300,
      }),
    ),
  );

  revalidateTag(MENU_CACHE_TAG, 'max');

  return NextResponse.json({ ok: true, date, count: restaurants.length, usotonu });
}
