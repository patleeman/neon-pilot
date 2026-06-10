import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'extension.json'), 'utf-8'));

describe('system-personal-agents manifest', () => {
  it('is a default-off installable extension', () => {
    expect(manifest.id).toBe('system-personal-agents');
    expect(manifest.packageType).toBe('user');
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('contributes the Agents route through the conversation host component', () => {
    expect(manifest.contributes.nav).toContainEqual(expect.objectContaining({ label: 'Agents', route: '/agents' }));
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({
        id: 'agents',
        route: '/agents',
        component: expect.objectContaining({
          host: 'conversation.page',
          overrides: expect.objectContaining({ wrapper: 'PersonalAgentsShell' }),
        }),
      }),
    );
  });

  it('declares profile storage, conversations, and turn context actions', () => {
    expect(manifest.permissions).toEqual(expect.arrayContaining(['storage:readwrite', 'conversations:readwrite']));
    expect(manifest.backend.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ensureDefaultConversation', worker: expect.objectContaining({ enabled: true }) }),
        expect.objectContaining({ id: 'routeGatewayMessage', worker: expect.objectContaining({ enabled: true }) }),
        expect.objectContaining({ id: 'provideAgentTurnContext', worker: expect.objectContaining({ enabled: true }) }),
      ]),
    );
    expect(manifest.contributes.turnContextProviders).toContainEqual(
      expect.objectContaining({ id: 'personal-agent-context', handler: 'provideAgentTurnContext' }),
    );
  });
});
