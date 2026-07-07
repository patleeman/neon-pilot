import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  isDurableRunAttentionDismissed,
  loadDurableRunAttentionState,
  markDurableRunAttentionRead,
  markDurableRunAttentionUnread,
  resolveDurableRunAttentionStatePath,
  resolveDurableRunAttentionStatePathFromLayout,
} from './durable-run-attention.js';
import type { DesktopRootLayout } from './runtime/desktop-root.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('durable run attention state', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('resolves the state path from a DesktopRootLayout', () => {
    const layout = { systemState: '/custom/root/system/state' } as Pick<DesktopRootLayout, 'systemState'>;

    expect(resolveDurableRunAttentionStatePathFromLayout(layout as DesktopRootLayout)).toBe(
      join(layout.systemState, 'pi-agent', 'state', 'durable-run-attention.json'),
    );
  });

  it('resolves the state path from options with layout', () => {
    const layout = { systemState: '/custom/root/system/state' } as Pick<DesktopRootLayout, 'systemState'>;

    expect(resolveDurableRunAttentionStatePath({ layout: layout as DesktopRootLayout })).toBe(
      join(layout.systemState, 'pi-agent', 'state', 'durable-run-attention.json'),
    );
  });

  it('uses layout option over stateRoot when both are provided', () => {
    const layout = { systemState: '/layout/state' } as Pick<DesktopRootLayout, 'systemState'>;

    const path = resolveDurableRunAttentionStatePath({
      stateRoot: '/fallback/state',
      layout: layout as DesktopRootLayout,
    });

    expect(path).toBe(join(layout.systemState, 'pi-agent', 'state', 'durable-run-attention.json'));
  });

  it('tracks reviewed signatures per run id', () => {
    const stateRoot = createTempDir('durable-run-attention-');
    const statePath = resolveDurableRunAttentionStatePath({ stateRoot });

    expect(loadDurableRunAttentionState({ stateRoot })).toEqual({
      version: 1,
      runs: {},
    });

    markDurableRunAttentionRead({
      stateRoot,
      runId: 'run-123',
      attentionSignature: '{"status":"failed"}',
      readAt: '2026-03-24T12:00:00.000Z',
    });

    expect(statePath).toContain('durable-run-attention.json');
    expect(
      isDurableRunAttentionDismissed({
        stateRoot,
        runId: 'run-123',
        attentionSignature: '{"status":"failed"}',
      }),
    ).toBe(true);
    expect(
      isDurableRunAttentionDismissed({
        stateRoot,
        runId: 'run-123',
        attentionSignature: '{"status":"failed","attempt":2}',
      }),
    ).toBe(false);
  });

  it('tracks reviewed signatures per run id using layout', () => {
    const stateRoot = createTempDir('durable-run-attention-layout-');
    const layout = { systemState: stateRoot } as Pick<DesktopRootLayout, 'systemState'>;

    expect(loadDurableRunAttentionState({ layout: layout as DesktopRootLayout })).toEqual({
      version: 1,
      runs: {},
    });

    markDurableRunAttentionRead({
      layout: layout as DesktopRootLayout,
      runId: 'run-layout',
      attentionSignature: '{"status":"running"}',
      readAt: '2026-06-01T12:00:00.000Z',
    });

    expect(
      isDurableRunAttentionDismissed({
        layout: layout as DesktopRootLayout,
        runId: 'run-layout',
        attentionSignature: '{"status":"running"}',
      }),
    ).toBe(true);

    expect(
      isDurableRunAttentionDismissed({
        layout: layout as DesktopRootLayout,
        runId: 'run-layout',
        attentionSignature: '{"status":"running","detail":"changed"}',
      }),
    ).toBe(false);
  });

  it('shares state between layout option and resolveDurableRunAttentionStatePathFromLayout', () => {
    const stateRoot = createTempDir('durable-run-attention-shared-');
    const layout = { systemState: stateRoot } as Pick<DesktopRootLayout, 'systemState'>;
    const layoutArg = layout as DesktopRootLayout;

    markDurableRunAttentionRead({
      layout: layoutArg,
      runId: 'run-shared',
      attentionSignature: 'shared-sig',
      readAt: '2026-06-01T12:00:00.000Z',
    });

    const resolvedPath = resolveDurableRunAttentionStatePathFromLayout(layoutArg);
    const loaded = loadDurableRunAttentionState({ layout: layoutArg });
    expect(loaded.runs['run-shared']).toBeDefined();
    expect(resolvedPath).toBe(join(layout.systemState, 'pi-agent', 'state', 'durable-run-attention.json'));
  });

  it('can clear a reviewed run so the same signature surfaces again', () => {
    const stateRoot = createTempDir('durable-run-attention-');

    markDurableRunAttentionRead({
      stateRoot,
      runId: 'run-123',
      attentionSignature: '{"status":"failed"}',
      readAt: '2026-03-24T12:00:00.000Z',
    });

    markDurableRunAttentionUnread({
      stateRoot,
      runId: 'run-123',
    });

    expect(
      isDurableRunAttentionDismissed({
        stateRoot,
        runId: 'run-123',
        attentionSignature: '{"status":"failed"}',
      }),
    ).toBe(false);
  });
});
