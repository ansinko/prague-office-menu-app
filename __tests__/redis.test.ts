import { describe, it, expect } from 'vitest';
import { todayKey } from '@/lib/redis';

describe('todayKey', () => {
  it('scopes the vote key by office id', () => {
    expect(todayKey('mocha')).toMatch(/^votes:mocha:\d{4}-\d{2}-\d{2}$/);
  });

  it('produces distinct keys for different offices on the same day', () => {
    const a = todayKey('mocha');
    const b = todayKey('other');
    expect(a).not.toBe(b);
    expect(a.slice(a.lastIndexOf(':'))).toBe(b.slice(b.lastIndexOf(':')));
  });
});
