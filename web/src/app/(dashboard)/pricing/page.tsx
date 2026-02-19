'use client';

import { useEffect, useState } from 'react';
import { LoadingPage } from '@/components/loading';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { Capability } from '@/lib/types';

function formatUsdMicros(micros: number): string {
  return (micros / 1000000).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

// Simple syntax highlighter for JavaScript code
function highlightCode(code: string): JSX.Element[] {
  const keywords = ['const', 'let', 'var', 'await', 'async', 'function', 'return', 'if', 'else', 'for', 'while'];
  const builtins = ['console', 'log', 'forEach', 'map', 'filter'];

  const lines = code.split('\n');
  return lines.map((line, lineIndex) => {
    const parts: JSX.Element[] = [];
    let remaining = line;
    let keyIndex = 0;

    while (remaining.length > 0) {
      // Check for comments
      const commentMatch = remaining.match(/^(\/\/.*)$/);
      if (commentMatch) {
        parts.push(<span key={keyIndex++} className="text-zinc-500">{commentMatch[1]}</span>);
        remaining = '';
        continue;
      }

      // Check for strings (single or double quotes)
      const stringMatch = remaining.match(/^('[^']*'|"[^"]*")/);
      if (stringMatch) {
        parts.push(<span key={keyIndex++} className="text-amber-400">{stringMatch[1]}</span>);
        remaining = remaining.slice(stringMatch[1].length);
        continue;
      }

      // Check for keywords
      const keywordMatch = remaining.match(new RegExp(`^(${keywords.join('|')})\\b`));
      if (keywordMatch) {
        parts.push(<span key={keyIndex++} className="text-purple-400">{keywordMatch[1]}</span>);
        remaining = remaining.slice(keywordMatch[1].length);
        continue;
      }

      // Check for builtins
      const builtinMatch = remaining.match(new RegExp(`^(${builtins.join('|')})\\b`));
      if (builtinMatch) {
        parts.push(<span key={keyIndex++} className="text-cyan-400">{builtinMatch[1]}</span>);
        remaining = remaining.slice(builtinMatch[1].length);
        continue;
      }

      // Check for saturn methods
      const saturnMatch = remaining.match(/^(saturn\.)(\w+)/);
      if (saturnMatch) {
        parts.push(<span key={keyIndex++} className="text-zinc-300">{saturnMatch[1]}</span>);
        parts.push(<span key={keyIndex++} className="text-green-400">{saturnMatch[2]}</span>);
        remaining = remaining.slice(saturnMatch[0].length);
        continue;
      }

      // Check for property access (.data, .results, etc)
      const propMatch = remaining.match(/^(\.\w+)/);
      if (propMatch) {
        parts.push(<span key={keyIndex++} className="text-blue-300">{propMatch[1]}</span>);
        remaining = remaining.slice(propMatch[1].length);
        continue;
      }

      // Check for numbers
      const numMatch = remaining.match(/^(\d+)/);
      if (numMatch) {
        parts.push(<span key={keyIndex++} className="text-orange-400">{numMatch[1]}</span>);
        remaining = remaining.slice(numMatch[1].length);
        continue;
      }

      // Default: take one character
      parts.push(<span key={keyIndex++} className="text-zinc-300">{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }

    return (
      <div key={lineIndex}>
        {parts.length > 0 ? parts : <span>&nbsp;</span>}
      </div>
    );
  });
}

// Copy icon component
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

// Capabilities that are coming soon (not yet available)
const COMING_SOON_CAPABILITIES = new Set(['execute', 'email', 'sms']);

// Parameter definitions for each capability
const CAPABILITY_PARAMS: Record<string, Array<{
  name: string;
  type: string;
  required: boolean;
  description: string;
  options?: string[];
}>> = {
  reason: [
    { name: 'prompt', type: 'string', required: true, description: 'The prompt or question' },
    { name: 'messages', type: 'array', required: false, description: 'Chat messages array (alternative to prompt)' },
    { name: 'model', type: 'string', required: false, description: 'Model to use', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-opus', 'claude-3-sonnet'] },
    { name: 'maxTokens', type: 'number', required: false, description: 'Maximum tokens in response' },
    { name: 'temperature', type: 'number', required: false, description: 'Randomness (0-1)' },
  ],
  search: [
    { name: 'query', type: 'string', required: true, description: 'Search query' },
    { name: 'numResults', type: 'number', required: false, description: 'Number of results (default: 10)' },
  ],
  read: [
    { name: 'url', type: 'string', required: true, description: 'URL to extract content from' },
  ],
  scrape: [
    { name: 'url', type: 'string', required: true, description: 'URL to scrape' },
    { name: 'selector', type: 'string', required: false, description: 'CSS selector to extract' },
  ],
  execute: [
    { name: 'code', type: 'string', required: true, description: 'Code to execute' },
    { name: 'language', type: 'string', required: false, description: 'Language', options: ['python', 'javascript', 'typescript'] },
  ],
  email: [
    { name: 'to', type: 'string', required: true, description: 'Recipient email' },
    { name: 'subject', type: 'string', required: true, description: 'Email subject' },
    { name: 'body', type: 'string', required: true, description: 'Email body (HTML or text)' },
    { name: 'from', type: 'string', required: false, description: 'Sender name' },
  ],
  sms: [
    { name: 'to', type: 'string', required: true, description: 'Phone number (E.164 format)' },
    { name: 'body', type: 'string', required: true, description: 'Message text' },
  ],
  imagine: [
    { name: 'prompt', type: 'string', required: true, description: 'Image description' },
    { name: 'model', type: 'string', required: false, description: 'Model to use', options: ['dall-e-3', 'stable-diffusion-xl'] },
    { name: 'width', type: 'number', required: false, description: 'Image width' },
    { name: 'height', type: 'number', required: false, description: 'Image height' },
  ],
  speak: [
    { name: 'text', type: 'string', required: true, description: 'Text to convert to speech' },
    { name: 'voice', type: 'string', required: false, description: 'Voice ID' },
  ],
  transcribe: [
    { name: 'audio', type: 'string', required: true, description: 'Audio URL or base64' },
    { name: 'language', type: 'string', required: false, description: 'Language code (e.g., "en")' },
  ],
};

// Code examples for each capability
const CAPABILITY_EXAMPLES: Record<string, string> = {
  reason: `const result = await saturn.reason({
  prompt: 'Explain quantum computing',
  model: 'gpt-4o',        // optional
  maxTokens: 500,         // optional
});

console.log(result.data.content);`,
  search: `const result = await saturn.search({
  query: 'latest AI news',
  numResults: 5,          // optional
});

result.data.results.forEach(r => {
  console.log(r.title, r.url);
});`,
  read: `const result = await saturn.read({
  url: 'https://example.com/article',
});

console.log(result.data.content);
console.log(result.data.title);`,
  scrape: `const result = await saturn.scrape({
  url: 'https://example.com',
  selector: '.main-content',  // optional
});

console.log(result.data.html);`,
  execute: `const result = await saturn.execute({
  code: 'print(sum([1, 2, 3, 4, 5]))',
  language: 'python',     // optional
});

console.log(result.data.stdout);`,
  email: `await saturn.email({
  to: 'user@example.com',
  subject: 'Hello!',
  body: '<h1>Welcome</h1><p>Your account is ready.</p>',
});`,
  sms: `await saturn.sms({
  to: '+1234567890',
  body: 'Your verification code is 123456',
});`,
  imagine: `const result = await saturn.imagine({
  prompt: 'A futuristic city at sunset',
  model: 'dall-e-3',      // optional
});

console.log(result.data.url);`,
  speak: `const result = await saturn.speak({
  text: 'Hello, welcome to Saturn!',
  voice: 'alloy',         // optional
});

console.log(result.data.audio); // base64`,
  transcribe: `const result = await saturn.transcribe({
  audio: 'https://example.com/audio.mp3',
  language: 'en',         // optional
});

console.log(result.data.text);`,
};

export default function PricingPage() {
  const { apiKey } = useAuth();
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());
  const [copiedCap, setCopiedCap] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    apiFetch<Capability[]>('/v1/capabilities', { apiKey })
      .then(setCapabilities)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load pricing');
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  const toggleExpand = (cap: string) => {
    setExpandedCaps(prev => {
      const next = new Set(prev);
      if (next.has(cap)) {
        next.delete(cap);
      } else {
        next.add(cap);
      }
      return next;
    });
  };

  const copyExample = async (cap: string) => {
    await navigator.clipboard.writeText(CAPABILITY_EXAMPLES[cap] || '');
    setCopiedCap(cap);
    setTimeout(() => setCopiedCap(null), 2000);
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (error) {
    return <div className="text-sm text-red-400">Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">API Reference</h1>
      <p className="text-sm text-muted mb-8">
        All capabilities, parameters, and pricing. Pay only for what you use.
      </p>

      {capabilities.length === 0 ? (
        <div className="border border-border rounded-xl p-8 text-center text-muted">
          No capabilities available yet.
        </div>
      ) : (
        <div className="space-y-4">
          {capabilities.map((cap) => {
            const isExpanded = expandedCaps.has(cap.capability);
            const params = CAPABILITY_PARAMS[cap.capability] || [];
            const example = CAPABILITY_EXAMPLES[cap.capability] || '';

            return (
              <div
                key={cap.capability}
                className="border border-border rounded-xl bg-surface hover:border-zinc-600 transition-colors overflow-hidden"
              >
                {/* Header - always visible */}
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => toggleExpand(cap.capability)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm font-semibold bg-background px-2.5 py-1 rounded-lg border border-border text-accent">
                          saturn.{cap.capability}()
                        </code>
                        {COMING_SOON_CAPABILITIES.has(cap.capability) && (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-medium">
                            Coming soon
                          </span>
                        )}
                        <svg
                          className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <p className="text-sm text-muted">{cap.description}</p>
                    </div>
                  </div>

                  {/* Compact pricing - always visible */}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {cap.pricing.slice(0, 3).map((p, i) => (
                      <span key={i} className="text-xs bg-background px-2 py-1 rounded border border-border">
                        <span className="text-zinc-400">{p.operation}</span>
                        <span className="text-accent ml-2">{formatUsdMicros(p.priceUsdMicros)}</span>
                      </span>
                    ))}
                    {cap.pricing.length > 3 && (
                      <span className="text-xs text-muted">+{cap.pricing.length - 3} more</span>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Parameters */}
                    {params.length > 0 && (
                      <div className="p-5 border-b border-border">
                        <div className="text-xs text-muted uppercase tracking-wider mb-3">Parameters</div>
                        <div className="space-y-2">
                          {params.map((param) => (
                            <div key={param.name} className="flex items-start gap-4 text-sm">
                              <div className="w-28 shrink-0">
                                <code className="text-accent">{param.name}</code>
                                {param.required && <span className="text-red-400 ml-1">*</span>}
                              </div>
                              <div className="w-20 shrink-0 text-muted text-xs font-mono">{param.type}</div>
                              <div className="flex-1 text-zinc-400">
                                {param.description}
                                {param.options && (
                                  <span className="text-muted ml-1">
                                    ({param.options.join(', ')})
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Providers & Models */}
                    <div className="p-5 border-b border-border">
                      <div className="text-xs text-muted uppercase tracking-wider mb-3">Providers & Models</div>
                      <div className="flex flex-wrap gap-2">
                        {cap.providers.map((provider) => (
                          <div key={provider.slug} className="bg-background border border-border rounded-lg px-3 py-2">
                            <div className="text-xs font-medium text-zinc-300 capitalize mb-1.5">{provider.slug}</div>
                            {provider.models && provider.models.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {provider.models.map((model) => (
                                  <span
                                    key={model}
                                    className="text-xs bg-zinc-800 text-accent px-2 py-0.5 rounded font-mono"
                                  >
                                    {model}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted">Default model</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Full Pricing */}
                    <div className="p-5 border-b border-border bg-background/50">
                      <div className="text-xs text-muted uppercase tracking-wider mb-3">Pricing</div>
                      <div className="space-y-2">
                        {cap.pricing.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-300">
                              {p.operation}
                              <span className="text-muted ml-1">({p.unit.replace(/_/g, ' ')})</span>
                            </span>
                            <span className="font-mono text-xs text-accent">
                              {formatUsdMicros(p.priceUsdMicros)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Code Example */}
                    {example && (
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs text-muted uppercase tracking-wider">Example</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyExample(cap.capability);
                            }}
                            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
                          >
                            {copiedCap === cap.capability ? (
                              <>
                                <CheckIcon className="text-green-400" />
                                <span className="text-green-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <CopyIcon />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-background rounded-lg p-4 text-xs font-mono overflow-x-auto border border-border">
                          <code>{highlightCode(example)}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
