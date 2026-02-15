/**
 * SATURN MODE - Protected API calls with spend limits
 *
 * Same buggy agent, but now running through Saturn.
 * When the daily limit is hit, calls are rejected cleanly.
 *
 * Run: npm run saturn
 */

import 'dotenv/config';
import { Saturn, SaturnPolicyDeniedError, SaturnInsufficientBalanceError } from '@saturn-pay/sdk';
import {
  responseSeemsTruncated,
  getRetryDelay,
  DEMO_PROMPT,
  type AgentResult,
} from './buggy-agent.js';

// ANSI colors for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSaturnAgent(): Promise<AgentResult> {
  console.log('\n' + '='.repeat(60));
  console.log(`${GREEN}${BOLD}  SATURN MODE - Spend protection enabled${RESET}`);
  console.log('='.repeat(60));

  // Initialize Saturn
  const apiKey = process.env.SATURN_API_KEY;
  if (!apiKey) {
    console.log(`\n${RED}Error: SATURN_API_KEY not set${RESET}`);
    console.log(`${GRAY}Create a .env file with your Saturn API key.${RESET}`);
    console.log(`${GRAY}Get one at: https://saturn-pay.com${RESET}\n`);
    process.exit(1);
  }

  const saturn = new Saturn({
    apiKey,
    baseUrl: process.env.SATURN_API_URL || 'https://api.saturn-pay.com',
  });

  // Display current policy
  console.log(`\n${GRAY}Checking agent policy...${RESET}`);

  try {
    const account = await saturn.accounts.me();
    console.log(`${GRAY}Account: ${account.name}${RESET}`);

    // Get wallet balance
    const wallet = await saturn.wallet.getSelf();
    console.log(`${GRAY}Balance: $${(wallet.balanceUsdCents / 100).toFixed(2)} USD${RESET}`);
  } catch (err) {
    console.log(`${YELLOW}Could not fetch account details${RESET}`);
  }

  console.log(`\n${YELLOW}Prompt:${RESET} "${DEMO_PROMPT}"\n`);

  let attempts = 0;
  let totalCostCents = 0;
  let lastResponse = '';
  const MAX_ATTEMPTS = 50;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    console.log(`${GRAY}[Call #${attempts}]${RESET}`);

    try {
      // Make the actual API call through Saturn
      const result = await saturn.reason({
        messages: [{ role: 'user', content: DEMO_PROMPT }],
        model: 'gpt-4o-mini',
        max_tokens: 200,
      });

      lastResponse = result.data.content;
      const costCents = Math.round(result.metadata.chargedSats * 0.04); // Approximate sats to cents
      totalCostCents += costCents;

      console.log(`  Response: "${lastResponse.substring(0, 50)}..."`);
      console.log(`  Cost: $${(costCents / 100).toFixed(2)}`);
      console.log(`  ${GREEN}Audit ID: ${result.metadata.auditId}${RESET}`);
      console.log(`  Running total: $${(totalCostCents / 100).toFixed(2)}`);

      // Check if response seems truncated (the bug)
      const isTruncated = responseSeemsTruncated(lastResponse);

      if (isTruncated) {
        const delay = getRetryDelay(attempts);
        console.log(`  ${YELLOW}BUG TRIGGERED: Response seems truncated, retrying...${RESET}`);
        console.log(`  ${GRAY}(waiting ${Math.min(delay, 500)}ms before retry)${RESET}\n`);
        await sleep(Math.min(delay, 500));
      } else {
        console.log(`  ${GRAY}Response accepted${RESET}\n`);
        break;
      }

    } catch (error) {
      // This is where Saturn saves you
      if (error instanceof SaturnPolicyDeniedError) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${GREEN}${BOLD}  SATURN PROTECTION ACTIVATED${RESET}`);
        console.log('='.repeat(60));
        console.log(`  ${GREEN}${BOLD}REJECTED: Policy limit reached${RESET}`);
        console.log(`  ${GRAY}Reason: ${error.message}${RESET}`);
        console.log(`\n  Total API calls before rejection: ${attempts}`);
        console.log(`  ${GREEN}Total cost: $${(totalCostCents / 100).toFixed(2)}${RESET}`);
        console.log(`\n  ${GREEN}${BOLD}The bug was caught. Your wallet is safe.${RESET}`);
        console.log('\n');

        return {
          response: lastResponse,
          attempts,
          totalCostCents,
          wasRejected: true,
          rejectionReason: 'POLICY_DENIED',
        };
      }

      if (error instanceof SaturnInsufficientBalanceError) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${GREEN}${BOLD}  SATURN PROTECTION ACTIVATED${RESET}`);
        console.log('='.repeat(60));
        console.log(`  ${GREEN}${BOLD}REJECTED: Insufficient balance${RESET}`);
        console.log(`\n  Total API calls before rejection: ${attempts}`);
        console.log(`  ${GREEN}Total cost: $${(totalCostCents / 100).toFixed(2)}${RESET}`);
        console.log(`\n  ${GREEN}${BOLD}Spending stopped at your funded limit.${RESET}`);
        console.log('\n');

        return {
          response: lastResponse,
          attempts,
          totalCostCents,
          wasRejected: true,
          rejectionReason: 'INSUFFICIENT_BALANCE',
        };
      }

      // Other errors
      console.log(`  ${RED}Error: ${error instanceof Error ? error.message : 'Unknown error'}${RESET}\n`);

      // Don't retry on non-policy errors
      break;
    }
  }

  // If we got here without rejection, the bug didn't trigger enough
  // (or policy limits weren't set tight enough for the demo)
  console.log('='.repeat(60));
  console.log(`${GREEN}${BOLD}  RESULT${RESET}`);
  console.log('='.repeat(60));
  console.log(`  Total API calls: ${attempts}`);
  console.log(`  Total cost: $${(totalCostCents / 100).toFixed(2)}`);

  if (attempts >= MAX_ATTEMPTS) {
    console.log(`\n  ${YELLOW}Note: Demo capped at ${MAX_ATTEMPTS} calls.${RESET}`);
    console.log(`  ${YELLOW}Set tighter policy limits to see rejection in action.${RESET}`);
  }

  console.log('\n');

  return {
    response: lastResponse,
    attempts,
    totalCostCents,
    wasRejected: false,
  };
}

// Run if executed directly
runSaturnAgent().catch(console.error);
