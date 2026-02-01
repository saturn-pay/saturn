import type { InferSelectModel } from 'drizzle-orm';
import type { accounts } from '../db/schema/accounts.js';
import type { agents } from '../db/schema/agents.js';
import type { wallets } from '../db/schema/wallets.js';
import type { policies } from '../db/schema/policies.js';

export type Account = InferSelectModel<typeof accounts>;
export type Agent = InferSelectModel<typeof agents>;
export type Wallet = InferSelectModel<typeof wallets>;
export type Policy = InferSelectModel<typeof policies>;

declare global {
  namespace Express {
    interface Request {
      account?: Account;
      agent?: Agent;
      wallet?: Wallet;
      policy?: Policy;
    }
  }
}

export interface PolicyCheckRequest {
  agent: Agent;
  policy: Policy;
  serviceSlug: string;
  quotedSats: number;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}
