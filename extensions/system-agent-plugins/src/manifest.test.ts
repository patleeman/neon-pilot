import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const EXTENSION_JSON_PATH = resolve(__dirname, '..', 'extension.json');

describe('system-agent-plugins manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('contributes a command to open plugin settings at its registered settings section', () => {
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({
        id: 'open-agent-plugins',
        title: 'Open plugins',
        action: 'app.navigate',
        args: { to: '/settings#settings-agent-plugins' },
      }),
    );
  });
});
