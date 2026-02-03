import { authenticatedLndGrpc } from 'ln-service';
// getInvoices exists at runtime but is missing from type definitions
const { getInvoices } = await import('ln-service') as any;
import { logger } from '../lib/logger.js';

const LND_TLS_CERT = process.env.LND_TLS_CERT ?? '';
const LND_MACAROON = process.env.LND_MACAROON ?? '';
const LND_SOCKET = process.env.LND_SOCKET ?? 'localhost:10009';

let lnd: ReturnType<typeof authenticatedLndGrpc>['lnd'] | null = null;

if (LND_MACAROON) {
  // When LND_TLS_CERT is empty, ln-service falls through to createSsl(undefined)
  // which uses the system CA store — correct for hosted providers like Voltage
  // that use Let's Encrypt. Self-hosted LND with self-signed certs needs the cert.
  ({ lnd } = authenticatedLndGrpc({
    cert: LND_TLS_CERT || undefined as unknown as string,
    macaroon: LND_MACAROON,
    socket: LND_SOCKET,
  }));
  logger.info({ socket: LND_SOCKET, customCert: !!LND_TLS_CERT }, 'LND gRPC client initialised');
} else {
  logger.warn('LND credentials not configured — Lightning features disabled');
}

/**
 * Verify LND connectivity using an invoice-permission call.
 * Uses getInvoices (invoices:read) instead of getWalletInfo (info:read)
 * so we can run with a restricted Invoice macaroon.
 */
export async function verifyLndConnection(): Promise<void> {
  if (!lnd) {
    throw new Error('LND client not initialised — check LND_MACAROON');
  }

  try {
    await getInvoices({ lnd, limit: 1 });
    logger.info({ socket: LND_SOCKET }, 'LND connection verified');
  } catch (err: unknown) {
    const details = err instanceof Array ? JSON.stringify(err) : (err instanceof Error ? err.message : JSON.stringify(err));
    logger.error({ err, socket: LND_SOCKET, details }, 'LND connection failed');
    throw new Error(`LND connection failed (${LND_SOCKET}): ${details}`);
  }
}

export { lnd };
