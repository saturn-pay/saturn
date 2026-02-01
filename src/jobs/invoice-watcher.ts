import { subscribeToInvoices } from 'ln-service';
import { eq } from 'drizzle-orm';
import { lnd } from '../lib/lnd-client.js';
import { db } from '../db/client.js';
import { invoices } from '../db/schema/index.js';
import * as walletService from '../services/wallet.service.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Reconnect state
// ---------------------------------------------------------------------------

const MAX_BACKOFF_MS = 60_000;
let backoffMs = 1_000;
let subscription: ReturnType<typeof subscribeToInvoices> | null = null;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleSettledInvoice(invoice: {
  id: string;
  is_confirmed: boolean;
  tokens: number;
}): Promise<void> {
  if (!invoice.is_confirmed) return;

  const rHash = invoice.id;

  try {
    // Look up the invoice in our DB by r_hash
    const [dbInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.rHash, rHash));

    if (!dbInvoice) {
      logger.debug({ rHash }, 'Settled invoice not found in DB — ignoring (external payment)');
      return;
    }

    if (dbInvoice.status === 'settled') {
      logger.debug({ rHash }, 'Invoice already settled — skipping');
      return;
    }

    // Credit the wallet
    await walletService.creditFromInvoice(
      dbInvoice.walletId,
      dbInvoice.amountSats,
      dbInvoice.id,
    );

    // Mark invoice as settled
    await db
      .update(invoices)
      .set({
        status: 'settled',
        settledAt: new Date(),
      })
      .where(eq(invoices.id, dbInvoice.id));

    logger.info(
      { invoiceId: dbInvoice.id, walletId: dbInvoice.walletId, amountSats: dbInvoice.amountSats },
      'Invoice settled and wallet credited',
    );
  } catch (err) {
    logger.error({ rHash, err }, 'Error processing settled invoice');
  }
}

// ---------------------------------------------------------------------------
// Subscribe with auto-reconnect
// ---------------------------------------------------------------------------

function subscribe(): void {
  logger.info('Subscribing to LND invoice stream');

  subscription = subscribeToInvoices({ lnd });

  subscription.on('invoice_updated', (invoice: {
    id: string;
    is_confirmed: boolean;
    tokens: number;
  }) => {
    void handleSettledInvoice(invoice);
  });

  subscription.on('error', (err: Error) => {
    logger.error({ err, backoffMs }, 'LND invoice subscription error — reconnecting');
    scheduleReconnect();
  });

  // Reset backoff on successful connection
  backoffMs = 1_000;
}

function scheduleReconnect(): void {
  setTimeout(() => {
    subscribe();
  }, backoffMs);

  // Exponential backoff with cap
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startInvoiceWatcher(): void {
  subscribe();
}
