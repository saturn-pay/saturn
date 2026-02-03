import { authenticatedLndGrpc, getWalletInfo } from 'ln-service';
import { logger } from '../lib/logger.js';

const LND_TLS_CERT = process.env.LND_TLS_CERT ?? '';
const LND_MACAROON = process.env.LND_MACAROON ?? '';
const LND_SOCKET = process.env.LND_SOCKET ?? 'localhost:10009';

let lnd: ReturnType<typeof authenticatedLndGrpc>['lnd'] | null = null;

if (LND_TLS_CERT && LND_MACAROON) {
  ({ lnd } = authenticatedLndGrpc({
    cert: LND_TLS_CERT,
    macaroon: LND_MACAROON,
    socket: LND_SOCKET,
  }));
  logger.info({ socket: LND_SOCKET }, 'LND gRPC client initialised');
} else {
  logger.warn('LND credentials not configured — Lightning features disabled');
}

/**
 * Verify LND connectivity by calling GetInfo.
 * Call during startup to fail fast if creds are wrong.
 */
export async function verifyLndConnection(): Promise<void> {
  if (!lnd) {
    throw new Error('LND client not initialised — check LND_TLS_CERT and LND_MACAROON');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = await getWalletInfo({ lnd });
    logger.info(
      { alias: info.alias, publicKey: info.public_key, synced: info.is_synced_to_chain },
      'LND connection verified',
    );

    if (!info.is_synced_to_chain) {
      logger.warn('LND node is not synced to chain — invoices may not work reliably');
    }
  } catch (err: unknown) {
    const details = err instanceof Array ? JSON.stringify(err) : (err instanceof Error ? err.message : JSON.stringify(err));
    logger.error({ err, socket: LND_SOCKET, details }, 'LND connection failed');
    throw new Error(`LND connection failed (${LND_SOCKET}): ${details}`);
  }
}

export { lnd };
