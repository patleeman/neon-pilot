import { PassThrough } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  getPiAgentRuntimeDir: vi.fn(() => '/agent'),
  getStateRoot: vi.fn(() => '/tmp/neon-pilot-protocol-cli-test'),
}));
const runtime = vi.hoisted(() => ({
  createRuntimeState: vi.fn(() => ({
    getRuntimeScope: vi.fn(() => 'shared'),
    buildLiveSessionResourceOptions: vi.fn(() => ({ additionalSkillPaths: ['/skills'] })),
  })),
}));
const extensionHostClient = vi.hoisted(() => ({
  health: vi.fn(async () => ({ status: 'ready' })),
  invokeProtocolEntrypoint: vi.fn(async () => undefined),
  readRegistryPresentation: vi.fn(async () => ({ cliCommandRegistrations: [] })),
  invokeAction: vi.fn(async () => ({ ok: true, result: { text: 'ok' } })),
}));
const extensionHostRpcClient = vi.hoisted(() => ({
  createExtensionHostRpcClient: vi.fn(() => extensionHostClient),
}));
const cliControlPlane = vi.hoisted(() => ({
  readNeonPilotCliControlPlaneRecord: vi.fn(() => null),
}));
const cliEnvironment = vi.hoisted(() => ({
  installNeonPilotUserCli: vi.fn(() => ({
    target: '/tmp/state/bin/neon-pilot',
    binDir: '/tmp/state/bin',
    linkPath: '/Users/patrick/.local/bin/neon-pilot',
    globallyInstalled: true,
  })),
  readNeonPilotCliInstallStatus: vi.fn(() => ({
    target: '/tmp/state/bin/neon-pilot',
    binDir: '/tmp/state/bin',
    linkPath: '/Users/patrick/.local/bin/neon-pilot',
    globallyInstalled: false,
  })),
  uninstallNeonPilotUserCli: vi.fn(() => ({
    target: '/tmp/state/bin/neon-pilot',
    binDir: '/tmp/state/bin',
    linkPath: '/Users/patrick/.local/bin/neon-pilot',
    globallyInstalled: false,
    removed: true,
  })),
}));

vi.mock('@neon-pilot/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@neon-pilot/core')>()),
  ...core,
}));
vi.mock('./app/runtimeState.js', () => runtime);
vi.mock('./cliEnvironment.js', () => cliEnvironment);
vi.mock('./extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
  setExtensionHostClient: vi.fn(),
}));
vi.mock('./extensions/extensionHostRpcClient.js', () => extensionHostRpcClient);
vi.mock('./cliControlPlane.js', () => cliControlPlane);

import { main, PROTOCOL_CLI_EXIT_CODES, runProtocolCli } from './protocolCli.js';

describe('protocol CLI', () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  const originalResourcesPath = process.resourcesPath;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL;
    delete process.env.NEON_PILOT_EXTENSION_HOST_TOKEN;
    delete process.env.NEON_PILOT_FORCE_SOURCE_CLI;
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
    cliControlPlane.readNeonPilotCliControlPlaneRecord.mockReturnValue(null);
    Object.defineProperty(process, 'resourcesPath', { value: undefined, configurable: true });
  });

  it('prints usage and returns usage exit code for invalid invocations', async () => {
    await expect(runProtocolCli([])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);
    await expect(runProtocolCli(['other', 'acp'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.notFound);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Usage: neon-pilot <command> [args]\n'));
    expect(extensionHostClient.invokeProtocolEntrypoint).not.toHaveBeenCalled();
  });

  it('invokes protocol entrypoints with args, stdio, signal, and server context snapshot', async () => {
    const controller = new AbortController();

    await expect(runProtocolCli(['protocol', 'acp', '--stdio'], { signal: controller.signal })).resolves.toBe(0);

    expect(runtime.createRuntimeState).toHaveBeenCalledWith({
      repoRoot: process.cwd(),
      agentDir: '/agent',
      settingsFile: '/agent/settings.json',
      stateRoot: '/tmp/neon-pilot-protocol-cli-test',
      logger: { warn: expect.any(Function) },
    });
    expect(extensionHostClient.invokeProtocolEntrypoint).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolId: 'acp',
        input: { args: ['--stdio'] },
        serverContextSnapshot: expect.objectContaining({
          runtimeScope: 'shared',
          repoRoot: process.cwd(),
          agentDir: '/agent',
          settingsFile: '/agent/settings.json',
          stateRoot: '/tmp/neon-pilot-protocol-cli-test',
        }),
        stdio: { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr },
        signal: controller.signal,
      }),
    );
    expect(extensionHostClient.invokeProtocolEntrypoint.mock.calls[0][0]).not.toHaveProperty('serverContext');
  });

  it('configures an RPC extension host client from app process environment', async () => {
    process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL = 'http://127.0.0.1:4321';
    process.env.NEON_PILOT_EXTENSION_HOST_TOKEN = 'secret';

    await expect(runProtocolCli(['protocol', 'ds4-tools', 'tools'])).resolves.toBe(0);

    expect(extensionHostRpcClient.createExtensionHostRpcClient).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:4321',
      token: 'secret',
    });
    expect(extensionHostClient.invokeProtocolEntrypoint).toHaveBeenCalledWith(
      expect.objectContaining({ protocolId: 'ds4-tools', input: { args: ['tools'] } }),
    );
  });

  it('discovers a running app extension host from the CLI control-plane file', async () => {
    cliControlPlane.readNeonPilotCliControlPlaneRecord.mockReturnValueOnce({
      version: 1,
      pid: 123,
      updatedAt: '2026-06-06T00:00:00.000Z',
      extensionHost: { baseUrl: 'http://127.0.0.1:9876', token: 'control-token' },
    });
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        { extensionId: 'system-settings', surfaceId: 'settings-list', command: 'settings list', action: 'manageSettings' },
      ],
    });

    await expect(runProtocolCli(['commands', '--json'])).resolves.toBe(0);

    expect(extensionHostRpcClient.createExtensionHostRpcClient).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:9876',
      token: 'control-token',
    });
    expect(extensionHostClient.health).toHaveBeenCalled();
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"command": "settings list"'));
  });

  it('lists extension-contributed CLI commands', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        { extensionId: 'system-extension-manager', surfaceId: 'extensions-list', command: 'extensions list', action: 'manageExtension' },
      ],
    });

    await expect(runProtocolCli(['commands', '--json'])).resolves.toBe(0);

    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"command": "extensions list"'));
  });

  it('prints stable human help for the core shell', async () => {
    await expect(runProtocolCli(['help'])).resolves.toBe(0);

    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('commands [--brief]'));
    expect(stdoutWrite).not.toHaveBeenCalledWith(expect.stringContaining('schema [--json]'));
    expect(stdoutWrite).not.toHaveBeenCalledWith(expect.stringContaining('protocol <protocol-id>'));
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('doctor [--json]               Check CLI/runtime readiness'));
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('--quiet      Suppress non-essential human output'));
  });

  it('uses packaged resourcesPath for cli status when repo root env is unavailable', async () => {
    Object.defineProperty(process, 'resourcesPath', {
      value: '/Applications/Neon Pilot.app/Contents/Resources',
      configurable: true,
    });
    try {
      await expect(runProtocolCli(['cli', 'status', '--json'])).resolves.toBe(0);
      expect(cliEnvironment.readNeonPilotCliInstallStatus).toHaveBeenCalledWith({
        repoRoot: '/Applications/Neon Pilot.app/Contents/Resources',
      });
    } finally {
      Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true });
    }
  });

  it('supports built-in aliases and runtime introspection commands', async () => {
    await expect(runProtocolCli(['ls', '--json'])).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"command": "commands"'));

    stdoutWrite.mockClear();
    await expect(runProtocolCli(['runtime', 'paths', '--json'])).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"stateRoot"'));

    stdoutWrite.mockClear();
    await expect(runProtocolCli(['-v', '--json'])).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"version"'));
  });

  it('exports CLI command schemas as JSON', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-settings',
          surfaceId: 'settings-list',
          command: 'settings list',
          action: 'manageSettings',
          description: 'List settings.',
        },
      ],
    });

    await expect(runProtocolCli(['schema', '--json'])).resolves.toBe(0);

    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"title": "Neon Pilot CLI command contracts"'));
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"command": "settings list"'));
  });

  it('prints stable human command lists with source ownership', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-settings',
          surfaceId: 'settings-list',
          command: 'settings list',
          action: 'manageSettings',
          description: 'List runtime settings.',
          usage: 'settings list [--json]',
          mode: 'read',
          requiresApp: false,
          idempotent: true,
          outputModes: ['text', 'json'],
        },
      ],
    });

    await expect(runProtocolCli(['commands'])).resolves.toBe(0);

    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('settings list [system-settings]  List runtime settings.'));
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('cli status  Show the channel-local launcher'));
    expect(stdoutWrite).not.toHaveBeenCalledWith(expect.stringContaining('protocol  Invoke a raw extension protocol entrypoint'));
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Advanced Commands: hidden from the default human list.'));
  });

  it('prints compact brief command lists and reveals advanced commands only with verbose', async () => {
    await expect(runProtocolCli(['commands', '--brief'])).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Neon Pilot commands (brief):'));
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('commands | cli.discover_contracts | public'));
    expect(stdoutWrite).not.toHaveBeenCalledWith(expect.stringContaining('protocol | host.raw_protocol_escape_hatch | advanced'));

    stdoutWrite.mockClear();
    await expect(runProtocolCli(['commands', '--brief', '--verbose'])).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('protocol | host.raw_protocol_escape_hatch | advanced'));
  });

  it('returns structured errors for JSON callers', async () => {
    await expect(runProtocolCli(['unknown-command', '--json'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.notFound);

    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('"category": "not_found"'));
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('"code": "unknown_command"'));
  });

  it('short-circuits extension dry-runs before invoking backend actions', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-settings',
          surfaceId: 'settings-set',
          command: 'settings set',
          action: 'manageSettings',
          supportsDryRun: true,
          mode: 'write',
        },
      ],
    });

    await expect(runProtocolCli(['settings', 'set', 'conversation.pinnedToolCalls', 'false', '--dry-run'])).resolves.toBe(0);

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Dry run: settings set would run'));
  });

  it('validates contributed command schemas before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-settings',
          surfaceId: 'settings-set',
          command: 'settings set',
          action: 'manageSettings',
          argsSchema: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' } },
          flagsSchema: { type: 'object', properties: {}, additionalProperties: false },
        },
      ],
    });

    await expect(runProtocolCli(['settings', 'set', 'conversation.pinnedToolCalls', '--json'])).resolves.toBe(
      PROTOCOL_CLI_EXIT_CODES.usage,
    );

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('"code": "usage_error"'));
  });

  it('validates required task save flags before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-automations',
          surfaceId: 'tasks-save',
          command: 'tasks save',
          action: 'scheduledTask',
          argsSchema: { type: 'array', maxItems: 0, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: {
              json: { type: 'boolean' },
              title: { type: 'string', minLength: 1 },
              prompt: { type: 'string', minLength: 1 },
            },
            required: ['title', 'prompt'],
            additionalProperties: true,
          },
        },
      ],
    });

    await expect(runProtocolCli(['tasks', 'save', '--prompt', 'hello', '--json'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Missing required flag --title'));
  });

  it('rejects positional args for flag-only task saves before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-automations',
          surfaceId: 'tasks-save',
          command: 'tasks save',
          action: 'scheduledTask',
          argsSchema: { type: 'array', maxItems: 0, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: {
              json: { type: 'boolean' },
              title: { type: 'string', minLength: 1 },
              prompt: { type: 'string', minLength: 1 },
            },
            required: ['title', 'prompt'],
            additionalProperties: true,
          },
        },
      ],
    });

    await expect(runProtocolCli(['tasks', 'save', 'extra', '--title', 'Task', '--prompt', 'hello', '--json'])).resolves.toBe(
      PROTOCOL_CLI_EXIT_CODES.usage,
    );

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Expected at most 0 positional arguments'));
  });

  it('validates required background command start flags before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-runs',
          surfaceId: 'background-commands-start',
          command: 'background-commands start',
          action: 'background_bash',
          argsSchema: { type: 'array', items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: {
              json: { type: 'boolean' },
              command: { type: 'string', minLength: 1 },
              cwd: { type: 'string', minLength: 1 },
              'task-slug': { type: 'string', minLength: 1 },
            },
            required: ['command'],
            additionalProperties: true,
          },
        },
      ],
    });

    await expect(runProtocolCli(['background-commands', 'start', '--json'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Missing required flag --command'));
  });

  it('rejects positional args for flag-only background command starts before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-runs',
          surfaceId: 'background-commands-start',
          command: 'background-commands start',
          action: 'background_bash',
          argsSchema: { type: 'array', maxItems: 0, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: {
              json: { type: 'boolean' },
              command: { type: 'string', minLength: 1 },
            },
            required: ['command'],
            additionalProperties: true,
          },
        },
      ],
    });

    await expect(runProtocolCli(['background-commands', 'start', 'extra', '--command', 'echo ok', '--json'])).resolves.toBe(
      PROTOCOL_CLI_EXIT_CODES.usage,
    );

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Expected at most 0 positional arguments'));
  });

  it('validates background command log run id before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-runs',
          surfaceId: 'background-commands-logs',
          command: 'background-commands logs',
          action: 'background_bash',
          argsSchema: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: { json: { type: 'boolean' }, tail: { type: 'number', minimum: 1, maximum: 1000 } },
            additionalProperties: true,
          },
        },
      ],
    });

    await expect(runProtocolCli(['background-commands', 'logs', '--tail', '25', '--json'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Expected at least 1 positional argument'));
  });

  it('accepts background command log tail flags before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-runs',
          surfaceId: 'background-commands-logs',
          command: 'background-commands logs',
          action: 'background_bash',
          argsSchema: { type: 'array', minItems: 1, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: { json: { type: 'boolean' }, tail: { type: 'number', minimum: 1, maximum: 1000 } },
            additionalProperties: true,
          },
        },
      ],
    });

    await expect(runProtocolCli(['background-commands', 'logs', 'run-agent', '--tail', '25', '--json'])).resolves.toBe(0);

    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: 'system-runs',
        actionId: 'background_bash',
        input: expect.objectContaining({
          action: 'logs',
          cli: expect.objectContaining({
            command: 'background-commands logs',
            args: ['run-agent'],
            flags: { tail: '25' },
            json: true,
          }),
        }),
      }),
    );
  });

  it('rejects invalid background command log tail flags before dispatch', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-runs',
          surfaceId: 'background-commands-logs',
          command: 'background-commands logs',
          action: 'background_bash',
          argsSchema: { type: 'array', minItems: 1, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: { json: { type: 'boolean' }, tail: { type: 'number', minimum: 1, maximum: 1000 } },
            additionalProperties: true,
          },
        },
      ],
    });

    await expect(runProtocolCli(['background-commands', 'logs', 'run-agent', '--tail', 'many', '--json'])).resolves.toBe(
      PROTOCOL_CLI_EXIT_CODES.usage,
    );

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('--tail must be a number.'));
  });

  it('requires --yes for destructive contributed commands in non-interactive mode', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-conversation-tools',
          surfaceId: 'conversations-delete',
          command: 'conversations delete',
          action: 'conversationTool',
          mode: 'destructive',
          destructive: true,
          supportsDryRun: true,
          argsSchema: { type: 'array', minItems: 1, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: { yes: { type: 'boolean' }, 'dry-run': { type: 'boolean' } },
            additionalProperties: false,
          },
        },
      ],
    });

    await expect(runProtocolCli(['conversations', 'delete', 'conv-1', '--json'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);

    expect(extensionHostClient.invokeAction).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('"code": "confirmation_required"'));
  });

  it('streams contributed command updates as JSONL', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-conversation-tools',
          surfaceId: 'conversations-run-turn',
          command: 'conversations run-turn',
          action: 'conversationTool',
          mode: 'streaming',
          outputModes: ['text', 'json', 'jsonl'],
          argsSchema: { type: 'array', minItems: 1, items: { type: 'string' } },
          flagsSchema: {
            type: 'object',
            properties: { text: { type: 'string' }, format: { enum: ['text', 'json', 'jsonl'] }, follow: { type: 'boolean' } },
            additionalProperties: false,
          },
        },
      ],
    });
    extensionHostClient.invokeAction.mockImplementationOnce(async (input) => {
      input.toolContext?.onUpdate?.({
        content: [{ type: 'text', text: 'Hello' }],
        details: { event: { type: 'text_delta', delta: 'Hello' } },
      });
      return { ok: true, result: { accepted: true } };
    });

    await expect(runProtocolCli(['conversations', 'run-turn', 'conv-1', '--text', 'Go', '--format', 'jsonl', '--follow'])).resolves.toBe(0);

    expect(stdoutWrite).toHaveBeenNthCalledWith(1, expect.stringContaining('"event":"update"'));
    expect(stdoutWrite).toHaveBeenLastCalledWith(expect.stringContaining('"event":"result"'));
  });

  it('dispatches extension-contributed CLI commands through extension actions', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-extension-manager',
          surfaceId: 'extensions-validate',
          command: 'extensions validate',
          action: 'manageExtension',
        },
      ],
    });
    extensionHostClient.invokeAction.mockResolvedValueOnce({ ok: true, result: { text: 'Validated system-knowledge.' } });

    await expect(runProtocolCli(['extensions', 'validate', 'system-knowledge', '--json'])).resolves.toBe(0);

    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: 'system-extension-manager',
        actionId: 'manageExtension',
        input: {
          action: 'validate',
          cli: {
            command: 'extensions validate',
            rawArgv: ['system-knowledge'],
            args: ['system-knowledge'],
            flags: {},
            json: true,
            cwd: process.cwd(),
          },
        },
      }),
    );
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Validated system-knowledge'));
  });

  it('passes the final command token as a generic action hint for extension CLI handlers', async () => {
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-settings',
          surfaceId: 'settings-set',
          command: 'settings set',
          action: 'manageSettings',
        },
      ],
    });

    await expect(runProtocolCli(['settings', 'set', 'conversation.pinnedToolCalls', 'false'])).resolves.toBe(0);

    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: 'system-settings',
        actionId: 'manageSettings',
        input: expect.objectContaining({
          action: 'set',
          cli: expect.objectContaining({
            command: 'settings set',
            args: ['conversation.pinnedToolCalls', 'false'],
            json: false,
          }),
        }),
      }),
    );
  });

  it('passes stdin to contributed CLI actions only when requested', async () => {
    const originalStdin = process.stdin;
    const stdin = new PassThrough();
    Object.defineProperty(process, 'stdin', { value: stdin, configurable: true });
    extensionHostClient.readRegistryPresentation.mockResolvedValueOnce({
      cliCommandRegistrations: [
        {
          extensionId: 'system-neon-pilot-admin-cli',
          surfaceId: 'bootstrap-provider-set-key',
          command: 'bootstrap provider set-key',
          action: 'neonPilotAgent',
          jsonDefault: true,
        },
      ],
    });
    stdin.end('sk-secret\n');

    await expect(runProtocolCli(['bootstrap', 'provider', 'set-key', 'openai', '--stdin'])).resolves.toBe(0);

    expect(extensionHostClient.invokeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          cli: expect.objectContaining({
            args: ['openai'],
            flags: { stdin: true },
            json: false,
            stdinText: 'sk-secret\n',
          }),
        }),
      }),
    );
    Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
  });

  it('reports CLI install status as a built-in command', async () => {
    await expect(runProtocolCli(['cli', 'status', '--json'])).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('"binDir"'));
  });

  it('supports dry-run for built-in CLI install management', async () => {
    await expect(runProtocolCli(['cli', 'install', '--dry-run'])).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Dry run: would install'));
  });

  it('maps extension protocol errors to specific exit codes', async () => {
    const cases: Array<[string, number]> = [
      ['No enabled extension provides protocol entrypoint acp', PROTOCOL_CLI_EXIT_CODES.notFound],
      ['Multiple enabled extensions provide protocol entrypoint acp', PROTOCOL_CLI_EXIT_CODES.ambiguous],
      ['extension failed to compile', PROTOCOL_CLI_EXIT_CODES.loadFailure],
      ['extension is not installed', PROTOCOL_CLI_EXIT_CODES.loadFailure],
      ['extension has no backend entry', PROTOCOL_CLI_EXIT_CODES.loadFailure],
      ['runtime exploded', PROTOCOL_CLI_EXIT_CODES.runtimeFailure],
    ];

    for (const [message, code] of cases) {
      extensionHostClient.invokeProtocolEntrypoint.mockRejectedValueOnce(new Error(message));
      await expect(runProtocolCli(['protocol', 'acp'])).resolves.toBe(code);
      expect(stderrWrite).toHaveBeenLastCalledWith(`${message}\n`);
    }
  });

  it('main sets process.exitCode from run result', async () => {
    extensionHostClient.invokeProtocolEntrypoint.mockRejectedValueOnce(new Error('runtime exploded'));
    await main(['protocol', 'acp']);
    expect(process.exitCode).toBe(PROTOCOL_CLI_EXIT_CODES.runtimeFailure);
  });
});
