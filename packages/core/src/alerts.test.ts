import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  acknowledgeAlert,
  countActiveAlerts,
  dismissAlert,
  getAlert,
  listAlerts,
  resolveProfileAlertsStateFile,
  resolveProfileAlertsStateFileFromLayout,
  upsertAlert,
} from './alerts.js';
import type { DesktopRootLayout } from './runtime/desktop-root.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('alerts', () => {
  it('creates and lists active alerts', () => {
    const stateRoot = createTempDir('pa-alerts-');

    upsertAlert({
      stateRoot,
      profile: 'datadog',
      alert: {
        id: 'wakeup-1',
        profile: 'datadog',
        kind: 'deferred-resume',
        severity: 'disruptive',
        status: 'active',
        title: 'Watch the prod gates',
        body: 'Approve the kube changes when the prompt appears.',
        createdAt: '2026-03-26T13:00:00.000Z',
        sourceKind: 'queue-followup-tool',
        sourceId: 'resume_123',
        conversationId: 'conv-123',
        wakeupId: 'resume_123',
        requiresAck: true,
      },
    });

    expect(countActiveAlerts({ stateRoot, profile: 'datadog' })).toBe(1);
    expect(resolveProfileAlertsStateFile({ stateRoot, profile: 'datadog' })).toBe(
      join(stateRoot, 'pi-agent', 'state', 'alerts', 'shared.json'),
    );
    expect(listAlerts({ stateRoot, profile: 'datadog' })).toEqual([
      expect.objectContaining({
        id: 'wakeup-1',
        profile: 'shared',
        title: 'Watch the prod gates',
        status: 'active',
        wakeupId: 'resume_123',
      }),
    ]);
  });

  it('drops stored alerts with invalid kinds instead of rewriting them as deferred resumes', () => {
    const stateRoot = createTempDir('pa-alerts-');
    const statePath = join(stateRoot, 'pi-agent', 'state', 'alerts', 'shared.json');
    mkdirSync(join(stateRoot, 'pi-agent', 'state', 'alerts'), { recursive: true });
    writeFileSync(
      statePath,
      `${JSON.stringify(
        {
          version: 1,
          alerts: {
            valid: {
              profile: 'shared',
              kind: 'blocked',
              severity: 'disruptive',
              status: 'active',
              title: 'Valid alert',
              body: 'Keep this alert.',
              createdAt: '2026-03-26T13:00:00.000Z',
              sourceKind: 'test',
              sourceId: 'valid',
              requiresAck: true,
            },
            corrupt: {
              profile: 'shared',
              kind: 'unknown-kind',
              severity: 'disruptive',
              status: 'active',
              title: 'Corrupt alert',
              body: 'Do not silently rewrite this alert.',
              createdAt: '2026-03-26T13:00:00.000Z',
              sourceKind: 'test',
              sourceId: 'corrupt',
              requiresAck: true,
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    expect(listAlerts({ stateRoot, profile: 'shared' })).toEqual([expect.objectContaining({ id: 'valid', kind: 'blocked' })]);
  });

  it('resolves the alerts state file from a DesktopRootLayout', () => {
    const layout = { systemState: '/custom/root/system/state' } as Pick<DesktopRootLayout, 'systemState'>;

    expect(resolveProfileAlertsStateFileFromLayout(layout as DesktopRootLayout, 'datadog')).toBe(
      join('/custom/root/system/state', 'pi-agent', 'state', 'alerts', 'shared.json'),
    );
  });

  it('rejects invalid mutation timestamps', () => {
    const stateRoot = createTempDir('pa-alerts-');

    expect(() =>
      upsertAlert({
        stateRoot,
        profile: 'datadog',
        alert: {
          id: 'wakeup-1',
          profile: 'datadog',
          kind: 'deferred-resume',
          severity: 'disruptive',
          status: 'active',
          title: 'Watch the prod gates',
          body: 'Approve the kube changes when the prompt appears.',
          createdAt: 'not-a-date',
          sourceKind: 'queue-followup-tool',
          sourceId: 'resume_123',
          requiresAck: true,
        },
      }),
    ).toThrow('Invalid alert createdAt');
  });

  it('acknowledges and dismisses alerts without losing the durable record', () => {
    const stateRoot = createTempDir('pa-alerts-');

    upsertAlert({
      stateRoot,
      profile: 'datadog',
      alert: {
        id: 'wakeup-1',
        profile: 'datadog',
        kind: 'deferred-resume',
        severity: 'disruptive',
        status: 'active',
        title: 'Watch the prod gates',
        body: 'Approve the kube changes when the prompt appears.',
        createdAt: '2026-03-26T13:00:00.000Z',
        sourceKind: 'queue-followup-tool',
        sourceId: 'resume_123',
        wakeupId: 'resume_123',
        requiresAck: true,
      },
    });

    const acknowledged = acknowledgeAlert({ stateRoot, profile: 'datadog', alertId: 'wakeup-1', at: '2026-03-26T13:01:00.000Z' });
    expect(acknowledged).toEqual(expect.objectContaining({ status: 'acknowledged', acknowledgedAt: '2026-03-26T13:01:00.000Z' }));
    expect(countActiveAlerts({ stateRoot, profile: 'datadog' })).toBe(0);

    const dismissed = dismissAlert({ stateRoot, profile: 'datadog', alertId: 'wakeup-1', at: '2026-03-26T13:02:00.000Z' });
    expect(dismissed).toEqual(expect.objectContaining({ status: 'dismissed', dismissedAt: '2026-03-26T13:02:00.000Z' }));
    expect(getAlert({ stateRoot, profile: 'datadog', alertId: 'wakeup-1' })).toEqual(expect.objectContaining({ status: 'dismissed' }));
  });
});
