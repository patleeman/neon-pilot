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

  it('contributes extension management to settings instead of a standalone route', () => {
    expect(manifest.contributes.views).toEqual([]);
    expect(manifest.contributes.settingsComponent).toMatchObject({
      sectionId: 'settings-extensions',
      component: 'ExtensionManagerSettingsPanel',
    });
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toContain('extensions:read');
    expect(manifest.permissions).toContain('extensions:write');
  });
});
