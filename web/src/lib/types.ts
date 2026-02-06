// Copied from sdk/src/types.ts — dashboard-relevant interfaces only

export interface Paginated<T> {
  data: T[];
  total?: number;
  limit: number;
  offset: number;
}

export interface SignupRequest {
  name: string;
  email?: string;
}

export interface SignupResponse {
  agentId: string;
  apiKey: string;
  accountId: string;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  defaultCurrency: 'sats' | 'usd_cents';
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  accountId: string;
  name: string;
  status: 'active' | 'suspended' | 'killed';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  balanceSats?: number;
}

export interface AdminStats {
  satsIn: number;
  satsOut: number;
  usdCentsIn: number;
  usdCentsOut: number;
  activeAgents: number;
  totalTransactions: number;
  revenueEstimateSats: number;
}

export interface AdminAgent {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'killed';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Sats balance
  balanceSats: number;
  heldSats: number;
  lifetimeIn: number;
  lifetimeOut: number;
  // USD balance
  balanceUsdCents: number;
  heldUsdCents: number;
  lifetimeInUsdCents: number;
  lifetimeOutUsdCents: number;
  todaySpendSats: number;
}

export interface Transaction {
  id: string;
  walletId: string;
  agentId: string | null;
  type: 'credit_lightning' | 'credit_stripe' | 'debit_proxy_call' | 'refund' | 'withdrawal';
  currency: 'sats' | 'usd_cents';
  // Sats amounts
  amountSats: number;
  balanceAfter: number;
  // USD amounts
  amountUsdCents: number | null;
  balanceAfterUsdCents: number | null;
  referenceType: 'invoice' | 'proxy_call' | 'checkout_session' | 'hold_release' | null;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

export interface AdminTransaction extends Transaction {
  agentId: string;
}

export interface AuditLog {
  id: string;
  agentId: string;
  serviceSlug: string;
  capability: string | null;
  operation: string | null;
  policyResult: 'allowed' | 'denied';
  policyReason: string | null;
  quotedSats: number;
  chargedSats: number | null;
  upstreamStatus: number | null;
  upstreamLatencyMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface RateInfo {
  current: {
    usdPerBtc: number;
    satsPerUsd: number;
    fetchedAt: string;
  };
  history: Array<{
    usdPerBtc: number;
    satsPerUsd: number;
    fetchedAt: string;
  }>;
}
