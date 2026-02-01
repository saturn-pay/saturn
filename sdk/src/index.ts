import { HttpClient } from './client.js';
import { AccountsResource } from './resources/accounts.js';
import { AgentsResource } from './resources/agents.js';
import { PoliciesResource } from './resources/policies.js';
import { WalletsResource } from './resources/wallets.js';
import { ServicesResource } from './resources/services.js';
import { ProxyResource } from './resources/proxy.js';
import { AdminResource } from './resources/admin.js';
import type { SaturnConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://api.saturn-pay.com';

export class Saturn {
  public readonly accounts: AccountsResource;
  public readonly agents: AgentsResource;
  public readonly policies: PoliciesResource;
  public readonly wallet: WalletsResource;
  public readonly services: ServicesResource;
  public readonly proxy: ProxyResource;
  public readonly admin: AdminResource;

  constructor(config: SaturnConfig) {
    const client = new HttpClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    });

    this.accounts = new AccountsResource(client);
    this.agents = new AgentsResource(client);
    this.policies = new PoliciesResource(client);
    this.wallet = new WalletsResource(client);
    this.services = new ServicesResource(client);
    this.proxy = new ProxyResource(client);
    this.admin = new AdminResource(client);
  }
}

// Re-export everything
export * from './types.js';
export * from './errors.js';
export { HttpClient } from './client.js';
export type { ClientConfig, RequestOptions } from './client.js';
export { AccountsResource } from './resources/accounts.js';
export { AgentsResource } from './resources/agents.js';
export { PoliciesResource } from './resources/policies.js';
export { WalletsResource } from './resources/wallets.js';
export { ServicesResource } from './resources/services.js';
export { ProxyResource } from './resources/proxy.js';
export { AdminResource } from './resources/admin.js';
