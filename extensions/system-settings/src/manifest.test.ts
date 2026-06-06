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
      ]),
    );
    expect(manifest.backend.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manageSettings',
          worker: expect.objectContaining({ enabled: true, inputActions: ['list', 'schema', 'get', 'set'] }),
        }),
      ]),
    );
  });
});
