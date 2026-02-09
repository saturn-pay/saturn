'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';

// Simple syntax highlighter for JavaScript/TypeScript
function highlightCode(code: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let key = 0;

  // Patterns for syntax highlighting
  const patterns = [
    { regex: /(\/\/[^\n]*)/g, className: 'text-zinc-500' }, // comments
    { regex: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, className: 'text-accent' }, // strings
    { regex: /\b(import|export|from|const|let|var|function|return|await|async|new|if|else|for|while|class|extends|typeof|instanceof)\b/g, className: 'text-purple-400' }, // keywords
    { regex: /\b(true|false|null|undefined|this)\b/g, className: 'text-orange-400' }, // literals
    { regex: /\b(\d+\.?\d*)\b/g, className: 'text-orange-400' }, // numbers
    { regex: /\b(console|Saturn|result|saturn|item|df|pd)\b/g, className: 'text-blue-400' }, // special identifiers
    { regex: /\.(log|reason|search|read|email|execute|data|content|title|url|results|forEach|metadata|chargedSats|stdout|describe|DataFrame)\b/g, className: 'text-yellow-400' }, // methods
  ];

  // Split code into lines and process each
  const lines = code.split('\n');

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      tokens.push(<br key={`br-${key++}`} />);
    }

    // Check if line is a comment
    if (line.trim().startsWith('//')) {
      tokens.push(<span key={key++} className="text-zinc-500">{line}</span>);
      return;
    }

    let remaining = line;
    let position = 0;

    while (remaining.length > 0) {
      let earliestMatch: { index: number; length: number; className: string; text: string } | null = null;

      // Find the earliest match among all patterns
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(remaining);
        if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            className: pattern.className,
            text: match[0],
          };
        }
      }

      if (earliestMatch) {
        // Add text before match
        if (earliestMatch.index > 0) {
          tokens.push(<span key={key++} className="text-zinc-300">{remaining.slice(0, earliestMatch.index)}</span>);
        }
        // Add matched token
        tokens.push(<span key={key++} className={earliestMatch.className}>{earliestMatch.text}</span>);
        remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
        position += earliestMatch.index + earliestMatch.length;
      } else {
        // No more matches, add remaining text
        tokens.push(<span key={key++} className="text-zinc-300">{remaining}</span>);
        break;
      }
    }
  });

  return tokens;
}

const EXAMPLES = {
  reason: {
    title: 'AI Reasoning',
    description: 'Use LLMs (GPT-4, Claude) for text generation, analysis, and code.',
    code: `import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({ apiKey: 'YOUR_API_KEY' });

const result = await saturn.reason({
  prompt: 'Explain quantum computing in one sentence',
});

console.log(result.data.content);
// "Quantum computing uses qubits that can exist in multiple states
// simultaneously to perform calculations exponentially faster than
// classical computers for certain problems."

console.log(\`Cost: \${result.metadata.chargedSats} sats\`);`,
  },
  search: {
    title: 'Web Search',
    description: 'Get real-time search results from the web.',
    code: `import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({ apiKey: 'YOUR_API_KEY' });

const result = await saturn.search({
  query: 'latest AI news today',
});

result.data.results.forEach(item => {
  console.log(item.title, item.url);
});`,
  },
  read: {
    title: 'Read URLs',
    description: 'Extract clean text content from any URL.',
    code: `import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({ apiKey: 'YOUR_API_KEY' });

const result = await saturn.read({
  url: 'https://example.com/article',
});

console.log(result.data.content);
console.log(result.data.title);`,
  },
  email: {
    title: 'Send Email',
    description: 'Send transactional emails programmatically.',
    code: `import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({ apiKey: 'YOUR_API_KEY' });

await saturn.email({
  to: 'user@example.com',
  subject: 'Your report is ready',
  html: '<h1>Report</h1><p>Your weekly report is attached.</p>',
});`,
  },
  execute: {
    title: 'Run Code',
    description: 'Execute code in a sandboxed environment.',
    code: `import { Saturn } from '@saturn-pay/sdk';

const saturn = new Saturn({ apiKey: 'YOUR_API_KEY' });

const result = await saturn.execute({
  code: \`
    import pandas as pd
    df = pd.DataFrame({'x': [1,2,3], 'y': [4,5,6]})
    print(df.describe())
  \`,
  language: 'python',
});

console.log(result.data.stdout);`,
  },
};

type ExampleKey = keyof typeof EXAMPLES;

export default function QuickstartPage() {
  const { apiKey } = useAuth();
  const [copied, setCopied] = useState(false);
  const [selectedExample, setSelectedExample] = useState<ExampleKey>('reason');

  const copyCode = async (code: string) => {
    const codeWithKey = code.replace('YOUR_API_KEY', apiKey || 'YOUR_API_KEY');
    await navigator.clipboard.writeText(codeWithKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const example = EXAMPLES[selectedExample];

  // Memoize highlighted code
  const highlightedCode = useMemo(() => {
    const codeWithKey = example.code.replace('YOUR_API_KEY', apiKey || 'YOUR_API_KEY');
    return highlightCode(codeWithKey);
  }, [example.code, apiKey]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Quickstart</h1>
      <p className="text-sm text-muted mb-8">
        Get up and running in under 3 minutes.
      </p>

      {/* Step 1: Install */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-black text-xs font-bold flex items-center justify-center">
            1
          </div>
          <h2 className="font-semibold">Install the SDK</h2>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <code className="text-sm font-mono text-accent">npm install @saturn-pay/sdk</code>
        </div>
      </div>

      {/* Step 2: Initialize */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-black text-xs font-bold flex items-center justify-center">
            2
          </div>
          <h2 className="font-semibold">Initialize with your API key</h2>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <pre className="text-sm font-mono overflow-x-auto">
            <span className="text-purple-400">import</span>{' '}
            <span className="text-zinc-300">{'{ Saturn }'}</span>{' '}
            <span className="text-purple-400">from</span>{' '}
            <span className="text-accent">&apos;@saturn-pay/sdk&apos;</span>;{'\n\n'}
            <span className="text-purple-400">const</span>{' '}
            <span className="text-zinc-300">saturn</span>{' '}
            <span className="text-muted">=</span>{' '}
            <span className="text-purple-400">new</span>{' '}
            <span className="text-blue-400">Saturn</span>({'{'}
            {'\n'}  apiKey:{' '}
            <span className="text-accent">&apos;{apiKey || 'YOUR_API_KEY'}&apos;</span>
            {'\n'}{'}'});
          </pre>
        </div>
        {apiKey && (
          <p className="text-xs text-muted mt-3">
            Your API key is pre-filled above. Keep it secret!
          </p>
        )}
      </div>

      {/* Step 3: Make a call */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-black text-xs font-bold flex items-center justify-center">
            3
          </div>
          <h2 className="font-semibold">Make your first API call</h2>
        </div>

        {/* Example selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(EXAMPLES) as ExampleKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedExample(key)}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${
                selectedExample === key
                  ? 'btn-primary'
                  : 'bg-surface border border-border hover:border-zinc-500'
              }`}
            >
              {EXAMPLES[key].title}
            </button>
          ))}
        </div>

        {/* Example code */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-surface px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">{example.title}</span>
              <span className="text-xs text-muted ml-2">{example.description}</span>
            </div>
            <button
              onClick={() => copyCode(example.code)}
              className="btn-secondary px-3 py-1.5 rounded-lg text-xs"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="p-4 text-sm font-mono overflow-x-auto bg-background">
            <code>{highlightedCode}</code>
          </pre>
        </div>
      </div>

      {/* Step 4: Add funds */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-black text-xs font-bold flex items-center justify-center">
            4
          </div>
          <h2 className="font-semibold">Add funds to start making calls</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          API calls are pay-per-use. Add funds with card or Lightning to get started.
        </p>
        <a
          href="/wallet"
          className="btn-primary inline-block px-5 py-2.5 rounded-lg text-sm"
        >
          Add funds
        </a>
      </div>

      {/* Capabilities reference */}
      <div className="border-t border-border pt-8">
        <h2 className="font-semibold mb-4">All Capabilities</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.reason()</code>
            <span className="text-muted">LLM inference</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.search()</code>
            <span className="text-muted">Web search</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.read()</code>
            <span className="text-muted">URL to text</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.scrape()</code>
            <span className="text-muted">Web scraping</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.execute()</code>
            <span className="text-muted">Code execution</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.email()</code>
            <span className="text-muted">Send email</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.sms()</code>
            <span className="text-muted">Send SMS</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.imagine()</code>
            <span className="text-muted">Image generation</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.speak()</code>
            <span className="text-muted">Text-to-speech</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-surface px-2 py-1 rounded-lg text-xs border border-border text-accent">saturn.transcribe()</code>
            <span className="text-muted">Speech-to-text</span>
          </div>
        </div>
        <a
          href="/pricing"
          className="inline-block mt-5 text-sm text-muted hover:text-accent transition-colors"
        >
          View pricing for all capabilities →
        </a>
      </div>
    </div>
  );
}
