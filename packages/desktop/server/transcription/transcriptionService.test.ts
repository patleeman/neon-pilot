import { describe, expect, it } from 'vitest';

import { testExports } from './transcriptionService.js';

const { resolveTranscriptionModelRoot } = testExports;

const MOCK_LAYOUT = {
  root: '/Users/test/neon-pilot',
  apps: '/Users/test/neon-pilot/apps',
  data: '/Users/test/neon-pilot/data',
  dataApps: '/Users/test/neon-pilot/data/apps',
  dataDocuments: '/Users/test/neon-pilot/data/documents',
  dataExports: '/Users/test/neon-pilot/data/exports',
  documents: '/Users/test/neon-pilot/documents',
  agents: '/Users/test/neon-pilot/agents',
  soulDoc: '/Users/test/neon-pilot/agents/soul.md',
  logs: '/Users/test/neon-pilot/logs',
  logsDesktop: '/Users/test/neon-pilot/logs/desktop',
  logsDaemon: '/Users/test/neon-pilot/logs/daemon',
  logsTelemetry: '/Users/test/neon-pilot/logs/telemetry',
  system: '/Users/test/neon-pilot/system',
  systemAgents: '/Users/test/neon-pilot/system/agents',
  systemApps: '/Users/test/neon-pilot/system/apps',
  systemCache: '/Users/test/neon-pilot/system/cache',
  systemConfig: '/Users/test/neon-pilot/system/config',
  systemConversations: '/Users/test/neon-pilot/system/conversations',
  systemConversationsIndex: '/Users/test/neon-pilot/system/conversations/session-meta-index.json',
  systemSessions: '/Users/test/neon-pilot/system/conversations/sessions',
  systemDaemon: '/Users/test/neon-pilot/system/daemon',
  systemElectron: '/Users/test/neon-pilot/system/electron',
  systemElectronUserData: '/Users/test/neon-pilot/system/electron/user-data',
  systemObservability: '/Users/test/neon-pilot/system/observability',
  systemRuntime: '/Users/test/neon-pilot/system/runtime',
  systemSecrets: '/Users/test/neon-pilot/system/secrets',
  systemState: '/Users/test/neon-pilot/system/state',
};

describe('resolveTranscriptionModelRoot', () => {
  it('resolves transcription model root from desktop root layout systemState', () => {
    const path = resolveTranscriptionModelRoot(MOCK_LAYOUT);
    expect(path).toBe('/Users/test/neon-pilot/system/state/transcription-models');
  });

  it('falls back to legacy getStateRoot-based path when no layout is provided', () => {
    const path = resolveTranscriptionModelRoot();
    expect(path).toMatch(/transcription-models$/);
    // Legacy path uses getStateRoot() which points to ~/.local/state/neon-pilot/transcription-models
    expect(path).not.toContain('/system/state/');
  });
});
