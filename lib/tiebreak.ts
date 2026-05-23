export function pickFromTied(tiedSlugs: string[], dateKey: string): string {
  const sorted = [...tiedSlugs].sort();
  const seed = `${dateKey}|${sorted.join('|')}`;
  let hash = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return sorted[Math.abs(hash) % sorted.length];
}
