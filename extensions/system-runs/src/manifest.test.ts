import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const manifestPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'extension.json');

describe('system-runs manifest', () => {
  it('exposes scheduled subagent fields to agent tool schemas', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      permissions?: string[];
      contributes?: { tools?: Array<{ id?: string; inputSchema?: { properties?: Record<string, unknown> } }> };
    };

    const subagent = manifest.contributes?.tools?.find((tool) => tool.id === 'subagent');

    expect(manifest.permissions).toContain('extensions:read');
    expect(subagent?.inputSchema?.properties).toMatchObject({
      defer: expect.objectContaining({ type: 'string' }),
      cron: expect.objectContaining({ type: 'string' }),
      at: expect.objectContaining({ type: 'string' }),
      allowedTools: expect.any(Object),
    });
  });
});
