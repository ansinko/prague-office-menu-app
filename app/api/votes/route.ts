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

type VoteMap = Record<string, string>;

async function readVotes(key: string): Promise<VoteMap> {
  return (await redis.hgetall<VoteMap>(key)) ?? {};
}

export async function GET(req: NextRequest) {
  const officeId = req.nextUrl.searchParams.get('office');
  if (!officeId || !getOffice(officeId)) {
    return NextResponse.json({ error: 'Unknown office' }, { status: 400 });
  }
  return NextResponse.json(
    { votes: await readVotes(todayKey(officeId)) },
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

  const parsed = body as {
    officeId?: unknown;
    name?: unknown;
    restaurant?: unknown;
    rename?: unknown;
  };

  const office = typeof parsed.officeId === 'string' ? getOffice(parsed.officeId) : undefined;
  if (!office) return NextResponse.json({ error: 'Unknown office' }, { status: 400 });
  const key = todayKey(office.id);

  if (parsed.rename && typeof parsed.rename === 'object') {
    const { from, to } = parsed.rename as { from?: unknown; to?: unknown };
    const fromName = normalizeIdentityName(from);
    const toName = normalizeIdentityName(to);
    if (!fromName || !toName) {
      return NextResponse.json({ error: 'Invalid rename' }, { status: 400 });
    }
    if (fromName !== toName) {
      const value = await redis.hget<string>(key, fromName);
      if (value) {
        await redis
          .multi()
          .hset(key, { [toName]: value })
          .hdel(key, fromName)
          .expire(key, secondsUntilPragueMidnight())
          .exec();
      }
    }
    return NextResponse.json({ votes: await readVotes(key) });
  }

  const name = normalizeIdentityName(parsed.name);
  if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

  const restaurantRaw = parsed.restaurant;
  if (restaurantRaw !== null && typeof restaurantRaw !== 'string') {
    return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 });
  }

  if (restaurantRaw === null || restaurantRaw === '') {
    await redis.hdel(key, name);
    return NextResponse.json({ votes: await readVotes(key) });
  }

  const validSlugs = new Set(office.restaurants.map((r) => slugify(r.name)));
  if (!validSlugs.has(restaurantRaw)) {
    return NextResponse.json({ error: 'Unknown restaurant' }, { status: 400 });
  }

  const [, , data] = await redis
    .multi()
    .hset(key, { [name]: restaurantRaw })
    .expire(key, secondsUntilPragueMidnight())
    .hgetall<VoteMap>(key)
    .exec<[number, number, VoteMap | null]>();

  return NextResponse.json({ votes: data ?? {} });
}
