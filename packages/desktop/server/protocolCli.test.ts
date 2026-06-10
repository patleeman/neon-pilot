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

vi.mock('@neon-pilot/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@neon-pilot/core')>()),
  ...core,
}));
vi.mock('./app/runtimeState.js', () => runtime);
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

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL;
    delete process.env.NEON_PILOT_EXTENSION_HOST_TOKEN;
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
    cliControlPlane.readNeonPilotCliControlPlaneRecord.mockReturnValue(null);
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
          extensionId: 'system-neon-pilot-agent',
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
