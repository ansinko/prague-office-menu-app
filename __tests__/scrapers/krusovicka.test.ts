import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseKrusovicka } from '@/lib/scrapers/krusovicka';

const fixture = readFileSync(join(__dirname, '../fixtures/krusovicka.html'), 'utf-8');

describe('parseKrusovicka', () => {
  it('parses soup and menu items for the correct day', () => {
    const result = parseKrusovicka(fixture, 3); // 3 = Středa
    expect(result.error).toBeNull();
    expect(result.soup).toBe('Chalupářská');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({ name: 'Kuřecí závitek plněný šunkou', price: '168 Kč' });
    expect(result.items[1]).toEqual({ name: 'Holandský řízek', price: '179 Kč' });
  });

  it('does not include items from adjacent days', () => {
    const result = parseKrusovicka(fixture, 3);
    expect(result.items.some(i => i.name.includes('Svíčková'))).toBe(false);
  });

  it('returns error when day section is not found', () => {
    const result = parseKrusovicka(fixture, 5); // 5 = Pátek, nie je vo fixture
    expect(result.error).toContain('nenalezena');
    expect(result.items).toHaveLength(0);
  });
});
