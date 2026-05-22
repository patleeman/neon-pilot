import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readTelegramGatewayServiceStatus,
  startTelegramGatewayService,
  stopTelegramGatewayService,
  TELEGRAM_GATEWAY_HOST_API_GLOBAL,
  type TelegramGatewayHostApi,
} from './gateways.js';

describe('backendApi/gateways', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, TELEGRAM_GATEWAY_HOST_API_GLOBAL);
  });

  it('returns stopped status when no Telegram gateway host API is installed', async () => {
    await expect(startTelegramGatewayService({ token: 'redacted' })).resolves.toEqual({ running: false });
    await expect(stopTelegramGatewayService()).resolves.toEqual({ running: false });
    await expect(readTelegramGatewayServiceStatus()).resolves.toEqual({ running: false });
  });

  it('delegates lifecycle operations to the installed Telegram gateway host API', async () => {
    const api: TelegramGatewayHostApi = {
      registerTelegramGatewayLifecycleDelivery: vi.fn(),
      startTelegramGatewayRuntime: vi.fn().mockReturnValue({ running: true, port: 1234 }),
      stopTelegramGatewayRuntime: vi.fn().mockReturnValue({ running: false, stopped: true }),
      readTelegramGatewayRuntimeStatus: vi.fn().mockReturnValue({ running: true }),
    };
    Object.assign(globalThis, { [TELEGRAM_GATEWAY_HOST_API_GLOBAL]: api });

    await expect(startTelegramGatewayService('profile-1')).resolves.toEqual({ running: true, port: 1234 });
    await expect(stopTelegramGatewayService('profile-1')).resolves.toEqual({ running: false, stopped: true });
    await expect(readTelegramGatewayServiceStatus('profile-1')).resolves.toEqual({ running: true });

    expect(api.registerTelegramGatewayLifecycleDelivery).toHaveBeenCalledOnce();
    expect(api.startTelegramGatewayRuntime).toHaveBeenCalledWith('profile-1');
    expect(api.stopTelegramGatewayRuntime).toHaveBeenCalledWith('profile-1');
    expect(api.readTelegramGatewayRuntimeStatus).toHaveBeenCalledWith('profile-1');
  });
});
