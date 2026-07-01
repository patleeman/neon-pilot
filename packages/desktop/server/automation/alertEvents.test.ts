import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const publishExtensionHostEvent = vi.fn();
const logError = vi.fn();

vi.mock('../extensions/extensionSubscriptions.js', () => ({ publishExtensionHostEvent }));
vi.mock('../shared/logging.js', () => ({ logError }));

const { publishAlertAcknowledged, publishAlertDismissed, upsertAlertAndPublish } = await import('./alertEvents.js');
const { getAlert } = await import('@neon-pilot/core');

const originalEnv = process.env;
const tempDirs: string[] = [];

function createStateRoot(): string {
  const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-alert-events-'));
  tempDirs.push(stateRoot);
  process.env.NEON_PILOT_STATE_ROOT = stateRoot;
  return stateRoot;
}

function createAlert(overrides: { id: string; status?: 'active' | 'acknowledged' | 'dismissed' }) {
  return {
    id: overrides.id,
    profile: 'shared',
    kind: 'blocked' as const,
    severity: 'disruptive' as const,
    status: overrides.status ?? ('active' as const),
    title: 'Agent needs attention',
    body: 'Open the conversation to continue.',
    createdAt: '2026-03-26T14:00:00.000Z',
    updatedAt: '2026-03-26T14:00:00.000Z',
    conversationId: 'conv-1',
    sourceKind: 'conversation',
    sourceId: 'conv-1',
    requiresAck: true,
  };
}

beforeEach(() => {
  process.env = { ...originalEnv };
  publishExtensionHostEvent.mockReset();
  publishExtensionHostEvent.mockResolvedValue(undefined);
  logError.mockReset();
});

afterEach(async () => {
  process.env = originalEnv;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('alert host events', () => {
  it('upserts alerts and publishes a host event for extension subscriptions', () => {
    const stateRoot = createStateRoot();

    const alert = upsertAlertAndPublish({
      stateRoot,
      profile: 'shared',
      alert: createAlert({ id: 'alert-1' }),
    });

    expect(getAlert({ stateRoot, profile: 'shared', alertId: 'alert-1' })).toEqual(expect.objectContaining({ id: 'alert-1' }));
    expect(publishExtensionHostEvent).toHaveBeenCalledWith('alerts', {
      type: 'upserted',
      alert,
    });
  });

  it('publishes alert state transition events', () => {
    const acknowledged = createAlert({ id: 'alert-ack', status: 'acknowledged' });
    const dismissed = createAlert({ id: 'alert-dismissed', status: 'dismissed' });

    publishAlertAcknowledged(acknowledged);
    publishAlertDismissed(dismissed);

    expect(publishExtensionHostEvent).toHaveBeenNthCalledWith(1, 'alerts', {
      type: 'acknowledged',
      alert: acknowledged,
    });
    expect(publishExtensionHostEvent).toHaveBeenNthCalledWith(2, 'alerts', {
      type: 'dismissed',
      alert: dismissed,
    });
  });

  it('logs host event publish failures without failing the alert write', async () => {
    const stateRoot = createStateRoot();
    publishExtensionHostEvent.mockRejectedValueOnce(new Error('event bus unavailable'));

    upsertAlertAndPublish({
      stateRoot,
      profile: 'shared',
      alert: createAlert({ id: 'alert-1' }),
    });

    await vi.waitFor(() =>
      expect(logError).toHaveBeenCalledWith('alert host event publish failed', {
        alertId: 'alert-1',
        eventType: 'upserted',
        message: 'event bus unavailable',
      }),
    );
  });
});
