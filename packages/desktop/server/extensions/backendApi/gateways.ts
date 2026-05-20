export const TELEGRAM_GATEWAY_HOST_API_GLOBAL = '__neonPilotTelegramGatewayHostApi';

export interface TelegramGatewayHostApi {
  registerTelegramGatewayLifecycleDelivery: () => void;
  startTelegramGatewayRuntime: (...args: unknown[]) => unknown;
  stopTelegramGatewayRuntime: (...args: unknown[]) => unknown;
  readTelegramGatewayRuntimeStatus: (...args: unknown[]) => unknown;
}

declare global {
  // eslint-disable-next-line no-var
  var __neonPilotTelegramGatewayHostApi: TelegramGatewayHostApi | undefined;
}

function readTelegramGatewayHostApi(): TelegramGatewayHostApi | null {
  const api = globalThis[TELEGRAM_GATEWAY_HOST_API_GLOBAL as keyof typeof globalThis] as TelegramGatewayHostApi | undefined;
  return api ?? null;
}

export async function startTelegramGatewayService(...args: unknown[]) {
  const api = readTelegramGatewayHostApi();
  if (!api) {
    return { running: false };
  }
  api.registerTelegramGatewayLifecycleDelivery();
  return api.startTelegramGatewayRuntime(...args);
}

export async function stopTelegramGatewayService(...args: unknown[]) {
  return readTelegramGatewayHostApi()?.stopTelegramGatewayRuntime(...args) ?? { running: false };
}

export async function readTelegramGatewayServiceStatus(...args: unknown[]) {
  return readTelegramGatewayHostApi()?.readTelegramGatewayRuntimeStatus(...args) ?? { running: false };
}
