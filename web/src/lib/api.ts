const API_BASE =
  process.env.NEXT_PUBLIC_SATURN_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: {
    apiKey?: string;
    method?: string;
    body?: unknown;
    params?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const { apiKey, method = 'GET', body, params } = options;

  const url = new URL(path, API_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, data.error?.message || data.message || res.statusText);
  }

  return res.json();
}
