import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const EXTENSION_JSON_PATH = resolve(__dirname, '..', 'extension.json');

describe('system-agent-plugins manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('contributes a command to open agent plugin settings at its registered settings section', () => {
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({
        id: 'open-agent-plugins',
        title: 'Open Agent Plugins',
        action: 'app.navigate',
        args: { to: '/settings#settings-agent-plugins' },
      }),
    );
  });

  it('labels the settings section as agent plugins', () => {
    expect(manifest.name).toBe('Agent Plugins');
    expect(manifest.contributes.settingsComponent).toMatchObject({
      label: 'Agent plugins',
      description: expect.stringContaining('Codex or Claude Code marketplace plugins'),
    });
  });

  it('contributes CLI commands and a skill for plugin installation', () => {
    expect(manifest.contributes.tools).toBeUndefined();
    expect(manifest.contributes.cliCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'agent-plugins list', action: 'agentPluginsCli', inputAction: 'list' }),
        expect.objectContaining({ command: 'agent-plugins install', action: 'agentPluginsCli', inputAction: 'install' }),
        expect.objectContaining({ command: 'agent-plugins enable', action: 'agentPluginsCli', inputAction: 'enable' }),
        expect.objectContaining({ command: 'agent-plugins disable', action: 'agentPluginsCli', inputAction: 'disable' }),
        expect.objectContaining({ command: 'agent-plugins check-updates', action: 'agentPluginsCli', inputAction: 'check-updates' }),
        expect.objectContaining({ command: 'agent-plugins update', action: 'agentPluginsCli', inputAction: 'update' }),
        expect.objectContaining({ command: 'agent-plugins remove', action: 'agentPluginsCli', inputAction: 'remove' }),
      ]),
    );
    expect(manifest.contributes.skills).toContainEqual(
      expect.objectContaining({
        id: 'agent-plugin-installation',
        path: 'skills/agent-plugin-installation/SKILL.md',
      }),
    );
  });

  it('declares the backend action used by CLI commands', () => {
    expect(manifest.backend.actions).toContainEqual(
      expect.objectContaining({
        id: 'agentPluginsCli',
        handler: 'agentPluginsCli',
        worker: expect.objectContaining({
          enabled: true,
          inputActions: ['list', 'install', 'enable', 'disable', 'check-updates', 'update', 'remove'],
        }),
      }),
    );
  });

  it('declares permissions needed to manage wrapper extensions and refresh skill config', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['extensions:read', 'extensions:write', 'mcp:write', 'shell:execute', 'filesystem:read', 'filesystem:write']),
    );
  });
});
