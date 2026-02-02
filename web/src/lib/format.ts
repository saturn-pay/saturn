export function formatSats(sats: number): string {
  return sats.toLocaleString('en-US');
}

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string): string {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncateId(id: string, len = 12): string {
  if (id.length <= len) return id;
  return id.slice(0, len) + '\u2026';
}
