import { subscribeToInvoices } from 'ln-service';
import { eq, and } from 'drizzle-orm';
import { lnd } from '../lib/lnd-client.js';
import { db } from '../db/client.js';
import { invoices, wallets, accounts } from '../db/schema/index.js';
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
    // Atomically claim the invoice — UPDATE only succeeds if status is still 'pending'.
    // This prevents double-credit when duplicate events arrive.
    const [claimed] = await db
      .update(invoices)
      .set({
        status: 'settled',
        settledAt: new Date(),
      })
      .where(and(eq(invoices.rHash, rHash), eq(invoices.status, 'pending')))
      .returning();

    if (!claimed) {
      // Either not our invoice, or already settled/expired — safe to ignore
      logger.debug({ rHash }, 'Invoice not found or already settled — skipping');
      return;
    }

    // Credit the wallet (idempotent via unique constraint on transactions)
    await walletService.creditFromInvoice(
      claimed.walletId,
      claimed.amountSats,
      claimed.id,
    );

    // Set account's defaultCurrency to sats if still at default (usd_cents)
    // First Lightning funding sets the preference to sats
    const [wallet] = await db
      .select({ accountId: wallets.accountId })
      .from(wallets)
      .where(eq(wallets.id, claimed.walletId));

    if (wallet) {
      await db
        .update(accounts)
        .set({ defaultCurrency: 'sats', updatedAt: new Date() })
        .where(
          and(
            eq(accounts.id, wallet.accountId),
            eq(accounts.defaultCurrency, 'usd_cents'), // Only if still at default
          ),
        );
    }

    logger.info(
      { invoiceId: claimed.id, walletId: claimed.walletId, amountSats: claimed.amountSats },
      'Invoice settled and wallet credited (sats)',
    );
  } catch (err) {
    logger.error({ rHash, err }, 'Error processing settled invoice');
  }
}

// ---------------------------------------------------------------------------
// Subscribe with auto-reconnect
// ---------------------------------------------------------------------------

function subscribe(): void {
  if (!lnd) {
    logger.warn('LND not available — invoice watcher not started');
    return;
  }

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

export function stopInvoiceWatcher(): void {
  if (subscription) {
    subscription.removeAllListeners();
    subscription = null;
    logger.info('Invoice watcher stopped');
  }
}
