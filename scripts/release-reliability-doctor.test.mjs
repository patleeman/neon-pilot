import { describe, expect, it } from 'vitest';

import {
  checkConversationAdminFlows,
  checkDeferredResumeLifecycle,
  checkExtensionStateSanity,
  checkHeartbeatConfig,
  checkUnifiedAdminSurface,
} from './release-reliability-doctor.mjs';

const manifest = (id, contributes = {}) => ({ path: `${id}/extension.json`, manifest: { id, contributes } });

describe('release reliability doctor', () => {
  it('accepts the canonical neon_pilot internal admin surface', () => {
    const result = checkUnifiedAdminSurface([
      manifest('system-neon-pilot-admin-cli', {
        tools: [{ id: 'neon-pilot-admin', name: 'neon_pilot', description: 'Canonical internal Neon Pilot self-admin tool.' }],
        cliCommands: [{ command: 'heartbeats list' }],
      }),
      manifest('system-mcp', {
        tools: [{ id: 'mcp', name: 'mcp', description: 'Not a Neon Pilot self-admin surface; use neon_pilot.' }],
      }),
    ]);

    expect(result.ok).toBe(true);
  });

  it('rejects extra internal self-admin tools', () => {
    const result = checkUnifiedAdminSurface([
      manifest('system-neon-pilot-admin-cli', {
        tools: [{ id: 'neon-pilot-admin', name: 'neon_pilot', description: 'Canonical internal Neon Pilot self-admin tool.' }],
      }),
      manifest('system-conversation-tools', {
        tools: [{ id: 'conversation-admin', name: 'conversation_admin', description: 'Conversation admin tool.' }],
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain('Unexpected internal admin-like tool conversation_admin');
  });

  it('validates conversation, deferred resume, and extension state seams in repo manifests', () => {
    expect(checkConversationAdminFlows().ok).toBe(true);
    expect(checkDeferredResumeLifecycle().ok).toBe(true);
    expect(checkExtensionStateSanity().ok).toBe(true);
  });

  it('validates heartbeat command inventory', () => {
    const result = checkHeartbeatConfig([
      manifest('system-neon-pilot-admin-cli', {
        tools: [
          {
            name: 'neon_pilot',
            inputSchema: { properties: { command: { enum: ['heartbeat_start', 'heartbeat_list', 'heartbeat_stop'] } } },
          },
        ],
        cliCommands: [{ command: 'heartbeats start' }, { command: 'heartbeats list' }, { command: 'heartbeats stop' }],
      }),
    ]);

    expect(result.ok).toBe(true);
  });
});
