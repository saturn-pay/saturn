import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { checkoutSessions } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, LEMONSQUEEZY_FUNDING } from '../config/constants.js';
import { ValidationError, AppError } from '../lib/errors.js';
import { createCheckout, verifyWebhookSignature } from '../lib/lemonsqueezy-client.js';
import * as walletService from '../services/wallet.service.js';
import * as pricing from '../services/pricing.service.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Webhook router (unauthenticated, raw body)
// ---------------------------------------------------------------------------

export const lemonsqueezyWebhookRouter = Router();

lemonsqueezyWebhookRouter.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['x-signature'] as string;

  if (!signature || !env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    res.status(400).json({ error: 'Missing signature or webhook secret' });
    return;
  }

  // Verify signature
  const rawBody = req.body;
  if (!verifyWebhookSignature(rawBody, signature, env.LEMONSQUEEZY_WEBHOOK_SECRET)) {
    logger.warn('LemonSqueezy webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch (err) {
    logger.warn({ err }, 'Failed to parse LemonSqueezy webhook body');
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const eventName = event.meta?.event_name;

  try {
    switch (eventName) {
      case 'order_created': {
        const orderId = event.data?.id;
        const checkoutSessionId = event.meta?.custom_data?.checkoutSessionId;
        const status = event.data?.attributes?.status;

        if (!checkoutSessionId) {
          logger.warn({ orderId }, 'Order missing checkoutSessionId in custom data');
          break;
        }

        // Only credit on successful order (status: 'paid')
        if (status !== 'paid') {
          logger.info({ orderId, status }, 'Order not paid yet, skipping credit');
          break;
        }

        // Atomically transition pending → completed
        const [updated] = await db
          .update(checkoutSessions)
          .set({
            status: 'completed',
            lemonOrderId: String(orderId),
            completedAt: new Date(),
          })
          .where(
            and(
              eq(checkoutSessions.id, checkoutSessionId),
              eq(checkoutSessions.status, 'pending'),
            ),
          )
          .returning();

        if (updated) {
          await walletService.creditFromCheckout(
            updated.walletId,
            updated.amountUsdCents,
            updated.id,
          );

          logger.info(
            { checkoutSessionId, walletId: updated.walletId, amountUsdCents: updated.amountUsdCents },
            'Wallet credited from LemonSqueezy order (USD)',
          );
        } else {
          logger.info({ checkoutSessionId }, 'Checkout session already processed or not found');
        }
        break;
      }

      case 'order_refunded': {
        const orderId = event.data?.id;
        const checkoutSessionId = event.meta?.custom_data?.checkoutSessionId;

        if (checkoutSessionId) {
          logger.warn({ checkoutSessionId, orderId }, 'Order refunded - manual review needed');
          // Note: Auto-reversing credits is risky. Log for manual review.
        }
        break;
      }

      default:
        logger.debug({ eventName }, 'Unhandled LemonSqueezy event type');
    }
  } catch (err) {
    logger.error({ err, eventName }, 'Error processing LemonSqueezy webhook');
  }

  // Always return 200 so LemonSqueezy doesn't retry
  res.status(200).json({ received: true });
});

// ---------------------------------------------------------------------------
// Fund card handler
// ---------------------------------------------------------------------------

const fundCardSchema = z.object({
  amountUsdCents: z.number().int().min(LEMONSQUEEZY_FUNDING.minAmountUsdCents).max(LEMONSQUEEZY_FUNDING.maxAmountUsdCents),
});

export async function handleFundCardLemonSqueezy(
  walletId: string,
  accountId: string,
  req: Request,
  res: Response,
): Promise<void> {
  if (!env.LEMONSQUEEZY_API_KEY || !env.LEMONSQUEEZY_STORE_ID || !env.LEMONSQUEEZY_VARIANT_ID) {
    throw new AppError(404, 'NOT_AVAILABLE', 'Card payments not enabled');
  }

  const parsed = fundCardSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid fund-card request', parsed.error.issues);
  }

  const { amountUsdCents } = parsed.data;

  // Get current BTC/USD rate
  const { btcUsd } = pricing.getCurrentRate();
  const amountSats = pricing.usdCentsToSats(amountUsdCents, btcUsd);

  if (amountSats <= 0) {
    throw new ValidationError('Amount too small to convert to sats at current rate');
  }

  const checkoutSessionId = generateId(ID_PREFIXES.checkoutSession);

  // Calculate expiry (30 minutes from now)
  const expiresAt = new Date(Date.now() + LEMONSQUEEZY_FUNDING.sessionExpirySecs * 1000);

  // Create LemonSqueezy checkout
  const checkout = await createCheckout({
    storeId: env.LEMONSQUEEZY_STORE_ID,
    variantId: env.LEMONSQUEEZY_VARIANT_ID,
    customPrice: amountUsdCents, // LemonSqueezy accepts cents
    checkoutData: {
      custom: {
        checkoutSessionId,
        walletId,
        accountId,
      },
    },
    productOptions: {
      name: 'Saturn Wallet Funding',
      description: `Add $${(amountUsdCents / 100).toFixed(2)} to your wallet`,
    },
    checkoutOptions: {
      embed: false,
      media: false,
      logo: true,
    },
    expiresAt: expiresAt.toISOString(),
  });

  // Insert checkout session record
  await db.insert(checkoutSessions).values({
    id: checkoutSessionId,
    walletId,
    provider: 'lemonsqueezy',
    lemonCheckoutId: checkout.id,
    amountUsdCents,
    btcUsdRate: btcUsd.toString(),
    amountSats,
    status: 'pending',
    createdAt: new Date(),
  });

  res.status(201).json({
    checkoutSessionId,
    checkoutUrl: checkout.url,
    amountUsdCents,
    amountSats,
    btcUsdRate: btcUsd,
    expiresAt: expiresAt.toISOString(),
  });
}
