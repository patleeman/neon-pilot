import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ensureDesktopRootDir,
  getDefaultDesktopRoot,
  getDesktopRootDir,
  getRuntimeAuthFilePath,
  getRuntimeModelsFilePath,
  getRuntimeProbeDir,
  getRuntimeSessionsIndexFilePath,
  getSkillsRegistryFilePath,
  resolveDesktopAppDataDir,
  resolveDesktopRootLayout,
} from './desktop-root.js';

describe('desktop root layout', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  it('defaults to a single host-visible desktop root', () => {
    expect(getDefaultDesktopRoot()).toBe(join(homedir(), 'Documents', 'neon-pilot-desktop'));
    expect(getDesktopRootDir()).toBe(getDefaultDesktopRoot());
  });

  it('resolves the canonical desktop layout from an explicit root', () => {
    const layout = resolveDesktopRootLayout({ root: '/Users/example/Agent Desktop' });

    expect(layout).toEqual({
      root: '/Users/example/Agent Desktop',
      apps: '/Users/example/Agent Desktop/apps',
      data: '/Users/example/Agent Desktop/data',
      dataApps: '/Users/example/Agent Desktop/data/apps',
      dataDocuments: '/Users/example/Agent Desktop/data/documents',
      dataExports: '/Users/example/Agent Desktop/data/exports',
      documents: '/Users/example/Agent Desktop/documents',
      agents: '/Users/example/Agent Desktop/agents',
      soulDoc: '/Users/example/Agent Desktop/agents/soul.md',
      logs: '/Users/example/Agent Desktop/logs',
      logsDesktop: '/Users/example/Agent Desktop/logs/desktop',
      logsDaemon: '/Users/example/Agent Desktop/logs/daemon',
      logsTelemetry: '/Users/example/Agent Desktop/logs/telemetry',
      system: '/Users/example/Agent Desktop/system',
      systemAgents: '/Users/example/Agent Desktop/system/agents',
      systemApps: '/Users/example/Agent Desktop/system/apps',
      systemCache: '/Users/example/Agent Desktop/system/cache',
      systemConfig: '/Users/example/Agent Desktop/system/config',
      systemConversations: '/Users/example/Agent Desktop/system/conversations',
      systemConversationsIndex: '/Users/example/Agent Desktop/system/conversations/session-meta-index.json',
      systemSessions: '/Users/example/Agent Desktop/system/conversations/sessions',
      systemDaemon: '/Users/example/Agent Desktop/system/daemon',
      systemElectron: '/Users/example/Agent Desktop/system/electron',
      systemElectronUserData: '/Users/example/Agent Desktop/system/electron/user-data',
      systemObservability: '/Users/example/Agent Desktop/system/observability',
      systemRuntime: '/Users/example/Agent Desktop/system/runtime',
      systemSecrets: '/Users/example/Agent Desktop/system/secrets',
      systemState: '/Users/example/Agent Desktop/system/state',
    });
  });

  it('reads desktop root from machine config when no explicit root is passed', () => {
    const configRoot = tempDir('neon-pilot-config-');
    writeFileSync(join(configRoot, 'config.json'), JSON.stringify({ desktopRoot: '~/Agent Desktop' }));

    expect(getDesktopRootDir({ configRoot })).toBe(join(homedir(), 'Agent Desktop'));
  });

  it('keeps explicit root options ahead of machine config', () => {
    const configRoot = tempDir('neon-pilot-config-');
    writeFileSync(join(configRoot, 'config.json'), JSON.stringify({ desktopRoot: '/configured/root' }));

    expect(getDesktopRootDir({ configRoot, root: '/explicit/root' })).toBe('/explicit/root');
  });

  it('resolves probe dir from desktop root layout', () => {
    const layout = resolveDesktopRootLayout({ root: '/desktop' });
    expect(getRuntimeProbeDir(layout)).toBe('/desktop/system/runtime/probes');
  });

  it('falls back to legacy pi-agent runtime dir for probes when no layout is provided', () => {
    const result = getRuntimeProbeDir();
    expect(result).toMatch(/neon-pilot-runtime$/);
  });

  it('resolves modelsFilePath from desktop root layout', () => {
    const layout = resolveDesktopRootLayout({ root: '/desktop' });
    expect(getRuntimeModelsFilePath(layout)).toBe('/desktop/system/runtime/models.json');
  });

  it('falls back to legacy pi-agent runtime dir when no layout is provided', () => {
    const result = getRuntimeModelsFilePath();
    // Uses getPiAgentRuntimeDir() as its base
    expect(result).toMatch(/neon-pilot-runtime\/models\.json$/);
  });

  it('resolves the session index path from desktop root layout', () => {
    const layout = resolveDesktopRootLayout({ root: '/desktop' });
    expect(getRuntimeSessionsIndexFilePath(layout)).toBe('/desktop/system/conversations/session-meta-index.json');
  });

  it('falls back to legacy pi-agent runtime dir for session index when no layout is provided', () => {
    const result = getRuntimeSessionsIndexFilePath();
    expect(result).toMatch(/neon-pilot-runtime\/session-meta-index\.json$/);
  });

  it('resolves authFilePath from desktop root layout', () => {
    const layout = resolveDesktopRootLayout({ root: '/desktop' });
    expect(getRuntimeAuthFilePath(layout)).toBe('/desktop/system/runtime/auth.json');
  });

  it('falls back to legacy pi-agent runtime dir for auth when no layout is provided', () => {
    const result = getRuntimeAuthFilePath();
    expect(result).toMatch(/neon-pilot-runtime\/auth\.json$/);
  });

  it('resolves skillsRegistryFilePath from desktop root layout', () => {
    const layout = resolveDesktopRootLayout({ root: '/desktop' });
    expect(getSkillsRegistryFilePath(layout)).toBe('/desktop/system/state/skills-registry.json');
  });

  it('falls back to legacy state root for skills registry when no layout is provided', () => {
    const result = getSkillsRegistryFilePath();
    expect(result).toMatch(/skills-registry\.json$/);
  });

  it('normalizes app data directories from app ids', () => {
    expect(resolveDesktopAppDataDir('system browser', { root: '/desktop' })).toBe('/desktop/data/apps/system-browser');
    expect(() => resolveDesktopAppDataDir('   ', { root: '/desktop' })).toThrow('Desktop app id must not be empty.');
  });

  describe('ensureDesktopRootDir', () => {
    it('creates the desktop root directory', () => {
      const testRoot = tempDir('neon-pilot-desktop-root-');
      expect(existsSync(testRoot)).toBe(true);

      // Now test that ensureDesktopRootDir creates a subdirectory within it
      const target = join(testRoot, 'my-desktop');
      expect(existsSync(target)).toBe(false);

      const result = ensureDesktopRootDir({ root: target });
      expect(result).toBe(target);
      expect(existsSync(target)).toBe(true);
    });

    it('is idempotent when the directory already exists', () => {
      const testRoot = tempDir('neon-pilot-desktop-root-');

      const target = join(testRoot, 'already-exists');
      mkdirSync(target, { recursive: true });
      expect(existsSync(target)).toBe(true);
      expect(existsSync(join(target, 'sub'))).toBe(false);

      const result = ensureDesktopRootDir({ root: target });
      expect(result).toBe(target);
      expect(existsSync(target)).toBe(true);

      // No additional subdirectory was created by ensureDesktopRootDir
      expect(existsSync(join(target, 'sub'))).toBe(false);
    });

    it('seeds a default soul doc when ensuring the desktop root directory', () => {
      const testRoot = tempDir('neon-pilot-desktop-root-');

      const target = join(testRoot, 'nested', 'desktop');
      const result = ensureDesktopRootDir({ root: target });
      expect(result).toBe(target);

      expect(existsSync(join(target, 'agents', 'soul.md'))).toBe(true);
      const content = readFileSync(join(target, 'agents', 'soul.md'), 'utf-8');
      expect(content).toContain('# Neon Pilot Persona');
    });

    it('is idempotent when the soul doc already exists', () => {
      const testRoot = tempDir('neon-pilot-desktop-root-');

      const target = join(testRoot, 'nested', 'desktop');
      mkdirSync(join(target, 'agents'), { recursive: true });
      writeFileSync(join(target, 'agents', 'soul.md'), '# Custom Soul\n\nCustom content.', 'utf-8');

      ensureDesktopRootDir({ root: target });

      const content = readFileSync(join(target, 'agents', 'soul.md'), 'utf-8');
      expect(content).toBe('# Custom Soul\n\nCustom content.');
    });

    it('does not create other layout subdirectories beyond agents', () => {
      const testRoot = tempDir('neon-pilot-desktop-root-');

      const target = join(testRoot, 'nested', 'desktop');
      ensureDesktopRootDir({ root: target });

      expect(existsSync(join(target, 'data'))).toBe(false);
      expect(existsSync(join(target, 'system'))).toBe(false);
      expect(existsSync(join(target, 'logs'))).toBe(false);
    });
  });
});
