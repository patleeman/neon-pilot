import { pathToFileURL } from 'node:url';

import { getPiAgentRuntimeDir } from '@neon-pilot/core';

import { createRuntimeState } from './app/runtimeState.js';
import { getExtensionHostClient } from './extensions/extensionHostClient.js';
import type { ExtensionHostBackendServerContext } from './extensions/extensionHostProtocol.js';

export const PROTOCOL_CLI_EXIT_CODES = {
  usage: 1,
  notFound: 2,
  ambiguous: 3,
  loadFailure: 4,
  runtimeFailure: 5,
} as const;

function buildServerContext(): ExtensionHostBackendServerContext {
  const repoRoot = process.cwd();
  const runtimeState = createRuntimeState({
    repoRoot,
    agentDir: getPiAgentRuntimeDir(),
    logger: {
      warn: (message, fields) => {
        const suffix = fields ? ` ${JSON.stringify(fields)}` : '';
        process.stderr.write(`[protocol] ${message}${suffix}\n`);
      },
    },
  });

  return {
    getRuntimeScope: runtimeState.getRuntimeScope,
    buildLiveSessionResourceOptions: () => runtimeState.buildLiveSessionResourceOptions(),
    getRepoRoot: () => repoRoot,
  };
}

function usage(): string {
  return ['Usage: neon-pilot protocol <protocol-id>', '', 'Example: neon-pilot protocol acp'].join('\n');
}

function classifyError(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('No enabled extension provides protocol entrypoint')) return PROTOCOL_CLI_EXIT_CODES.notFound;
  if (message.includes('Multiple enabled extensions provide protocol entrypoint')) return PROTOCOL_CLI_EXIT_CODES.ambiguous;
  if (message.includes('failed to compile') || message.includes('is not installed') || message.includes('has no backend entry')) {
    return PROTOCOL_CLI_EXIT_CODES.loadFailure;
  }
  return PROTOCOL_CLI_EXIT_CODES.runtimeFailure;
}

export async function runProtocolCli(argv: string[], options?: { signal?: AbortSignal }): Promise<number> {
  const [command, protocolId, ...protocolArgs] = argv;
  if (command !== 'protocol' || !protocolId) {
    process.stderr.write(`${usage()}\n`);
    return PROTOCOL_CLI_EXIT_CODES.usage;
  }

  const stdinCloseController = new AbortController();
  const signal = options?.signal ?? stdinCloseController.signal;
  const abortOnStdinClose = () => stdinCloseController.abort();
  if (!options?.signal) {
    process.stdin.once('close', abortOnStdinClose);
    process.stdin.once('end', abortOnStdinClose);
  }

  try {
    await getExtensionHostClient().invokeProtocolEntrypoint({
      protocolId,
      input: { args: protocolArgs },
      serverContext: buildServerContext(),
      stdio: {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      },
      signal,
    });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return classifyError(error);
  } finally {
    if (!options?.signal) {
      process.stdin.off('close', abortOnStdinClose);
      process.stdin.off('end', abortOnStdinClose);
    }
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const code = await runProtocolCli(argv);
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
