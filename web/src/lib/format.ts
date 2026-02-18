export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function formatUsdCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export function formatBrlCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatUsdMicros(micros: number): string {
  return (micros / 1000000).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
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
