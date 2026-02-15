export const DEFAULT_POLICY = {
  maxPerCallSats: null,
  maxPerDaySats: 10_000,
  allowedServices: null,
  deniedServices: null,
  allowedCapabilities: null,
  deniedCapabilities: null,
  killSwitch: false,
  maxBalanceSats: null,
} as const;

export const FUNDING = {
  minAmountSats: 1_000,
  maxAmountSats: 10_000_000,
  invoiceExpirySecs: 3600,
} as const;

export const STRIPE_FUNDING = {
  minAmountUsdCents: 500,
  maxAmountUsdCents: 50_000,
  sessionExpirySecs: 1800,
} as const;

export const LEMONSQUEEZY_FUNDING = {
  minAmountUsdCents: 500,
  maxAmountUsdCents: 50_000,
  sessionExpirySecs: 1800,
} as const;

export const RATE_UPDATE_INTERVAL_CRON = '*/5 * * * *'; // every 5 minutes

export const API_KEY_PREFIXES = {
  agent: 'sk_agt_',
} as const;

export const ID_PREFIXES = {
  account: 'acc',
  agent: 'agt',
  wallet: 'wal',
  policy: 'pol',
  service: 'svc',
  servicePricing: 'spr',
  invoice: 'inv',
  transaction: 'txn',
  auditLog: 'aud',
  rateSnapshot: 'rts',
  submission: 'sub',
  checkoutSession: 'cks',
} as const;

export const DAILY_SPEND_CACHE_TTL_MS = 60_000;
