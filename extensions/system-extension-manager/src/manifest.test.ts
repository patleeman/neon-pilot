import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PKG_ROOT = resolve(import.meta.dirname, '..');
const EXTENSION_JSON_PATH = resolve(PKG_ROOT, 'extension.json');

describe('system-extension-manager manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('has the expected identity', () => {
    expect(manifest.id).toBe('system-extension-manager');
    expect(manifest.name).toBe('Extension Manager');
    expect(manifest.packageType).toBe('system');
  });

  it('has a valid schema version', () => {
    expect(manifest.schemaVersion).toBe(2);
  });

  it('declares a frontend entry', () => {
    expect(manifest.frontend).toBeDefined();
    expect(manifest.frontend.entry).toBe('dist/frontend.js');
  });

  it('contributes the canonical extension page', () => {
    expect(manifest.contributes.nav).toContainEqual(expect.objectContaining({ label: 'Extensions', route: '/extensions' }));
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({
        route: '/extensions',
        component: 'ExtensionManagerPage',
      }),
    );
    expect(manifest.contributes.settingsComponent).toEqual(
      expect.objectContaining({
        id: 'extension-repositories',
        component: 'ExtensionRepositoriesSettingsPanel',
        sectionId: 'settings-extension-repositories',
        label: 'Extension repositories',
      }),
    );
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
    expect(commands.get('extensions install-marketplace')).toMatchObject({
      usage: 'extensions install-marketplace <source> --type <skill|instruction-pack|agent|template> [--json]',
      argsSchema: { minItems: 1, maxItems: 1, description: 'Positional args: source.' },
      flagsSchema: {
        required: ['type'],
        properties: { type: { enum: ['skill', 'instruction-pack', 'agent', 'template'] } },
      },
    });
  });
});
