import { describe, it, expect } from 'vitest';
import { usdMicrosToSats } from '../../src/services/pricing.service.js';

describe('usdMicrosToSats', () => {
  it('at BTC/USD 100,000: 1000 usd micros = 1 sat', () => {
    expect(usdMicrosToSats(1000, 100_000)).toBe(1);
  });

  it('at BTC/USD 50,000: 1000 usd micros = 2 sats', () => {
    expect(usdMicrosToSats(1000, 50_000)).toBe(2);
  });

  it('at BTC/USD 100,000: 3000 usd micros = 3 sats', () => {
    expect(usdMicrosToSats(3000, 100_000)).toBe(3);
  });

  it('rounds up (ceil)', () => {
    // 1500 * 100 / 100_000 = 1.5 → ceil → 2
    expect(usdMicrosToSats(1500, 100_000)).toBe(2);
  });

  it('handles large values', () => {
    // 10_000_000 usd micros = $10 → at $100k/BTC = 10,000 sats
    expect(usdMicrosToSats(10_000_000, 100_000)).toBe(10_000);
  });
});
