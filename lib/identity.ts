export const MAX_NAME_LEN = 24;

export function normalizeIdentityName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length < 1 || t.length > MAX_NAME_LEN) return null;
  return t;
}
