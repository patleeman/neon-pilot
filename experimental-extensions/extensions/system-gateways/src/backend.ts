import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  readTelegramGatewayServiceStatus,
  startTelegramGatewayService,
  stopTelegramGatewayService,
} from '@neon-pilot/extensions/backend/gateways';

export async function startTelegramGateway(_input: unknown, ctx: ExtensionBackendContext): Promise<() => Promise<void>> {
  await startTelegramGatewayService();
  ctx.log.info('telegram gateway service started');
  return async () => {
    await stopTelegramGatewayService();
  };
}

export async function telegramGatewayStatus(): Promise<unknown> {
  return readTelegramGatewayServiceStatus();
}
