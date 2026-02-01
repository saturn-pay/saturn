declare module 'ln-service' {
  export interface AuthenticatedLnd {
    lnd: unknown;
  }

  export function authenticatedLndGrpc(params: {
    cert: string;
    macaroon: string;
    socket: string;
  }): AuthenticatedLnd;

  export function createInvoice(params: {
    lnd: unknown;
    tokens: number;
    description?: string;
    expires_at?: string;
  }): Promise<{
    request: string;
    id: string;
    tokens: number;
  }>;

  export function getInvoice(params: {
    lnd: unknown;
    id: string;
  }): Promise<{
    is_confirmed: boolean;
    is_held: boolean;
    is_canceled: boolean;
  }>;

  export function getWalletInfo(params: {
    lnd: unknown;
  }): Promise<{
    public_key: string;
    alias: string;
  }>;

  export function subscribeToInvoices(params: {
    lnd: unknown;
  }): NodeJS.EventEmitter;
}
