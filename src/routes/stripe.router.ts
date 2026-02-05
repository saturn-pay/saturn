import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { checkoutSessions } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, STRIPE_FUNDING } from '../config/constants.js';
import { ValidationError, AppError } from '../lib/errors.js';
import { getStripe } from '../lib/stripe-client.js';
import * as walletService from '../services/wallet.service.js';
import * as pricing from '../services/pricing.service.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Webhook router (unauthenticated, raw body)
// ---------------------------------------------------------------------------

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'] as string;

  if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(400).json({ error: 'Missing signature or webhook secret' });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: `Webhook signature failed: ${message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const checkoutSessionId = session.metadata?.checkoutSessionId;

        if (!checkoutSessionId) {
          logger.warn({ sessionId: session.id }, 'Checkout session missing checkoutSessionId metadata');
          break;
        }

        // Atomically transition pending → completed (prevents double-credit)
        const [updated] = await db
          .update(checkoutSessions)
          .set({
            status: 'completed',
            stripePaymentIntentId: session.payment_intent as string | null,
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
            updated.amountSats,
            updated.id,
          );
          logger.info(
            { checkoutSessionId, walletId: updated.walletId, amountSats: updated.amountSats },
            'Wallet credited from Stripe checkout',
          );
        } else {
          logger.info({ checkoutSessionId }, 'Checkout session already processed or not found');
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const checkoutSessionId = session.metadata?.checkoutSessionId;

        if (checkoutSessionId) {
          await db
            .update(checkoutSessions)
            .set({ status: 'expired' })
            .where(
              and(
                eq(checkoutSessions.id, checkoutSessionId),
                eq(checkoutSessions.status, 'pending'),
              ),
            );
          logger.info({ checkoutSessionId }, 'Checkout session expired');
        }
        break;
      }

      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event type');
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, 'Error processing Stripe webhook');
  }

  // Always return 200 so Stripe doesn't retry
  res.status(200).json({ received: true });
});

// ---------------------------------------------------------------------------
// Fund card handler (shared by both routers)
// ---------------------------------------------------------------------------

const fundCardSchema = z.object({
  amountUsdCents: z.number().int().min(STRIPE_FUNDING.minAmountUsdCents).max(STRIPE_FUNDING.maxAmountUsdCents),
});

export async function handleFundCard(
  walletId: string,
  accountId: string,
  req: Request,
  res: Response,
): Promise<void> {
  if (!env.STRIPE_SECRET_KEY) {
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

  // Create Stripe Checkout session
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Saturn Wallet Funding',
            description: `${amountSats.toLocaleString()} sats at $${(btcUsd).toLocaleString()}/BTC`,
          },
          unit_amount: amountUsdCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      checkoutSessionId,
      walletId,
      accountId,
    },
    expires_at: Math.floor(Date.now() / 1000) + STRIPE_FUNDING.sessionExpirySecs,
    success_url: `${req.headers.origin || 'https://app.trysaturn.com'}/wallet?funded=true`,
    cancel_url: `${req.headers.origin || 'https://app.trysaturn.com'}/wallet?funded=false`,
  });

  // Insert checkout session record
  await db.insert(checkoutSessions).values({
    id: checkoutSessionId,
    walletId,
    stripeSessionId: session.id,
    amountUsdCents,
    btcUsdRate: btcUsd.toString(),
    amountSats,
    status: 'pending',
    createdAt: new Date(),
  });

  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + STRIPE_FUNDING.sessionExpirySecs * 1000).toISOString();

  res.status(201).json({
    checkoutSessionId,
    checkoutUrl: session.url,
    amountUsdCents,
    amountSats,
    btcUsdRate: btcUsd,
    expiresAt,
  });
}
