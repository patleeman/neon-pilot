/**
 * Tests for runtime state path resolution
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getConfigRoot,
  getDefaultKnowledgeRoot,
  getDefaultStateRoot,
  getDurableAgentFilePath,
  getDurableConversationAttentionDir,
  getDurableMemoryDir,
  getDurableModelsDir,
  getDurableNodesDir,
  getDurableNotesDir,
  getDurablePiAgentDir,
  getDurableProjectsDir,
  getDurableRuntimeConfigRoot,
  getDurableRuntimeScopeDir,
  getDurableSessionsDir,
  getDurableSettingsDir,
  getDurableSkillsDir,
  getDurableTasksDir,
  getKnowledgeRoot,
  getLocalRuntimeConfigDir,
  getRuntimeConfigRoot,
  getStateRoot,
  getSyncRoot,
  isPathInRepo,
  resolveNeutralChatCwd,
  resolveStatePaths,
  type RuntimeStatePaths,
  validateStatePathsOutsideRepo,
} from './paths.js';

describe('getDefaultStateRoot', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.XDG_STATE_HOME;
    delete process.env.NEON_PILOT_STATE_ROOT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use XDG_STATE_HOME when set', () => {
    process.env.XDG_STATE_HOME = '/custom/state';
    expect(getDefaultStateRoot()).toBe('/custom/state/neon-pilot');
  });

  it('should fall back to ~/.local/state/neon-pilot', () => {
    delete process.env.XDG_STATE_HOME;
    expect(getDefaultStateRoot()).toBe(join(homedir(), '.local', 'state', 'neon-pilot'));
  });
});

describe('getStateRoot', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEON_PILOT_RUNTIME_CHANNEL;
    delete process.env.NEON_PILOT_DESKTOP_VARIANT;
    delete process.env.NEON_PILOT_STATE_ROOT;
    delete process.env.XDG_STATE_HOME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return NEON_PILOT_STATE_ROOT when set', () => {
    process.env.NEON_PILOT_STATE_ROOT = '/custom/runtime/state';
    expect(getStateRoot()).toBe('/custom/runtime/state');
  });

  it('should fall back to default state root', () => {
    delete process.env.NEON_PILOT_STATE_ROOT;
    expect(getStateRoot()).toBe(getDefaultStateRoot());
  });

  it('should isolate explicit runtime channels onto channel-specific state roots', () => {
    process.env.XDG_STATE_HOME = '/state';
    process.env.NEON_PILOT_RUNTIME_CHANNEL = 'testing';
    expect(getStateRoot()).toBe('/state/neon-pilot-testing');

    process.env.NEON_PILOT_RUNTIME_CHANNEL = 'dev';
    expect(getStateRoot()).toBe('/state/neon-pilot-dev');

    process.env.NEON_PILOT_RUNTIME_CHANNEL = 'rc';
    expect(getStateRoot()).toBe('/state/neon-pilot-rc');
  });

  it('should keep explicit state root overrides ahead of runtime channel defaults', () => {
    process.env.NEON_PILOT_RUNTIME_CHANNEL = 'testing';
    process.env.NEON_PILOT_STATE_ROOT = '/custom/runtime/state';
    expect(getStateRoot()).toBe('/custom/runtime/state');
  });
});

describe('resolveNeutralChatCwd', () => {
  it('returns and creates the runtime-scope-scoped neutral Chat workspace', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-neutral-chat-cwd-'));
    try {
      const cwd = resolveNeutralChatCwd('shared/profile', stateRoot);

      expect(cwd).toBe(join(stateRoot, 'neon-pilot-runtime', 'chat-workspaces', 'shared-profile'));
      expect(existsSync(cwd)).toBe(true);
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });
});

describe('runtime config path helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEON_PILOT_STATE_ROOT;
    delete process.env.NEON_PILOT_CONFIG_ROOT;
    delete process.env.NEON_PILOT_CONFIG_FILE;
    delete process.env.NEON_PILOT_KNOWLEDGE_ROOT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('derives runtime state paths from state root and durable knowledge paths from the knowledge root', () => {
    process.env.NEON_PILOT_STATE_ROOT = '/runtime/state';

    expect(getConfigRoot()).toBe('/runtime/state/config');
    expect(getDefaultKnowledgeRoot()).toBe(join(homedir(), 'Documents', 'neon-pilot'));
    expect(getKnowledgeRoot()).toBe(join(homedir(), 'Documents', 'neon-pilot'));
    expect(getRuntimeConfigRoot()).toBe('/runtime/state/config/runtime');
    expect(getSyncRoot()).toBe('/runtime/state/sync');
    expect(getDurablePiAgentDir()).toBe('/runtime/state/sync/pi-agent');
    expect(getDurableSessionsDir()).toBe('/runtime/state/sync/pi-agent/sessions');
    expect(getDurableConversationAttentionDir()).toBe('/runtime/state/sync/pi-agent/state/conversation-attention');
    expect(getDurableRuntimeConfigRoot()).toBe('/runtime/state/config/runtime');
    expect(getDurableAgentFilePath()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'AGENTS.md'));
    expect(getDurableSettingsDir()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'settings'));
    expect(getDurableModelsDir()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'models'));
    expect(getDurableSkillsDir()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'skills'));
    expect(getDurableNodesDir()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'nodes'));
    expect(getDurableNotesDir()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'notes'));
    expect(getDurableMemoryDir()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'notes'));
    expect(getDurableTasksDir()).toBe('/runtime/state/sync/tasks');
    expect(getDurableProjectsDir()).toBe(join(homedir(), 'Documents', 'neon-pilot', 'projects'));
    expect(getLocalRuntimeConfigDir()).toBe('/runtime/state/config/local');
  });

  it('honors explicit overrides', () => {
    process.env.NEON_PILOT_CONFIG_ROOT = '/custom/config';
    process.env.NEON_PILOT_KNOWLEDGE_ROOT = '/custom/knowledge';

    expect(getConfigRoot()).toBe('/custom/config');
    expect(getKnowledgeRoot()).toBe('/custom/knowledge');
    expect(getRuntimeConfigRoot()).toBe('/custom/config/runtime');
    expect(getDurableRuntimeConfigRoot()).toBe('/custom/config/runtime');
    expect(getDurableAgentFilePath()).toBe('/custom/knowledge/AGENTS.md');
    expect(getDurableSkillsDir()).toBe('/custom/knowledge/skills');
    expect(getDurableNotesDir()).toBe('/custom/knowledge/notes');
    expect(getDurableProjectsDir()).toBe('/custom/knowledge/projects');
    expect(getLocalRuntimeConfigDir()).toBe('/custom/config/local');
  });

  it('reads knowledge root from machine config when no env override is set', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'neon-pilot-config-'));
    const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-state-'));
    writeFileSync(join(configDir, 'config.json'), JSON.stringify({ knowledgeRoot: '~/Documents/custom-agent-knowledge' }));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    process.env.NEON_PILOT_CONFIG_FILE = join(configDir, 'config.json');

    expect(getKnowledgeRoot()).toBe(join(homedir(), 'Documents', 'custom-agent-knowledge'));
    expect(getDurableRuntimeConfigRoot()).toBe(join(stateRoot, 'config', 'runtime'));
    expect(getDurableAgentFilePath()).toBe(join(homedir(), 'Documents', 'custom-agent-knowledge', 'AGENTS.md'));

    rmSync(configDir, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('keeps durable knowledge directories canonical while runtime config stays machine-local', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-state-'));

    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    process.env.NEON_PILOT_KNOWLEDGE_ROOT = join(stateRoot, 'sync');

    expect(getRuntimeConfigRoot()).toBe(join(stateRoot, 'config', 'runtime'));
    expect(getDurableRuntimeConfigRoot()).toBe(join(stateRoot, 'config', 'runtime'));
    expect(getDurableRuntimeScopeDir('default')).toBe(join(stateRoot, 'config', 'runtime', 'default'));
    expect(getDurableAgentFilePath()).toBe(join(stateRoot, 'sync', 'AGENTS.md'));
    expect(getDurableSkillsDir()).toBe(join(stateRoot, 'sync', 'skills'));
    expect(getDurableTasksDir()).toBe(join(stateRoot, 'sync', 'tasks'));

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('expands ~ in path overrides', () => {
    process.env.NEON_PILOT_CONFIG_ROOT = '~/pa-config';
    process.env.NEON_PILOT_KNOWLEDGE_ROOT = '~/Documents/neon-pilot';

    expect(getConfigRoot()).toBe(join(homedir(), 'pa-config'));
    expect(getKnowledgeRoot()).toBe(join(homedir(), 'Documents', 'neon-pilot'));
  });
});

describe('resolveStatePaths', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEON_PILOT_STATE_ROOT;
    delete process.env.NEON_PILOT_AUTH_PATH;
    delete process.env.NEON_PILOT_SESSION_PATH;
    delete process.env.NEON_PILOT_CACHE_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return default paths when no env vars set', () => {
    const paths = resolveStatePaths();
    const root = getDefaultStateRoot();

    expect(paths.root).toBe(root);
    expect(paths.auth).toBe(join(root, 'auth'));
    expect(paths.session).toBe(join(root, 'session'));
    expect(paths.cache).toBe(join(root, 'cache'));
  });

  it('should use NEON_PILOT_STATE_ROOT for base path', () => {
    process.env.NEON_PILOT_STATE_ROOT = '/runtime/state';
    const paths = resolveStatePaths();

    expect(paths.root).toBe('/runtime/state');
    expect(paths.auth).toBe('/runtime/state/auth');
    expect(paths.session).toBe('/runtime/state/session');
    expect(paths.cache).toBe('/runtime/state/cache');
  });

  it('should allow individual path overrides', () => {
    process.env.NEON_PILOT_AUTH_PATH = '/secure/auth';
    process.env.NEON_PILOT_SESSION_PATH = '/tmp/sessions';
    process.env.NEON_PILOT_CACHE_PATH = '/var/cache/pa';

    const paths = resolveStatePaths();

    expect(paths.auth).toBe('/secure/auth');
    expect(paths.session).toBe('/tmp/sessions');
    expect(paths.cache).toBe('/var/cache/pa');
  });

  it('should combine root override with individual overrides', () => {
    process.env.NEON_PILOT_STATE_ROOT = '/runtime/state';
    process.env.NEON_PILOT_AUTH_PATH = '/secure/auth';

    const paths = resolveStatePaths();

    expect(paths.root).toBe('/runtime/state');
    expect(paths.auth).toBe('/secure/auth');
    expect(paths.session).toBe('/runtime/state/session');
    expect(paths.cache).toBe('/runtime/state/cache');
  });
});

describe('isPathInRepo', () => {
  it('should return true for paths inside repo', () => {
    const repoRoot = '/home/user/project';
    expect(isPathInRepo('/home/user/project', repoRoot)).toBe(true);
    expect(isPathInRepo('/home/user/project/src', repoRoot)).toBe(true);
    expect(isPathInRepo('/home/user/project/.git', repoRoot)).toBe(true);
    expect(isPathInRepo('/home/user/project/data/cache', repoRoot)).toBe(true);
  });

  it('should return false for paths outside repo', () => {
    const repoRoot = '/home/user/project';
    expect(isPathInRepo('/home/user', repoRoot)).toBe(false);
    expect(isPathInRepo('/home/user/other-project', repoRoot)).toBe(false);
    expect(isPathInRepo('/tmp/cache', repoRoot)).toBe(false);
    expect(isPathInRepo('/var/lib/data', repoRoot)).toBe(false);
  });

  it('should handle paths with trailing slashes', () => {
    const repoRoot = '/home/user/project';
    expect(isPathInRepo('/home/user/project/', repoRoot)).toBe(true);
    expect(isPathInRepo('/home/user/project/src/', repoRoot)).toBe(true);
  });

  it('should handle Windows-style paths', () => {
    const repoRoot = 'C:\\Users\\project';
    expect(isPathInRepo('C:\\Users\\project\\cache', repoRoot)).toBe(true);
    expect(isPathInRepo('D:\\other', repoRoot)).toBe(false);
  });

  it('should handle sibling directories correctly', () => {
    const repoRoot = '/home/user/project';
    expect(isPathInRepo('/home/user/project-data', repoRoot)).toBe(false);
    expect(isPathInRepo('/home/user/project_backup', repoRoot)).toBe(false);
  });

  it('canonicalizes dot segments before comparison', () => {
    const repoRoot = '/home/user/project';
    expect(isPathInRepo('/home/user/project/../outside', repoRoot)).toBe(false);
    expect(isPathInRepo('/home/user/project/../project/cache', repoRoot)).toBe(true);
  });

  it('resolves symlink targets before comparison', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'pa-paths-symlink-'));

    try {
      const repoRoot = join(tempRoot, 'repo');
      const symlinkPath = join(tempRoot, 'repo-link');

      mkdirSync(repoRoot, { recursive: true });
      symlinkSync(repoRoot, symlinkPath);

      expect(isPathInRepo(join(symlinkPath, 'state'), repoRoot)).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('validateStatePathsOutsideRepo', () => {
  it('should not throw when all paths are outside repo', () => {
    const paths: RuntimeStatePaths = {
      root: '/runtime/state',
      auth: '/runtime/state/auth',
      session: '/runtime/state/session',
      cache: '/runtime/state/cache',
    };

    expect(() => validateStatePathsOutsideRepo(paths, '/home/user/project')).not.toThrow();
  });

  it('should throw when root path is in repo', () => {
    const paths: RuntimeStatePaths = {
      root: '/home/user/project/.state',
      auth: '/tmp/auth',
      session: '/tmp/session',
      cache: '/tmp/cache',
    };

    expect(() => validateStatePathsOutsideRepo(paths, '/home/user/project')).toThrow('State root');
  });

  it('should throw when auth path is in repo', () => {
    const paths: RuntimeStatePaths = {
      root: '/home/user/project/.state',
      auth: '/home/user/project/.state/auth',
      session: '/tmp/session',
      cache: '/tmp/cache',
    };

    expect(() => validateStatePathsOutsideRepo(paths, '/home/user/project')).toThrow('Auth path');
  });

  it('should throw when session path is in repo', () => {
    const paths: RuntimeStatePaths = {
      root: '/tmp/state',
      auth: '/tmp/auth',
      session: '/home/user/project/.sessions',
      cache: '/tmp/cache',
    };

    expect(() => validateStatePathsOutsideRepo(paths, '/home/user/project')).toThrow('Session path');
  });

  it('should throw when cache path is in repo', () => {
    const paths: RuntimeStatePaths = {
      root: '/tmp/state',
      auth: '/tmp/auth',
      session: '/tmp/session',
      cache: '/home/user/project/node_modules/.cache',
    };

    expect(() => validateStatePathsOutsideRepo(paths, '/home/user/project')).toThrow('Cache path');
  });

  it('should report all violations in error message', () => {
    const paths: RuntimeStatePaths = {
      root: '/home/user/project/state',
      auth: '/home/user/project/state/auth',
      session: '/home/user/project/state/session',
      cache: '/home/user/project/state/cache',
    };

    let error: Error | undefined;
    try {
      validateStatePathsOutsideRepo(paths, '/home/user/project');
    } catch (e) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error!.message).toContain('State root');
    expect(error!.message).toContain('Auth path');
    expect(error!.message).toContain('Session path');
    expect(error!.message).toContain('Cache path');
    expect(error!.message).toContain('NEON_PILOT_STATE_ROOT');
  });
});
