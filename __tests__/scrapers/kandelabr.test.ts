import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseZomato } from '@/lib/scrapers/kandelabr';

const fixture = readFileSync(join(__dirname, '../fixtures/kandelabr-zomato.html'), 'utf-8');

describe('parseZomato', () => {
  it("parses today's section marked with (Dnes)", () => {
    const result = parseZomato(fixture);
    expect(result.soup).toBe('ZELNÁ S PAPRIKOVOU KLOBÁSOU');
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({ name: 'HOVĚZÍ KOSTKY NA ČESNEKU, BRAMBOROVÉ KNEDLÍKY', price: '195 Kč' });
  });

  it('does not include items from other days', () => {
    const result = parseZomato(fixture);
    expect(result.items.some(i => i.name.includes('SVÍČKOVÁ'))).toBe(false);
  });

  it('strips numbering prefix from item names', () => {
    const result = parseZomato(fixture);
    expect(result.items[0].name).not.toMatch(/^1\./);
  });

  it('excludes items without Kč price', () => {
    const result = parseZomato(fixture);
    expect(result.items.some(i => i.price === 'zdarma')).toBe(false);
  });
});
