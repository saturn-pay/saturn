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
  todaySpendUsdCents: number;
  activeAgents: number;
  totalApiCalls: number;
  revenueEstimateSats: number;
}

export interface AdminAgent {
  id: string;
  name: string;
  role: 'primary' | 'worker';
  status: 'active' | 'suspended' | 'killed';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Account-level balance (shared)
  balanceSats: number;
  heldSats: number;
  balanceUsdCents: number;
  heldUsdCents: number;
  // Per-agent lifetime stats
  lifetimeIn: number;
  lifetimeOut: number;
  lifetimeInUsdCents: number;
  lifetimeOutUsdCents: number;
  // Per-agent today stats
  todaySpendSats: number;
  todaySpendUsdCents: number;
  // Per-agent call count
  totalCalls: number;
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
  quotedUsdCents: number | null;
  chargedUsdCents: number | null;
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

export interface Wallet {
  id: string;
  accountId: string;
  balanceSats: number;
  heldSats: number;
  balanceUsdCents: number;
  heldUsdCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePricing {
  operation: string;
  priceUsdMicros: number;
  priceSats: number;
  unit: string;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: string;
  status: 'active' | 'inactive' | 'maintenance';
  baseUrl: string;
  authType: string;
  pricing: ServicePricing[];
}

export interface CapabilityProvider {
  slug: string;
  priority: number;
  active: boolean;
  models?: string[];
}

export interface Capability {
  capability: string;
  description: string;
  providers: CapabilityProvider[];
  defaultProvider: string;
  pricing: ServicePricing[];
}

export interface FundCardResponse {
  checkoutUrl: string;
  checkoutSessionId: string;
  amountUsdCents: number;
  amountBrlCents: number;
  usdBrlRate: number;
  amountSats: number;
  btcUsdRate: number;
  expiresAt: string;
}

export interface FundLightningResponse {
  invoice: string;
  amountSats: number;
  expiresAt: string;
}

export interface CreateAgentResponse {
  id: string;
  apiKey: string;
  name: string;
}

export interface Policy {
  id: string;
  agentId: string;
  maxPerCallUsdCents: number | null;
  maxPerDayUsdCents: number | null;
  allowedServices: string[] | null;
  deniedServices: string[] | null;
  allowedCapabilities: string[] | null;
  deniedCapabilities: string[] | null;
  killSwitch: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePolicyRequest {
  maxPerCallUsdCents?: number | null;
  maxPerDayUsdCents?: number | null;
  allowedServices?: string[] | null;
  deniedServices?: string[] | null;
  allowedCapabilities?: string[] | null;
  deniedCapabilities?: string[] | null;
  killSwitch?: boolean;
}

export interface AgentStats {
  totalCalls: number;
  todaySpendUsdCents: number;
  lifetimeSpendUsdCents: number;
}
