import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { redis, todayKey } from '@/lib/redis';
import { secondsUntilPragueMidnight } from '@/lib/prague-time';
import { slugify } from '@/lib/slug';
import { normalizeIdentityName } from '@/lib/identity';
import { getOffice } from '@/lib/offices';

export const dynamic = 'force-dynamic';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  prefix: 'ratelimit:votes',
});

function clientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function GET(req: NextRequest) {
  const officeId = req.nextUrl.searchParams.get('office');
  if (!officeId || !getOffice(officeId)) {
    return NextResponse.json({ error: 'Unknown office' }, { status: 400 });
  }
  const key = todayKey(officeId);
  const data = (await redis.hgetall<Record<string, string>>(key)) ?? {};
  return NextResponse.json(
    { votes: data },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const { success } = await ratelimit.limit(clientIp(req));
  if (!success) {
    return NextResponse.json({ error: 'Rate limit' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = body as { name?: unknown; restaurant?: unknown; officeId?: unknown };

  const office = typeof parsed.officeId === 'string' ? getOffice(parsed.officeId) : undefined;
  if (!office) return NextResponse.json({ error: 'Unknown office' }, { status: 400 });

  const name = normalizeIdentityName(parsed.name);
  if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

  const restaurantRaw = parsed.restaurant;
  if (restaurantRaw !== null && typeof restaurantRaw !== 'string') {
    return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
  }

  const key = todayKey(office.id);

  if (restaurantRaw === null || restaurantRaw === '') {
    await redis.hdel(key, name);
    const data = (await redis.hgetall<Record<string, string>>(key)) ?? {};
    return NextResponse.json({ votes: data });
  }

  const validSlugs = new Set(office.restaurants.map((r) => slugify(r.name)));
  if (!validSlugs.has(restaurantRaw)) {
    return NextResponse.json({ error: 'Unknown restaurant' }, { status: 400 });
  }

  await redis.hset(key, { [name]: restaurantRaw });
  await redis.expire(key, secondsUntilPragueMidnight());

  const data = (await redis.hgetall<Record<string, string>>(key)) ?? {};
  return NextResponse.json({ votes: data });
}
