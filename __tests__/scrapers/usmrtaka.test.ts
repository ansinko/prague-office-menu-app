import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseUsmrtaka } from '@/lib/scrapers/usmrtaka';

const fixture = readFileSync(join(__dirname, '../fixtures/usmrtaka.html'), 'utf-8');

describe('parseUsmrtaka', () => {
  it('parses soup from priced lines before Menu items', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.soup).toBe('Kuřecí vývar s nudličkami / Bramboračka');
  });

  it('parses up to 4 menu items', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.items).toHaveLength(4);
  });

  it('strips allergen codes from item names', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.items[0].name).not.toContain('(1,7,10)');
  });

  it('parses price correctly', () => {
    const result = parseUsmrtaka(fixture);
    expect(result.items[0]).toEqual({ name: 'Vepřové nudličky stroganof, hranolky', price: '193 Kč' });
  });
});
