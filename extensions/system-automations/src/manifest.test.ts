import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const EXTENSION_JSON_PATH = resolve(import.meta.dirname, '..', 'extension.json');

describe('system-automations manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('command-backs the automation creation flow', () => {
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({
        id: 'new',
        title: 'New Automation',
        action: 'app.navigate',
        args: { to: '/automations?action=new' },
      }),
    );
  });
});
