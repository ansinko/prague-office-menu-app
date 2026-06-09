import { describe, it, expect } from 'vitest';
import { pickFromTied } from '@/lib/tiebreak';

describe('pickFromTied', () => {
  it('is deterministic for the same input', () => {
    const a = pickFromTied(['krusovicka', 'kandelabr'], '2026-05-23');
    const b = pickFromTied(['krusovicka', 'kandelabr'], '2026-05-23');
    expect(a).toBe(b);
  });

  it('is order-insensitive on the tied set', () => {
    const a = pickFromTied(['krusovicka', 'kandelabr'], '2026-05-23');
    const b = pickFromTied(['kandelabr', 'krusovicka'], '2026-05-23');
    expect(a).toBe(b);
  });

  it('returns the only element for a singleton set', () => {
    expect(pickFromTied(['solo'], '2026-05-23')).toBe('solo');
  });

  it('always returns a slug from the tied set', () => {
    const tied = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) {
      const date = `2026-05-${String(i + 1).padStart(2, '0')}`;
      expect(tied).toContain(pickFromTied(tied, date));
    }
  });

  it('distributes roughly evenly across many date keys', () => {
    const tied = ['a', 'b', 'c'];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 900; i++) {
      const date = `seed-${i}`;
      counts[pickFromTied(tied, date)]++;
    }
    for (const k of ['a', 'b', 'c']) {
      expect(counts[k]).toBeGreaterThan(240);
      expect(counts[k]).toBeLessThan(360);
    }
  });
});
