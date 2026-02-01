import { describe, it, expect } from 'vitest';
import { generateId } from '../../src/lib/id.js';

describe('generateId', () => {
  it('returns a string with the correct prefix', () => {
    const id = generateId('acct');
    expect(id.startsWith('acct_')).toBe(true);
  });

  it('contains an underscore separator', () => {
    const id = generateId('agent');
    expect(id).toContain('_');
    const parts = id.split('_');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe('agent');
  });

  it('generates unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId('tx')));
    expect(ids.size).toBe(100);
  });

  it('has a valid ULID portion (26 characters)', () => {
    const id = generateId('pol');
    const ulidPart = id.split('_')[1];
    expect(ulidPart).toHaveLength(26);
    // ULID uses Crockford's Base32: 0-9 A-Z excluding I L O U
    expect(ulidPart).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
