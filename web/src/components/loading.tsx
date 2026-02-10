export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <svg
      className={`${sizes[size]} animate-spin text-accent`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        <span className="text-sm text-muted">Loading...</span>
      </div>
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="border border-border rounded-xl p-6 bg-surface animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-1/4 mb-4" />
      <div className="h-8 bg-zinc-800 rounded w-1/2 mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-1/3" />
    </div>
  );
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="bg-surface border-b border-border px-4 py-3">
        <div className="h-4 bg-zinc-800 rounded w-1/3 animate-pulse" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-b border-border last:border-b-0 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-3 bg-zinc-800 rounded w-1/6" />
            <div className="h-3 bg-zinc-800 rounded w-1/4" />
            <div className="h-3 bg-zinc-800 rounded w-1/5" />
            <div className="h-3 bg-zinc-800 rounded w-1/6 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border rounded-xl p-5 bg-surface animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-2/3 mb-3" />
          <div className="h-7 bg-zinc-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
