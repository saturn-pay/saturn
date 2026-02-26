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

// ── Signup ──

export interface SignupRequest {
  name: string;
  email?: string;
}

export interface SignupResponse {
  agentId: string;
  apiKey: string;
  accountId: string;
}

// ── Accounts ──

export interface Account {
  id: string;
  name: string;
  email: string;
  defaultCurrency: 'sats' | 'usd_cents';
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
  allowedCapabilities: string[] | null;
  deniedCapabilities: string[] | null;
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
  allowedCapabilities: string[] | null;
  deniedCapabilities: string[] | null;
  killSwitch: boolean;
  maxBalanceSats: number | null;
}

export interface UpdatePolicyRequest {
  maxPerCallSats?: number | null;
  maxPerDaySats?: number | null;
  allowedServices?: string[] | null;
  deniedServices?: string[] | null;
  allowedCapabilities?: string[] | null;
  deniedCapabilities?: string[] | null;
  killSwitch?: boolean;
  maxBalanceSats?: number | null;
}

// ── Wallets ──

export interface Wallet {
  id: string;
  accountId: string;
  // Sats balance (Lightning funding)
  balanceSats: number;
  heldSats: number;
  lifetimeIn: number;
  lifetimeOut: number;
  // USD balance (Stripe funding)
  balanceUsdCents: number;
  heldUsdCents: number;
  lifetimeInUsdCents: number;
  lifetimeOutUsdCents: number;
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

export interface FundCardRequest {
  amountUsdCents: number;
}

export interface FundCardResponse {
  checkoutSessionId: string;
  checkoutUrl: string;
  amountUsdCents: number;
  amountSats: number;
  btcUsdRate: number;
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
  agentId: string | null;
  type: 'credit_lightning' | 'credit_stripe' | 'debit_proxy_call' | 'refund' | 'withdrawal';
  currency: 'sats' | 'usd_cents';
  // Sats amounts
  amountSats: number;
  balanceAfter: number;
  // USD amounts (for Stripe transactions)
  amountUsdCents: number | null;
  balanceAfterUsdCents: number | null;
  referenceType: 'invoice' | 'proxy_call' | 'checkout_session' | 'hold_release' | null;
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
  quotedUsdCents: number;
  chargedUsdCents: number;
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

// ── Capabilities ──

export type CapabilityVerb =
  | 'reason'
  | 'search'
  | 'read'
  | 'scrape'
  | 'execute'
  | 'email'
  | 'sms'
  | 'imagine'
  | 'speak'
  | 'transcribe';

export interface CapabilityProvider {
  slug: string;
  priority: number;
  active: boolean;
}

export interface Capability {
  capability: CapabilityVerb;
  description: string;
  providers: CapabilityProvider[];
  defaultProvider: string;
  pricing: ServicePricing[];
}

export interface CapabilityDetail {
  capability: CapabilityVerb;
  description: string;
  defaultProvider: string;
  providers: Array<CapabilityProvider & {
    name: string;
    pricing: ServicePricing[];
  }>;
}

// ── Capability Request Types ──

export interface ReasonRequest {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  [key: string]: unknown;
}

export interface SearchRequest {
  query: string;
  numResults?: number;
  [key: string]: unknown;
}

export interface ReadRequest {
  url: string;
  [key: string]: unknown;
}

export interface ScrapeRequest {
  url: string;
  [key: string]: unknown;
}

export interface ExecuteRequest {
  language?: string;
  code: string;
  [key: string]: unknown;
}

export interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  from?: string;
  [key: string]: unknown;
}

export interface SmsRequest {
  to: string;
  body: string;
  [key: string]: unknown;
}

export interface ImagineRequest {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface SpeakRequest {
  text: string;
  voice?: string;
  [key: string]: unknown;
}

export interface TranscribeRequest {
  audio: string;
  language?: string;
  [key: string]: unknown;
}

// ── Registry ──

export interface RegistrySubmission {
  serviceName: string;
  serviceSlug: string;
  description?: string;
  baseUrl: string;
  authType: 'bearer' | 'api_key_header' | 'basic' | 'query_param';
  authCredentialEnv: string;
  capability: CapabilityVerb;
  proposedPricing?: Array<{
    operation: string;
    costUsdMicros: number;
    priceUsdMicros: number;
    unit: 'per_request' | 'per_1k_tokens' | 'per_minute';
  }>;
  notes?: string;
}

export interface ServiceSubmission {
  id: string;
  accountId: string;
  serviceName: string;
  serviceSlug: string;
  description: string | null;
  baseUrl: string;
  authType: 'bearer' | 'api_key_header' | 'basic' | 'query_param';
  authCredentialEnv: string;
  capability: string;
  proposedPricing: unknown;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewerNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Normalized Responses ──

export interface NormalizedReasonResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  raw: unknown;
}

export interface NormalizedSearchResponse {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  raw: unknown;
}

export interface NormalizedReadResponse {
  content: string;
  title?: string;
  raw: unknown;
}

export interface NormalizedScrapeResponse {
  html: string;
  text?: string;
  metadata?: Record<string, unknown>;
  raw: unknown;
}

export interface NormalizedExecuteResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  raw: unknown;
}

export interface NormalizedEmailResponse {
  id: string;
  status: string;
  raw: unknown;
}

export interface NormalizedSmsResponse {
  sid: string;
  status: string;
  raw: unknown;
}

export interface NormalizedImagineResponse {
  url: string;
  raw: unknown;
}

export interface NormalizedSpeakResponse {
  audio: string;
  format: string;
  raw: unknown;
}

export interface NormalizedTranscribeResponse {
  text: string;
  raw: unknown;
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
