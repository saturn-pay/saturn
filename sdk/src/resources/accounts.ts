import type { HttpClient, RequestOptions } from '../client.js';
import type {
  Account,
  CreateAccountRequest,
  CreateAccountResponse,
  UpdateAccountRequest,
  RotateKeyResponse,
} from '../types.js';

export class AccountsResource {
  constructor(private readonly client: HttpClient) {}

  async create(params: CreateAccountRequest, opts?: RequestOptions): Promise<CreateAccountResponse> {
    return this.client.post<CreateAccountResponse>('/v1/accounts', params, opts);
  }

  async me(opts?: RequestOptions): Promise<Account> {
    return this.client.get<Account>('/v1/accounts/me', undefined, opts);
  }

  async update(params: UpdateAccountRequest, opts?: RequestOptions): Promise<Account> {
    return this.client.patch<Account>('/v1/accounts/me', params, opts);
  }

  async rotateKey(opts?: RequestOptions): Promise<RotateKeyResponse> {
    return this.client.post<RotateKeyResponse>('/v1/accounts/me/rotate-key', {}, opts);
  }
}
