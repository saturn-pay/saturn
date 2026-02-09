'use client';

import { useState } from 'react';

export function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <div className="font-mono text-sm break-all select-all">{apiKey}</div>
      <button
        onClick={copy}
        className="mt-3 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-background transition-colors"
      >
        {copied ? 'Copied' : 'Copy to clipboard'}
      </button>
    </div>
  );
}
