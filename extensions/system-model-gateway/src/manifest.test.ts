import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const EXTENSION_JSON_PATH = resolve(__dirname, '..', 'extension.json');

describe('system-model-gateway manifest', () => {
  const manifest = JSON.parse(readFileSync(EXTENSION_JSON_PATH, 'utf-8'));

  it('contributes AI Gateway as a main app surface', () => {
    expect(manifest.contributes.views).toContainEqual(
      expect.objectContaining({
        id: 'ai-gateway-page',
        title: 'AI Gateway',
        location: 'main',
        route: '/ai-gateway',
        component: 'ModelGatewayPage',
      }),
    );
    expect(manifest.contributes.nav).toContainEqual(
      expect.objectContaining({
        id: 'ai-gateway-nav',
        label: 'AI Gateway',
        route: '/ai-gateway',
      }),
    );
  });

  it('contributes a command to open AI Gateway', () => {
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({
        id: 'open-model-gateway-settings',
        title: 'Open AI Gateway',
        action: 'app.navigate',
        args: { to: '/ai-gateway' },
      }),
    );
  });
});
