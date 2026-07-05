import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PKG_ROOT = resolve(import.meta.dirname, '..');
const EXTENSION_JSON_PATH = resolve(PKG_ROOT, 'extension.json');

describe('system-extension-manager manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('has the expected identity', () => {
    expect(manifest.id).toBe('system-extension-manager');
    expect(manifest.name).toBe('App Manager');
    expect(manifest.packageType).toBe('system');
    expect(manifest.description).toBe('Inspect, install, update, enable, disable, validate, reload, snapshot, and delete app packages.');
  });

  it('has a valid schema version', () => {
    expect(manifest.schemaVersion).toBe(2);
  });

  it('declares a frontend entry', () => {
    expect(manifest.frontend).toBeDefined();
    expect(manifest.frontend.entry).toBe('dist/frontend.js');
  });

  it('contributes the canonical app manager page', () => {
    expect(manifest.contributes.nav).toContainEqual(expect.objectContaining({ label: 'App Manager', route: '/apps' }));
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({
        id: 'app-manager-page',
        route: '/apps',
        component: 'ExtensionManagerPage',
      }),
    );
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({
        id: 'extensions-page',
        route: '/extensions',
        component: 'ExtensionManagerPage',
      }),
    );
    expect(manifest.contributes.settingsComponent).toEqual(
      expect.objectContaining({
        id: 'extension-repositories',
        component: 'ExtensionRepositoriesSettingsPanel',
        sectionId: 'settings-extension-repositories',
        label: 'App repositories',
      }),
    );
  });

  it('command-backs extension manager workflows', () => {
    const commands = new Map(manifest.contributes.commands.map((command: { id: string }) => [command.id, command]));

    expect(commands.get('open')).toMatchObject({
      title: 'Open App Manager',
      action: 'app.navigate',
      args: { to: '/apps' },
    });
    expect(commands.get('reload-registry')).toMatchObject({
      title: 'Reload Apps',
      action: 'reloadExtensions',
    });
    expect(commands.get('list-catalog')).toMatchObject({
      title: 'List Installable Apps',
      action: 'listInstallableExtensions',
    });
    expect(commands.get('install-catalog')).toMatchObject({
      title: 'Install Catalog App',
      action: 'installCatalogExtension',
      argsSchema: {
        required: ['id'],
        properties: { id: { type: 'string' } },
        additionalProperties: false,
      },
    });
    expect(commands.get('update-catalog')).toMatchObject({
      title: 'Update Catalog App',
      action: 'updateCatalogExtension',
      argsSchema: {
        required: ['id'],
        properties: { id: { type: 'string' } },
        additionalProperties: false,
      },
    });
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toContain('extensions:read');
    expect(manifest.permissions).toContain('extensions:write');
  });

  it('keeps install CLI positional schemas aligned with backend normalization', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

    expect(commands.get('extensions install-url')).toMatchObject({
      usage: 'extensions install-url <url> [--expected-id <id>] [--json]',
      argsSchema: { minItems: 1, maxItems: 1, description: 'Positional args: url.' },
      flagsSchema: { properties: { 'expected-id': { type: 'string' } } },
    });
    expect(commands.has('extensions install-marketplace')).toBe(false);
  });

  it('keeps read and reload CLI positional schemas explicit', () => {
    const commands = new Map(manifest.contributes.cliCommands.map((command: { command: string }) => [command.command, command]));

    for (const command of ['extensions list', 'extensions catalog', 'extensions paths', 'extensions sources']) {
      expect(commands.get(command)).toMatchObject({
        usage: `${command} [--json]`,
        argsSchema: { maxItems: 0 },
      });
    }
    expect(commands.get('extensions reload')).toMatchObject({
      usage: 'extensions reload [appPackageId] [--json]',
      argsSchema: { maxItems: 1, description: 'Optional positional args: appPackageId.' },
    });
  });
});
