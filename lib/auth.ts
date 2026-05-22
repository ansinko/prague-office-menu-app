'use server';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getOffice } from '@/lib/offices';
import { secondsUntilPragueMidnight } from '@/lib/redis';

const COOKIE = 'menu-unlocked';

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s);
}

/** HMAC-SHA256(password, AUTH_SECRET) → hex. Password never leaves the server. */
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signIds(ids: string[]): Promise<string> {
  return new SignJWT({ ids })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret());
}

export async function getUnlockedOfficeIds(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const { payload } = await jwtVerify(raw, secret());
    const ids = (payload as { ids?: unknown }).ids;
    return Array.isArray(ids) ? (ids.filter((x) => typeof x === 'string') as string[]) : [];
  } catch {
    return [];
  }
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

  const ids = Array.from(new Set([...(await getUnlockedOfficeIds()), officeId]));
  (await cookies()).set(COOKIE, await signIds(ids), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: secondsUntilPragueMidnight(),
  });
  return { ok: true };
}

export async function lockOffice(officeId: string): Promise<void> {
  const ids = (await getUnlockedOfficeIds()).filter((id) => id !== officeId);
  (await cookies()).set(COOKIE, await signIds(ids), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: secondsUntilPragueMidnight(),
  });
}
