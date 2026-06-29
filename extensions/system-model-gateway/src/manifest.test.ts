import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const EXTENSION_JSON_PATH = resolve(__dirname, '..', 'extension.json');

describe('system-model-gateway manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('contributes a command to open AI Gateway settings', () => {
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({
        id: 'open-model-gateway-settings',
        title: 'Open AI Gateway Settings',
        action: 'app.navigate',
        args: { to: '/settings#settings-model-gateway' },
      }),
    );
  });
});
