import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ensureNeonPilotCliLauncher,
  getNeonPilotCliBinDir,
  installNeonPilotUserCli,
  prependNeonPilotCliBin,
  readNeonPilotCliInstallStatus,
} from './cliEnvironment.js';

function withTempHome<T>(callback: (home: string) => T): T {
  const home = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-home-'));
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  try {
    return callback(home);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  }
}

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

  it('refuses to overwrite a user shell link owned by another install', () => {
    withTempHome((home) => {
      const root = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-env-'));
      const otherRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-other-cli-env-'));
      try {
        const linkPath = join(home, '.local', 'bin', 'neon-pilot');
        const otherTarget = join(otherRoot, 'bin', 'neon-pilot');
        mkdirSync(join(home, '.local', 'bin'), { recursive: true });
        mkdirSync(join(otherRoot, 'bin'), { recursive: true });
        writeFileSync(otherTarget, '#!/bin/sh\n');
        symlinkSync(otherTarget, linkPath);

        const status = readNeonPilotCliInstallStatus({ repoRoot: process.cwd(), stateRoot: root });

        expect(status.globallyInstalled).toBe(false);
        expect(status.linkExists).toBe(true);
        expect(status.linkConflict).toBe(true);
        expect(status.linkTarget).toBe(otherTarget);
        expect(() => installNeonPilotUserCli({ repoRoot: process.cwd(), stateRoot: root })).toThrow(
          `Cannot install Neon Pilot CLI because ${linkPath} already points to ${otherTarget}.`,
        );
        expect(readlinkSync(linkPath)).toBe(otherTarget);
      } finally {
        rmSync(root, { recursive: true, force: true });
        rmSync(otherRoot, { recursive: true, force: true });
      }
    });
  });

  it('refuses to overwrite a non-symlink user shell command', () => {
    withTempHome((home) => {
      const root = mkdtempSync(join(tmpdir(), 'neon-pilot-cli-env-'));
      try {
        const linkPath = join(home, '.local', 'bin', 'neon-pilot');
        mkdirSync(join(home, '.local', 'bin'), { recursive: true });
        writeFileSync(linkPath, '#!/bin/sh\necho existing\n');

        const status = readNeonPilotCliInstallStatus({ repoRoot: process.cwd(), stateRoot: root });

        expect(status.globallyInstalled).toBe(false);
        expect(status.linkExists).toBe(true);
        expect(status.linkConflict).toBe(true);
        expect(status.linkTarget).toBeUndefined();
        expect(() => installNeonPilotUserCli({ repoRoot: process.cwd(), stateRoot: root })).toThrow(
          `Cannot install Neon Pilot CLI because ${linkPath} already exists and is not a Neon Pilot CLI symlink.`,
        );
        expect(readFileSync(linkPath, 'utf-8')).toBe('#!/bin/sh\necho existing\n');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
