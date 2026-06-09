import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
      const launcherContent = readFileSync(launcher, 'utf-8');
      expect(launcherContent).toContain('export ELECTRON_RUN_AS_NODE=1');
      expect(launcherContent).toContain('neon-pilot-cli.mjs');

      const env = prependNeonPilotCliBin({ PATH: '/usr/bin' }, root);
      expect(env.PATH).toBe(`${getNeonPilotCliBinDir(root)}${delimiter}/usr/bin`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('targets the packaged protocol CLI entry when no source launcher exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-env-'));
    const appRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-packaged-root-'));
    try {
      const protocolCli = join(appRoot, 'server', 'dist', 'protocolCli.js');
      mkdirSync(join(appRoot, 'server', 'dist'), { recursive: true });
      writeFileSync(protocolCli, 'export {};\n');

      const launcher = ensureNeonPilotCliLauncher({ repoRoot: appRoot, stateRoot: root });

      expect(readFileSync(launcher, 'utf-8')).toContain(protocolCli);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(appRoot, { recursive: true, force: true });
    }
  });

  it('targets protocol CLI inside packaged app.asar resources', () => {
    const root = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-env-'));
    const resourcesRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-resources-root-'));
    try {
      const protocolCli = join(resourcesRoot, 'app.asar', 'server', 'dist', 'protocolCli.js');
      mkdirSync(join(resourcesRoot, 'app.asar', 'server', 'dist'), { recursive: true });
      writeFileSync(protocolCli, 'export {};\n');

      const launcher = ensureNeonPilotCliLauncher({ repoRoot: resourcesRoot, stateRoot: root });

      expect(readFileSync(launcher, 'utf-8')).toContain(protocolCli);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(resourcesRoot, { recursive: true, force: true });
    }
  });
});
