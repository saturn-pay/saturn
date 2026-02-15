import crypto from 'crypto';
import { env } from '../config/env.js';

const LEMONSQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1';

export interface LemonSqueezyCheckout {
  id: string;
  url: string;
  expires_at: string | null;
}

export interface CreateCheckoutOptions {
  storeId: string;
  variantId: string;
  customPrice: number; // in cents
  checkoutData: {
    custom: Record<string, string>;
  };
  productOptions?: {
    name?: string;
    description?: string;
    redirectUrl?: string;
  };
  checkoutOptions?: {
    embed?: boolean;
    media?: boolean;
    logo?: boolean;
  };
  expiresAt?: string;
}

let apiKey: string | null = null;

export function getLemonSqueezyApiKey(): string {
  if (!apiKey) {
    if (!env.LEMONSQUEEZY_API_KEY) {
      throw new Error('LEMONSQUEEZY_API_KEY is not configured');
    }
    apiKey = env.LEMONSQUEEZY_API_KEY;
  }
  return apiKey;
}

export async function createCheckout(options: CreateCheckoutOptions): Promise<LemonSqueezyCheckout> {
  const key = getLemonSqueezyApiKey();

  const response = await fetch(`${LEMONSQUEEZY_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          custom_price: options.customPrice,
          product_options: {
            ...options.productOptions,
            redirect_url: options.productOptions?.redirectUrl,
          },
          checkout_options: options.checkoutOptions || {},
          checkout_data: options.checkoutData,
          expires_at: options.expiresAt,
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: options.storeId,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: options.variantId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`LemonSqueezy API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return {
    id: data.data.id,
    url: data.data.attributes.url,
    expires_at: data.data.attributes.expires_at,
  };
}

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
