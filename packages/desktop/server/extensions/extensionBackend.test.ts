import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkEnabledExtensionBackendHealth,
  createBackendContext,
  invokeExtensionAction,
  invokeExtensionRoute,
  loadExtensionAgentFactory,
  loadExtensionBackend,
  reloadExtensionBackend,
  runExtensionSelfTest,
  setWorkerImportBackendRunnerForTests,
} from './extensionBackend.js';
import { resolveExtensionBackendLoadTarget, resolvePrebuiltSystemExtensionBackend } from './extensionBackendLoadTarget.js';
import { setExtensionBackendRunnerForTests } from './extensionBackendRunner.js';
import { invalidateExtensionRegistryReadCaches, isExtensionEnabled, setExtensionEnabled } from './extensionRegistry.js';

const TEST_EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../extensions/system-auto-mode');

const ORIGINAL_STATE_ROOT = process.env.NEON_PILOT_STATE_ROOT;

function installTestExtension(stateRoot: string, extensionId: string): void {
  const extensionRoot = join(stateRoot, 'extensions', extensionId);
  mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
  writeFileSync(
    join(extensionRoot, 'extension.json'),
    JSON.stringify(
      {
        schemaVersion: 2,
        id: extensionId,
        name: extensionId,
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'ensure', handler: 'ensure', worker: { enabled: true } }],
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export {};\n');
  writeFileSync(join(extensionRoot, 'dist', 'frontend.js'), 'export {};\n');
  invalidateExtensionRegistryReadCaches(stateRoot);
}

function installKnowledgeWorkerTestExtension(stateRoot: string): void {
  const extensionRoot = join(stateRoot, 'extensions', 'system-knowledge');
  mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
  writeFileSync(
    join(extensionRoot, 'extension.json'),
    JSON.stringify(
      {
        schemaVersion: 2,
        id: 'system-knowledge',
        name: 'Knowledge',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [
            'knowledgeListFiles',
            'readState',
            'updateState',
            'sync',
            'knowledgeReadFile',
            'knowledgeWriteFile',
            'knowledgeCreateFolder',
            'knowledgeDeleteFile',
            'knowledgeRename',
            'knowledgeMove',
            'knowledgeUploadImage',
            'knowledgeImportUrl',
            'knowledgeImportSharedItem',
            'readMemory',
          ].map((id) => ({ id, handler: id, worker: { enabled: true } })),
          routes: [
            ['GET', '/knowledge/search', 'knowledgeSearchRoute'],
            ['GET', '/memory', 'memoryRoute'],
            ['PUT', '/knowledge/file', 'knowledgeWriteFileRoute'],
            ['POST', '/knowledge/folder', 'knowledgeCreateFolderRoute'],
            ['DELETE', '/knowledge/file', 'knowledgeDeleteFileRoute'],
            ['POST', '/knowledge/rename', 'knowledgeRenameRoute'],
            ['POST', '/knowledge/move', 'knowledgeMoveRoute'],
            ['POST', '/knowledge/image', 'knowledgeUploadImageRoute'],
            ['POST', '/knowledge/share-import', 'knowledgeImportUrlRoute'],
            ['GET', '/asset', 'asset'],
          ].map(([method, path, handler]) => ({ method, path, handler, worker: { enabled: true } })),
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export {};\n');
  invalidateExtensionRegistryReadCaches(stateRoot);
}

const extensionServices = vi.hoisted(() => ({
  startExtensionServices: vi.fn(async () => undefined),
  stopExtensionServices: vi.fn(async () => undefined),
}));

vi.mock('./extensionServices.js', () => extensionServices);

afterEach(() => {
  vi.clearAllMocks();
  setExtensionBackendRunnerForTests(undefined);
  setWorkerImportBackendRunnerForTests(undefined);
  if (ORIGINAL_STATE_ROOT === undefined) delete process.env.NEON_PILOT_STATE_ROOT;
  else process.env.NEON_PILOT_STATE_ROOT = ORIGINAL_STATE_ROOT;
});

describe('extension backend action invocation', () => {
  it('retries transient backend health load failures before recording a failure', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'health-ext');
    let healthExtAttempts = 0;
    const workerRunner = {
      loadModule: vi.fn(async (extensionId: string) => {
        if (extensionId === 'health-ext') {
          healthExtAttempts += 1;
          if (healthExtAttempts === 1) throw new Error('worker warming');
        }
        return {};
      }),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    const results = await checkEnabledExtensionBackendHealth();

    expect(results).toContainEqual({ extensionId: 'health-ext', ok: true });
    expect(healthExtAttempts).toBe(2);
    expect(isExtensionEnabled('health-ext', stateRoot)).toBe(true);
  });

  it('uses the server route settings file in backend contexts', () => {
    const context = createBackendContext('settings-aware-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => '/state-root',
      getSettingsFile: () => '/runtime/from-route/settings.json',
    });

    expect(context.runtimeDir).toBe('/state-root/neon-pilot-runtime');
    expect(context.runtimeSettingsFilePath).toBe('/runtime/from-route/settings.json');
  });

  it('requires mcp write permission for host-run runtime MCP refresh', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'runtime-refresh-ext');
    const context = createBackendContext('runtime-refresh-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    expect(() => context.runtime.refreshSkillMcpConfig()).toThrow(
      'Extension "runtime-refresh-ext" requires permission mcp:write to use runtime.refreshSkillMcpConfig.',
    );
  });

  it('requires extension registry permissions for host-run extension helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'registry-helper-ext');
    const context = createBackendContext('registry-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    expect(() => context.extensions.listActions()).toThrow(
      'Extension "registry-helper-ext" requires permission extensions:read to use extensions.listActions.',
    );
    expect(() => context.extensions.getStatus('registry-helper-ext')).toThrow(
      'Extension "registry-helper-ext" requires permission extensions:read to use extensions.getStatus.',
    );
    expect(() => context.extensions.setEnabled('registry-helper-ext', false)).toThrow(
      'Extension "registry-helper-ext" requires permission extensions:write to use extensions.setEnabled.',
    );
    await expect(context.extensions.callAction('registry-helper-ext', 'ensure', {})).rejects.toThrow(
      'Extension "registry-helper-ext" requires permission extensions:read to use extensions.callAction.',
    );
  });

  it('allows declared host-run extension registry writes', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'registry-writer-ext');
    const extensionRoot = join(stateRoot, 'extensions', 'registry-writer-ext');
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'registry-writer-ext',
        name: 'Registry Writer Ext',
        permissions: ['extensions:write'],
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'ensure', handler: 'ensure', worker: { enabled: true } }],
        },
      }),
    );
    invalidateExtensionRegistryReadCaches(stateRoot);
    const context = createBackendContext('registry-writer-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    expect(() => context.extensions.setEnabled('registry-writer-ext', false)).not.toThrow();
    expect(isExtensionEnabled('registry-writer-ext', stateRoot)).toBe(false);
  });

  it('requires command permissions for host-run command helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'command-helper-ext');
    const context = createBackendContext('command-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.commands.list()).rejects.toThrow(
      'Extension "command-helper-ext" requires permission commands:read to use commands.list.',
    );
    await expect(context.commands.execute('app.test')).rejects.toThrow(
      'Extension "command-helper-ext" requires permission commands:execute to use commands.execute.',
    );
  });

  it('requires shell execute permission for host-run shell helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'shell-helper-ext');
    const context = createBackendContext('shell-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.shell.exec({ command: 'echo', args: ['hello'] })).rejects.toThrow(
      'Extension "shell-helper-ext" requires permission shell:execute to use shell.exec.',
    );
    await expect(context.shell.spawn({ command: 'echo', args: ['hello'] })).rejects.toThrow(
      'Extension "shell-helper-ext" requires permission shell:execute to use shell.spawn.',
    );
  });

  it('requires model permissions for host-run model helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'model-helper-ext');
    const context = createBackendContext('model-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.models.list()).rejects.toThrow('Extension "model-helper-ext" requires permission models:read to use models.list.');
    await expect(context.models.saveProvider({ provider: 'ds4' })).rejects.toThrow(
      'Extension "model-helper-ext" requires permission models:write to use models.saveProvider.',
    );
  });

  it('requires workspace and filesystem permissions for host-run file helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'file-helper-ext');
    const context = createBackendContext('file-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.workspace.readText({ cwd: '/repo', path: 'README.md' })).rejects.toThrow(
      'Extension "file-helper-ext" requires permission workspace:read to use workspace.readText.',
    );
    await expect(context.workspace.writeText({ cwd: '/repo', path: 'README.md', content: 'hello' })).rejects.toThrow(
      'Extension "file-helper-ext" requires permission workspace:write to use workspace.writeText.',
    );
    await expect(context.filesystem.app({ access: ['read'] })).rejects.toThrow(
      'Extension "file-helper-ext" requires permission filesystem:read to use filesystem.app.',
    );
    await expect(context.filesystem.temp({ access: ['write'] })).rejects.toThrow(
      'Extension "file-helper-ext" requires permission filesystem:write to use filesystem.temp.',
    );
  });

  it('requires execution permissions for host-run execution helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'execution-helper-ext');
    const context = createBackendContext('execution-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.executions.list()).rejects.toThrow(
      'Extension "execution-helper-ext" requires permission executions:read to use executions.list.',
    );
    await expect(context.executions.start({ prompt: 'go' })).rejects.toThrow(
      'Extension "execution-helper-ext" requires permission executions:start to use executions.start.',
    );
    await expect(context.executions.cancel('run-1')).rejects.toThrow(
      'Extension "execution-helper-ext" requires permission executions:cancel to use executions.cancel.',
    );
  });

  it('requires storage permissions for host-run storage helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'storage-helper-ext');
    const context = createBackendContext('storage-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.storage.get('settings')).rejects.toThrow(
      'Extension "storage-helper-ext" requires permission storage:read to use storage.get.',
    );
    await expect(context.storage.list()).rejects.toThrow(
      'Extension "storage-helper-ext" requires permission storage:read to use storage.list.',
    );
    await expect(context.storage.put('settings', { ok: true })).rejects.toThrow(
      'Extension "storage-helper-ext" requires permission storage:write to use storage.put.',
    );
    await expect(context.storage.delete('settings')).rejects.toThrow(
      'Extension "storage-helper-ext" requires permission storage:write to use storage.delete.',
    );
  });

  it('requires git read permission for host-run git helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'git-helper-ext');
    const context = createBackendContext('git-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.git.status({ cwd: '/repo' })).rejects.toThrow(
      'Extension "git-helper-ext" requires permission git:read to use git.status.',
    );
    await expect(context.git.diff({ cwd: '/repo' })).rejects.toThrow(
      'Extension "git-helper-ext" requires permission git:read to use git.diff.',
    );
    await expect(context.git.log({ cwd: '/repo' })).rejects.toThrow(
      'Extension "git-helper-ext" requires permission git:read to use git.log.',
    );
  });

  it('requires notify permission for host-run notification helpers', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'notify-helper-ext');
    const context = createBackendContext('notify-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    expect(() => context.notify.toast('Saved')).toThrow('Extension "notify-helper-ext" requires permission ui:notify to use notify.toast.');
    expect(() => context.notify.system({ title: 'Title', message: 'Body' })).toThrow(
      'Extension "notify-helper-ext" requires permission ui:notify to use notify.system.',
    );
    expect(() => context.notify.setBadge(1)).toThrow('Extension "notify-helper-ext" requires permission ui:notify to use notify.setBadge.');
    expect(() => context.notify.clearBadge()).toThrow(
      'Extension "notify-helper-ext" requires permission ui:notify to use notify.clearBadge.',
    );
    expect(() => context.notify.isSystemAvailable()).toThrow(
      'Extension "notify-helper-ext" requires permission ui:notify to use notify.isSystemAvailable.',
    );
  });

  it('requires runtime read permission for host-run runtime provider helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'runtime-provider-helper-ext');
    const context = createBackendContext('runtime-provider-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.runtimes.list()).rejects.toThrow(
      'Extension "runtime-provider-helper-ext" requires permission runtimes:read to use runtimes.list.',
    );
    await expect(context.runtimes.get('runtime-1')).rejects.toThrow(
      'Extension "runtime-provider-helper-ext" requires permission runtimes:read to use runtimes.get.',
    );
    await expect(context.runtimes.healthCheck('runtime-1')).rejects.toThrow(
      'Extension "runtime-provider-helper-ext" requires permission runtimes:read to use runtimes.healthCheck.',
    );
  });

  it('requires telemetry write permission for host-run telemetry helpers', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'telemetry-helper-ext');
    const context = createBackendContext('telemetry-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    expect(() => context.telemetry.record({ category: 'extension', name: 'done' })).toThrow(
      'Extension "telemetry-helper-ext" requires permission telemetry:write to use telemetry.record.',
    );
  });

  it('requires UI invalidate permission for host-run UI invalidation helpers', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'ui-helper-ext');
    const context = createBackendContext('ui-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    expect(() => context.ui.invalidate(['sessions'])).toThrow(
      'Extension "ui-helper-ext" requires permission ui:invalidate to use ui.invalidate.',
    );
  });

  it('requires conversation permissions for host-run conversation helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'conversation-helper-ext');
    const context = createBackendContext('conversation-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
      getSettingsFile: () => join(stateRoot, 'settings.json'),
    });

    await expect(context.conversations.list()).rejects.toThrow(
      'Extension "conversation-helper-ext" requires permission conversations:read to use conversations.list.',
    );
    await expect(context.conversations.getWorkspace()).rejects.toThrow(
      'Extension "conversation-helper-ext" requires permission conversations:read to use conversations.getWorkspace.',
    );
    await expect(context.conversations.create({ cwd: '/repo', live: false })).rejects.toThrow(
      'Extension "conversation-helper-ext" requires permission conversations:write to use conversations.create.',
    );
    await expect(context.conversations.metadata.set({ conversationId: 'conv-1', values: { ok: true } })).rejects.toThrow(
      'Extension "conversation-helper-ext" requires permission conversations:write to use conversations.metadata.set.',
    );
  });

  it('requires knowledge permissions for host-run knowledge helpers', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'knowledge-helper-ext');
    const context = createBackendContext('knowledge-helper-ext', {
      getRuntimeScope: () => 'shared',
      getRepoRoot: () => '/repo',
      getStateRoot: () => stateRoot,
    });

    await expect(context.knowledge.list()).rejects.toThrow(
      'Extension "knowledge-helper-ext" requires permission knowledge:read to use knowledge.list.',
    );
    await expect(context.knowledge.search('note')).rejects.toThrow(
      'Extension "knowledge-helper-ext" requires permission knowledge:read to use knowledge.search.',
    );
    await expect(context.knowledge.write('notes/today.md', 'hello')).rejects.toThrow(
      'Extension "knowledge-helper-ext" requires permission knowledge:write to use knowledge.write.',
    );
  });

  it('passes the server route settings file into worker action contexts', async () => {
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true })),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction(
        'system-runs',
        'bash',
        { command: 'echo bash works' },
        {
          getRuntimeScope: () => 'shared',
          getRepoRoot: () => '/repo',
          getStateRoot: () => '/state-root',
          getSettingsFile: () => '/runtime/from-route/settings.json',
        },
        {
          conversationId: 'conv-1',
          cwd: '/repo',
        },
      ),
    ).resolves.toEqual({ ok: true, result: { ok: true } });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-runs',
      expect.any(Object),
      'bash',
      expect.any(Object),
      [{ command: 'echo bash works' }],
      expect.objectContaining({
        context: expect.objectContaining({
          runtimeDir: '/state-root/neon-pilot-runtime',
          runtimeSettingsFilePath: '/runtime/from-route/settings.json',
          stateRoot: '/state-root',
        }),
      }),
    );
  });

  it('derives worker runtime settings from the server route state root', async () => {
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true })),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction(
        'system-runs',
        'bash',
        { command: 'echo bash works' },
        {
          getRuntimeScope: () => 'shared',
          getRepoRoot: () => '/repo',
          getStateRoot: () => '/state-root',
        },
        {
          conversationId: 'conv-1',
          cwd: '/repo',
        },
      ),
    ).resolves.toEqual({ ok: true, result: { ok: true } });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-runs',
      expect.any(Object),
      'bash',
      expect.any(Object),
      [{ command: 'echo bash works' }],
      expect.objectContaining({
        context: expect.objectContaining({
          runtimeDir: '/state-root/neon-pilot-runtime',
          runtimeSettingsFilePath: '/state-root/neon-pilot-runtime/settings.json',
          stateRoot: '/state-root',
        }),
      }),
    );
  });

  it('refuses to invoke actions from disabled extensions before loading backend code', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'disabled-action-ext');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'disabled-action-ext',
        name: 'Disabled Action Ext',
        backend: {
          entry: 'missing-backend.js',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    setExtensionEnabled('disabled-action-ext', false, stateRoot);

    await expect(invokeExtensionAction('disabled-action-ext', 'doThing', {})).resolves.toEqual({
      ok: false,
      error: 'Cannot invoke action "doThing": extension "disabled-action-ext" is disabled.',
    });
  });

  it('blocks process termination from extension actions and disables the extension', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'exit-action-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'exit-action-ext',
        name: 'Exit Action Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function doThing() { process.exit(42); }\n');

    const result = await invokeExtensionAction('exit-action-ext', 'doThing', {});

    expect(result).toEqual({
      ok: false,
      error: 'Extension "exit-action-ext" action "doThing" must declare worker.enabled before it can run.',
    });
    expect(isExtensionEnabled('exit-action-ext', stateRoot)).toBe(true);
  });

  it('returns repeated action handler errors without disabling the extension', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'validation-action-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'validation-action-ext',
        name: 'Validation Action Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function doThing() { throw new Error("validation failed"); }\n');

    await invokeExtensionAction('validation-action-ext', 'doThing', {});
    await invokeExtensionAction('validation-action-ext', 'doThing', {});
    const result = await invokeExtensionAction('validation-action-ext', 'doThing', {});

    expect(result).toEqual({
      ok: false,
      error: 'Extension "validation-action-ext" action "doThing" must declare worker.enabled before it can run.',
    });
    expect(isExtensionEnabled('validation-action-ext', stateRoot)).toBe(false);
  });

  it('blocks process termination during extension backend import', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'exit-import-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'exit-import-ext',
        name: 'Exit Import Ext',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'noop', handler: 'noop' }] },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'process.exit(42); export function noop() { return true; }\n');

    await expect(loadExtensionBackend('exit-import-ext')).rejects.toThrow('attempted to terminate the application via process.exit');
  });

  it('rejects backend actions that do not declare worker.enabled', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'runner-action-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'runner-action-ext',
        name: 'Runner Action Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    await expect(invokeExtensionAction('runner-action-ext', 'doThing', { ok: true })).resolves.toEqual({
      ok: false,
      error: 'Extension "runner-action-ext" action "doThing" must declare worker.enabled before it can run.',
    });
  });

  it('runs explicitly worker-safe backend actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ text: 'No commit checkpoints saved for conversation conv-1.', action: 'list' })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-diffs', 'checkpoint', { action: 'list' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
        onUpdate: undefined,
      }),
    ).resolves.toEqual({
      ok: true,
      result: { text: 'No commit checkpoints saved for conversation conv-1.', action: 'list' },
    });

    expect(workerRunner.hasExport).toHaveBeenCalledWith(
      'system-diffs',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-diffs', 'dist', 'backend.mjs')) }),
      'checkpoint',
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-diffs',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-diffs', 'dist', 'backend.mjs')) }),
      'checkpoint',
      { type: 'action', label: 'action checkpoint', target: 'checkpoint' },
      [{ action: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('derives worker tool context from agent tool context when direct tool context is absent', async () => {
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ text: 'ok' })),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-diffs', 'checkpoint', { action: 'list' }, undefined, undefined, {
        conversationId: 'conv-from-agent',
        sessionFile: '/sessions/conv-from-agent.jsonl',
        cwd: '/repo',
      }),
    ).resolves.toEqual({ ok: true, result: { text: 'ok' } });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-diffs',
      expect.any(Object),
      'checkpoint',
      expect.any(Object),
      [{ action: 'list' }],
      expect.objectContaining({
        context: expect.objectContaining({
          toolContext: {
            conversationId: 'conv-from-agent',
            sessionId: 'conv-from-agent',
            cwd: '/repo',
            sessionFile: '/sessions/conv-from-agent.jsonl',
          },
        }),
      }),
    );
  });

  it('rejects manifest worker actions when the input is not allowlisted', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(async (_extensionId, _compiled, _exportName, _operation, invoke) =>
        invoke(() => ({ action: 'unknown', via: 'in-process' })),
      ),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-diffs', 'checkpoint', { action: 'unknown' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'Extension "system-diffs" action "checkpoint" must declare worker.enabled before it can run.',
    });

    expect(workerRunner.runWorkerExport).not.toHaveBeenCalled();
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs artifact backend actions through the worker runner when manifest-declared', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ text: 'No artifacts saved for conversation conv-1.', action: 'list' })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-artifacts', 'artifact', { action: 'list' }, undefined, {
        conversationId: 'conv-1',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { text: 'No artifacts saved for conversation conv-1.', action: 'list' },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-artifacts',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-artifacts', 'dist', 'backend.mjs')) }),
      'artifact',
      { type: 'action', label: 'action artifact', target: 'artifact' },
      [{ action: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: { conversationId: 'conv-1' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe conversation context menu actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true, conversationId: 'conv-1' })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-conversation-tools', 'copyConversationId', {
        conversationId: 'conv-1',
        sessionTitle: 'Architecture Notes',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, conversationId: 'conv-1' },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'copyConversationId',
      { type: 'action', label: 'action copyConversationId', target: 'copyConversationId' },
      [{ conversationId: 'conv-1', sessionTitle: 'Architecture Notes' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: undefined,
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe split conversation tool actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) =>
        exportName === 'askUser'
          ? { content: [{ type: 'text', text: 'Asked the user a question.' }], details: { action: 'ask_user' } }
          : exportName === 'conversationInspect'
            ? { content: [{ type: 'text', text: 'Listed conversations.' }], details: { action: 'list', conversations: [] } }
            : exportName === 'conversationCwd'
              ? {
                  content: [{ type: 'text', text: 'Queued working directory change to /next.' }],
                  details: { action: 'queue', cwd: '/next' },
                }
              : exportName === 'conversationTitle'
                ? {
                    content: [{ type: 'text', text: 'Conversation title set.' }],
                    details: { conversationId: 'conv-1', title: 'New Title' },
                  }
                : { content: [{ type: 'text', text: 'scheduled' }], details: { text: 'scheduled', id: 'resume-1' } },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction(
        'system-conversation-tools',
        'askUser',
        { questions: [{ label: 'Proceed?', options: ['Yes', 'No'] }] },
        undefined,
        {
          conversationId: 'conv-1',
          cwd: '/repo',
        },
      ),
    ).resolves.toEqual({
      ok: true,
      result: { content: [{ type: 'text', text: 'Asked the user a question.' }], details: { action: 'ask_user' } },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationInspect', { action: 'list' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { content: [{ type: 'text', text: 'Listed conversations.' }], details: { action: 'list', conversations: [] } },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationTitle', { title: 'New Title' }, undefined, {
        conversationId: 'conv-1',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { content: [{ type: 'text', text: 'Conversation title set.' }], details: { conversationId: 'conv-1', title: 'New Title' } },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationCwd', { cwd: '/next' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'Queued working directory change to /next.' }],
        details: { action: 'queue', cwd: '/next' },
      },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'deferredResume', { action: 'add', trigger: 'delay', delay: '10m' }, undefined, {
        conversationId: 'conv-1',
        sessionFile: '/session.json',
        cwd: '/repo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { content: [{ type: 'text', text: 'scheduled' }], details: { text: 'scheduled', id: 'resume-1' } },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'askUser',
      { type: 'action', label: 'action askUser', target: 'askUser' },
      [{ questions: [{ label: 'Proceed?', options: ['Yes', 'No'] }] }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationInspect',
      { type: 'action', label: 'action conversationInspect', target: 'conversationInspect' },
      [{ action: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTitle',
      { type: 'action', label: 'action conversationTitle', target: 'conversationTitle' },
      [{ title: 'New Title' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1' },
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationCwd',
      { type: 'action', label: 'action conversationCwd', target: 'conversationCwd' },
      [{ cwd: '/next' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'deferredResumeTool',
      { type: 'action', label: 'action deferredResume', target: 'deferredResume' },
      [{ action: 'add', trigger: 'delay', delay: '10m' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', sessionFile: '/session.json', cwd: '/repo' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe local dictation settings actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ settings: { enabled: false, model: 'base.en' } })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-local-dictation', 'readSettings', {})).resolves.toEqual({
      ok: true,
      result: { settings: { enabled: false, model: 'base.en' } },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-dictation',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-dictation', 'dist', 'backend.mjs')),
      }),
      'readSettings',
      { type: 'action', label: 'action readSettings', target: 'readSettings' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe local dictation model and transcription actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) =>
        exportName === 'installModel'
          ? { provider: 'local-whisper', model: 'base.en', cacheDir: '/runtime/transcription-models' }
          : { text: 'hello world', provider: 'local-whisper', model: 'base.en', durationMs: 500 },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-local-dictation', 'installModel', { model: 'base.en' })).resolves.toEqual({
      ok: true,
      result: { provider: 'local-whisper', model: 'base.en', cacheDir: '/runtime/transcription-models' },
    });
    await expect(
      invokeExtensionAction('system-local-dictation', 'transcribeFile', {
        dataBase64: 'AAE=',
        mimeType: 'audio/pcm',
        language: 'en',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { text: 'hello world', provider: 'local-whisper', model: 'base.en', durationMs: 500 },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-dictation',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-dictation', 'dist', 'backend.mjs')),
      }),
      'installModel',
      { type: 'action', label: 'action installModel', target: 'installModel' },
      [{ model: 'base.en' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-dictation',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-dictation', 'dist', 'backend.mjs')),
      }),
      'transcribeFile',
      { type: 'action', label: 'action transcribeFile', target: 'transcribeFile' },
      [{ dataBase64: 'AAE=', mimeType: 'audio/pcm', language: 'en' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe caffeinate process actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ running: true, pid: 123 })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-caffeinate', 'caffeinateStart', {})).resolves.toEqual({
      ok: true,
      result: { running: true, pid: 123 },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-caffeinate',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-caffeinate', 'dist', 'backend.mjs')),
      }),
      'start',
      { type: 'action', label: 'action caffeinateStart', target: 'caffeinateStart' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe todo actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    setExtensionEnabled('system-todo', true, stateRoot);
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ schemaVersion: 1, updatedAt: '2026-06-01T00:00:00.000Z', items: [] })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-todo', 'getState', { conversationId: 'conv-1' }, undefined, {
        conversationId: 'conv-1',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { schemaVersion: 1, updatedAt: '2026-06-01T00:00:00.000Z', items: [] },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-todo',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-todo', 'dist', 'backend.mjs')),
      }),
      'getState',
      { type: 'action', label: 'action getState', target: 'getState' },
      [{ conversationId: 'conv-1' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe web fetch actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ text: 'example', url: 'https://example.com', truncated: false })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-web-tools', 'webFetch', { url: 'https://example.com' })).resolves.toEqual({
      ok: true,
      result: { text: 'example', url: 'https://example.com', truncated: false },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-web-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-web-tools', 'dist', 'backend.mjs')),
      }),
      'webFetch',
      { type: 'action', label: 'action webFetch', target: 'webFetch' },
      [{ url: 'https://example.com' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe installable web search actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const duckDuckGoRoot = join(stateRoot, 'extensions', 'system-duckduckgo-search');
    const exaRoot = join(stateRoot, 'extensions', 'system-exa-search');
    mkdirSync(join(duckDuckGoRoot, 'dist'), { recursive: true });
    mkdirSync(join(exaRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(duckDuckGoRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-duckduckgo-search',
        name: 'DuckDuckGo Search',
        packageType: 'system',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'duckDuckGoSearch', handler: 'duckDuckGoSearch', title: 'Search with DuckDuckGo', worker: { enabled: true } }],
        },
      }),
    );
    writeFileSync(join(duckDuckGoRoot, 'dist', 'backend.mjs'), 'export function duckDuckGoSearch() { return true; }\n');
    writeFileSync(
      join(exaRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-exa-search',
        name: 'Exa Search',
        packageType: 'system',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'exaSearch', handler: 'exaSearch', title: 'Search with Exa', worker: { enabled: true } }],
        },
      }),
    );
    writeFileSync(join(exaRoot, 'dist', 'backend.mjs'), 'export function exaSearch() { return true; }\n');
    invalidateExtensionRegistryReadCaches(stateRoot);

    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (extensionId) =>
        extensionId === 'system-duckduckgo-search'
          ? { text: 'DuckDuckGo results', query: 'neon pilot', page: 1, count: 1, source: 'duckduckgo' }
          : { text: 'Exa results', query: 'neon pilot', page: 1, count: 1, source: 'exa' },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-duckduckgo-search', 'duckDuckGoSearch', { query: 'neon pilot' })).resolves.toEqual({
      ok: true,
      result: { text: 'DuckDuckGo results', query: 'neon pilot', page: 1, count: 1, source: 'duckduckgo' },
    });
    await expect(invokeExtensionAction('system-exa-search', 'exaSearch', { query: 'neon pilot', count: 3 })).resolves.toEqual({
      ok: true,
      result: { text: 'Exa results', query: 'neon pilot', page: 1, count: 1, source: 'exa' },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-duckduckgo-search',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-duckduckgo-search', 'dist', 'backend.mjs')),
      }),
      'duckDuckGoSearch',
      { type: 'action', label: 'action duckDuckGoSearch', target: 'duckDuckGoSearch' },
      [{ query: 'neon pilot' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-exa-search',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-exa-search', 'dist', 'backend.mjs')),
      }),
      'exaSearch',
      { type: 'action', label: 'action exaSearch', target: 'exaSearch' },
      [{ query: 'neon pilot', count: 3 }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe installable local model lookup actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const localModelsRoot = join(stateRoot, 'extensions', 'system-local-models');
    mkdirSync(join(localModelsRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(localModelsRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-local-models',
        name: 'Local Models',
        packageType: 'system',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [
            { id: 'localModelsMlxSearch', handler: 'mlxSearch', title: 'Search MLX models', worker: { enabled: true } },
            { id: 'localModelsSearch', handler: 'searchModels', title: 'Search local-compatible models', worker: { enabled: true } },
            { id: 'localModelsModelDetails', handler: 'modelDetails', title: 'Get Hugging Face model details', worker: { enabled: true } },
            { id: 'localModelsDiscover', handler: 'localModelsDiscover', title: 'Discover local models', worker: { enabled: true } },
          ],
        },
      }),
    );
    writeFileSync(
      join(localModelsRoot, 'dist', 'backend.mjs'),
      'export function mlxSearch() { return true; }\nexport function searchModels() { return true; }\nexport function modelDetails() { return true; }\nexport function localModelsDiscover() { return true; }\n',
    );
    invalidateExtensionRegistryReadCaches(stateRoot);

    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) =>
        exportName === 'localModelsDiscover'
          ? { provider: 'local', models: [{ id: 'qwen-local' }] }
          : exportName === 'modelDetails'
            ? { ok: true, model: { id: 'org/model', files: [] } }
            : { ok: true, models: [{ id: 'org/model', title: 'model' }] },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-local-models', 'localModelsSearch', { query: 'qwen', format: 'gguf', limit: 5 }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, models: [{ id: 'org/model', title: 'model' }] },
    });
    await expect(invokeExtensionAction('system-local-models', 'localModelsMlxSearch', { query: 'qwen' })).resolves.toEqual({
      ok: true,
      result: { ok: true, models: [{ id: 'org/model', title: 'model' }] },
    });
    await expect(invokeExtensionAction('system-local-models', 'localModelsModelDetails', { modelId: 'org/model' })).resolves.toEqual({
      ok: true,
      result: { ok: true, model: { id: 'org/model', files: [] } },
    });
    await expect(invokeExtensionAction('system-local-models', 'localModelsDiscover', {})).resolves.toEqual({
      ok: true,
      result: { provider: 'local', models: [{ id: 'qwen-local' }] },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-models',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-models', 'dist', 'backend.mjs')),
      }),
      'searchModels',
      { type: 'action', label: 'action localModelsSearch', target: 'localModelsSearch' },
      [{ query: 'qwen', format: 'gguf', limit: 5 }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-models',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-models', 'dist', 'backend.mjs')),
      }),
      'mlxSearch',
      { type: 'action', label: 'action localModelsMlxSearch', target: 'localModelsMlxSearch' },
      [{ query: 'qwen' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-models',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-models', 'dist', 'backend.mjs')),
      }),
      'modelDetails',
      { type: 'action', label: 'action localModelsModelDetails', target: 'localModelsModelDetails' },
      [{ modelId: 'org/model' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-local-models',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-local-models', 'dist', 'backend.mjs')),
      }),
      'localModelsDiscover',
      { type: 'action', label: 'action localModelsDiscover', target: 'localModelsDiscover' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe installable DS4 tool actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const ds4Root = join(stateRoot, 'extensions', 'system-ds4');
    mkdirSync(join(ds4Root, 'dist'), { recursive: true });
    writeFileSync(
      join(ds4Root, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-ds4',
        name: 'DS4',
        packageType: 'system',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [
            { id: 'ds4InstallProvider', handler: 'installProvider', title: 'Install DS4 model provider', worker: { enabled: true } },
            { id: 'ds4Status', handler: 'status', title: 'DS4 server status', worker: { enabled: true } },
            { id: 'ds4Discover', handler: 'discover', title: 'Discover DS4 model', worker: { enabled: true } },
            { id: 'ds4BootstrapRuntime', handler: 'bootstrapRuntime', title: 'Download and build DS4 runtime', worker: { enabled: true } },
            { id: 'ds4StartServer', handler: 'startServer', title: 'Start managed DS4 server', worker: { enabled: true } },
            { id: 'ds4StopServer', handler: 'stopServer', title: 'Stop managed DS4 server', worker: { enabled: true } },
            { id: 'ds4GoogleSearch', handler: 'google_search', title: 'DS4 google_search', worker: { enabled: true } },
            { id: 'ds4Read', handler: 'read', title: 'DS4 read', worker: { enabled: true } },
            { id: 'ds4List', handler: 'list', title: 'DS4 list', worker: { enabled: true } },
          ],
        },
      }),
    );
    writeFileSync(
      join(ds4Root, 'dist', 'backend.mjs'),
      'export function google_search() { return true; }\nexport function read() { return true; }\nexport function list() { return true; }\n',
    );
    invalidateExtensionRegistryReadCaches(stateRoot);

    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) => ({ ok: true, action: exportName })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-ds4', 'ds4InstallProvider', {})).resolves.toEqual({
      ok: true,
      result: { ok: true, action: 'installProvider' },
    });
    const runtimeActions: Array<[string, string, Record<string, unknown>]> = [
      ['ds4Status', 'status', {}],
      ['ds4Discover', 'discover', {}],
      ['ds4BootstrapRuntime', 'bootstrapRuntime', { start: false }],
      ['ds4StartServer', 'startServer', { timeoutMs: 0 }],
      ['ds4StopServer', 'stopServer', {}],
    ];
    for (const [actionId, exportName, input] of runtimeActions) {
      await expect(invokeExtensionAction('system-ds4', actionId, input)).resolves.toEqual({
        ok: true,
        result: { ok: true, action: exportName },
      });
    }
    await expect(invokeExtensionAction('system-ds4', 'ds4GoogleSearch', { query: 'neon pilot' })).resolves.toEqual({
      ok: true,
      result: { ok: true, action: 'google_search' },
    });
    await expect(invokeExtensionAction('system-ds4', 'ds4Read', { path: 'README.md' }, undefined, { cwd: '/repo' })).resolves.toEqual({
      ok: true,
      result: { ok: true, action: 'read' },
    });
    await expect(invokeExtensionAction('system-ds4', 'ds4List', { path: '.' }, undefined, { cwd: '/repo' })).resolves.toEqual({
      ok: true,
      result: { ok: true, action: 'list' },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-ds4',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-ds4', 'dist', 'backend.mjs')),
      }),
      'read',
      { type: 'action', label: 'action ds4Read', target: 'ds4Read' },
      [{ path: 'README.md' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { cwd: '/repo' },
        }),
      },
    );
    for (const [actionId, exportName, input] of runtimeActions) {
      expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
        'system-ds4',
        expect.objectContaining({
          path: expect.stringContaining(join('extensions', 'system-ds4', 'dist', 'backend.mjs')),
        }),
        exportName,
        { type: 'action', label: `action ${actionId}`, target: actionId },
        [input],
        {
          context: expect.objectContaining({
            type: 'backend',
            runtimeScope: 'shared',
            runtimeDir: expect.any(String),
            runtimeSettingsFilePath: expect.any(String),
          }),
        },
      );
    }
    expect(workerRunner.runWorkerExport).toHaveBeenCalledTimes(9);
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe installable video probe actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const videoProbeRoot = join(stateRoot, 'extensions', 'system-video-probe');
    mkdirSync(join(videoProbeRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(videoProbeRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-video-probe',
        name: 'Video Probe',
        packageType: 'system',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [
            { id: 'videoProbeStatus', handler: 'status', title: 'Video probe status', worker: { enabled: true } },
            { id: 'videoProbeSetup', handler: 'setup', title: 'Install runtime and download model', worker: { enabled: true } },
            { id: 'videoProbeStart', handler: 'startServer', title: 'Start mlx-vlm server', worker: { enabled: true } },
            { id: 'videoProbeStop', handler: 'stopServer', title: 'Stop mlx-vlm server', worker: { enabled: true } },
            { id: 'videoProbeReadSettings', handler: 'readSettings', title: 'Read video probe settings', worker: { enabled: true } },
            { id: 'videoProbeWriteSettings', handler: 'writeSettings', title: 'Write video probe settings', worker: { enabled: true } },
            { id: 'videoProbeCancel', handler: 'cancelSetup', title: 'Cancel setup', worker: { enabled: true } },
            { id: 'videoProbeReset', handler: 'resetInstallation', title: 'Reset installation', worker: { enabled: true } },
          ],
        },
      }),
    );
    writeFileSync(join(videoProbeRoot, 'dist', 'backend.mjs'), 'export function status() { return true; }\n');
    invalidateExtensionRegistryReadCaches(stateRoot);

    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) => ({ ok: true, action: exportName })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-video-probe', 'videoProbeStatus', {})).resolves.toEqual({
      ok: true,
      result: { ok: true, action: 'status' },
    });
    await expect(
      invokeExtensionAction('system-video-probe', 'videoProbeWriteSettings', { backend: 'local', localModel: 'mlx/model' }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, action: 'writeSettings' },
    });
    await expect(invokeExtensionAction('system-video-probe', 'videoProbeReset', {})).resolves.toEqual({
      ok: true,
      result: { ok: true, action: 'resetInstallation' },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-video-probe',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-video-probe', 'dist', 'backend.mjs')),
      }),
      'status',
      { type: 'action', label: 'action videoProbeStatus', target: 'videoProbeStatus' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-video-probe',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-video-probe', 'dist', 'backend.mjs')),
      }),
      'writeSettings',
      { type: 'action', label: 'action videoProbeWriteSettings', target: 'videoProbeWriteSettings' },
      [{ backend: 'local', localModel: 'mlx/model' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-video-probe',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-video-probe', 'dist', 'backend.mjs')),
      }),
      'resetInstallation',
      { type: 'action', label: 'action videoProbeReset', target: 'videoProbeReset' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe installable suggested context warming through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const suggestedContextRoot = join(stateRoot, 'extensions', 'system-suggested-context');
    mkdirSync(join(suggestedContextRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(suggestedContextRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-suggested-context',
        name: 'Suggested Context',
        packageType: 'system',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [
            {
              id: 'warmPointers',
              handler: 'warmPointers',
              title: 'Warm suggested context pointer cache',
              worker: { enabled: true },
            },
          ],
        },
      }),
    );
    writeFileSync(join(suggestedContextRoot, 'dist', 'backend.mjs'), 'export function warmPointers() { return true; }\n');
    invalidateExtensionRegistryReadCaches(stateRoot);

    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true, pointerCount: 2 })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-suggested-context', 'warmPointers', {
        prompt: 'architecture process split',
        currentConversationId: 'conv-1',
        currentCwd: '/repo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, pointerCount: 2 },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-suggested-context',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-suggested-context', 'dist', 'backend.mjs')),
      }),
      'warmPointers',
      { type: 'action', label: 'action warmPointers', target: 'warmPointers' },
      [{ prompt: 'architecture process split', currentConversationId: 'conv-1', currentCwd: '/repo' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe telemetry aggregate actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true, summary: { activeSessions: 0 } })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-telemetry', 'getTelemetryData', { range: '1h' })).resolves.toEqual({
      ok: true,
      result: { ok: true, summary: { activeSessions: 0 } },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-telemetry',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-telemetry', 'dist', 'backend.mjs')),
      }),
      'getTelemetryData',
      { type: 'action', label: 'action getTelemetryData', target: 'getTelemetryData' },
      [{ range: '1h' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe background work actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({
        text: 'Background commands (1):\n- run-1 [running] smoke',
        details: { action: 'list', runCount: 1, runIds: ['run-1'] },
      })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction('system-runs', 'background_bash', { action: 'list' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
        sessionFile: '/tmp/session.json',
        sessionId: 'sess-1',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        text: 'Background commands (1):\n- run-1 [running] smoke',
        details: { action: 'list', runCount: 1, runIds: ['run-1'] },
      },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-runs',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-runs', 'dist', 'backend.mjs')),
      }),
      'background_bash',
      { type: 'action', label: 'action background_bash', target: 'background_bash' },
      [{ action: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: {
            conversationId: 'conv-1',
            cwd: '/repo',
            sessionFile: '/tmp/session.json',
            sessionId: 'sess-1',
          },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe codex profile apply patch actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({
        text: 'Applied patch to 1 file.',
        details: { fileChanges: [{ path: 'README.md', status: 'modified' }] },
      })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction(
        'system-codex-profile',
        'applyPatch',
        { patch: '*** Begin Patch\n*** Update File: README.md\n@@\n-old\n+new\n*** End Patch' },
        undefined,
        { cwd: '/repo' },
      ),
    ).resolves.toEqual({
      ok: true,
      result: {
        text: 'Applied patch to 1 file.',
        details: { fileChanges: [{ path: 'README.md', status: 'modified' }] },
      },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-codex-profile',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-codex-profile', 'dist', 'backend.mjs')),
      }),
      'applyPatch',
      { type: 'action', label: 'action applyPatch', target: 'applyPatch' },
      [{ patch: '*** Begin Patch\n*** Update File: README.md\n@@\n-old\n+new\n*** End Patch' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { cwd: '/repo' },
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe onboarding actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installTestExtension(stateRoot, 'system-onboarding');
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ created: true, conversationId: 'conv-1', shouldOpen: true })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-onboarding', 'ensure', { source: 'frontend' })).resolves.toEqual({
      ok: true,
      result: { created: true, conversationId: 'conv-1', shouldOpen: true },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-onboarding',
      expect.objectContaining({
        path: expect.stringContaining(join('system-onboarding', 'dist', 'backend.mjs')),
      }),
      'ensure',
      { type: 'action', label: 'action ensure', target: 'ensure' },
      [{ source: 'frontend' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
          toolContext: undefined,
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs allowlisted conversation tool actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, _exportName, _operation, args) => {
        const action = (args[0] as { action?: string }).action ?? 'create';
        return {
          content: [{ type: 'text', text: `${action} complete.` }],
          details:
            action === 'create'
              ? { id: 'conv-2', conversationId: 'conv-2' }
              : action === 'inspect'
                ? { action: 'list', conversations: [] }
                : action === 'change_working_directory'
                  ? { action: 'queue', cwd: '/next', queued: true }
                  : action === 'ensure_live'
                    ? { id: 'conv-1', conversationId: 'conv-1' }
                    : action === 'send_message'
                      ? { accepted: true }
                      : action === 'abort' || action === 'compact'
                        ? { ok: true }
                        : action === 'fork'
                          ? { id: 'conv-fork', conversationId: 'conv-fork' }
                          : action === 'set_title'
                            ? { ok: true }
                            : action === 'workspace_get'
                              ? { openConversationIds: ['conv-1'], activeConversationId: 'conv-1' }
                              : action === 'rollback'
                                ? { rolledBackTo: 'entry-1' }
                                : { blockId: 'block-1' },
        };
      }),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction(
        'system-conversation-tools',
        'conversationTool',
        { action: 'create', cwd: '/repo', title: 'Worker conversation', live: false },
        undefined,
        { conversationId: 'conv-1', cwd: '/repo' },
      ),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'create complete.' }],
        details: { id: 'conv-2', conversationId: 'conv-2' },
      },
    });
    await expect(
      invokeExtensionAction(
        'system-conversation-tools',
        'conversationTool',
        { action: 'create_and_run', cwd: '/repo', text: 'Review CLI', timeoutMs: 180_000 },
        undefined,
        { conversationId: 'conv-1', cwd: '/repo' },
      ),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'create_and_run complete.' }],
        details: { blockId: 'block-1' },
      },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationTool', { action: 'inspect', inspectAction: 'list' }, undefined, {
        conversationId: 'conv-1',
        cwd: '/repo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'inspect complete.' }],
        details: { action: 'list', conversations: [] },
      },
    });
    await expect(invokeExtensionAction('system-conversation-tools', 'conversationTool', { action: 'workspace_get' })).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'workspace_get complete.' }],
        details: { openConversationIds: ['conv-1'], activeConversationId: 'conv-1' },
      },
    });
    await expect(
      invokeExtensionAction(
        'system-conversation-tools',
        'conversationTool',
        { action: 'change_working_directory', cwd: '/next' },
        undefined,
        { conversationId: 'conv-1', cwd: '/repo' },
      ),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'change_working_directory complete.' }],
        details: { action: 'queue', cwd: '/next', queued: true },
      },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationTool', {
        action: 'ensure_live',
        conversationId: 'conv-1',
        cwd: '/repo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'ensure_live complete.' }],
        details: { id: 'conv-1', conversationId: 'conv-1' },
      },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationTool', {
        action: 'send_message',
        conversationId: 'conv-1',
        text: 'Go',
        steer: true,
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'send_message complete.' }],
        details: { accepted: true },
      },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationTool', {
        action: 'fork',
        conversationId: 'conv-1',
        targetCwd: '/fork',
        title: 'Fork',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'fork complete.' }],
        details: { id: 'conv-fork', conversationId: 'conv-fork' },
      },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationTool', {
        action: 'update_transcript_block',
        conversationId: 'conv-1',
        blockType: 'note',
        blockId: 'block-1',
        data: { ok: true },
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'update_transcript_block complete.' }],
        details: { blockId: 'block-1' },
      },
    });
    await expect(
      invokeExtensionAction('system-conversation-tools', 'conversationTool', { action: 'rollback', conversationId: 'conv-1', count: 2 }),
    ).resolves.toEqual({
      ok: true,
      result: {
        content: [{ type: 'text', text: 'rollback complete.' }],
        details: { rolledBackTo: 'entry-1' },
      },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'create', cwd: '/repo', title: 'Worker conversation', live: false }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'create_and_run', cwd: '/repo', text: 'Review CLI', timeoutMs: 180_000 }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
        timeoutMs: 180_000,
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'inspect', inspectAction: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'change_working_directory', cwd: '/next' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          toolContext: { conversationId: 'conv-1', cwd: '/repo' },
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'send_message', conversationId: 'conv-1', text: 'Go', steer: true }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'fork', conversationId: 'conv-1', targetCwd: '/fork', title: 'Fork' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'workspace_get' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-conversation-tools',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-conversation-tools', 'dist', 'backend.mjs')),
      }),
      'conversationTool',
      { type: 'action', label: 'action conversationTool', target: 'conversationTool' },
      [{ action: 'rollback', conversationId: 'conv-1', count: 2 }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe MCP actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) =>
        exportName === 'inspectMcpSettings'
          ? { configPath: '/repo/.mcp.json', servers: [], searchedPaths: ['/repo/.mcp.json'] }
          : exportName === 'saveExplicitMcpConfig'
            ? { configPath: '/repo/.mcp.json', servers: [{ name: 'filesystem' }], searchedPaths: ['/repo/.mcp.json'] }
            : { content: [{ type: 'text', text: 'MCP servers (/repo/.mcp.json):\\n' }], details: { action: 'list', serverCount: 0 } },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-mcp', 'inspectSettings', {})).resolves.toEqual({
      ok: true,
      result: { configPath: '/repo/.mcp.json', servers: [], searchedPaths: ['/repo/.mcp.json'] },
    });
    await expect(invokeExtensionAction('system-mcp', 'mcpTool', { action: 'list' })).resolves.toEqual({
      ok: true,
      result: { content: [{ type: 'text', text: 'MCP servers (/repo/.mcp.json):\\n' }], details: { action: 'list', serverCount: 0 } },
    });
    await expect(invokeExtensionAction('system-mcp', 'saveExplicitConfig', { json: '{"mcpServers":{}}' })).resolves.toEqual({
      ok: true,
      result: { configPath: '/repo/.mcp.json', servers: [{ name: 'filesystem' }], searchedPaths: ['/repo/.mcp.json'] },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-mcp',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-mcp', 'dist', 'backend.mjs')),
      }),
      'inspectMcpSettings',
      { type: 'action', label: 'action inspectSettings', target: 'inspectSettings' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-mcp',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-mcp', 'dist', 'backend.mjs')),
      }),
      'mcpTool',
      { type: 'action', label: 'action mcpTool', target: 'mcpTool' },
      [{ action: 'list' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-mcp',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-mcp', 'dist', 'backend.mjs')),
      }),
      'saveExplicitMcpConfig',
      { type: 'action', label: 'action saveExplicitConfig', target: 'saveExplicitConfig' },
      [{ json: '{"mcpServers":{}}' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe prompt assembly actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) =>
        exportName === 'inspectAgentRuntime'
          ? { ok: true, runtimeScope: 'shared', capabilities: [], counts: {} }
          : { ok: true, id: 'skill-a', kind: exportName === 'updateRuntimeCapability' ? 'skill' : undefined, enabled: false },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-prompt-assembly', 'inspectAgentRuntime', { cwd: '/repo' })).resolves.toEqual({
      ok: true,
      result: { ok: true, runtimeScope: 'shared', capabilities: [], counts: {} },
    });
    await expect(
      invokeExtensionAction('system-prompt-assembly', 'updatePromptAssemblySkillEnabled', { id: 'skill-a', enabled: false }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, id: 'skill-a', kind: undefined, enabled: false },
    });
    await expect(
      invokeExtensionAction('system-prompt-assembly', 'updateRuntimeCapability', { id: 'skill-a', kind: 'skill', enabled: false }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, id: 'skill-a', kind: 'skill', enabled: false },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-prompt-assembly',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-prompt-assembly', 'dist', 'backend.mjs')),
      }),
      'inspectAgentRuntime',
      { type: 'action', label: 'action inspectAgentRuntime', target: 'inspectAgentRuntime' },
      [{ cwd: '/repo' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-prompt-assembly',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-prompt-assembly', 'dist', 'backend.mjs')),
      }),
      'updateSkillEnabled',
      { type: 'action', label: 'action updatePromptAssemblySkillEnabled', target: 'updatePromptAssemblySkillEnabled' },
      [{ id: 'skill-a', enabled: false }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-prompt-assembly',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-prompt-assembly', 'dist', 'backend.mjs')),
      }),
      'updateRuntimeCapability',
      { type: 'action', label: 'action updateRuntimeCapability', target: 'updateRuntimeCapability' },
      [{ id: 'skill-a', kind: 'skill', enabled: false }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledTimes(3);
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe skills list actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true, skills: [{ id: 'skill-a', enabled: true }] })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-skills', 'listSkills', {})).resolves.toEqual({
      ok: true,
      result: { ok: true, skills: [{ id: 'skill-a', enabled: true }] },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-skills',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-skills', 'dist', 'backend.mjs')),
      }),
      'listSkills',
      { type: 'action', label: 'action listSkills', target: 'listSkills' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe skills update actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true, id: 'skill-a', enabled: false })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-skills', 'updateSkillEnabled', { id: 'skill-a', enabled: false })).resolves.toEqual({
      ok: true,
      result: { ok: true, id: 'skill-a', enabled: false },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-skills',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-skills', 'dist', 'backend.mjs')),
      }),
      'updateSkillEnabled',
      { type: 'action', label: 'action updateSkillEnabled', target: 'updateSkillEnabled' },
      [{ id: 'skill-a', enabled: false }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe extension manager actions through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName, _operation, args) => {
        if (exportName === 'createExtension') return { ok: true, id: 'new-extension' };
        if (exportName === 'snapshotExtension') return { ok: true, extensionId: 'system-todo', files: [] };
        if (exportName === 'reloadExtension') return { ok: true, extensionId: 'system-todo', rebuilt: false };
        if (exportName === 'smokeExtension') return { ok: true, extensionId: 'system-todo', checks: [] };
        if (exportName === 'validateExtension') return { ok: true, valid: true, findings: [] };
        if (exportName === 'installCatalogExtension') return { ok: true, id: 'system-browser', installed: true };
        if (exportName === 'installExtensionFromUrl') return { ok: true, id: 'remote-extension', installed: true };
        if (exportName === 'updateSearchPaths') return { ok: true, configuredPaths: ['/extensions/one'] };
        if (exportName === 'manageExtension') {
          const action = (args[0] as { action?: string }).action;
          return action === 'create'
            ? { ok: true, id: 'managed-extension' }
            : action === 'reload'
              ? { ok: true, extensionId: 'system-todo', rebuilt: false }
              : action === 'smoke'
                ? { ok: true, extensionId: 'system-todo', checks: [] }
                : action === 'updateSearchPaths'
                  ? { ok: true, configuredPaths: ['/extensions/one'] }
                  : {
                      ok: true,
                      reloaded: true,
                      message: 'Extension registry caches were invalidated; reopen contributed routes if needed.',
                    };
        }
        return { ok: true, extensions: [{ id: 'system-todo' }] };
      }),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-extension-manager', 'listExtensions', {})).resolves.toEqual({
      ok: true,
      result: { ok: true, extensions: [{ id: 'system-todo' }] },
    });
    await expect(invokeExtensionAction('system-extension-manager', 'manageExtension', { action: 'reloadExtensions' })).resolves.toEqual({
      ok: true,
      result: { ok: true, reloaded: true, message: 'Extension registry caches were invalidated; reopen contributed routes if needed.' },
    });
    await expect(
      invokeExtensionAction('system-extension-manager', 'createExtension', {
        id: 'new-extension',
        name: 'New Extension',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, id: 'new-extension' },
    });
    await expect(invokeExtensionAction('system-extension-manager', 'snapshotExtension', { id: 'system-todo' })).resolves.toEqual({
      ok: true,
      result: { ok: true, extensionId: 'system-todo', files: [] },
    });
    await expect(invokeExtensionAction('system-extension-manager', 'reloadExtension', { id: 'system-todo' })).resolves.toEqual({
      ok: true,
      result: { ok: true, extensionId: 'system-todo', rebuilt: false },
    });
    await expect(invokeExtensionAction('system-extension-manager', 'smokeExtension', { id: 'system-todo' })).resolves.toEqual({
      ok: true,
      result: { ok: true, extensionId: 'system-todo', checks: [] },
    });
    await expect(invokeExtensionAction('system-extension-manager', 'validateExtension', { id: 'system-todo' })).resolves.toEqual({
      ok: true,
      result: { ok: true, valid: true, findings: [] },
    });
    await expect(invokeExtensionAction('system-extension-manager', 'installCatalogExtension', { id: 'system-browser' })).resolves.toEqual({
      ok: true,
      result: { ok: true, id: 'system-browser', installed: true },
    });
    await expect(
      invokeExtensionAction('system-extension-manager', 'installExtensionFromUrl', {
        url: 'https://example.test/remote.neon-extension.zip',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, id: 'remote-extension', installed: true },
    });
    await expect(
      invokeExtensionAction('system-extension-manager', 'manageExtension', {
        action: 'create',
        id: 'managed-extension',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, id: 'managed-extension' },
    });
    await expect(
      invokeExtensionAction('system-extension-manager', 'manageExtension', {
        action: 'reload',
        id: 'system-todo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, extensionId: 'system-todo', rebuilt: false },
    });
    await expect(
      invokeExtensionAction('system-extension-manager', 'manageExtension', {
        action: 'smoke',
        id: 'system-todo',
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, extensionId: 'system-todo', checks: [] },
    });
    await expect(invokeExtensionAction('system-extension-manager', 'updateSearchPaths', { paths: ['/extensions/one'] })).resolves.toEqual({
      ok: true,
      result: { ok: true, configuredPaths: ['/extensions/one'] },
    });
    await expect(
      invokeExtensionAction('system-extension-manager', 'manageExtension', {
        action: 'updateSearchPaths',
        paths: ['/extensions/one'],
      }),
    ).resolves.toEqual({
      ok: true,
      result: { ok: true, configuredPaths: ['/extensions/one'] },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'listExtensions',
      { type: 'action', label: 'action listExtensions', target: 'listExtensions' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'createExtension',
      { type: 'action', label: 'action createExtension', target: 'createExtension' },
      [{ id: 'new-extension', name: 'New Extension' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'installExtensionFromUrl',
      { type: 'action', label: 'action installExtensionFromUrl', target: 'installExtensionFromUrl' },
      [{ url: 'https://example.test/remote.neon-extension.zip' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'manageExtension',
      { type: 'action', label: 'action manageExtension', target: 'manageExtension' },
      [{ action: 'create', id: 'managed-extension' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'reloadExtension',
      { type: 'action', label: 'action reloadExtension', target: 'reloadExtension' },
      [{ id: 'system-todo' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'manageExtension',
      { type: 'action', label: 'action manageExtension', target: 'manageExtension' },
      [{ action: 'reload', id: 'system-todo' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'updateSearchPaths',
      { type: 'action', label: 'action updateSearchPaths', target: 'updateSearchPaths' },
      [{ paths: ['/extensions/one'] }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'manageExtension',
      { type: 'action', label: 'action manageExtension', target: 'manageExtension' },
      [{ action: 'updateSearchPaths', paths: ['/extensions/one'] }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-extension-manager',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-extension-manager', 'dist', 'backend.mjs')),
      }),
      'manageExtension',
      { type: 'action', label: 'action manageExtension', target: 'manageExtension' },
      [{ action: 'reloadExtensions' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe knowledge read actions through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installKnowledgeWorkerTestExtension(stateRoot);
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) =>
        exportName === 'readState'
          ? { configured: false, effectiveRoot: '/knowledge', effectiveRoots: ['/knowledge'] }
          : exportName === 'updateState'
            ? { configured: true, repoUrl: 'https://example.test/kb.git', branch: 'main', effectiveRoots: ['/knowledge'] }
            : exportName === 'sync'
              ? { configured: true, syncStatus: 'idle', lastSyncAt: '2026-01-01T00:00:00.000Z' }
              : exportName === 'readMemory'
                ? { agentsMd: [], skills: [], memoryDocs: [] }
                : exportName === 'knowledgeDeleteFile'
                  ? { ok: true }
                  : exportName === 'knowledgeReadFile'
                    ? { id: 'notes/a.md', content: '# A', updatedAt: '2026-01-01T00:00:00.000Z' }
                    : exportName === 'knowledgeWriteFile' ||
                        exportName === 'knowledgeCreateFolder' ||
                        exportName === 'knowledgeRename' ||
                        exportName === 'knowledgeMove' ||
                        exportName === 'knowledgeUploadImage' ||
                        exportName === 'knowledgeImportUrl' ||
                        exportName === 'knowledgeImportSharedItem'
                      ? { id: 'notes/a.md', kind: 'file' }
                      : { root: '/knowledge', files: [{ id: 'notes/a.md' }] },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(invokeExtensionAction('system-knowledge', 'knowledgeListFiles', {})).resolves.toEqual({
      ok: true,
      result: { root: '/knowledge', files: [{ id: 'notes/a.md' }] },
    });
    await expect(invokeExtensionAction('system-knowledge', 'readState', {})).resolves.toEqual({
      ok: true,
      result: { configured: false, effectiveRoot: '/knowledge', effectiveRoots: ['/knowledge'] },
    });
    await expect(
      invokeExtensionAction('system-knowledge', 'updateState', { repoUrl: 'https://example.test/kb.git', branch: 'main' }),
    ).resolves.toEqual({
      ok: true,
      result: { configured: true, repoUrl: 'https://example.test/kb.git', branch: 'main', effectiveRoots: ['/knowledge'] },
    });
    await expect(invokeExtensionAction('system-knowledge', 'sync', {})).resolves.toEqual({
      ok: true,
      result: { configured: true, syncStatus: 'idle', lastSyncAt: '2026-01-01T00:00:00.000Z' },
    });
    await expect(invokeExtensionAction('system-knowledge', 'knowledgeReadFile', { id: 'notes/a.md' })).resolves.toEqual({
      ok: true,
      result: { id: 'notes/a.md', content: '# A', updatedAt: '2026-01-01T00:00:00.000Z' },
    });
    const mutationActionInputs: Array<[string, string, Record<string, unknown>, unknown]> = [
      ['knowledgeWriteFile', 'knowledgeWriteFile', { id: 'notes/a.md', content: '# B' }, { id: 'notes/a.md', kind: 'file' }],
      ['knowledgeCreateFolder', 'knowledgeCreateFolder', { id: 'notes/new/' }, { id: 'notes/a.md', kind: 'file' }],
      ['knowledgeDeleteFile', 'knowledgeDeleteFile', { id: 'notes/a.md' }, { ok: true }],
      ['knowledgeRename', 'knowledgeRename', { id: 'notes/a.md', newName: 'b.md' }, { id: 'notes/a.md', kind: 'file' }],
      ['knowledgeMove', 'knowledgeMove', { id: 'notes/a.md', targetDir: 'archive/' }, { id: 'notes/a.md', kind: 'file' }],
      [
        'knowledgeUploadImage',
        'knowledgeUploadImage',
        { filename: 'shot.png', dataUrl: 'data:image/png;base64,aW1n' },
        { id: 'notes/a.md', kind: 'file' },
      ],
      ['knowledgeImportUrl', 'knowledgeImportUrl', { url: 'https://example.test', title: 'Example' }, { id: 'notes/a.md', kind: 'file' }],
      [
        'knowledgeImportSharedItem',
        'knowledgeImportSharedItem',
        { kind: 'text', text: 'hello', title: 'Shared text' },
        { id: 'notes/a.md', kind: 'file' },
      ],
    ];
    for (const [actionId, , input, result] of mutationActionInputs) {
      await expect(invokeExtensionAction('system-knowledge', actionId, input)).resolves.toEqual({ ok: true, result });
    }
    await expect(invokeExtensionAction('system-knowledge', 'readMemory', {})).resolves.toEqual({
      ok: true,
      result: { agentsMd: [], skills: [], memoryDocs: [] },
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')),
      }),
      'knowledgeListFiles',
      { type: 'action', label: 'action knowledgeListFiles', target: 'knowledgeListFiles' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
          liveSessionResourceOptions: expect.objectContaining({
            additionalExtensionPaths: expect.any(Array),
            additionalSkillPaths: expect.any(Array),
            additionalPromptTemplatePaths: expect.any(Array),
            additionalThemePaths: expect.any(Array),
          }),
        }),
      },
    );
    for (const [actionId, exportName, input] of mutationActionInputs) {
      expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
        'system-knowledge',
        expect.objectContaining({
          path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')),
        }),
        exportName,
        { type: 'action', label: `action ${actionId}`, target: actionId },
        [input],
        {
          context: expect.objectContaining({
            type: 'backend',
            runtimeScope: 'shared',
            repoRoot: expect.any(String),
            runtimeDir: expect.any(String),
            runtimeSettingsFilePath: expect.any(String),
          }),
        },
      );
    }
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')),
      }),
      'readState',
      { type: 'action', label: 'action readState', target: 'readState' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')),
      }),
      'updateState',
      { type: 'action', label: 'action updateState', target: 'updateState' },
      [{ repoUrl: 'https://example.test/kb.git', branch: 'main' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')),
      }),
      'sync',
      { type: 'action', label: 'action sync', target: 'sync' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')),
      }),
      'knowledgeReadFile',
      { type: 'action', label: 'action knowledgeReadFile', target: 'knowledgeReadFile' },
      [{ id: 'notes/a.md' }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({
        path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')),
      }),
      'readMemory',
      { type: 'action', label: 'action readMemory', target: 'readMemory' },
      [{}],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          repoRoot: expect.any(String),
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('normalizes agent factory builders through the extension backend runner seam', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'runner-agent-builder-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'runner-agent-builder-ext',
        name: 'Runner Agent Builder Ext',
        backend: {
          entry: 'dist/backend.mjs',
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const factory = vi.fn();
    const create = vi.fn(() => factory);
    const loadModule = vi.fn(async () => ({ create }));
    const loadAgentFactory = vi.fn(async () => {
      const backend = await loadModule('runner-agent-builder-ext', { path: join(extensionRoot, 'dist', 'backend.mjs'), hash: 'test' });
      return run(
        'runner-agent-builder-ext',
        { type: 'agent-factory-builder', label: 'agent extension factory builder', exportName: 'create', target: 'create' },
        () => (backend.create as () => unknown)(),
      );
    });
    const run = vi.fn(async (_extensionId: string, _operation: unknown, handler: () => unknown) => handler());
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory,
      runExport: vi.fn(),
      run,
    });

    await expect(loadExtensionAgentFactory('runner-agent-builder-ext', 'create')).resolves.toBe(factory);

    expect(loadAgentFactory).toHaveBeenCalledWith(
      'runner-agent-builder-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
      'create',
    );
    expect(create).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(
      'runner-agent-builder-ext',
      { type: 'agent-factory-builder', label: 'agent extension factory builder', exportName: 'create', target: 'create' },
      expect.any(Function),
    );
  });

  it('can run declared live-context-independent actions in the worker despite manifest tool live context', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'live-context-worker-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'live-context-worker-ext',
        name: 'Live Context Worker Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing', worker: { enabled: true, ignoreLiveContext: true } }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function doThing() { return true; }\n');
    invalidateExtensionRegistryReadCaches(stateRoot);

    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionAction(
        'live-context-worker-ext',
        'doThing',
        {},
        undefined,
        { conversationId: 'conv-1', onUpdate: vi.fn() },
        { signal: new AbortController().signal },
      ),
    ).resolves.toEqual({ ok: true, result: { ok: true } });

    expect(workerRunner.runWorkerExport).toHaveBeenCalled();
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('rejects backend routes that do not declare worker.enabled', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'runner-route-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'runner-route-ext',
        name: 'Runner Route Ext',
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/ping', handler: 'ping' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    await expect(
      invokeExtensionRoute('runner-route-ext', 'GET', '/ping', { method: 'GET', path: '/ping', query: {}, params: {} }),
    ).rejects.toMatchObject({ code: 'worker_required' });
  });

  it('runs worker-safe backend routes through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'worker-route-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'worker-route-ext',
        name: 'Worker Route Ext',
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'POST', path: '/ping', handler: 'ping', worker: { enabled: true } }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ status: 202, body: { via: 'worker' } })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);
    const controller = new AbortController();

    await expect(
      invokeExtensionRoute('worker-route-ext', 'POST', '/ping', {
        method: 'POST',
        path: '/ping',
        query: { q: '1' },
        params: {},
        body: { ok: true },
        signal: controller.signal,
      }),
    ).resolves.toEqual({ status: 202, body: { via: 'worker' } });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'worker-route-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
      'ping',
      { type: 'route', label: 'route POST /ping', target: '/ping' },
      [{ method: 'POST', path: '/ping', query: { q: '1' }, params: {}, body: { ok: true } }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe system telemetry routes through the worker runner', async () => {
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ status: 200, body: { activeSessions: 0, runsToday: 0 } })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionRoute('system-telemetry', 'GET', '/traces/summary', {
        method: 'GET',
        path: '/traces/summary',
        query: { range: '1h' },
        params: {},
      }),
    ).resolves.toEqual({ status: 200, body: { activeSessions: 0, runsToday: 0 } });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-telemetry',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-telemetry', 'dist', 'backend.mjs')) }),
      'summary',
      { type: 'route', label: 'route GET /traces/summary', target: '/traces/summary' },
      [{ method: 'GET', path: '/traces/summary', query: { range: '1h' }, params: {} }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe knowledge read routes through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installKnowledgeWorkerTestExtension(stateRoot);
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async (_extensionId, _compiled, exportName) =>
        exportName === 'memoryRoute'
          ? { status: 200, body: { agentsMd: [], skills: [], memoryDocs: [] } }
          : exportName === 'knowledgeDeleteFileRoute'
            ? { status: 200, body: { ok: true } }
            : exportName === 'knowledgeWriteFileRoute' ||
                exportName === 'knowledgeCreateFolderRoute' ||
                exportName === 'knowledgeRenameRoute' ||
                exportName === 'knowledgeMoveRoute' ||
                exportName === 'knowledgeUploadImageRoute' ||
                exportName === 'knowledgeImportUrlRoute'
              ? { status: 200, body: { id: 'notes/a.md', kind: 'file' } }
              : { status: 200, body: { results: [{ id: 'notes/a.md' }] } },
      ),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionRoute('system-knowledge', 'GET', '/knowledge/search', {
        method: 'GET',
        path: '/knowledge/search',
        query: { q: 'alpha' },
        params: {},
      }),
    ).resolves.toEqual({ status: 200, body: { results: [{ id: 'notes/a.md' }] } });
    await expect(
      invokeExtensionRoute('system-knowledge', 'GET', '/memory', {
        method: 'GET',
        path: '/memory',
        query: {},
        params: {},
      }),
    ).resolves.toEqual({ status: 200, body: { agentsMd: [], skills: [], memoryDocs: [] } });
    const mutationRouteInputs: Array<
      ['PUT' | 'POST' | 'DELETE', string, string, Record<string, string | string[]>, Record<string, unknown> | undefined, unknown]
    > = [
      ['PUT', '/knowledge/file', 'knowledgeWriteFileRoute', {}, { id: 'notes/a.md', content: '# B' }, { id: 'notes/a.md', kind: 'file' }],
      ['POST', '/knowledge/folder', 'knowledgeCreateFolderRoute', {}, { id: 'notes/new/' }, { id: 'notes/a.md', kind: 'file' }],
      ['DELETE', '/knowledge/file', 'knowledgeDeleteFileRoute', { id: 'notes/a.md' }, undefined, { ok: true }],
      ['POST', '/knowledge/rename', 'knowledgeRenameRoute', {}, { id: 'notes/a.md', newName: 'b.md' }, { id: 'notes/a.md', kind: 'file' }],
      [
        'POST',
        '/knowledge/move',
        'knowledgeMoveRoute',
        {},
        { id: 'notes/a.md', targetDir: 'archive/' },
        { id: 'notes/a.md', kind: 'file' },
      ],
      [
        'POST',
        '/knowledge/image',
        'knowledgeUploadImageRoute',
        {},
        { filename: 'shot.png', dataUrl: 'data:image/png;base64,aW1n' },
        { id: 'notes/a.md', kind: 'file' },
      ],
      [
        'POST',
        '/knowledge/share-import',
        'knowledgeImportUrlRoute',
        {},
        { kind: 'text', text: 'hello', title: 'Shared text' },
        { id: 'notes/a.md', kind: 'file' },
      ],
    ];
    for (const [method, path, , query, body, result] of mutationRouteInputs) {
      await expect(
        invokeExtensionRoute('system-knowledge', method, path, {
          method,
          path,
          query,
          params: {},
          ...(body ? { body } : {}),
        }),
      ).resolves.toEqual({ status: 200, body: result });
    }

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')) }),
      'knowledgeSearchRoute',
      { type: 'route', label: 'route GET /knowledge/search', target: '/knowledge/search' },
      [{ method: 'GET', path: '/knowledge/search', query: { q: 'alpha' }, params: {} }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')) }),
      'memoryRoute',
      { type: 'route', label: 'route GET /memory', target: '/memory' },
      [{ method: 'GET', path: '/memory', query: {}, params: {} }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    for (const [method, path, exportName, query, body] of mutationRouteInputs) {
      expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
        'system-knowledge',
        expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')) }),
        exportName,
        { type: 'route', label: `route ${method} ${path}`, target: path },
        [{ method, path, query, params: {}, ...(body ? { body } : {}) }],
        {
          context: expect.objectContaining({
            type: 'backend',
            runtimeScope: 'shared',
            runtimeDir: expect.any(String),
            runtimeSettingsFilePath: expect.any(String),
          }),
        },
      );
    }
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs worker-safe knowledge asset route through the worker runner with binary bodies', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    installKnowledgeWorkerTestExtension(stateRoot);
    const body = Uint8Array.from([137, 80, 78, 71]);
    const backendRunner = {
      loadModule: vi.fn(),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ status: 200, headers: { 'content-type': 'image/png' }, body })),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionRoute('system-knowledge', 'GET', '/asset', {
        method: 'GET',
        path: '/asset',
        query: { id: 'images/shot.png' },
        params: {},
      }),
    ).resolves.toEqual({ status: 200, headers: { 'content-type': 'image/png' }, body });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-knowledge',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-knowledge', 'dist', 'backend.mjs')) }),
      'asset',
      { type: 'route', label: 'route GET /asset', target: '/asset' },
      [{ method: 'GET', path: '/asset', query: { id: 'images/shot.png' }, params: {} }],
      {
        context: expect.objectContaining({
          type: 'backend',
          runtimeScope: 'shared',
          runtimeDir: expect.any(String),
          runtimeSettingsFilePath: expect.any(String),
        }),
      },
    );
    expect(backendRunner.runExport).not.toHaveBeenCalled();
  });

  it('runs SSE backend routes in host so async event iterables can stream', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'sse-route-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'sse-route-ext',
        name: 'SSE Route Ext',
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/stream', handler: 'stream', stream: 'sse', worker: { enabled: true } }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const loadModule = vi.fn(async () => ({ stream: vi.fn(() => ({ stream: 'sse', events: [] })) }));
    const runExport = vi.fn(
      async (
        extensionId: string,
        compiled: { path: string; hash: string },
        exportName: string,
        _operation: unknown,
        invoke: (handler: (...args: unknown[]) => unknown) => unknown,
      ) => {
        const backend = await loadModule(extensionId, compiled);
        return invoke(backend[exportName] as (...args: unknown[]) => unknown);
      },
    );
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport,
      run: vi.fn(),
    });
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(
      invokeExtensionRoute('sse-route-ext', 'GET', '/stream', { method: 'GET', path: '/stream', query: {}, params: {} }),
    ).resolves.toMatchObject({ stream: 'sse', events: [] });

    expect(runExport).toHaveBeenCalled();
    expect(workerRunner.runWorkerExport).not.toHaveBeenCalled();
  });

  it('requires secrets permission for host-run SSE backend route secret access', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    process.env.SSE_ROUTE_SECRET = 'secret-value';
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'env-only' } }));
    const extensionRoot = join(stateRoot, 'extensions', 'sse-secret-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'sse-secret-ext',
        name: 'SSE Secret Ext',
        contributes: {
          secrets: {
            apiKey: {
              label: 'API key',
              env: 'SSE_ROUTE_SECRET',
            },
          },
        },
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/stream', handler: 'stream', stream: 'sse', worker: { enabled: true } }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const stream = vi.fn((_request, context) => ({ stream: 'sse', events: [], body: { secret: context.secrets.get('apiKey') } }));
    const loadModule = vi.fn(async () => ({ stream }));
    const runExport = vi.fn(
      async (
        extensionId: string,
        compiled: { path: string; hash: string },
        exportName: string,
        _operation: unknown,
        invoke: (handler: (...args: unknown[]) => unknown) => unknown,
      ) => {
        const backend = await loadModule(extensionId, compiled);
        return invoke(backend[exportName] as (...args: unknown[]) => unknown);
      },
    );
    setExtensionBackendRunnerForTests({
      loadModule,
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport,
      run: vi.fn(),
    });
    setWorkerImportBackendRunnerForTests({
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    });

    await expect(
      invokeExtensionRoute('sse-secret-ext', 'GET', '/stream', { method: 'GET', path: '/stream', query: {}, params: {} }),
    ).rejects.toThrow('Extension "sse-secret-ext" requires permission secrets:read to use secrets.get.');

    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'sse-secret-ext',
        name: 'SSE Secret Ext',
        permissions: ['secrets:read'],
        contributes: {
          secrets: {
            apiKey: {
              label: 'API key',
              env: 'SSE_ROUTE_SECRET',
            },
          },
        },
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/stream', handler: 'stream', stream: 'sse', worker: { enabled: true } }],
        },
      }),
    );
    invalidateExtensionRegistryReadCaches(stateRoot);

    await expect(
      invokeExtensionRoute('sse-secret-ext', 'GET', '/stream', { method: 'GET', path: '/stream', query: {}, params: {} }),
    ).resolves.toMatchObject({ stream: 'sse', body: { secret: 'secret-value' } });

    delete process.env.SSE_ROUTE_SECRET;
  });

  it('returns HTTP 500 when a backend route export is missing', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'missing-route-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'missing-route-ext',
        name: 'Missing Route Ext',
        backend: {
          entry: 'dist/backend.mjs',
          routes: [{ method: 'GET', path: '/ping', handler: 'missing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');

    await expect(
      invokeExtensionRoute('missing-route-ext', 'GET', '/ping', { method: 'GET', path: '/ping', query: {}, params: {} }),
    ).rejects.toMatchObject({ code: 'worker_required' });
  });

  it('probes self-test backend imports and exports through the worker import runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'self-test-worker-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'self-test-worker-ext',
        name: 'Self Test Worker Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function unused() { return true; }\n');
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => false),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(runExtensionSelfTest('self-test-worker-ext')).resolves.toEqual({
      ok: false,
      extensionId: 'self-test-worker-ext',
      checks: [
        { name: 'backend import', ok: true },
        { name: 'action export: doThing', ok: false, error: 'Missing export doThing' },
      ],
    });

    expect(workerRunner.loadModule).toHaveBeenCalledWith(
      'self-test-worker-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
    );
    expect(workerRunner.hasExport).toHaveBeenCalledWith(
      'self-test-worker-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
      'doThing',
    );
  });

  it('runs product-critical self-test action smoke checks through the worker runner', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'system-diffs');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-diffs',
        name: 'System Diffs',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'checkpoint', handler: 'checkpoint' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function checkpoint() { return true; }\n');
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(async () => true),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(async () => ({ ok: true })),
      run: vi.fn(),
    };
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(runExtensionSelfTest('system-diffs')).resolves.toEqual({
      ok: true,
      extensionId: 'system-diffs',
      checks: [
        { name: 'backend import', ok: true },
        { name: 'action export: checkpoint', ok: true },
        { name: 'action smoke: checkpoint', ok: true },
      ],
    });

    expect(workerRunner.runWorkerExport).toHaveBeenCalledWith(
      'system-diffs',
      expect.objectContaining({ path: expect.stringContaining(join('extensions', 'system-diffs', 'dist', 'backend.mjs')) }),
      'checkpoint',
      { type: 'self-test-action', label: 'self-test action checkpoint', target: 'checkpoint' },
      [{ action: 'list' }],
      { context: { type: 'backend', toolContext: { conversationId: 'extension-self-test', cwd: process.cwd() } } },
    );
  });

  it('clears both backend runners before reloading a backend', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-backend-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'reload-worker-ext');
    mkdirSync(join(extensionRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'reload-worker-ext',
        name: 'Reload Worker Ext',
        backend: {
          entry: 'dist/backend.mjs',
          actions: [{ id: 'doThing', handler: 'doThing' }],
        },
      }),
    );
    writeFileSync(join(extensionRoot, 'dist', 'backend.mjs'), 'export function doThing() { return true; }\n');

    const backendRunner = {
      loadModule: vi.fn(async () => ({ doThing: vi.fn() })),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      runWorkerExport: vi.fn(),
      run: vi.fn(),
    };
    const workerRunner = {
      loadModule: vi.fn(async () => ({})),
      clearModule: vi.fn(),
      hasExport: vi.fn(),
      loadAgentFactory: vi.fn(),
      runExport: vi.fn(),
      run: vi.fn(),
    };
    setExtensionBackendRunnerForTests(backendRunner);
    setWorkerImportBackendRunnerForTests(workerRunner);

    await expect(reloadExtensionBackend('reload-worker-ext')).resolves.toEqual({
      ok: true,
      extensionId: 'reload-worker-ext',
      rebuilt: false,
    });

    expect(extensionServices.stopExtensionServices).toHaveBeenCalledWith('reload-worker-ext');
    expect(backendRunner.clearModule).toHaveBeenCalledWith('reload-worker-ext');
    expect(workerRunner.clearModule).toHaveBeenCalledWith('reload-worker-ext');
    expect(backendRunner.loadModule).toHaveBeenCalledWith(
      'reload-worker-ext',
      expect.objectContaining({ path: join(extensionRoot, 'dist', 'backend.mjs') }),
    );
    expect(extensionServices.startExtensionServices).toHaveBeenCalledOnce();
  });
});

describe('extension backend load targeting', () => {
  it('resolves prebuilt dist/backend.mjs for bundled system extensions', () => {
    const target = resolvePrebuiltSystemExtensionBackend({ source: 'system', packageRoot: TEST_EXTENSION_ROOT });

    expect(target).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
    expect(target?.hash).toMatch(/^prebuilt:/);
  });

  it('loads built-output backend entries directly', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'dist/backend.mjs')).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });
  });

  it('resolves source manifest entries to built dist/backend.mjs artifacts', () => {
    expect(resolveExtensionBackendLoadTarget({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT }, 'src/backend.ts')).toMatchObject({
      path: resolve(TEST_EXTENSION_ROOT, 'dist/backend.mjs'),
    });

    expect(resolvePrebuiltSystemExtensionBackend({ source: 'runtime', packageRoot: TEST_EXTENSION_ROOT })).toBeNull();
  });
});
