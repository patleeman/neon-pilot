export const TELEGRAM_GATEWAY_HOST_API_GLOBAL = '__neonPilotTelegramGatewayHostApi';

export interface TelegramGatewayHostApi {
  registerTelegramGatewayLifecycleDelivery: () => void;
  startTelegramGatewayRuntime: (...args: unknown[]) => unknown;
  stopTelegramGatewayRuntime: (...args: unknown[]) => unknown;
  readTelegramGatewayRuntimeStatus: (...args: unknown[]) => unknown;
  readGatewayState: () => unknown;
  ensureGatewayConnection: (input: { provider: string }) => unknown;
  updateGatewayConnectionStatus: (input: {
    provider: string;
    status: string;
    enabled?: boolean;
    statusMessage?: string;
  }) => unknown;
  attachGatewayConversation: (input: {
    provider: string;
    conversationId: string;
    conversationTitle?: string;
    externalChatId?: string;
    externalChatLabel?: string;
  }) => unknown;
  detachGatewayConversation: (input: { provider?: string; conversationId: string }) => unknown;
  recordGatewayEvent: (input: { provider: string; conversationId?: string; kind: string; message: string }) => unknown;
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

export async function readGatewayState() {
  return readTelegramGatewayHostApi()?.readGatewayState() ?? null;
}

export async function ensureGatewayConnection(input: { provider: string }) {
  return readTelegramGatewayHostApi()?.ensureGatewayConnection(input) ?? null;
}

export async function updateGatewayConnectionStatus(input: {
  provider: string;
  status: string;
  enabled?: boolean;
  statusMessage?: string;
}) {
  return readTelegramGatewayHostApi()?.updateGatewayConnectionStatus(input) ?? null;
}

export async function attachGatewayConversation(input: {
  provider: string;
  conversationId: string;
  conversationTitle?: string;
  externalChatId?: string;
  externalChatLabel?: string;
}) {
  return readTelegramGatewayHostApi()?.attachGatewayConversation(input) ?? null;
}

export async function detachGatewayConversation(input: { provider?: string; conversationId: string }) {
  return readTelegramGatewayHostApi()?.detachGatewayConversation(input) ?? null;
}

export async function recordGatewayEvent(input: { provider: string; conversationId?: string; kind: string; message: string }) {
  return readTelegramGatewayHostApi()?.recordGatewayEvent(input) ?? null;
}
