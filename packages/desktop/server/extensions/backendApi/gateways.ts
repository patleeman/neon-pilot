export const TELEGRAM_GATEWAY_HOST_API_GLOBAL = '__personalAgentTelegramGatewayHostApi';

export interface TelegramGatewayHostApi {
  registerTelegramGatewayLifecycleDelivery: () => void;
  startTelegramGatewayRuntime: (...args: unknown[]) => unknown;
  stopTelegramGatewayRuntime: (...args: unknown[]) => unknown;
  readTelegramGatewayRuntimeStatus: (...args: unknown[]) => unknown;
}

declare global {
  // eslint-disable-next-line no-var
  var __personalAgentTelegramGatewayHostApi: TelegramGatewayHostApi | undefined;
}

function readTelegramGatewayHostApi(): TelegramGatewayHostApi {
  const api = globalThis[TELEGRAM_GATEWAY_HOST_API_GLOBAL as keyof typeof globalThis] as TelegramGatewayHostApi | undefined;
  if (!api) {
    throw new Error('Gateways backend API is unavailable because gateway routes are not initialized.');
  }
  return api;
}

export async function startTelegramGatewayService(...args: unknown[]) {
  const api = readTelegramGatewayHostApi();
  api.registerTelegramGatewayLifecycleDelivery();
  return api.startTelegramGatewayRuntime(...args);
}

export async function stopTelegramGatewayService(...args: unknown[]) {
  return readTelegramGatewayHostApi().stopTelegramGatewayRuntime(...args);
}

export async function readTelegramGatewayServiceStatus(...args: unknown[]) {
  return readTelegramGatewayHostApi().readTelegramGatewayRuntimeStatus(...args);
}
