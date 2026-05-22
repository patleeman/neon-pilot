import { beforeEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ getPiAgentRuntimeDir: vi.fn(() => '/agent') }));
const runtime = vi.hoisted(() => ({
  createRuntimeState: vi.fn(() => ({
    getRuntimeScope: vi.fn(() => 'shared'),
    buildLiveSessionResourceOptions: vi.fn(() => ({ additionalSkillPaths: ['/skills'] })),
  })),
}));
const backend = vi.hoisted(() => ({ invokeExtensionProtocolEntrypoint: vi.fn(async () => undefined) }));

vi.mock('@neon-pilot/core', () => core);
vi.mock('./app/runtimeState.js', () => runtime);
vi.mock('./extensions/extensionBackend.js', () => backend);

import { main, PROTOCOL_CLI_EXIT_CODES, runProtocolCli } from './protocolCli.js';

describe('protocol CLI', () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });

  it('prints usage and returns usage exit code for invalid invocations', async () => {
    await expect(runProtocolCli([])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);
    await expect(runProtocolCli(['other', 'acp'])).resolves.toBe(PROTOCOL_CLI_EXIT_CODES.usage);
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Usage: neon-pilot protocol <protocol-id>\n'));
    expect(backend.invokeExtensionProtocolEntrypoint).not.toHaveBeenCalled();
  });

  it('invokes protocol entrypoints with args, stdio, signal, and server context', async () => {
    const controller = new AbortController();

    await expect(runProtocolCli(['protocol', 'acp', '--stdio'], { signal: controller.signal })).resolves.toBe(0);

    expect(runtime.createRuntimeState).toHaveBeenCalledWith({
      repoRoot: process.cwd(),
      agentDir: '/agent',
      logger: { warn: expect.any(Function) },
    });
    expect(backend.invokeExtensionProtocolEntrypoint).toHaveBeenCalledWith(
      'acp',
      { args: ['--stdio'] },
      expect.objectContaining({
        serverContext: expect.objectContaining({
          getRuntimeScope: expect.any(Function),
          buildLiveSessionResourceOptions: expect.any(Function),
          getRepoRoot: expect.any(Function),
        }),
        stdio: { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr },
        signal: controller.signal,
      }),
    );
    const serverContext = backend.invokeExtensionProtocolEntrypoint.mock.calls[0][2].serverContext;
    expect(serverContext.getRepoRoot()).toBe(process.cwd());
    expect(serverContext.buildLiveSessionResourceOptions()).toEqual({ additionalSkillPaths: ['/skills'] });
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
      backend.invokeExtensionProtocolEntrypoint.mockRejectedValueOnce(new Error(message));
      await expect(runProtocolCli(['protocol', 'acp'])).resolves.toBe(code);
      expect(stderrWrite).toHaveBeenLastCalledWith(`${message}\n`);
    }
  });

  it('main sets process.exitCode from run result', async () => {
    backend.invokeExtensionProtocolEntrypoint.mockRejectedValueOnce(new Error('runtime exploded'));
    await main(['protocol', 'acp']);
    expect(process.exitCode).toBe(PROTOCOL_CLI_EXIT_CODES.runtimeFailure);
  });
});
