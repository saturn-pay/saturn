/**
 * UNSAFE MODE - Direct API calls without spend protection
 *
 * This simulates what happens when your buggy agent calls
 * an LLM API directly. No guardrails. No limits.
 *
 * Run: npm run unsafe
 */

import {
  responseSeemsTruncated,
  getRetryDelay,
  COST_PER_CALL_CENTS,
  DEMO_PROMPT,
  type AgentResult,
} from './buggy-agent.js';

// ANSI colors for terminal output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Simulated LLM responses (to avoid needing real API key for demo)
const SIMULATED_RESPONSES = [
  "1. map()\n2. filter()\n3. reduce()\n4. forEach()\n5. find()",
  "Here are 5 array methods:\n- push\n- pop\n- shift\n- unshift\n- slice",
  "Array methods: map, filter, reduce, find, some",
  "1. map() - transforms elements\n2. filter() - filters elements",
  "JavaScript arrays have methods like map, filter, and reduce",
];

function simulateLLMCall(): string {
  // Simulate API latency
  const response = SIMULATED_RESPONSES[Math.floor(Math.random() * SIMULATED_RESPONSES.length)];
  return response;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runUnsafeAgent(): Promise<AgentResult> {
  console.log('\n' + '='.repeat(60));
  console.log(`${RED}${BOLD}  UNSAFE MODE - No spend protection${RESET}`);
  console.log('='.repeat(60));
  console.log(`${GRAY}Simulating direct API calls without Saturn...${RESET}\n`);

  let attempts = 0;
  let totalCostCents = 0;
  const MAX_SIMULATED_CALLS = 50; // Cap simulation to avoid infinite loop

  console.log(`${YELLOW}Prompt:${RESET} "${DEMO_PROMPT}"\n`);

  while (attempts < MAX_SIMULATED_CALLS) {
    attempts++;
    totalCostCents += COST_PER_CALL_CENTS;

    const response = simulateLLMCall();
    const isTruncated = responseSeemsTruncated(response);

    // Log the call
    console.log(`${GRAY}[Call #${attempts}]${RESET}`);
    console.log(`  Response: "${response.substring(0, 50)}..."`);
    console.log(`  Cost: $${(COST_PER_CALL_CENTS / 100).toFixed(2)}`);
    console.log(`  ${RED}Running total: $${(totalCostCents / 100).toFixed(2)}${RESET}`);

    if (isTruncated) {
      const delay = getRetryDelay(attempts);
      console.log(`  ${YELLOW}BUG TRIGGERED: Response seems truncated, retrying...${RESET}`);
      console.log(`  ${GRAY}(waiting ${delay}ms before retry)${RESET}\n`);
      await sleep(Math.min(delay, 500)); // Speed up demo
    } else {
      console.log(`  ${GRAY}Response accepted${RESET}\n`);
      break;
    }
  }

  // Show the damage
  console.log('='.repeat(60));
  console.log(`${RED}${BOLD}  SIMULATION RESULT${RESET}`);
  console.log('='.repeat(60));
  console.log(`  Total API calls: ${attempts}`);
  console.log(`  ${RED}${BOLD}Total cost: $${(totalCostCents / 100).toFixed(2)}${RESET}`);

  if (attempts >= MAX_SIMULATED_CALLS) {
    console.log(`\n  ${RED}(Simulation capped at ${MAX_SIMULATED_CALLS} calls)${RESET}`);
    console.log(`  ${RED}In production, this would continue until:${RESET}`);
    console.log(`  ${RED}  - You notice and kill the process${RESET}`);
    console.log(`  ${RED}  - Your API quota is exhausted${RESET}`);
    console.log(`  ${RED}  - Your credit card is maxed out${RESET}`);

    // Project the real cost
    const projectedCalls = 1000; // Realistic overnight scenario
    const projectedCost = projectedCalls * COST_PER_CALL_CENTS;
    console.log(`\n  ${YELLOW}Projected damage (overnight, 1000 calls):${RESET}`);
    console.log(`  ${RED}${BOLD}  $${(projectedCost / 100).toFixed(2)}${RESET}`);
  }

  console.log('\n');

  return {
    response: 'Simulation ended',
    attempts,
    totalCostCents,
    wasRejected: false,
  };
}

// Run if executed directly
runUnsafeAgent().catch(console.error);
