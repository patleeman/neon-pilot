import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ensureNeonPilotCliLauncher, getNeonPilotCliBinDir, prependNeonPilotCliBin } from './cliEnvironment.js';

describe('cliEnvironment', () => {
  it('creates a state-root launcher and prepends it to PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-env-'));
    try {
      const launcher = ensureNeonPilotCliLauncher({ repoRoot: process.cwd(), stateRoot: root });
      expect(launcher).toBe(join(root, 'bin', 'neon-pilot'));
      expect(existsSync(launcher)).toBe(true);
      expect(readFileSync(launcher, 'utf-8')).toContain('neon-pilot-cli.mjs');

      const env = prependNeonPilotCliBin({ PATH: '/usr/bin' }, root);
      expect(env.PATH).toBe(`${getNeonPilotCliBinDir(root)}${delimiter}/usr/bin`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
