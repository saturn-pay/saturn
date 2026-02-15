/**
 * Agent Bug Cost Demo
 *
 * Same bug. Different financial outcome.
 *
 * This demo shows how a common agent bug (retry on "incomplete" response)
 * can burn through your budget - and how Saturn stops it.
 *
 * Run: npm run demo
 */

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function printBanner() {
  console.clear();
  console.log(`
${CYAN}${BOLD}
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║          THE $400 BUG - A CAUTIONARY TALE                 ║
    ║                                                           ║
    ║   Same bug. Different financial outcome.                  ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
${RESET}

${GRAY}This demo shows a common agent bug: retrying when the response
seems "incomplete". The bug is subtle but expensive.${RESET}

${YELLOW}The Bug:${RESET}
  - Agent checks if response ends with punctuation
  - Many valid responses (lists, code) don't end with "." or "!"
  - Agent retries... and retries... and retries...

${RED}Without Protection:${RESET}
  - Costs accumulate silently
  - You wake up to a surprise invoice
  - This is how $400 bugs happen

${GREEN}With Saturn:${RESET}
  - Daily spend limit kicks in
  - Calls rejected after limit
  - Process stops cleanly
  - You sleep peacefully

`);
}

async function promptUser(): Promise<'unsafe' | 'saturn' | 'both'> {
  printBanner();

  console.log(`${BOLD}Choose demo mode:${RESET}
  ${RED}1)${RESET} Unsafe mode  - See costs accumulate (simulated)
  ${GREEN}2)${RESET} Saturn mode  - See protection in action (requires API key)
  ${CYAN}3)${RESET} Both         - Compare side by side

`);

  // Simple stdin reading
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${YELLOW}Enter choice (1/2/3): ${RESET}`, (answer) => {
      rl.close();
      if (answer === '1') resolve('unsafe');
      else if (answer === '2') resolve('saturn');
      else resolve('both');
    });
  });
}

async function main() {
  const choice = await promptUser();

  if (choice === 'unsafe' || choice === 'both') {
    const { default: runUnsafe } = await import('./unsafe-mode.js');
  }

  if (choice === 'saturn' || choice === 'both') {
    if (choice === 'both') {
      console.log(`\n${GRAY}Press Enter to continue to Saturn mode...${RESET}`);
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });
    }
    const { default: runSaturn } = await import('./saturn-mode.js');
  }

  if (choice === 'both') {
    console.log(`
${'='.repeat(60)}
${CYAN}${BOLD}  COMPARISON${RESET}
${'='.repeat(60)}

${RED}Without Saturn:${RESET}
  - Bug runs unchecked
  - Costs accumulate until you notice
  - Projected overnight damage: $30+ (conservative)

${GREEN}With Saturn:${RESET}
  - Bug triggers same retries
  - Policy limit stops the bleeding
  - Maximum damage: Your daily cap

${BOLD}Same bug. Different financial outcome.${RESET}

Learn more: ${CYAN}https://saturn-pay.com${RESET}
`);
  }
}

main().catch(console.error);
