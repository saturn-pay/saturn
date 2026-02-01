// Normalized response types for each capability verb.
// Every response includes `raw` — the unmodified upstream response for agents that need it.

export interface NormalizedReasonResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  raw: unknown;
}

export interface NormalizedSearchResponse {
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  raw: unknown;
}

export interface NormalizedReadResponse {
  content: string;
  title?: string;
  raw: unknown;
}

export interface NormalizedScrapeResponse {
  html: string;
  text?: string;
  metadata?: Record<string, unknown>;
  raw: unknown;
}

export interface NormalizedExecuteResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  raw: unknown;
}

export interface NormalizedEmailResponse {
  id: string;
  status: string;
  raw: unknown;
}

export interface NormalizedSmsResponse {
  sid: string;
  status: string;
  raw: unknown;
}

export interface NormalizedImagineResponse {
  url: string;
  raw: unknown;
}

export interface NormalizedSpeakResponse {
  audio: string;
  format: string;
  raw: unknown;
}

export interface NormalizedTranscribeResponse {
  text: string;
  raw: unknown;
}

export type NormalizedResponse =
  | NormalizedReasonResponse
  | NormalizedSearchResponse
  | NormalizedReadResponse
  | NormalizedScrapeResponse
  | NormalizedExecuteResponse
  | NormalizedEmailResponse
  | NormalizedSmsResponse
  | NormalizedImagineResponse
  | NormalizedSpeakResponse
  | NormalizedTranscribeResponse;
