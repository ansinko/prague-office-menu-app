import { describe, it, expect } from 'vitest';
import { listOffices, getOffice, getPublicOffice } from '@/lib/offices';

describe('listOffices', () => {
  it('never leaks the password hash to the public shape', () => {
    for (const o of listOffices()) {
      expect(o).not.toHaveProperty('passwordHash');
    }
  });

  it('includes the Mo-cha office with its restaurants', () => {
    const mocha = listOffices().find((o) => o.id === 'mocha');
    expect(mocha).toBeDefined();
    expect(mocha!.restaurants.map((r) => r.name)).toContain('Krušovická Chalupa');
  });
});

describe('getOffice', () => {
  it('returns the full office (with hash) for server use', () => {
    expect(getOffice('mocha')?.passwordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns undefined for an unknown id', () => {
    expect(getOffice('nope')).toBeUndefined();
  });
});

describe('getPublicOffice', () => {
  it('omits the hash', () => {
    expect(getPublicOffice('mocha')).not.toHaveProperty('passwordHash');
  });
});
