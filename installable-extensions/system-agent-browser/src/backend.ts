import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

interface AgentBrowserInput {
  command: string;
  args?: string[];
  session?: string;
  native?: boolean;
  headed?: boolean;
  platform?: 'chromium' | 'chrome' | 'firefox' | 'webkit' | 'ios';
  timeoutSeconds?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_CHARS = 60_000;
const STALE_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const AGENT_BROWSER_DIR = join(homedir(), '.agent-browser');
const COMMAND_PATTERN = /^[a-z][a-z0-9:-]*$/i;

function readInput(input: unknown): AgentBrowserInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input must be an object.');
  const record = input as Record<string, unknown>;
  if (typeof record.command !== 'string' || !COMMAND_PATTERN.test(record.command)) {
    throw new Error('command must be a valid agent-browser command name.');
  }
  if (record.args !== undefined && (!Array.isArray(record.args) || record.args.some((arg) => typeof arg !== 'string'))) {
    throw new Error('args must be an array of strings.');
  }
  if (record.session !== undefined && typeof record.session !== 'string') throw new Error('session must be a string.');
  if (record.native !== undefined && typeof record.native !== 'boolean') throw new Error('native must be a boolean.');
  if (record.headed !== undefined && typeof record.headed !== 'boolean') throw new Error('headed must be a boolean.');
  if (record.platform !== undefined && typeof record.platform !== 'string') throw new Error('platform must be a string.');
  if (record.timeoutSeconds !== undefined && typeof record.timeoutSeconds !== 'number') {
    throw new Error('timeoutSeconds must be a number.');
  }
  return record as unknown as AgentBrowserInput;
}

function shouldUseNative(input: AgentBrowserInput): boolean {
  if (input.native !== undefined) return input.native;
  return ['open', 'goto', 'navigate', 'connect', 'device', 'session'].includes(input.command);
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function removeIfPresent(path: string): Promise<void> {
  await rm(path, { force: true }).catch(() => undefined);
}

async function cleanupStaleAgentBrowserSessions(ctx: ExtensionBackendContext, ttlMs = STALE_SESSION_TTL_MS): Promise<void> {
  if (ttlMs <= 0) return;
  const entries = (await readdir(AGENT_BROWSER_DIR).catch(() => [])).filter((entry) => entry.endsWith('.pid'));
  const now = Date.now();
  await Promise.all(
    entries.map(async (entry) => {
      const session = entry.slice(0, -4);
      const pidPath = join(AGENT_BROWSER_DIR, entry);
      const sockPath = join(AGENT_BROWSER_DIR, `${session}.sock`);
      const stats = await stat(pidPath).catch(() => null);
      if (!stats || now - stats.mtimeMs < ttlMs) return;

      const pid = Number.parseInt((await readFile(pidPath, 'utf8').catch(() => '')).trim(), 10);
      if (!isPidAlive(pid)) {
        await removeIfPresent(pidPath);
        await removeIfPresent(sockPath);
        return;
      }

      await ctx.shell
        .exec({ command: 'agent-browser', args: ['--session', session, 'close'], timeoutMs: 5_000 })
        .catch(() => undefined);
      if (isPidAlive(pid)) process.kill(pid, 'SIGTERM');
      await removeIfPresent(pidPath);
      await removeIfPresent(sockPath);
    }),
  );
}

function resolveDefaultSession(ctx: ExtensionBackendContext): string {
  const conversationId = ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? '';
  const suffix = conversationId.trim() ? conversationId.replace(/[^a-z0-9._-]/gi, '-').slice(0, 48) : 'default';
  return `neon-pilot-${suffix}`;
}

function truncateOutput(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) return { text, truncated: false };
  return {
    text: `${text.slice(0, MAX_OUTPUT_CHARS)}\n\n[Truncated: showing first ${MAX_OUTPUT_CHARS} of ${text.length} characters]`,
    truncated: true,
  };
}

export async function runAgentBrowser(input: unknown, ctx: ExtensionBackendContext) {
  const parsed = readInput(input);
  const args: string[] = [];
  const session = parsed.session?.trim() || resolveDefaultSession(ctx);
  if (shouldUseNative(parsed)) args.push('--native');
  if (parsed.headed) args.push('--headed');
  args.push('--session', session);
  if (parsed.platform) args.push('-p', parsed.platform);
  args.push(parsed.command, ...(parsed.args ?? []));

  const timeoutMs = Math.min(Math.max((parsed.timeoutSeconds ?? DEFAULT_TIMEOUT_MS / 1000) * 1000, 1_000), MAX_TIMEOUT_MS);

  try {
    await cleanupStaleAgentBrowserSessions(ctx);
    const result = await ctx.shell.exec({
      command: 'agent-browser',
      args,
      timeoutMs,
    });
    const combined = [result.stdout?.trimEnd(), result.stderr?.trimEnd()].filter(Boolean).join('\n');
    const formatted = truncateOutput(combined || '(no output)');
    return {
      content: [{ type: 'text', text: formatted.text }],
      details: { command: ['agent-browser', ...args], truncated: formatted.truncated, executionWrappers: result.executionWrappers ?? [] },
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
      isError: true,
      details: { command: ['agent-browser', ...args] },
    };
  }
}
