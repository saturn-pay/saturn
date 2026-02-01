// Abstract base class for all proxy adapters
// Each adapter wraps a specific upstream API service

export interface QuoteResult {
  operation: string;
  quotedSats: number;
}

export interface ExecuteResult {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

export interface FinalizeResult {
  finalSats: number;
}

export abstract class BaseAdapter {
  abstract slug: string;

  // Estimate the cost in sats before executing
  abstract quote(body: unknown): Promise<QuoteResult>;

  // Execute the upstream API call
  abstract execute(body: unknown): Promise<ExecuteResult>;

  // Determine actual cost after execution (may be less than quoted)
  abstract finalize(response: ExecuteResult, quotedSats: number): Promise<FinalizeResult>;
}
