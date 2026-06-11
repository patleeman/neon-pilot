import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const appEvents = vi.hoisted(() => ({ invalidateAppTopics: vi.fn(), publishAppEvent: vi.fn() }));

vi.mock('../shared/appEvents.js', () => appEvents);

import {
  beginExtensionStartupGuard,
  clearExtensionFailureRecordsForOperation,
  completeExtensionStartupGuard,
  invalidateExtensionRegistryReadCaches,
  isExtensionEnabled,
  listExtensionAssemblyProviderRegistrations,
  listExtensionCliCommandRegistrations,
  listExtensionCommandRegistrations,
  listExtensionComposerInputToolRegistrations,
  listExtensionInstallSummaries,
  listExtensionKeybindingRegistrations,
  listExtensionModelProfileRegistrations,
  listExtensionPromptAssemblyHookRegistrations,
  listExtensionSkillRegistrations,
  listExtensionToolRegistrations,
  markExtensionStartupActive,
  parseExtensionManifest,
  readExtensionRegistrySnapshot,
  readExtensionSchema,
  readRuntimeExtensionEntries,
  recordExtensionFailure,
  resolveExtensionModelProfile,
  setExtensionEnabled,
  setExtensionKeybinding,
  withExtensionRegistryReadCache,
} from './extensionRegistry.js';

describe('extension registry', () => {
  afterEach(() => {
    delete process.env.NEON_PILOT_STATE_ROOT;
    appEvents.invalidateAppTopics.mockReset();
    appEvents.publishAppEvent.mockReset();
  });

  it('reports runtime-installed system-prefixed catalog extensions as uninstallable user packages', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'system-hermes-agent');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({ schemaVersion: 2, id: 'system-hermes-agent', name: 'Hermes Agent', packageType: 'system' }),
    );

    expect(listExtensionInstallSummaries(stateRoot)).toContainEqual(
      expect.objectContaining({ id: 'system-hermes-agent', name: 'Hermes Agent', packageType: 'user', uninstallable: true }),
    );

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('persists custom keybindings only for declared commands', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'declared-command');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'declared-command',
        name: 'Declared Command',
        enabled: true,
        contributes: { commands: [{ id: 'open-palette', title: 'Open Palette', action: 'palette.open' }] },
      }),
    );

    setExtensionKeybinding({
      extensionId: 'declared-command',
      keybindingId: 'command:declared-command.open-palette',
      title: 'Open Command Palette',
      command: 'declared-command.open-palette',
      packageType: 'user',
      scope: 'global',
      keys: ['CommandOrControl+P'],
      enabled: true,
      stateRoot,
    });

    expect(listExtensionKeybindingRegistrations(stateRoot)).toContainEqual(
      expect.objectContaining({
        extensionId: 'declared-command',
        surfaceId: 'command:declared-command.open-palette',
        title: 'Open Command Palette',
        command: 'declared-command.open-palette',
        keys: ['CommandOrControl+P'],
        enabled: true,
        packageType: 'user',
      }),
    );

    expect(() =>
      setExtensionKeybinding({
        extensionId: 'declared-command',
        keybindingId: 'command:palette.open',
        title: 'Injected',
        command: 'palette.open',
        packageType: 'user',
        keys: ['CommandOrControl+Shift+P'],
        enabled: true,
        stateRoot,
      }),
    ).toThrow('Cannot create keybinding for unknown command: palette.open');

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('does not expose backend actions as commands', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'backend-only');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'backend-only',
        name: 'Backend Only',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'plumbing', title: 'Plumbing', handler: 'plumbing' }] },
        contributes: { commands: [{ id: 'visible', title: 'Visible', action: 'visible' }] },
      }),
    );
    setExtensionEnabled('backend-only', true, stateRoot);

    const commands = listExtensionCommandRegistrations().filter((command) => command.extensionId === 'backend-only');
    expect(commands.map((command) => command.surfaceId)).toEqual(['visible']);

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('indexes extension-contributed CLI commands for enabled extensions', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;
    const extensionRoot = join(stateRoot, 'extensions', 'cli-owner');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'cli-owner',
        name: 'CLI Owner',
        backend: { entry: 'dist/backend.mjs', actions: [{ id: 'manage', title: 'Manage', handler: 'manage' }] },
        contributes: {
          cliCommands: [
            {
              id: 'things-list',
              command: 'things list',
              description: 'List things.',
              action: 'manage',
              aliases: ['thing ls'],
              jsonDefault: true,
            },
          ],
        },
      }),
    );
    setExtensionEnabled('cli-owner', true, stateRoot);

    expect(listExtensionCliCommandRegistrations()).toContainEqual(
      expect.objectContaining({
        extensionId: 'cli-owner',
        surfaceId: 'things-list',
        command: 'things list',
        action: 'manage',
        aliases: ['thing ls'],
        jsonDefault: true,
      }),
    );

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('invalidates scoped registry config cache after writes', async () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'opt-in');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'opt-in',
        name: 'Opt In',
        defaultEnabled: false,
      }),
    );

    await withExtensionRegistryReadCache(async () => {
      expect(isExtensionEnabled('opt-in', stateRoot)).toBe(false);
      setExtensionEnabled('opt-in', true, stateRoot);
      expect(isExtensionEnabled('opt-in', stateRoot)).toBe(true);
    });

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('invalidates process registry entry caches after manifest files change', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    process.env.NEON_PILOT_STATE_ROOT = stateRoot;

    expect(listExtensionInstallSummaries(stateRoot).some((extension) => extension.id === 'added-later')).toBe(false);

    const extensionRoot = join(stateRoot, 'extensions', 'added-later');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'added-later',
        name: 'Added Later',
      }),
    );

    invalidateExtensionRegistryReadCaches(stateRoot);
    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'added-later')).toMatchObject({
      id: 'added-later',
      status: 'enabled',
    });

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('drops runtime extensions from process registry caches after their package folder is deleted', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'deleted-later');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'deleted-later',
        name: 'Deleted Later',
      }),
    );

    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'deleted-later')).toMatchObject({
      id: 'deleted-later',
      status: 'enabled',
    });

    rmSync(extensionRoot, { recursive: true, force: true });

    expect(listExtensionInstallSummaries(stateRoot).some((extension) => extension.id === 'deleted-later')).toBe(false);

    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('exposes the extension manager as the standalone /extensions route', () => {
    const routes = readExtensionRegistrySnapshot().routes;
    expect(routes).toContainEqual(expect.objectContaining({ extensionId: 'system-extension-manager', route: '/extensions' }));
  });

  it('resolves enabled model profiles by provider/model glob and priority', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const registryRoot = join(stateRoot, 'extensions');
    const first = join(registryRoot, 'first-profile');
    const second = join(registryRoot, 'second-profile');
    mkdirSync(first, { recursive: true });
    mkdirSync(second, { recursive: true });
    writeFileSync(
      join(first, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'first-profile',
        name: 'First Profile',
        contributes: { modelProfiles: [{ id: 'gpt-anywhere', match: ['*/gpt-5.5'], priority: 10 }] },
      }),
    );
    writeFileSync(
      join(second, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'second-profile',
        name: 'Second Profile',
        contributes: { modelProfiles: [{ id: 'codex-provider', match: ['openai-codex/*'], priority: 20 }] },
      }),
    );
    setExtensionEnabled('first-profile', true, stateRoot);
    setExtensionEnabled('second-profile', true, stateRoot);

    expect(listExtensionModelProfileRegistrations(stateRoot).map((profile) => profile.id)).toEqual([
      'codex-compatible',
      'gpt-anywhere',
      'codex-provider',
    ]);
    expect(resolveExtensionModelProfile({ provider: 'openai-codex', model: 'gpt-5.5' }, stateRoot)).toMatchObject({
      kind: 'resolved',
      profile: { id: 'codex-compatible' },
    });
    expect(resolveExtensionModelProfile({ provider: 'openai', model: 'gpt-5.5' }, stateRoot)).toMatchObject({
      kind: 'resolved',
      profile: { id: 'gpt-anywhere' },
    });
  });

  it('treats same-priority model profile matches as ambiguous and ignores disabled profiles', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const registryRoot = join(stateRoot, 'extensions');
    for (const id of ['profile-a', 'profile-b', 'profile-disabled']) {
      const root = join(registryRoot, id);
      mkdirSync(root, { recursive: true });
      writeFileSync(
        join(root, 'extension.json'),
        JSON.stringify({
          schemaVersion: 2,
          id,
          name: id,
          contributes: { modelProfiles: [{ id, match: ['opencode-go/qwen*-coder*'], priority: 10 }] },
        }),
      );
    }
    setExtensionEnabled('profile-a', true, stateRoot);
    setExtensionEnabled('profile-b', true, stateRoot);
    setExtensionEnabled('profile-disabled', false, stateRoot);

    expect(resolveExtensionModelProfile({ provider: 'opencode-go', model: 'qwen3-coder' }, stateRoot)).toMatchObject({
      kind: 'ambiguous',
      profiles: [{ id: 'profile-a' }, { id: 'profile-b' }],
    });
  });

  it('exposes the automations system extension route and surface', () => {
    const snapshot = readExtensionRegistrySnapshot();

    expect(snapshot.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'system-automations', packageType: 'system', name: 'Automations' }),
        expect.objectContaining({ id: 'system-telemetry', packageType: 'system', name: 'Telemetry' }),
        expect.objectContaining({ id: 'system-files', packageType: 'system', name: 'File Explorer' }),
        expect.objectContaining({ id: 'system-diffs', packageType: 'system', name: 'Diffs' }),
        expect.objectContaining({ id: 'system-context-usage', packageType: 'system', name: 'Context Usage' }),
        expect.objectContaining({ id: 'system-git-status', packageType: 'system', name: 'Git Status' }),
        expect.objectContaining({ id: 'system-runs', packageType: 'system', name: 'Background Work' }),
      ]),
    );
    expect(snapshot.routes).toContainEqual({
      route: '/automations',
      extensionId: 'system-automations',
      surfaceId: 'page',
      packageType: 'system',
    });
    expect(snapshot.views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          extensionId: 'system-automations',
          location: 'main',
          component: 'AutomationsPage',
          route: '/automations',
        }),
        expect.objectContaining({ extensionId: 'system-telemetry', location: 'main', component: 'TelemetryPage', route: '/telemetry' }),
        expect.objectContaining({
          extensionId: 'system-files',
          location: 'rightRail',
          component: 'WorkspaceFilesPanel',
          detailView: 'workspace-file-detail',
        }),
        expect.objectContaining({ extensionId: 'system-files', location: 'workbench', component: 'WorkspaceFileDetailPanel' }),
      ]),
    );
    expect(listExtensionSkillRegistrations()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ extensionId: 'system-artifacts', id: 'artifacts' }),
        expect.objectContaining({ extensionId: 'system-automations', id: 'scheduled-tasks' }),
        expect.objectContaining({ extensionId: 'system-runs', id: 'runs' }),
      ]),
    );
    expect(listExtensionComposerInputToolRegistrations()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          extensionId: 'system-excalidraw-input',
          id: 'excalidraw',
          component: 'ExcalidrawInputTool',
          packageType: 'system',
        }),
      ]),
    );
  });

  it('validates manifest contributions before accepting runtime extensions', () => {
    expect(() =>
      parseExtensionManifest({
        schemaVersion: 2,
        id: 'bad-ext',
        name: 'Bad Ext',
        contributes: {
          views: [{ id: 'page', title: 'Bad', location: 'somewhere', component: 'BadPage' }],
        },
      }),
    ).toThrow(/contributes\.views\[0\]\.location/);

    expect(() =>
      parseExtensionManifest({
        schemaVersion: 2,
        id: 'bad-ext',
        name: 'Bad Ext',
        contributes: {
          keybindings: [{ id: 'open', title: 'Open', keys: 'mod+o', command: 'navigate:/bad' }],
        },
      }),
    ).toThrow(/contributes\.keybindings\[0\]\.keys/);

    expect(() =>
      parseExtensionManifest({
        schemaVersion: 2,
        id: 'bad-ext',
        name: 'Bad Ext',
        contributes: {
          themes: [{ id: 'bad-theme', label: 'Bad Theme', appearance: 'dark', tokens: { '--not-color': '1 2 3' } }],
        },
      }),
    ).toThrow(/contributes\.themes\[0\]\.tokens\.*/);
  });

  it('loads runtime extension manifests from the state root as user extensions', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        packageType: 'system',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Agent Board', location: 'main', route: '/ext/agent-board', component: 'AgentBoardPage' }],
        },
      }),
    );

    expect(readRuntimeExtensionEntries(stateRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageRoot: extensionRoot,
          source: 'runtime',
          manifest: expect.objectContaining({ id: 'agent-board', packageType: 'user' }),
        }),
      ]),
    );
  });

  it('does not seed optional first-party extensions from repo source', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));

    expect(readRuntimeExtensionEntries(stateRoot).some((entry) => entry.manifest.id === 'system-onboarding')).toBe(false);
    expect(readRuntimeExtensionEntries(stateRoot).some((entry) => entry.manifest.id === 'system-browser')).toBe(false);
  });

  it('enables bundled Todos by default', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));

    expect(listExtensionInstallSummaries(stateRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-todo',
          enabled: true,
          status: 'enabled',
          manifest: expect.objectContaining({ defaultEnabled: true }),
        }),
      ]),
    );
  });

  it('exposes invalid runtime extension manifests in installation summaries', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'bad-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'bad-board',
        name: 'Bad Board',
        contributes: {
          views: [{ id: 'page', title: 'Bad Board', location: 'somewhere', component: 'BadBoardPage' }],
        },
      }),
    );

    expect(
      readRuntimeExtensionEntries(stateRoot).filter((entry) => !['system-browser', 'system-onboarding'].includes(entry.manifest.id)),
    ).toEqual([]);
    expect(listExtensionInstallSummaries(stateRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'bad-board',
          name: 'Bad Board',
          enabled: false,
          status: 'invalid',
          errors: [expect.stringContaining('contributes.views[0].location')],
        }),
      ]),
    );
  });

  it('surfaces invalid extension skill diagnostics without registering the skill', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'bad-skills');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'bad-skills',
        name: 'Bad Skills',
        contributes: {
          skills: [{ id: 'missing', path: 'skills/missing/SKILL.md' }],
        },
      }),
    );

    expect(listExtensionSkillRegistrations(stateRoot).some((skill) => skill.extensionId === 'bad-skills')).toBe(false);
    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'bad-skills')).toEqual(
      expect.objectContaining({
        diagnostics: [expect.stringContaining('path does not exist')],
      }),
    );
  });

  it('tracks disabled runtime extensions and hides them from active surfaces', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        frontend: { entry: 'dist/frontend.js' },
        contributes: {
          views: [{ id: 'page', title: 'Agent Board', location: 'main', route: '/ext/agent-board', component: 'AgentBoardPage' }],
        },
      }),
    );

    expect(isExtensionEnabled('agent-board', stateRoot)).toBe(true);
    setExtensionEnabled('agent-board', false, stateRoot);
    expect(isExtensionEnabled('agent-board', stateRoot)).toBe(false);
    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'agent-board')?.enabled).toBe(false);
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('extensions', 'notifications');
  });

  it('quarantines an extension after repeated failures', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'flaky-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 2, id: 'flaky-board', name: 'Flaky Board' }));

    expect(recordExtensionFailure({ extensionId: 'flaky-board', operation: 'action run', error: 'boom 1', stateRoot })).toMatchObject({
      quarantined: false,
      failures: 1,
    });
    recordExtensionFailure({ extensionId: 'flaky-board', operation: 'action run', error: 'boom 2', stateRoot });
    expect(recordExtensionFailure({ extensionId: 'flaky-board', operation: 'action run', error: 'boom 3', stateRoot })).toMatchObject({
      quarantined: true,
      failures: 3,
    });

    expect(isExtensionEnabled('flaky-board', stateRoot)).toBe(false);
    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'flaky-board')).toMatchObject({
      enabled: false,
      diagnostics: [expect.stringContaining('Extension disabled by circuit breaker')],
    });
    expect(appEvents.invalidateAppTopics).toHaveBeenCalledWith('extensions', 'notifications');
    expect(appEvents.publishAppEvent).toHaveBeenCalledWith({
      type: 'notification',
      extensionId: 'flaky-board',
      message: 'Extension quarantined after 3 failures and was disabled.',
      details: 'boom 3',
      severity: 'warning',
    });
  });

  it('records locked extension failures without quarantining core platform surfaces', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'system-extension-manager');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-extension-manager',
        name: 'Extension Manager',
        packageType: 'system',
      }),
    );

    recordExtensionFailure({ extensionId: 'system-extension-manager', operation: 'action manageExtension', error: 'boom 1', stateRoot });
    recordExtensionFailure({ extensionId: 'system-extension-manager', operation: 'action manageExtension', error: 'boom 2', stateRoot });
    expect(
      recordExtensionFailure({ extensionId: 'system-extension-manager', operation: 'action manageExtension', error: 'boom 3', stateRoot }),
    ).toMatchObject({
      quarantined: false,
      failures: 3,
    });

    expect(isExtensionEnabled('system-extension-manager', stateRoot)).toBe(true);
    const summary = listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'system-extension-manager');
    expect(summary).toMatchObject({
      enabled: true,
      required: true,
    });
    expect(summary?.diagnostics ?? []).not.toEqual(expect.arrayContaining([expect.stringContaining('Extension disabled by circuit breaker')]));
    expect(appEvents.invalidateAppTopics).not.toHaveBeenCalledWith('extensions', 'notifications');
    expect(appEvents.publishAppEvent).not.toHaveBeenCalledWith(expect.objectContaining({ extensionId: 'system-extension-manager' }));
  });

  it('clears failure records for a recovered operation without dropping unrelated failures', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'recovering-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({ schemaVersion: 2, id: 'recovering-board', name: 'Recovering Board' }),
    );

    recordExtensionFailure({ extensionId: 'recovering-board', operation: 'service sync health check', error: 'stopped', stateRoot });
    recordExtensionFailure({ extensionId: 'recovering-board', operation: 'action run', error: 'boom', stateRoot });
    clearExtensionFailureRecordsForOperation('recovering-board', 'service sync health check', stateRoot);

    const records = JSON.parse(readFileSync(join(stateRoot, 'extensions', 'failures.json'), 'utf8')) as Record<
      string,
      Array<{ operation: string; error: string }>
    >;
    expect(records['recovering-board']).toEqual([{ at: expect.any(String), operation: 'action run', error: 'boom' }]);
  });

  it('safe-mode startup leaves runtime extensions enabled when an unclean startup marker has no suspect', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'runtime-board');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 2, id: 'runtime-board', name: 'Runtime Board' }));

    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: false, disabledIds: [] });
    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: true, disabledIds: [] });
    expect(isExtensionEnabled('runtime-board', stateRoot)).toBe(true);
    expect(appEvents.invalidateAppTopics).not.toHaveBeenCalledWith('extensions', 'notifications');
    expect(appEvents.publishAppEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: 'runtime-board',
        message: 'Extension quarantined by safe mode and was disabled.',
      }),
    );
    completeExtensionStartupGuard(stateRoot);
    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: false, disabledIds: [] });
  });

  it('safe-mode startup disables only the active runtime extension when the marker has a suspect', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    for (const id of ['runtime-board', 'runtime-chat']) {
      const extensionRoot = join(stateRoot, 'extensions', id);
      mkdirSync(extensionRoot, { recursive: true });
      writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 2, id, name: id }));
    }

    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: false, disabledIds: [] });
    markExtensionStartupActive('runtime-chat', stateRoot);
    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: true, disabledIds: ['runtime-chat'] });

    expect(isExtensionEnabled('runtime-board', stateRoot)).toBe(true);
    expect(isExtensionEnabled('runtime-chat', stateRoot)).toBe(false);
  });

  it('clears stale startup safe-mode markers when re-enabling an extension', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'runtime-chat');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, 'extension.json'), JSON.stringify({ schemaVersion: 2, id: 'runtime-chat', name: 'Runtime Chat' }));

    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: false, disabledIds: [] });
    markExtensionStartupActive('runtime-chat', stateRoot);
    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: true, disabledIds: ['runtime-chat'] });
    expect(isExtensionEnabled('runtime-chat', stateRoot)).toBe(false);

    setExtensionEnabled('runtime-chat', true, stateRoot);

    expect(beginExtensionStartupGuard(stateRoot)).toEqual({ safeMode: false, disabledIds: [] });
  });

  it('keeps default-disabled extensions off until explicitly enabled', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'slack-mcp-gateway');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'slack-mcp-gateway',
        name: 'Slack MCP Gateway',
        defaultEnabled: false,
      }),
    );

    expect(isExtensionEnabled('slack-mcp-gateway', stateRoot)).toBe(false);
    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'slack-mcp-gateway')?.enabled).toBe(false);

    setExtensionEnabled('slack-mcp-gateway', true, stateRoot);
    expect(isExtensionEnabled('slack-mcp-gateway', stateRoot)).toBe(true);
  });

  it('keeps incompatible runtime extensions disabled with diagnostics even when explicitly enabled', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'old-extension');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'old-extension',
        name: 'Old Extension',
        compatibility: { neonPilot: '>=0.10.0 <0.11.0' },
        contributes: { views: [{ id: 'page', title: 'Old', location: 'main', route: '/ext/old', component: 'OldPage' }] },
      }),
    );

    setExtensionEnabled('old-extension', true, stateRoot);

    expect(isExtensionEnabled('old-extension', stateRoot)).toBe(false);
    expect(readExtensionRegistrySnapshot().routes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ extensionId: 'old-extension' })]),
    );
    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'old-extension')).toMatchObject({
      enabled: false,
      status: 'disabled',
      diagnostics: [expect.stringContaining('requires Neon Pilot >=0.10.0 <0.11.0')],
    });
  });

  it('does not disable built-in system extensions with stale compatibility metadata', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'system-onboarding');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-onboarding',
        name: 'Onboarding',
        packageType: 'system',
        compatibility: { neonPilot: '>=0.10.0 <0.11.0' },
      }),
    );

    setExtensionEnabled('system-onboarding', true, stateRoot);

    expect(isExtensionEnabled('system-onboarding', stateRoot)).toBe(true);
    const summary = listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'system-onboarding');
    expect(summary).toMatchObject({
      enabled: true,
      status: 'enabled',
    });
    expect(summary?.diagnostics ?? []).toEqual([]);
  });

  it('keeps locked system extensions enabled even when stale config disables them', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'system-terminal');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'system-terminal',
        name: 'Terminal',
        packageType: 'system',
      }),
    );
    writeFileSync(join(stateRoot, 'extensions', 'registry.json'), JSON.stringify({ disabledIds: ['system-terminal'] }));

    expect(isExtensionEnabled('system-terminal', stateRoot)).toBe(true);
    expect(listExtensionInstallSummaries(stateRoot).find((extension) => extension.id === 'system-terminal')).toMatchObject({
      enabled: true,
      required: true,
    });
  });

  it('indexes enabled extension skills and tools', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'agent-board');
    mkdirSync(join(extensionRoot, 'skills', 'agent-board'), { recursive: true });
    writeFileSync(
      join(extensionRoot, 'skills', 'agent-board', 'SKILL.md'),
      '---\nname: agent-board\ndescription: Use when managing agent board tasks.\n---\n\n# Agent Board\n',
    );
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'agent-board',
        name: 'Agent Board',
        backend: { entry: 'src/backend.ts' },
        contributes: {
          skills: [{ id: 'agent-board', description: 'Use when managing agent board tasks.', path: 'skills/agent-board/SKILL.md' }],
          tools: [
            {
              id: 'create-task',
              description: 'Create an agent board task.',
              action: 'createTask',
              inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
              when: { providers: ['openai'], models: ['gpt-5.2'] },
            },
          ],
        },
      }),
    );

    expect(listExtensionSkillRegistrations(stateRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          extensionId: 'agent-board',
          name: 'agent-board/agent-board',
          path: join(extensionRoot, 'skills', 'agent-board', 'SKILL.md'),
        }),
      ]),
    );
    expect(listExtensionToolRegistrations(stateRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          extensionId: 'agent-board',
          id: 'create-task',
          name: 'extension_agent_board_create_task',
          action: 'createTask',
          when: { providers: ['openai'], models: ['gpt-5.2'] },
        }),
      ]),
    );

    setExtensionEnabled('agent-board', false, stateRoot);
    expect(listExtensionSkillRegistrations(stateRoot).some((skill) => skill.extensionId === 'agent-board')).toBe(false);
    expect(listExtensionToolRegistrations(stateRoot).some((tool) => tool.extensionId === 'agent-board')).toBe(false);
  });

  it('indexes prompt assembly providers and hooks', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'pa-ext-registry-'));
    const extensionRoot = join(stateRoot, 'extensions', 'prompt-lab');
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(
      join(extensionRoot, 'extension.json'),
      JSON.stringify({
        schemaVersion: 2,
        id: 'prompt-lab',
        name: 'Prompt Lab',
        backend: { entry: 'src/backend.ts' },
        contributes: {
          skillProviders: [{ id: 'generated-skills', handler: 'listGeneratedSkills', title: 'Generated Skills', priority: 10 }],
          toolProviders: [{ id: 'generated-tools', handler: 'listGeneratedTools' }],
          promptTemplateProviders: [{ id: 'generated-prompts', handler: 'listGeneratedPrompts' }],
          promptAssemblyHooks: [{ id: 'filter-context', handler: 'filterContext', phase: 'before-injection', priority: 5 }],
        },
      }),
    );

    expect(listExtensionAssemblyProviderRegistrations(stateRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ extensionId: 'prompt-lab', id: 'generated-skills', kind: 'skills', priority: 10 }),
        expect.objectContaining({ extensionId: 'prompt-lab', id: 'generated-tools', kind: 'tools' }),
        expect.objectContaining({ extensionId: 'prompt-lab', id: 'generated-prompts', kind: 'promptTemplates' }),
      ]),
    );
    expect(listExtensionPromptAssemblyHookRegistrations(stateRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ extensionId: 'prompt-lab', id: 'filter-context', phase: 'before-injection' })]),
    );
  });

  it('exposes schema values for agents and the extension manager', () => {
    expect(readExtensionSchema()).toEqual(
      expect.objectContaining({
        placements: expect.arrayContaining(['main', 'right', 'slash']),
        surfaceKinds: expect.arrayContaining(['page', 'toolPanel', 'slashCommand']),
        iconNames: expect.arrayContaining(['automation', 'kanban']),
        contributions: expect.arrayContaining(['themes']),
      }),
    );
  });
});
