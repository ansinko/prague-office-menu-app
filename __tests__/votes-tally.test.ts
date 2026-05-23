import { describe, it, expect } from 'vitest';
import { parseCsvVotes, computeTally, computeWinner } from '@/lib/tally';

describe('parseCsvVotes', () => {
  it('returns empty map for empty input', () => {
    expect(parseCsvVotes({})).toEqual({});
  });

  it('parses a single slug string into a one-element array (backwards-compat)', () => {
    expect(parseCsvVotes({ Andrej: 'krusovicka' })).toEqual({ Andrej: ['krusovicka'] });
  });

  it('parses CSV slugs into an array', () => {
    expect(parseCsvVotes({ Andrej: 'krusovicka,kandelabr' })).toEqual({
      Andrej: ['krusovicka', 'kandelabr'],
    });
  });

  it('filters empty entries from malformed CSV', () => {
    expect(parseCsvVotes({ Andrej: ',krusovicka,,kandelabr,' })).toEqual({
      Andrej: ['krusovicka', 'kandelabr'],
    });
  });
});

describe('computeTally', () => {
  it('returns empty tally for empty votes', () => {
    expect(computeTally({})).toEqual(new Map());
  });

  it('counts a single voter with a single pick', () => {
    const t = computeTally({ Andrej: ['krusovicka'] });
    expect(t.get('krusovicka')).toEqual(['Andrej']);
    expect(t.size).toBe(1);
  });

  it('counts a single voter with multiple picks', () => {
    const t = computeTally({ Andrej: ['krusovicka', 'kandelabr'] });
    expect(t.get('krusovicka')).toEqual(['Andrej']);
    expect(t.get('kandelabr')).toEqual(['Andrej']);
  });

  it('aggregates voters per slug', () => {
    const t = computeTally({
      Andrej: ['krusovicka'],
      Bara: ['krusovicka', 'kandelabr'],
    });
    expect(t.get('krusovicka')).toEqual(['Andrej', 'Bara']);
    expect(t.get('kandelabr')).toEqual(['Bara']);
  });
});

describe('computeWinner', () => {
  const date = '2026-05-23';

  it('returns null winner when no votes', () => {
    const r = computeWinner(new Map(), date);
    expect(r.winnerSlug).toBeNull();
    expect(r.topVotes).toBe(0);
    expect(r.tiedCount).toBe(0);
    expect(r.tiedSlugs).toEqual([]);
  });

  it('returns solo winner with tiedCount=1', () => {
    const tally = new Map([
      ['krusovicka', ['Andrej', 'Bara']],
      ['kandelabr', ['Cyril']],
    ]);
    const r = computeWinner(tally, date);
    expect(r.winnerSlug).toBe('krusovicka');
    expect(r.topVotes).toBe(2);
    expect(r.tiedCount).toBe(1);
  });

  it('breaks a 2-way tie deterministically', () => {
    const tally = new Map([
      ['krusovicka', ['Andrej']],
      ['kandelabr', ['Bara']],
    ]);
    const r1 = computeWinner(tally, date);
    const r2 = computeWinner(tally, date);
    expect(r1.winnerSlug).toBe(r2.winnerSlug);
    expect(['krusovicka', 'kandelabr']).toContain(r1.winnerSlug);
    expect(r1.tiedCount).toBe(2);
    expect(r1.tiedSlugs.sort()).toEqual(['kandelabr', 'krusovicka']);
  });

  it('breaks a 4-way tie', () => {
    const tally = new Map([
      ['a', ['x']],
      ['b', ['x']],
      ['c', ['x']],
      ['d', ['x']],
    ]);
    const r = computeWinner(tally, date);
    expect(['a', 'b', 'c', 'd']).toContain(r.winnerSlug);
    expect(r.tiedCount).toBe(4);
  });
});
