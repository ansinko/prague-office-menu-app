'use server';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getOffice } from '@/lib/offices';
import { secondsUntilPragueMidnight } from '@/lib/prague-time';
import { timingSafeEqual } from '@/lib/timing-safe-equal';

const COOKIE = 'menu-unlocked';

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s);
}

async function hashPassword(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret() as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(password) as BufferSource,
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function readIds(store: Awaited<ReturnType<typeof cookies>>): Promise<string[]> {
  const raw = store.get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const { payload } = await jwtVerify(raw, secret());
    const ids = (payload as { ids?: unknown }).ids;
    return Array.isArray(ids) ? (ids.filter((x) => typeof x === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

async function writeIds(store: Awaited<ReturnType<typeof cookies>>, ids: string[]): Promise<void> {
  const token = await new SignJWT({ ids })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret());
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: secondsUntilPragueMidnight(),
  });
}

export async function getUnlockedOfficeIds(): Promise<string[]> {
  return readIds(await cookies());
}

export async function isOfficeUnlocked(officeId: string): Promise<boolean> {
  return (await getUnlockedOfficeIds()).includes(officeId);
}

export async function unlockOffice(
  officeId: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: 'bad-password' }> {
  const office = getOffice(officeId);
  if (!office) return { ok: false, error: 'bad-password' };

  const candidate = await hashPassword(password);
  if (!timingSafeEqual(candidate, office.passwordHash)) {
    return { ok: false, error: 'bad-password' };
  }

  const store = await cookies();
  const ids = Array.from(new Set([...(await readIds(store)), officeId]));
  await writeIds(store, ids);
  return { ok: true };
}

export async function lockOffice(officeId: string): Promise<void> {
  const store = await cookies();
  const ids = (await readIds(store)).filter((id) => id !== officeId);
  await writeIds(store, ids);
}
