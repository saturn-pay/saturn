import cron from 'node-cron';
import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { invoices } from '../db/schema/index.js';
import { logger } from '../lib/logger.js';

/**
 * Expire pending invoices whose expiresAt has passed.
 * Runs every minute.
 */
async function expirePendingInvoices(): Promise<void> {
  try {
    const expired = await db
      .update(invoices)
      .set({ status: 'expired' })
      .where(
        and(
          eq(invoices.status, 'pending'),
          lte(invoices.expiresAt, new Date()),
        ),
      )
      .returning({ id: invoices.id });

    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Expired pending invoices');
    }
  } catch (err) {
    logger.error({ err }, 'Error expiring invoices');
  }
}

export function startInvoiceExpiryJob(): void {
  logger.info('Scheduling invoice expiry job (every minute)');
  cron.schedule('* * * * *', () => {
    void expirePendingInvoices();
  });
}
