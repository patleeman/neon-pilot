import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf-8');
}

describe('desktop IPC protocol boundary', () => {
  it('keeps registered IPC handlers limited to native/bootstrap/control channels', () => {
    const ipcSource = readRepoFile('packages/desktop/src/ipc.ts');
    const registeredChannels = Array.from(ipcSource.matchAll(/ipcMain\.handle\(`\$\{CHANNEL_PREFIX\}:([^`]+)`/g), (match) => match[1]);

    expect(registeredChannels).toEqual([
      'get-environment',
      'get-navigation-state',
      'open-new-conversation',
      'open-conversation-popout',
      'open-path',
      'open-external-url',
      'write-clipboard-text',
      'read-desktop-app-preferences',
      'update-desktop-app-preferences',
      'check-for-updates',
      'pick-folder',
      'capture-screenshot',
      'go-back',
      'go-forward',
      'workbench-browser-set-bounds',
      'workbench-browser-state',
      'workbench-browser-navigate',
      'workbench-browser-back',
      'workbench-browser-forward',
      'workbench-browser-reload',
      'workbench-browser-stop',
      'workbench-browser-snapshot',
    ]);
  });

  it('does not expose preload invoke channels without main-process handlers', () => {
    const ipcSource = readRepoFile('packages/desktop/src/ipc.ts');
    const preloadSource = readRepoFile('packages/desktop/src/preload.cts');
    const registeredChannels = new Set(
      Array.from(ipcSource.matchAll(/ipcMain\.handle\(`\$\{CHANNEL_PREFIX\}:([^`]+)`/g), (match) => match[1]),
    );
    const exposedInvokeChannels = Array.from(
      preloadSource.matchAll(/ipcRenderer\.invoke\(`\$\{CHANNEL_PREFIX\}:([^`]+)`/g),
      (match) => match[1],
    );

    for (const channel of exposedInvokeChannels) {
      expect(registeredChannels, channel).toContain(channel);
    }
  });

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
      'read-session-search-index',
      'read-vault-files',
      'read-scheduled-task-log',
      'read-durable-run-log',
      'read-conversation-bootstrap',
      'read-session-detail',
      'read-session-block',
      'create-live-session',
      'resume-live-session',
      'submit-live-session-prompt',
      'restore-queued-live-session-message',
      'clear-queued-live-session-messages',
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
      'readSessionSearchIndex',
      'readVaultFiles',
      'readScheduledTaskLog',
      'readDurableRunLog',
      'createLiveSession',
      'resumeLiveSession',
      'submitLiveSessionPrompt',
      'restoreQueuedLiveSessionMessage',
      'clearQueuedLiveSessionMessages',
      'executeLiveSessionBash',
    ]) {
      expect(exposedRendererBridge, forbidden).not.toContain(forbidden);
    }
  });
});
