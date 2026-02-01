// ── Configuration ──

export interface SaturnConfig {
  apiKey: string;
  baseUrl?: string;
}

// ── Common ──

export interface Paginated<T> {
  data: T[];
  total?: number;
  limit: number;
  offset: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// ── Accounts ──

export interface Account {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  name: string;
  email: string;
}

export interface CreateAccountResponse extends Account {
  apiKey: string;
}

export interface UpdateAccountRequest {
  name?: string;
  email?: string;
}

export interface RotateKeyResponse extends Account {
  apiKey: string;
}

// ── Agents ──

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

export interface CreateAgentRequest {
  name: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentResponse extends Agent {
  apiKey: string;
  wallet: Wallet;
  policy: Policy;
}

export interface UpdateAgentRequest {
  name?: string;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'suspended';
}

// ── Policies ──

export interface Policy {
  id: string;
  agentId: string;
  maxPerCallSats: number | null;
  maxPerDaySats: number | null;
  allowedServices: string[] | null;
  deniedServices: string[] | null;
  killSwitch: boolean;
  maxBalanceSats: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReplacePolicyRequest {
  maxPerCallSats: number | null;
  maxPerDaySats: number | null;
  allowedServices: string[] | null;
  deniedServices: string[] | null;
  killSwitch: boolean;
  maxBalanceSats: number | null;
}

export interface UpdatePolicyRequest {
  maxPerCallSats?: number | null;
  maxPerDaySats?: number | null;
  allowedServices?: string[] | null;
  deniedServices?: string[] | null;
  killSwitch?: boolean;
  maxBalanceSats?: number | null;
}

// ── Wallets ──

export interface Wallet {
  id: string;
  agentId: string;
  balanceSats: number;
  heldSats: number;
  lifetimeIn: number;
  lifetimeOut: number;
  createdAt: string;
  updatedAt: string;
}

export interface FundWalletRequest {
  amountSats: number;
}

export interface FundWalletResponse {
  invoiceId: string;
  paymentRequest: string;
  amountSats: number;
  expiresAt: string;
}

export interface Invoice {
  id: string;
  walletId: string;
  amountSats: number;
  paymentRequest: string;
  rHash: string;
  status: 'pending' | 'settled' | 'expired' | 'cancelled';
  expiresAt: string;
  settledAt: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: 'credit_lightning' | 'debit_proxy_call' | 'refund' | 'withdrawal';
  amountSats: number;
  balanceAfter: number;
  referenceType: 'invoice' | 'proxy_call' | null;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

// ── Services ──

export interface ServicePricing {
  operation: string;
  costUsdMicros?: number;
  priceUsdMicros: number;
  priceSats: number;
  unit: 'per_request' | 'per_1k_tokens' | 'per_minute';
  updatedAt?: string;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: string;
  status: 'active' | 'disabled';
  baseUrl: string;
  authType: 'bearer' | 'api_key_header' | 'basic' | 'query_param';
  pricing: ServicePricing[];
}

export type ServiceDetail = Service;

// ── Proxy ──

export interface ProxyCallMetadata {
  auditId: string;
  quotedSats: number;
  chargedSats: number;
  balanceAfter: number;
}

export interface ProxyCallResponse<T = unknown> {
  data: T;
  metadata: ProxyCallMetadata;
}

// ── Admin ──

export interface AdminStats {
  satsIn: number;
  satsOut: number;
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
  balanceSats: number;
  heldSats: number;
  lifetimeIn: number;
  lifetimeOut: number;
  todaySpendSats: number;
}

export interface AdminTransaction extends Transaction {
  agentId: string;
}

export interface AdminTransactionsParams extends PaginationParams {
  agent_id?: string;
  type?: string;
  from?: string;
  to?: string;
}

export interface AuditLog {
  id: string;
  agentId: string;
  serviceSlug: string;
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

export type AuditLogDetail = AuditLog;

export interface AdminAuditLogsParams extends PaginationParams {
  agent_id?: string;
  service_slug?: string;
  policy_result?: string;
  from?: string;
  to?: string;
}

export interface ServiceHealth {
  serviceSlug: string;
  callCount: number;
  avgLatencyMs: number;
  errorRate: number;
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

// ── Proxy convenience types ──

export interface OpenAIChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface AnthropicMessageRequest {
  model: string;
  max_tokens: number;
  messages: Array<{ role: string; content: string }>;
  system?: string;
  temperature?: number;
  [key: string]: unknown;
}

export interface AnthropicMessageResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}
