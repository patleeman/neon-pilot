import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PKG_ROOT = resolve(import.meta.dirname, '..');
const EXTENSION_JSON_PATH = resolve(PKG_ROOT, 'extension.json');

describe('system-settings manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('has the expected identity', () => {
    expect(manifest.id).toBe('system-settings');
    expect(manifest.name).toBe('Settings panels');
    expect(manifest.packageType).toBe('system');
    expect(manifest.schemaVersion).toBe(2);
  });

  it('declares a frontend entry', () => {
    expect(manifest.frontend.entry).toBe('dist/frontend.js');
  });

  it('declares the core settings views', () => {
    const views = manifest.contributes.views;
    expect(views.find((v: { id: string }) => v.id === 'settings')).toBeDefined();
    expect(views.find((v: { id: string }) => v.id === 'providers')).toBeDefined();
    expect(views.find((v: { id: string }) => v.id === 'desktop')).toBeDefined();
    expect(
      Object.fromEntries(
        views
          .filter((v: { route?: string }) =>
            [
              '/settings/appearance',
              '/settings/conversation',
              '/settings/workspace',
              '/settings/commands',
              '/settings/security',
              '/settings/extensions',
            ].includes(v.route ?? ''),
          )
          .map((v: { route: string; component: string }) => [v.route, v.component]),
      ),
    ).toEqual({
      '/settings/appearance': 'AppearanceSettingsPage',
      '/settings/conversation': 'ConversationSettingsPage',
      '/settings/workspace': 'WorkspaceSettingsPage',
      '/settings/commands': 'CommandsSettingsPage',
      '/settings/security': 'SecuritySettingsPage',
      '/settings/extensions': 'ExtensionsSettingsPage',
    });
    expect(views.find((v: { id: string; location?: string }) => v.id === 'settings-sidebar')).toMatchObject({
      location: 'sidebar',
      component: 'SettingsSidebar',
    });
    expect(manifest.contributes.nav).toContainEqual(expect.objectContaining({ id: 'settings-nav', sidebarView: 'settings-sidebar' }));
  });

  it('does not declare a settings keybinding that duplicates the desktop menu shortcut', () => {
    expect(manifest.contributes.keybindings ?? []).not.toContainEqual(expect.objectContaining({ id: 'open-settings' }));
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toContain('settings:read');
    expect(manifest.permissions).toContain('settings:write');
  });

  it('declares settings CLI commands backed by a worker action', () => {
    expect(manifest.contributes.cliCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'settings list', action: 'manageSettings' }),
        expect.objectContaining({ command: 'settings schema', action: 'manageSettings' }),
        expect.objectContaining({ command: 'settings get', action: 'manageSettings' }),
        expect.objectContaining({ command: 'settings set', action: 'manageSettings' }),
        expect.objectContaining({ command: 'settings reset', action: 'manageSettings' }),
      ]),
    );
    expect(manifest.backend.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manageSettings',
          worker: expect.objectContaining({ enabled: true, inputActions: ['list', 'schema', 'get', 'set', 'reset'] }),
        }),
        expect.objectContaining({
          id: 'manageCli',
          worker: expect.objectContaining({ enabled: true, inputActions: ['status', 'install', 'uninstall'] }),
        }),
      ]),
    );
  });

  it('keeps settings CLI positional schemas aligned with backend requirements', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

    expect(commands.get('settings list')).toMatchObject({
      usage: 'settings list [prefix] [--json]',
      argsSchema: { maxItems: 1 },
    });
    expect(commands.get('settings schema')).toMatchObject({
      usage: 'settings schema [--json]',
      argsSchema: { maxItems: 0 },
    });
    expect(commands.get('settings get')).toMatchObject({
      usage: 'settings get <key> [--json]',
      argsSchema: { minItems: 1, maxItems: 1 },
    });
    expect(commands.get('settings set')).toMatchObject({
      usage: 'settings set <key> <value> [--json]',
      argsSchema: { minItems: 2, maxItems: 2 },
    });
  });
});
