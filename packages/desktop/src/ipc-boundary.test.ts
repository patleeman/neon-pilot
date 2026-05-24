import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf-8');
}

describe('desktop IPC protocol boundary', () => {
  it('does not expose generic product API or realtime stream IPC channels', () => {
    const ipcSource = readRepoFile('packages/desktop/src/ipc.ts');
    const preloadSource = readRepoFile('packages/desktop/src/preload.cts');
    const bridgeSource = readRepoFile('packages/desktop/ui/src/desktop/desktopBridge.ts');
    const combined = `${ipcSource}\n${preloadSource}\n${bridgeSource}`;

    for (const forbidden of [
      'invoke-local-api',
      'subscribe-app-events',
      'unsubscribe-app-events',
      'subscribe-api-stream',
      'unsubscribe-api-stream',
      'subscribe-provider-oauth-login',
      'unsubscribe-provider-oauth-login',
      'neon-pilot-desktop-app-events',
      'neon-pilot-desktop-api-stream',
      'neon-pilot-desktop-provider-oauth-login',
    ]) {
      expect(combined, forbidden).not.toContain(forbidden);
    }

    const exposedRendererBridge = `${preloadSource}\n${bridgeSource}`;
    for (const forbidden of [
      'readAppStatus',
      'readSessions',
      'readModels',
      'readScheduledTasks',
      'readDurableRuns',
      'readConversationArtifacts',
    ]) {
      expect(exposedRendererBridge, forbidden).not.toContain(forbidden);
    }
  });
});
