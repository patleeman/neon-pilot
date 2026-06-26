import type { AgentSession } from '@earendil-works/pi-coding-agent';

import { listProcessWrappers } from '../shared/processLauncher.js';
import { createConversationBashOperations } from './liveSessionBashProcesses.js';
import type { SseEvent } from './liveSessionEvents.js';

let syntheticBashExecutionCounter = 0;
const activeBashSessionIds = new Set<string>();

export interface LiveSessionBashHost {
  sessionId: string;
  cwd?: string;
  session: Pick<AgentSession, 'isBashRunning' | 'executeBash'>;
}

export async function executeLiveSessionBash(
  host: LiveSessionBashHost,
  command: string,
  options: {
    excludeFromContext?: boolean;
    signal?: AbortSignal;
    broadcast: (event: SseEvent) => void;
  },
): Promise<{ result: unknown; normalizedCommand: string }> {
  const normalizedCommand = command.trim();
  if (!normalizedCommand) {
    throw new Error('command required');
  }
  if (activeBashSessionIds.has(host.sessionId) || host.session.isBashRunning) {
    throw new Error('A bash command is already running.');
  }

  activeBashSessionIds.add(host.sessionId);
  const toolCallId = `user-bash-${host.sessionId}-${Date.now()}-${++syntheticBashExecutionCounter}`;
  const startedAtMs = Date.now();
  const eventArgs: Record<string, unknown> = {
    command: normalizedCommand,
    displayMode: 'terminal',
    ...(options.excludeFromContext ? { excludeFromContext: true } : {}),
  };

  let streamedOutput = '';
  try {
    options.broadcast({ type: 'tool_start', toolCallId, toolName: 'bash', args: eventArgs });

    const appendChunk = (chunk: unknown) => {
      if (!chunk) {
        return;
      }

      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      streamedOutput += text;
      options.broadcast({ type: 'tool_update', toolCallId, partialResult: text });
    };

    const result = host.cwd
      ? await createConversationBashOperations({ conversationId: host.sessionId }).exec(normalizedCommand, host.cwd, {
          onData: appendChunk,
          signal: options.signal,
          env: {
            ...process.env,
            NEON_PILOT_SOURCE_CONVERSATION_ID: host.sessionId,
          },
        })
      : await host.session.executeBash(
          normalizedCommand,
          (chunk) => {
            appendChunk(chunk);
          },
          { excludeFromContext: options.excludeFromContext === true },
        );

    const normalizedResult =
      host.cwd && result && typeof result === 'object'
        ? {
            output: streamedOutput,
            exitCode: (result as { exitCode?: unknown }).exitCode,
            ...((result as { exitCode?: unknown }).exitCode === null ? { cancelled: true } : {}),
          }
        : result;

    const bashResult = normalizedResult as {
      output?: unknown;
      exitCode?: unknown;
      cancelled?: unknown;
      truncated?: unknown;
      fullOutputPath?: unknown;
    };
    const details = {
      displayMode: 'terminal',
      executionWrappers: listProcessWrappers(),
      ...(typeof bashResult.exitCode === 'number' ? { exitCode: bashResult.exitCode } : {}),
      ...(bashResult.cancelled === true ? { cancelled: true } : {}),
      ...(bashResult.truncated === true ? { truncated: true } : {}),
      ...(typeof bashResult.fullOutputPath === 'string' && bashResult.fullOutputPath.trim().length > 0
        ? { fullOutputPath: bashResult.fullOutputPath }
        : {}),
      ...(options.excludeFromContext ? { excludeFromContext: true } : {}),
    };
    const output = typeof bashResult.output === 'string' ? bashResult.output : streamedOutput;

    options.broadcast({
      type: 'tool_end',
      toolCallId,
      toolName: 'bash',
      isError: false,
      durationMs: Date.now() - startedAtMs,
      output,
      ...(Object.keys(details).length > 0 ? { details } : {}),
    });

    return { result: normalizedResult, normalizedCommand };
  } catch (error) {
    const details = {
      displayMode: 'terminal',
      executionWrappers: listProcessWrappers(),
      ...(options.excludeFromContext ? { excludeFromContext: true } : {}),
    };
    options.broadcast({
      type: 'tool_end',
      toolCallId,
      toolName: 'bash',
      isError: true,
      durationMs: Date.now() - startedAtMs,
      output: error instanceof Error ? error.message : String(error),
      details,
    });
    throw error;
  } finally {
    activeBashSessionIds.delete(host.sessionId);
  }
}
