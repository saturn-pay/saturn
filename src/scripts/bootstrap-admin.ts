#!/usr/bin/env npx tsx
/**
 * Bootstrap script: creates the first admin account + primary agent.
 * Run once after deployment to get a master API key.
 *
 * Usage:
 *   npx tsx src/scripts/bootstrap-admin.ts --email you@saturn-pay.com --name "Saturn Admin"
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../db/client.js';
import { accounts, agents, wallets, policies } from '../db/schema/index.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, API_KEY_PREFIXES, DEFAULT_POLICY } from '../config/constants.js';

const BCRYPT_SALT_ROUNDS = 10;

function parseArgs(args: string[]): { email: string; name: string } {
  let email = '';
  let name = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[++i];
    } else if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    }
  }

  if (!email || !name) {
    console.error('Usage: npx tsx src/scripts/bootstrap-admin.ts --email <email> --name <name>');
    process.exit(1);
  }

  return { email, name };
}

async function main() {
  const { email, name } = parseArgs(process.argv.slice(2));

  const rawApiKey = API_KEY_PREFIXES.agent + crypto.randomBytes(32).toString('hex');
  const apiKeyHash = await bcrypt.hash(rawApiKey, BCRYPT_SALT_ROUNDS);
  const apiKeyPrefix = crypto.createHash('sha256').update(rawApiKey).digest('hex').slice(0, 16);

  const accountId = generateId(ID_PREFIXES.account);
  const agentId = generateId(ID_PREFIXES.agent);
  const walletId = generateId(ID_PREFIXES.wallet);
  const policyId = generateId(ID_PREFIXES.policy);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(accounts).values({
      id: accountId,
      name,
      email,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(agents).values({
      id: agentId,
      accountId,
      name: `${name} (primary)`,
      apiKeyHash,
      apiKeyPrefix,
      email,
      role: 'primary',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(wallets).values({
      id: walletId,
      agentId,
      balanceSats: 0,
      heldSats: 0,
      lifetimeIn: 0,
      lifetimeOut: 0,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(policies).values({
      id: policyId,
      agentId,
      maxPerCallSats: DEFAULT_POLICY.maxPerCallSats,
      maxPerDaySats: DEFAULT_POLICY.maxPerDaySats,
      allowedServices: DEFAULT_POLICY.allowedServices,
      deniedServices: DEFAULT_POLICY.deniedServices,
      allowedCapabilities: DEFAULT_POLICY.allowedCapabilities,
      deniedCapabilities: DEFAULT_POLICY.deniedCapabilities,
      killSwitch: DEFAULT_POLICY.killSwitch,
      maxBalanceSats: DEFAULT_POLICY.maxBalanceSats,
      createdAt: now,
      updatedAt: now,
    });
  });

  console.log('Bootstrap complete!');
  console.log('');
  console.log(`Account ID:  ${accountId}`);
  console.log(`Agent ID:    ${agentId}`);
  console.log(`API Key:     ${rawApiKey}`);
  console.log('');
  console.log('Save this API key securely — it will not be shown again.');

  process.exit(0);
}

main().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
