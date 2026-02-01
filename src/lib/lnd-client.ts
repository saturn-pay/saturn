import { authenticatedLndGrpc } from 'ln-service';
import { logger } from '../lib/logger.js';

const LND_TLS_CERT = process.env.LND_TLS_CERT ?? '';
const LND_MACAROON = process.env.LND_MACAROON ?? '';
const LND_SOCKET = process.env.LND_SOCKET ?? 'localhost:10009';

const { lnd } = authenticatedLndGrpc({
  cert: LND_TLS_CERT,
  macaroon: LND_MACAROON,
  socket: LND_SOCKET,
});

logger.info({ socket: LND_SOCKET }, 'LND gRPC client initialised');

export { lnd };
