import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().url(),

  LND_SOCKET: z.string().default('localhost:10009'),
  LND_TLS_CERT: z.string().optional(),
  LND_MACAROON: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  E2B_API_KEY: z.string().optional(),
  JINA_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  SCRAPERAPI_API_KEY: z.string().optional(),
  HUNTER_API_KEY: z.string().optional(),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_ENVIRONMENT: z.string().optional(),

  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error('Invalid environment variables:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
