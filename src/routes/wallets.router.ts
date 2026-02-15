import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { wallets, invoices, transactions, agents } from '../db/schema/index.js';
import { requirePrimary, requireAuth } from '../middleware/auth.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, FUNDING } from '../config/constants.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import * as walletService from '../services/wallet.service.js';
import * as lightningService from '../services/lightning.service.js';
import { handleFundCard } from './stripe.router.js';
import { handleFundCardLemonSqueezy } from './lemonsqueezy.router.js';
import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const fundSchema = z.object({
  amountSats: z.number().int().min(FUNDING.minAmountSats).max(FUNDING.maxAmountSats),
});

// ---------------------------------------------------------------------------
// Shared handler factories
// ---------------------------------------------------------------------------

async function verifyAgentOwnership(agentId: string, accountId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.accountId, accountId)));

  if (!agent) {
    throw new NotFoundError('Agent', agentId);
  }

  return agent;
}

async function getWalletForAccount(accountId: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.accountId, accountId));

  if (!wallet) {
    throw new NotFoundError('Wallet for account', accountId);
  }

  return wallet;
}

// ---------------------------------------------------------------------------
// Handler: GET balance
// ---------------------------------------------------------------------------

async function handleGetBalance(walletId: string, res: Response): Promise<void> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) {
    throw new NotFoundError('Wallet', walletId);
  }

  res.json(wallet);
}

// ---------------------------------------------------------------------------
// Handler: POST fund
// ---------------------------------------------------------------------------

async function handleFund(
  walletId: string,
  accountId: string,
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = fundSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid fund request', parsed.error.issues);
  }

  const { amountSats } = parsed.data;

  // Create LND invoice
  const lnInvoice = await lightningService.createLightningInvoice(
    amountSats,
    `Saturn fund: account ${accountId}`,
    FUNDING.invoiceExpirySecs,
  );

  // Store invoice record
  const invoiceId = generateId(ID_PREFIXES.invoice);
  const [invoice] = await db
    .insert(invoices)
    .values({
      id: invoiceId,
      walletId,
      amountSats,
      paymentRequest: lnInvoice.paymentRequest,
      rHash: lnInvoice.rHash,
      status: 'pending',
      expiresAt: lnInvoice.expiresAt,
      createdAt: new Date(),
    })
    .returning();

  res.status(201).json({
    invoiceId: invoice.id,
    paymentRequest: invoice.paymentRequest,
    amountSats: invoice.amountSats,
    expiresAt: invoice.expiresAt,
  });
}

// ---------------------------------------------------------------------------
// Handler: GET invoices
// ---------------------------------------------------------------------------

async function handleGetInvoices(
  walletId: string,
  req: Request,
  res: Response,
): Promise<void> {
  const status = req.query.status as string | undefined;

  let query = db
    .select()
    .from(invoices)
    .where(eq(invoices.walletId, walletId))
    .orderBy(desc(invoices.createdAt))
    .$dynamic();

  if (status) {
    query = db
      .select()
      .from(invoices)
      .where(and(eq(invoices.walletId, walletId), eq(invoices.status, status as 'pending' | 'settled' | 'expired' | 'cancelled')))
      .orderBy(desc(invoices.createdAt))
      .$dynamic();
  }

  const rows = await query;

  res.json(rows);
}

// ---------------------------------------------------------------------------
// Handler: GET transactions
// ---------------------------------------------------------------------------

async function handleGetTransactions(
  walletId: string,
  req: Request,
  res: Response,
): Promise<void> {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.walletId, walletId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data: rows, limit, offset });
}

// ---------------------------------------------------------------------------
// Account-scoped router: /agents/:agentId/wallet
// ---------------------------------------------------------------------------

export const walletsRouter = Router({ mergeParams: true });

walletsRouter.use(requirePrimary);

// GET /agents/:agentId/wallet
walletsRouter.get('/', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);
  const wallet = await getWalletForAccount(account.id);

  await handleGetBalance(wallet.id, res);
});

// POST /agents/:agentId/wallet/fund
walletsRouter.post('/fund', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);
  const wallet = await getWalletForAccount(account.id);

  await handleFund(wallet.id, account.id, req, res);
});

// POST /agents/:agentId/wallet/fund-card
walletsRouter.post('/fund-card', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);
  const wallet = await getWalletForAccount(account.id);

  // Prefer LemonSqueezy if configured, fallback to Stripe
  if (env.LEMONSQUEEZY_API_KEY) {
    await handleFundCardLemonSqueezy(wallet.id, account.id, req, res);
  } else {
    await handleFundCard(wallet.id, account.id, req, res);
  }
});

// GET /agents/:agentId/wallet/invoices
walletsRouter.get('/invoices', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);
  const wallet = await getWalletForAccount(account.id);

  await handleGetInvoices(wallet.id, req, res);
});

// GET /agents/:agentId/wallet/transactions
walletsRouter.get('/transactions', async (req: Request, res: Response) => {
  const account = req.account!;
  const agentId = paramString(req.params.agentId);
  await verifyAgentOwnership(agentId, account.id);
  const wallet = await getWalletForAccount(account.id);

  await handleGetTransactions(wallet.id, req, res);
});

// ---------------------------------------------------------------------------
// Agent shortcut router: /wallet
// ---------------------------------------------------------------------------

export const agentWalletsRouter = Router();

agentWalletsRouter.use(requireAuth);

// GET /wallet
agentWalletsRouter.get('/', async (req: Request, res: Response) => {
  const wallet = req.wallet;
  if (!wallet) {
    throw new NotFoundError('Wallet');
  }

  await handleGetBalance(wallet.id, res);
});

// POST /wallet/fund
agentWalletsRouter.post('/fund', async (req: Request, res: Response) => {
  const account = req.account!;
  const wallet = req.wallet;
  if (!wallet) {
    throw new NotFoundError('Wallet');
  }

  await handleFund(wallet.id, account.id, req, res);
});

// POST /wallet/fund-card
agentWalletsRouter.post('/fund-card', async (req: Request, res: Response) => {
  const account = req.account!;
  const wallet = req.wallet;
  if (!wallet) {
    throw new NotFoundError('Wallet');
  }

  // Prefer LemonSqueezy if configured, fallback to Stripe
  if (env.LEMONSQUEEZY_API_KEY) {
    await handleFundCardLemonSqueezy(wallet.id, account.id, req, res);
  } else {
    await handleFundCard(wallet.id, account.id, req, res);
  }
});

// GET /wallet/invoices
agentWalletsRouter.get('/invoices', async (req: Request, res: Response) => {
  const wallet = req.wallet;
  if (!wallet) {
    throw new NotFoundError('Wallet');
  }

  await handleGetInvoices(wallet.id, req, res);
});

// GET /wallet/transactions
agentWalletsRouter.get('/transactions', async (req: Request, res: Response) => {
  const wallet = req.wallet;
  if (!wallet) {
    throw new NotFoundError('Wallet');
  }

  await handleGetTransactions(wallet.id, req, res);
});
