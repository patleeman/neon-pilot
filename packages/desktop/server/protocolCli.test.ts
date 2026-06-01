import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ getPiAgentRuntimeDir: vi.fn(() => '/agent') }));
const runtime = vi.hoisted(() => ({
  createRuntimeState: vi.fn(() => ({
    getRuntimeScope: vi.fn(() => 'shared'),
    buildLiveSessionResourceOptions: vi.fn(() => ({ additionalSkillPaths: ['/skills'] })),
  })),
}));
const extensionHostClient = vi.hoisted(() => ({ invokeProtocolEntrypoint: vi.fn(async () => undefined) }));
const extensionHostRpcClient = vi.hoisted(() => ({
  createExtensionHostRpcClient: vi.fn(() => extensionHostClient),
}));

vi.mock('@neon-pilot/core', () => core);
vi.mock('./app/runtimeState.js', () => runtime);
vi.mock('./extensions/extensionHostClient.js', () => ({
  getExtensionHostClient: () => extensionHostClient,
  setExtensionHostClient: vi.fn(),
}));
vi.mock('./extensions/extensionHostRpcClient.js', () => extensionHostRpcClient);

import { main, PROTOCOL_CLI_EXIT_CODES, runProtocolCli } from './protocolCli.js';

describe('protocol CLI', () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEON_PILOT_EXTENSION_HOST_BASE_URL;
    delete process.env.NEON_PILOT_EXTENSION_HOST_TOKEN;
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  it('prints usage and returns usage exit code for invalid invocations', async () => {
    await expect(runProtocolCli([])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);
    await expect(runProtocolCli(['other', 'acp'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Usage: neon-pilot protocol <protocol-id>\n'));
    expect(extensionHostClient.invokeProtocolEntrypoint).not.toHaveBeenCalled();
  });

  it('invokes protocol entrypoints with args, stdio, signal, and server context snapshot', async () => {
    const controller = new AbortController();

    await expect(runProtocolCli(['protocol', 'acp', '--stdio'], { signal: controller.signal })).resolves.toBe(0);

    expect(runtime.createRuntimeState).toHaveBeenCalledWith({
      repoRoot: process.cwd(),
      agentDir: '/agent',
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
