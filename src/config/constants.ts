export const DEFAULT_POLICY = {
  maxPerCallSats: null,
  maxPerDaySats: null,
  allowedServices: null,
  deniedServices: null,
  killSwitch: false,
  maxBalanceSats: null,
} as const;

export const FUNDING = {
  minAmountSats: 1_000,
  maxAmountSats: 10_000_000,
  invoiceExpirySecs: 3600,
} as const;

export const RATE_UPDATE_INTERVAL_CRON = '*/5 * * * *'; // every 5 minutes

export const API_KEY_PREFIXES = {
  account: 'sk_acct_',
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
} as const;

export const DAILY_SPEND_CACHE_TTL_MS = 60_000;
