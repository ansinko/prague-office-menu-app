import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { scrapeKrusovicka } from '@/lib/scrapers/krusovicka';
import { scrapeKandelabr } from '@/lib/scrapers/kandelabr';
import { scrapeUsmrtaka } from '@/lib/scrapers/usmrtaka';
import { pragueIsoDate } from '@/lib/prague-time';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = pragueIsoDate();
  const restaurants = await Promise.all([
    scrapeKrusovicka(),
    scrapeKandelabr(),
    scrapeUsmrtaka(),
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

  return NextResponse.json({ ok: true, date, count: restaurants.length });
}
