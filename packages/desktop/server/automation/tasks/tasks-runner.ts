import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, type WriteStream } from 'fs';
import { join } from 'path';

import { buildBackgroundAgentArgv } from '../../daemon/background-run-agent.js';
import type { ParsedTaskDefinition } from './tasks-parser.js';

interface TaskRunThreadBinding {
  threadMode?: 'dedicated' | 'existing' | 'none';
  threadSessionFile?: string;
  threadConversationId?: string;
}

export type RunnableTaskDefinition = ParsedTaskDefinition &
  TaskRunThreadBinding & {
    targetType?: 'background-agent' | 'conversation';
    conversationBehavior?: 'steer' | 'followUp';
  };

const MAX_CAPTURED_OUTPUT_CHARS = 16_000;
const PRIVATE_TASK_LOG_FILE_MODE = 0o600;

export interface TaskRunRequest {
  task: RunnableTaskDefinition;
  attempt: number;
  runsRoot: string;
  signal?: AbortSignal;
}

export interface TaskRunResult {
  success: boolean;
  startedAt: string;
  endedAt: string;
  exitCode: number;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  cancelled: boolean;
  logPath: string;
  error?: string;
  outputText?: string;
}

interface CapturedOutputBuffer {
  append(chunk: string): void;
  value(): string | undefined;
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return sanitized.length > 0 ? sanitized : 'task';
}

function toTimestampKey(timestamp: string): string {
  return timestamp.replace(/[:.]/g, '-');
}

function closeStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve) => {
    stream.end(() => resolve());
  });
}

function writeLine(stream: WriteStream, message: string): void {
  stream.write(`${message}\n`);
}

function createCapturedOutputBuffer(): CapturedOutputBuffer {
  let captured = '';
  let truncated = false;

  return {
    append(chunk: string) {
      if (chunk.length === 0 || captured.length >= MAX_CAPTURED_OUTPUT_CHARS) {
        if (chunk.length > 0) {
          truncated = true;
        }
        return;
      }

      const remaining = MAX_CAPTURED_OUTPUT_CHARS - captured.length;
      if (chunk.length <= remaining) {
        captured += chunk;
        return;
      }

      captured += chunk.slice(0, remaining);
      truncated = true;
    },
    value() {
      const trimmed = captured.trim();
      if (trimmed.length === 0) {
        return undefined;
      }

      return truncated ? `${trimmed}\n\n[output truncated]` : trimmed;
    },
  };
}

function readExactReplyPrompt(prompt: string): string | undefined {
  const match = prompt.trim().match(/^(?:reply|say|output|respond)\s+exactly\s*:?\s*([\s\S]+)$/i);
  const exactText = match?.[1]?.trim();
  return exactText && exactText.length > 0 ? exactText : undefined;
}

function formatStandaloneTaskSystemPromptSupplement(prompt: string): string | undefined {
  const exactText = readExactReplyPrompt(prompt);
  if (!exactText) {
    return undefined;
  }

  return [
    'For this automation run, the next user message is an exact-response task.',
    'Your entire assistant response must be exactly the text between <exact_reply> and </exact_reply>.',
    'Do not explain, quote, add punctuation, mention these instructions, or include any other text.',
    '<exact_reply>',
    exactText,
    '</exact_reply>',
  ].join('\n');
}

function normalizeCapturedOutputText(task: RunnableTaskDefinition, outputText: string | undefined): string | undefined {
  const exactText = readExactReplyPrompt(task.prompt);
  if (!exactText || !outputText?.includes(exactText)) {
    return outputText;
  }

  return exactText;
}

async function runTaskWithStandaloneAgent(input: {
  task: RunnableTaskDefinition;
  startedAt: string;
  logPath: string;
  stream: WriteStream;
  capture: CapturedOutputBuffer;
  signal?: AbortSignal;
}): Promise<TaskRunResult> {
  const { task, startedAt, logPath, stream, capture, signal } = input;
  const shouldWriteSession = task.threadMode !== 'none' && Boolean(task.threadSessionFile);
  const systemPromptSupplement = formatStandaloneTaskSystemPromptSupplement(task.prompt);
  const argv = buildBackgroundAgentArgv({
    prompt: task.prompt,
    ...(systemPromptSupplement ? { systemPromptSupplement } : {}),
    ...(task.modelRef ? { model: task.modelRef } : {}),
    ...(task.allowedTools && task.allowedTools.length > 0 ? { allowedTools: task.allowedTools } : {}),
    ...(!shouldWriteSession ? { noSession: true } : {}),
  });
  argv.push('--cwd', task.cwd ?? process.cwd());
  if (shouldWriteSession && task.threadSessionFile) {
    argv.push('--session-file', task.threadSessionFile);
  }

  writeLine(stream, '# mode=standalone-agent-runner');
  if (shouldWriteSession && task.threadSessionFile) {
    writeLine(stream, `# sessionFile=${task.threadSessionFile}`);
  }
  writeLine(stream, `# command=${argv.map((part) => JSON.stringify(part)).join(' ')}`);
  writeLine(stream, '');

  if (signal?.aborted) {
    const endedAt = new Date().toISOString();
    return {
      success: false,
      startedAt,
      endedAt,
      exitCode: 1,
      signal: null,
      timedOut: false,
      cancelled: true,
      logPath,
      error: 'Task run cancelled before dispatch',
      outputText: capture.value(),
    };
  }

  return await new Promise<TaskRunResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let cancelled = false;
    const timers: { timeout?: NodeJS.Timeout } = {};

    const finish = (details: { exitCode: number | null; signal: NodeJS.Signals | null; error?: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timers.timeout) clearTimeout(timers.timeout);
      signal?.removeEventListener('abort', onAbort);
      const endedAt = new Date().toISOString();
      const exitCode = details.exitCode ?? (details.signal ? 1 : 0);
      const error = details.error ?? (exitCode === 0 ? undefined : `Standalone agent exited with code ${exitCode}.`);
      resolve({
        success: exitCode === 0 && !cancelled && !timedOut,
        startedAt,
        endedAt,
        exitCode,
        signal: details.signal,
        timedOut,
        cancelled,
        logPath,
        ...(error ? { error } : {}),
        outputText: normalizeCapturedOutputText(task, capture.value()),
      });
    };

    const child = spawn(argv[0] as string, argv.slice(1), {
      cwd: task.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onAbort = () => {
      cancelled = true;
      child.kill('SIGTERM');
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    timers.timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, task.timeoutSeconds * 1000);

    child.stdout?.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stream.write(text);
      capture.append(text);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stream.write(text);
      capture.append(text);
    });
    child.once('error', (error) => finish({ exitCode: 1, signal: null, error: error.message }));
    child.once('close', (code, closeSignal) => {
      const error = cancelled
        ? 'Task run cancelled'
        : timedOut
          ? `Task timed out after ${task.timeoutSeconds}s`
          : code === 0
            ? undefined
            : `Standalone agent exited with code ${code ?? 1}.`;
      finish({ exitCode: code, signal: closeSignal, error });
    });
  });
}

export async function runTaskInIsolatedPi(request: TaskRunRequest): Promise<TaskRunResult> {
  const startedAt = new Date().toISOString();
  const logDir = join(request.runsRoot, sanitizePathSegment(request.task.id));
  const logPath = join(logDir, `${toTimestampKey(startedAt)}-attempt-${request.attempt}.log`);

  mkdirSync(logDir, { recursive: true, mode: 0o700 });

  const stream = createWriteStream(logPath, { flags: 'a', encoding: 'utf-8', mode: PRIVATE_TASK_LOG_FILE_MODE });
  const capture = createCapturedOutputBuffer();
  let result: TaskRunResult | undefined;

  writeLine(stream, `# task=${request.task.id}`);
  if (request.task.title) {
    writeLine(stream, `# title=${request.task.title}`);
  }
  if (!request.task.filePath.startsWith('/__automations__/')) {
    writeLine(stream, `# file=${request.task.filePath}`);
  }
  writeLine(stream, `# profile=${request.task.profile}`);
  writeLine(stream, `# attempt=${request.attempt}`);
  writeLine(stream, `# startedAt=${startedAt}`);
  writeLine(stream, '');

  try {
    if (request.signal?.aborted) {
      const endedAt = new Date().toISOString();
      writeLine(stream, '# cancelled before standalone agent dispatch');
      result = {
        success: false,
        startedAt,
        endedAt,
        exitCode: 1,
        signal: null,
        timedOut: false,
        cancelled: true,
        logPath,
        error: 'Task run cancelled before dispatch',
        outputText: capture.value(),
      };
      return result;
    }

    result = await runTaskWithStandaloneAgent({
      task: request.task,
      startedAt,
      logPath,
      signal: request.signal,
      stream,
      capture,
    });
    return result;
  } catch (error) {
    const endedAt = new Date().toISOString();
    const message = (error as Error).message;

    writeLine(stream, '');
    writeLine(stream, `# fatal error=${message}`);

    result = {
      success: false,
      startedAt,
      endedAt,
      exitCode: 1,
      signal: null,
      timedOut: false,
      cancelled: false,
      logPath,
      error: message,
      outputText: capture.value(),
    };

    return result;
  } finally {
    if (result) {
      writeLine(stream, '');
      writeLine(stream, `# endedAt=${result.endedAt}`);
      writeLine(stream, `# success=${result.success}`);
      if (result.error) {
        writeLine(stream, `# error=${result.error}`);
      }
    }
    await closeStream(stream);
  }
}
