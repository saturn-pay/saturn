import { createInvoice, getInvoice, getWalletInfo } from 'ln-service';
import { lnd } from '../lib/lnd-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateInvoiceResult {
  paymentRequest: string;
  rHash: string;
  expiresAt: Date;
}

export interface InvoiceStatus {
  isConfirmed: boolean;
  isHeld: boolean;
  isCanceled: boolean;
}

export interface NodeInfo {
  publicKey: string;
  alias: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createLightningInvoice(
  amountSats: number,
  memo: string,
  expirySecs = 3600,
): Promise<CreateInvoiceResult> {
  if (!lnd) throw new Error('Lightning is not configured');

  const invoice = await createInvoice({
    lnd,
    tokens: amountSats,
    description: memo,
    expires_at: new Date(Date.now() + expirySecs * 1000).toISOString(),
  });

  return {
    paymentRequest: invoice.request,
    rHash: invoice.id,
    expiresAt: new Date(Date.now() + expirySecs * 1000),
  };
}

export async function getInvoiceStatus(rHash: string): Promise<InvoiceStatus> {
  if (!lnd) throw new Error('Lightning is not configured');

  const invoice = await getInvoice({ lnd, id: rHash });

  return {
    isConfirmed: invoice.is_confirmed,
    isHeld: invoice.is_held,
    isCanceled: invoice.is_canceled,
  };
}

export async function getNodeInfo(): Promise<NodeInfo> {
  if (!lnd) throw new Error('Lightning is not configured');

  const info = await getWalletInfo({ lnd });

  return {
    publicKey: info.public_key,
    alias: info.alias,
  };
}
