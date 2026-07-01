import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onAlertUpserted, readSettings, sendTestAlert, updateSettings } from './backend.js';

function createStorage(initial: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
      return { ok: true };
    }),
  };
}

function createCtx(initialStorage: Record<string, unknown> = {}) {
  const storage = createStorage(initialStorage);
  return {
    storage,
    notify: {
      system: vi.fn(() => true),
      isSystemAvailable: vi.fn(() => true),
    },
    shell: {
      spawn: vi.fn(async () => ({ pid: 1234, kill: vi.fn() })),
    },
    log: {
      warn: vi.fn(),
    },
  };
}

function alert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    kind: 'blocked',
    severity: 'disruptive',
    status: 'active',
    title: 'Agent needs attention',
    body: 'Review the blocked run.',
    updatedAt: '2026-03-26T14:00:00.000Z',
    conversationId: 'conv-1',
    requiresAck: true,
    ...overrides,
  };
}

function event(payloadAlert = alert()) {
  return {
    subscriptionId: 'agent-attention',
    event: 'host:alerts:upserted',
    payload: { type: 'upserted', alert: payloadAlert },
    sourceExtensionId: 'host',
  };
}

describe('system-alerts backend', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('reads default settings and system notification availability', async () => {
    const ctx = createCtx();

    await expect(readSettings({}, ctx as never)).resolves.toEqual({
      settings: {
        enabled: true,
        nativeNotifications: true,
        soundEnabled: true,
        severity: 'disruptive',
        sound: 'ping',
      },
      systemNotificationsAvailable: true,
    });
  });

  it('updates only recognized settings fields', async () => {
    const ctx = createCtx();

    await expect(
      updateSettings({ enabled: false, severity: 'all', sound: 'glass', ignored: true }, ctx as never),
    ).resolves.toEqual(
      expect.objectContaining({
        settings: expect.objectContaining({
          enabled: false,
          severity: 'all',
          sound: 'glass',
        }),
      }),
    );

    expect(ctx.storage.put).toHaveBeenCalledWith('settings', {
      enabled: false,
      nativeNotifications: true,
      soundEnabled: true,
      severity: 'all',
      sound: 'glass',
    });
  });

  it('delivers active disruptive alerts through native notification and sound', async () => {
    const ctx = createCtx();

    await onAlertUpserted(event(), ctx as never);

    expect(ctx.notify.system).toHaveBeenCalledWith({
      title: 'Agent needs attention',
      subtitle: 'Conversation needs attention',
      message: 'Review the blocked run.',
      persistent: true,
    });
    expect(ctx.shell.spawn).toHaveBeenCalledWith({
      command: '/usr/bin/afplay',
      args: ['/System/Library/Sounds/Ping.aiff'],
      onExit: expect.any(Function),
    });
    expect(ctx.storage.put).toHaveBeenCalledWith('notified/alert-1', expect.objectContaining({ updatedAt: '2026-03-26T14:00:00.000Z' }));
  });

  it('does not redeliver the same alert timestamp', async () => {
    const ctx = createCtx({ 'notified/alert-1': { updatedAt: '2026-03-26T14:00:00.000Z' } });

    await onAlertUpserted(event(), ctx as never);

    expect(ctx.notify.system).not.toHaveBeenCalled();
    expect(ctx.shell.spawn).not.toHaveBeenCalled();
  });

  it('skips passive alerts unless the setting includes all alerts', async () => {
    const passive = alert({ severity: 'passive' });
    const ctx = createCtx();

    await onAlertUpserted(event(passive), ctx as never);
    expect(ctx.notify.system).not.toHaveBeenCalled();

    const allCtx = createCtx({ settings: { severity: 'all' } });
    await onAlertUpserted(event(passive), allCtx as never);
    expect(allCtx.notify.system).toHaveBeenCalledOnce();
  });

  it('honors disabled channels and sends test alerts', async () => {
    const ctx = createCtx({ settings: { nativeNotifications: false, soundEnabled: true, sound: 'pop' } });

    await onAlertUpserted(event(), ctx as never);
    expect(ctx.notify.system).not.toHaveBeenCalled();
    expect(ctx.shell.spawn).toHaveBeenCalledWith({
      command: '/usr/bin/afplay',
      args: ['/System/Library/Sounds/Pop.aiff'],
      onExit: expect.any(Function),
    });

    await sendTestAlert({}, ctx as never);
    expect(ctx.shell.spawn).toHaveBeenCalledTimes(2);
  });
});
