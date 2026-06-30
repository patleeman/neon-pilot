import { beforeEach, describe, expect, it, vi } from 'vitest';

const automations = vi.hoisted(() => ({
  applyScheduledTaskThreadBinding: vi.fn(),
  createStoredAutomation: vi.fn(),
  invalidateAppTopics: vi.fn(),
  loadScheduledTasksForProfile: vi.fn(),
  resolveScheduledTaskThreadBinding: vi.fn(),
  updateStoredAutomation: vi.fn(),
}));

const cli = vi.hoisted(() => ({
  installNeonPilotUserCli: vi.fn(),
  readNeonPilotCliInstallStatus: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/automations', () => automations);
vi.mock('@neon-pilot/extensions/backend/cli', () => cli);

import {
  cliShellLinkSetupStatus,
  controlPlaneDoctor,
  installCliShellLink,
  manageAppCommands,
  neonPilotAdmin,
  neonPilotTool,
} from './backend.js';

function ctx(overrides: Record<string, unknown> = {}) {
  const storage = new Map<string, unknown>();
  return {
    commands: {
      list: vi.fn().mockResolvedValue([{ id: 'cmd-1' }]),
      execute: vi.fn().mockResolvedValue(true),
    },
    conversations: {
      list: vi.fn().mockResolvedValue([{ id: 'conv-1' }]),
      getWorkspace: vi.fn().mockResolvedValue({ openConversationIds: ['conv-1'] }),
      prune: vi.fn().mockResolvedValue({ ok: true, dryRun: true, candidates: [] }),
    },
    runtime: {
      getRepoRoot: vi.fn().mockReturnValue('/repo'),
    },
    shell: {
      exec: vi.fn().mockResolvedValue({
        stdout:
          '{"installed":true,"appPath":"/Applications/Neon Pilot.app","cliReady":true,"cliInstalled":true,"bootstrapDoctorReady":true}',
        stderr: '',
        executionWrappers: [],
      }),
    },
    storage: {
      put: vi.fn(async (key: string, value: unknown) => {
        storage.set(key, value);
        return { ok: true };
      }),
      get: vi.fn(async (key: string) => storage.get(key) ?? null),
      delete: vi.fn(async (key: string) => ({ ok: true, deleted: storage.delete(key) })),
    },
    ...overrides,
  } as never;
}

describe('system-neon-pilot-admin-cli backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    automations.invalidateAppTopics.mockResolvedValue(undefined);
    cli.readNeonPilotCliInstallStatus.mockResolvedValue({
      target: '/state/neon-pilot/bin/neon-pilot',
      binDir: '/Users/patrick/.local/bin',
      linkPath: '/Users/patrick/.local/bin/neon-pilot',
      globallyInstalled: true,
      linkExists: true,
      linkConflict: false,
    });
    cli.installNeonPilotUserCli.mockResolvedValue({
      target: '/state/neon-pilot/bin/neon-pilot',
      binDir: '/Users/patrick/.local/bin',
      linkPath: '/Users/patrick/.local/bin/neon-pilot',
      globallyInstalled: true,
      linkExists: true,
      linkConflict: false,
    });
  });

  it('normalizes app command CLI list and run inputs', async () => {
    const context = ctx();
    await expect(manageAppCommands({ cli: { command: 'app-commands list' } }, context)).resolves.toEqual({
      ok: true,
      commands: [{ id: 'cmd-1' }],
    });

    await expect(
      manageAppCommands({ cli: { command: 'app-commands run', args: ['cmd-1'], flags: { args: '{"value":1}' } } }, context),
    ).resolves.toEqual({ ok: true, commandId: 'cmd-1', executed: true });
    expect((context as { commands: { execute: ReturnType<typeof vi.fn> } }).commands.execute).toHaveBeenCalledWith('cmd-1', { value: 1 });
  });

  it('uses shared semantics for CLI and neon_pilot tool inputs', async () => {
    const cliContext = ctx();
    const toolContext = ctx();
    const cliResult = await manageAppCommands(
      { cli: { command: 'app-commands run', args: ['cmd-1'], flags: { args: '{"value":1}' } } },
      cliContext,
    );
    const toolResult = await neonPilotAdmin({ command: 'run_app_command', commandId: 'cmd-1', args: { value: 1 } }, toolContext);

    expect(toolResult).toEqual(cliResult);
    expect((toolContext as { commands: { execute: ReturnType<typeof vi.fn> } }).commands.execute).toHaveBeenCalledWith('cmd-1', {
      value: 1,
    });
  });

  it('honors app command dry-runs without executing the command', async () => {
    const cliContext = ctx();
    const toolContext = ctx();

    await expect(
      manageAppCommands(
        { cli: { command: 'app-commands run', args: ['cmd-1'], flags: { args: '{"value":1}', 'dry-run': true } } },
        cliContext,
      ),
    ).resolves.toEqual({ ok: true, dryRun: true, action: 'run_app_command', commandId: 'cmd-1', args: { value: 1 }, executed: false });
    await expect(
      neonPilotAdmin({ command: 'run_app_command', commandId: 'cmd-1', args: { value: 1 }, dryRun: true }, toolContext),
    ).resolves.toEqual({ ok: true, dryRun: true, action: 'run_app_command', commandId: 'cmd-1', args: { value: 1 }, executed: false });

    expect((cliContext as { commands: { execute: ReturnType<typeof vi.fn> } }).commands.execute).not.toHaveBeenCalled();
    expect((toolContext as { commands: { execute: ReturnType<typeof vi.fn> } }).commands.execute).not.toHaveBeenCalled();
  });

  it('wraps neon_pilot tool results in agent tool content with details', async () => {
    const result = await neonPilotTool({ command: 'list_app_commands' }, ctx());
    expect(result.details).toEqual({ ok: true, commands: [{ id: 'cmd-1' }] });
    expect(result.content[0]?.type).toBe('text');
    expect(result.content[0]?.text).toContain('cmd-1');
  });

  it('lists canonical admin commands by default', async () => {
    await expect(neonPilotAdmin({}, ctx())).resolves.toMatchObject({
      ok: true,
      commands: expect.arrayContaining([
        { id: 'list_app_commands', description: expect.any(String), inputSchema: expect.any(Object) },
        { id: 'run_app_command', description: expect.any(String), inputSchema: expect.any(Object) },
        { id: 'app_update', description: expect.any(String), inputSchema: expect.any(Object) },
        { id: 'control_plane_doctor', description: expect.any(String), inputSchema: expect.any(Object) },
        { id: 'heartbeat_start', description: expect.any(String), inputSchema: expect.any(Object) },
      ]),
    });
  });

  it('reports CLI shell link setup as ready when the user link is installed', async () => {
    await expect(cliShellLinkSetupStatus()).resolves.toMatchObject({
      status: 'ready',
      detail: expect.stringContaining('Shell command is linked'),
      actions: [],
    });
  });

  it('reports CLI shell link setup as actionable when the link is missing', async () => {
    cli.readNeonPilotCliInstallStatus.mockResolvedValueOnce({
      target: '/state/neon-pilot/bin/neon-pilot',
      binDir: '/Users/patrick/.local/bin',
      linkPath: '/Users/patrick/.local/bin/neon-pilot',
      globallyInstalled: false,
      linkExists: false,
      linkConflict: false,
    });

    await expect(cliShellLinkSetupStatus()).resolves.toMatchObject({
      status: 'needs_setup',
      detail: expect.stringContaining('shell link is missing'),
      actions: ['install'],
    });
  });

  it('reports CLI shell link conflicts as blocked', async () => {
    cli.readNeonPilotCliInstallStatus.mockResolvedValueOnce({
      target: '/state/neon-pilot/bin/neon-pilot',
      binDir: '/Users/patrick/.local/bin',
      linkPath: '/Users/patrick/.local/bin/neon-pilot',
      globallyInstalled: false,
      linkExists: true,
      linkConflict: true,
      linkTarget: '/usr/local/bin/other',
    });

    await expect(cliShellLinkSetupStatus()).resolves.toMatchObject({
      status: 'blocked',
      detail: expect.stringContaining('/usr/local/bin/other'),
      actions: [],
    });
  });

  it('installs the CLI shell link through the shared host API', async () => {
    await expect(installCliShellLink()).resolves.toMatchObject({
      ok: true,
      detail: expect.stringContaining('Shell command is linked'),
    });
    expect(cli.installNeonPilotUserCli).toHaveBeenCalledTimes(1);
  });

  it('normalizes app update CLI dry-run input', async () => {
    const result = await neonPilotAdmin(
      {
        cli: { command: 'app update', flags: { channel: 'rc', 'app-dir': '/Applications', repo: 'patleeman/neon-pilot', 'dry-run': true } },
      },
      ctx(),
    );

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      action: 'app_update',
      description: expect.any(String),
    });
    expect((result as { command: string }).command).toContain("bash '/repo/install.sh'");
    expect((result as { command: string }).command).toContain("'--channel' 'rc'");
    expect((result as { command: string }).command).toContain('raw.githubusercontent.com/patleeman/neon-pilot/master/install.sh');
  });

  it('runs app update through the signed release installer', async () => {
    const context = ctx();
    const result = await neonPilotAdmin({ command: 'app_update', channel: 'stable' }, context);

    expect(result).toMatchObject({
      ok: true,
      action: 'app_update',
      installerResult: {
        installed: true,
        appPath: '/Applications/Neon Pilot.app',
        cliReady: true,
      },
    });
    expect((context as { shell: { exec: ReturnType<typeof vi.fn> } }).shell.exec).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'sh',
        args: ['-lc', expect.stringContaining("bash '/repo/install.sh'")],
        cwd: '/repo',
        timeoutMs: 15 * 60 * 1000,
      }),
    );
  });

  it('uses shared semantics for heartbeat CLI and neon_pilot tool inputs', async () => {
    const setup = () => {
      automations.loadScheduledTasksForProfile.mockResolvedValueOnce({ tasks: [], parseErrors: [] });
      automations.resolveScheduledTaskThreadBinding.mockResolvedValue({
        mode: 'existing',
        conversationId: 'conv-1',
        sessionFile: '/session.jsonl',
      });
      automations.createStoredAutomation.mockResolvedValue({
        id: 'hb-1',
        enabled: true,
        schedule: { type: 'cron', expression: '*/5 * * * *' },
      });
      automations.applyScheduledTaskThreadBinding.mockResolvedValue({ threadConversationId: 'conv-1' });
    };

    setup();
    const cliResult = await neonPilotAdmin(
      {
        cli: {
          command: 'heartbeats start',
          args: ['hb-1'],
          flags: { 'interval-minutes': '5', 'conversation-id': 'conv-1', prompt: 'Check work.' },
        },
      },
      ctx(),
    );
    vi.clearAllMocks();
    automations.invalidateAppTopics.mockResolvedValue(undefined);
    setup();
    const toolResult = await neonPilotAdmin(
      { command: 'heartbeat_start', heartbeatId: 'hb-1', intervalMinutes: 5, conversationId: 'conv-1', prompt: 'Check work.' },
      ctx(),
    );

    expect(toolResult).toEqual(cliResult);
    expect(toolResult).toMatchObject({ ok: true, action: 'heartbeat_start', heartbeat: { id: 'hb-1', intervalMinutes: 5 } });
  });

  it('starts, lists, and stops heartbeats through the shared admin schema', async () => {
    automations.loadScheduledTasksForProfile.mockResolvedValueOnce({ tasks: [], parseErrors: [] });
    automations.resolveScheduledTaskThreadBinding.mockResolvedValue({
      mode: 'existing',
      conversationId: 'conv-1',
      sessionFile: '/session.jsonl',
    });
    automations.createStoredAutomation.mockResolvedValue({
      id: 'hb-1',
      enabled: true,
      schedule: { type: 'cron', expression: '*/5 * * * *' },
    });
    automations.applyScheduledTaskThreadBinding.mockResolvedValue({ threadConversationId: 'conv-1' });

    await expect(
      neonPilotAdmin(
        { command: 'heartbeat_start', heartbeatId: 'hb-1', intervalMinutes: 5, conversationId: 'conv-1', prompt: 'Check work.' },
        ctx(),
      ),
    ).resolves.toMatchObject({ ok: true, heartbeat: { id: 'hb-1', intervalMinutes: 5, skipIfRunning: true, coalesce: true } });
    expect(automations.createStoredAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'hb-1',
        cron: '*/5 * * * *',
        targetType: 'conversation',
        policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }],
      }),
    );

    automations.loadScheduledTasksForProfile.mockResolvedValueOnce({
      tasks: [
        {
          id: 'hb-1',
          enabled: true,
          targetType: 'conversation',
          threadConversationId: 'conv-1',
          schedule: { type: 'cron', expression: '*/5 * * * *' },
          policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }],
          prompt: 'Check work.',
        },
        { id: 'daily', enabled: true, targetType: 'background-agent', schedule: { type: 'cron', expression: '0 9 * * *' }, policies: [] },
      ],
      parseErrors: [],
    });
    await expect(neonPilotAdmin({ command: 'heartbeat_list' }, ctx())).resolves.toMatchObject({
      ok: true,
      count: 1,
      heartbeats: [{ id: 'hb-1', intervalMinutes: 5, coalesce: true }],
    });

    automations.loadScheduledTasksForProfile.mockResolvedValueOnce({
      tasks: [
        {
          id: 'hb-1',
          enabled: true,
          targetType: 'conversation',
          schedule: { type: 'cron', expression: '*/5 * * * *' },
          policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }],
          prompt: 'Check work.',
        },
      ],
      parseErrors: [],
    });
    automations.updateStoredAutomation.mockResolvedValue({
      id: 'hb-1',
      enabled: false,
      schedule: { type: 'cron', expression: '*/5 * * * *' },
    });
    await expect(neonPilotAdmin({ command: 'heartbeat_stop', heartbeatId: 'hb-1' }, ctx())).resolves.toMatchObject({
      ok: true,
      heartbeat: { id: 'hb-1', enabled: false },
    });
    expect(automations.updateStoredAutomation).toHaveBeenCalledWith('hb-1', expect.objectContaining({ enabled: false }));
  });

  it('runs non-destructive control-plane doctor checks', async () => {
    const context = ctx();
    const result = await controlPlaneDoctor({}, context);
    expect(result.ok).toBe(true);
    expect(result.checks.map((check) => check.name)).toEqual([
      'app_commands_list',
      'conversations_list',
      'conversations_workspace',
      'conversations_retention_dry_run',
      'runtime_repo_root',
      'storage_round_trip',
    ]);
    expect((context as { conversations: { prune: ReturnType<typeof vi.fn> } }).conversations.prune).toHaveBeenCalledWith({
      olderThanMs: 365 * 86_400_000,
      dryRun: true,
      archivedOnly: true,
    });
  });
});
