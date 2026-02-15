/**
 * The Buggy Agent
 *
 * This agent has a subtle but expensive bug:
 * It retries when the response seems "incomplete" - but the check
 * is flawed and triggers retries even on valid responses.
 *
 * In production, this burns money until you notice.
 */

// Simulated cost per API call (in cents) - based on typical Claude API pricing
export const COST_PER_CALL_CENTS = 3; // ~$0.03 per call average

// The bug: This check is broken - it triggers on many valid responses
export function responseSeemsTruncated(response: string): boolean {
  // BUG: Many valid responses don't end with punctuation
  // e.g., code blocks, lists, JSON responses
  const endsWithPunctuation = /[.!?]$/.test(response.trim());

  // BUG: Short responses aren't always incomplete
  const isTooShort = response.length < 100;

  // This will trigger retries on ~60% of valid responses
  return !endsWithPunctuation || isTooShort;
}

// Exponential backoff that makes it worse
export function getRetryDelay(attempt: number): number {
  // Base delay of 100ms, doubles each time, max 5 seconds
  // But the bug means we keep retrying even with valid responses
  return Math.min(100 * Math.pow(2, attempt), 5000);
}

export interface AgentResult {
  response: string;
  attempts: number;
  totalCostCents: number;
  wasRejected: boolean;
  rejectionReason?: string;
}

// The prompt that triggers the bug
export const DEMO_PROMPT = "List 5 JavaScript array methods";

// Why this prompt triggers the bug:
// - The response is a list, often doesn't end with punctuation
// - The response might be short (just method names)
// - Perfectly valid, but triggers infinite retries
