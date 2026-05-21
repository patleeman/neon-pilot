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
  if (shouldUseNative(parsed)) args.push('--native');
  if (parsed.headed) args.push('--headed');
  if (parsed.session) args.push('--session', parsed.session);
  if (parsed.platform) args.push('-p', parsed.platform);
  args.push(parsed.command, ...(parsed.args ?? []));

  const timeoutMs = Math.min(Math.max((parsed.timeoutSeconds ?? DEFAULT_TIMEOUT_MS / 1000) * 1000, 1_000), MAX_TIMEOUT_MS);

  try {
    const result = await ctx.shell.exec({
      command: 'agent-browser',
      args,
      timeoutMs,
      signal: ctx.agentToolContext?.signal,
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
