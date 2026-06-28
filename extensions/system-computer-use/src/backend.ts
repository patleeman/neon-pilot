import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { callMcpToolDirect } from '@neon-pilot/extensions/backend/mcp';

type ComputerUseAction = 'status' | 'doctor' | 'capture' | 'window_state' | 'click' | 'type' | 'key' | 'scroll' | 'drag' | 'focus_app';

type ComputerUseInput = {
  action: ComputerUseAction;
  tool?: string;
  arguments?: Record<string, unknown>;
  pid?: number;
  window_id?: number;
  element?: number;
  x?: number;
  y?: number;
  text?: string;
  keys?: string;
  button?: string;
  capture_after?: boolean;
};

type McpOperationResult<T = unknown> = {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
  data?: T;
};

type CuaDriverResolution = {
  command: string;
  env: Record<string, string>;
};

const CUA_DRIVER_COMMAND = 'cua-driver';
const CUA_DRIVER_PATH_DIRS = [`${process.env.HOME ?? ''}/.local/bin`, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean);

function buildCuaDriverEnv(): Record<string, string> {
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const pathEntries = [...CUA_DRIVER_PATH_DIRS, env.PATH ?? ''].filter(Boolean);
  return {
    ...env,
    PATH: pathEntries.join(':'),
    CUA_DRIVER_RS_TELEMETRY_ENABLED: '0',
  };
}

function resolveCuaDriver(command = CUA_DRIVER_COMMAND): CuaDriverResolution {
  return { command, env: buildCuaDriverEnv() };
}

function cuaServerConfig(resolution = resolveCuaDriver()) {
  return {
    name: 'cua-driver',
    transport: 'stdio' as const,
    command: resolution.command,
    args: ['mcp'],
    env: resolution.env,
    raw: { allowToolCalls: true },
  };
}

const MUTATING_ACTIONS = new Set<ComputerUseAction>(['click', 'type', 'key', 'scroll', 'drag', 'focus_app']);
const BLOCKED_KEY_PATTERNS = [/lock/i, /logout/i, /log\s*out/i, /force\s*quit/i, /delete/i, /trash/i];
const BLOCKED_TEXT_PATTERNS = [
  /curl\s+[^\n|]+\|\s*(ba)?sh/i,
  /wget\s+[^\n|]+\|\s*(ba)?sh/i,
  /sudo\s+rm\s+-rf\s+\//i,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCuaDriverUnavailable(error: unknown): boolean {
  const message = messageFrom(error);
  return /\bENOENT\b/.test(message) || /not found/i.test(message) || /command not found/i.test(message);
}

function cuaDriverUnavailableResult(error: unknown): Record<string, unknown> {
  return {
    ok: false,
    message: 'Cua Driver is not installed or is not on PATH.',
    error: messageFrom(error),
    installHint:
      'Run the “Install Cua Driver” command, then grant Accessibility and Screen Recording permissions when prompted by your OS.',
  };
}

function mergeArgs(input: ComputerUseInput): Record<string, unknown> {
  const args = isRecord(input.arguments) ? { ...input.arguments } : {};
  for (const key of ['pid', 'window_id', 'element', 'x', 'y', 'text', 'keys', 'button', 'capture_after'] as const) {
    const value = input[key];
    if (value !== undefined) args[key] = value;
  }
  return args;
}

function normalizeCuaArgs(args: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...args };
  if (typeof normalized.element === 'number' && normalized.element_index === undefined) {
    normalized.element_index = normalized.element;
  }
  delete normalized.element;
  delete normalized.capture_after;
  return normalized;
}

function keyToolFor(args: Record<string, unknown>): { tool: string; args: Record<string, unknown> } {
  const normalized = normalizeCuaArgs(args);
  const keys = normalized.keys;
  if (typeof keys !== 'string' || !keys.trim()) {
    throw new Error('keys is required for action=key.');
  }
  const parts = keys
    .split(/[+,]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  delete normalized.keys;
  if (parts.length > 1) return { tool: 'hotkey', args: { ...normalized, keys: parts } };
  return { tool: 'press_key', args: { ...normalized, key: parts[0] ?? keys.trim() } };
}

function mcpToolFor(input: ComputerUseInput): { tool: string; args: Record<string, unknown> } {
  const args = mergeArgs(input);
  switch (input.action) {
    case 'capture':
      return { tool: 'get_accessibility_tree', args: {} };
    case 'window_state':
      return { tool: 'get_window_state', args: normalizeCuaArgs(args) };
    case 'click':
      return { tool: 'click', args: normalizeCuaArgs(args) };
    case 'type':
      return { tool: 'type_text', args: normalizeCuaArgs(args) };
    case 'key':
      return keyToolFor(args);
    case 'scroll':
      return { tool: 'scroll', args: normalizeCuaArgs(args) };
    case 'drag':
      return { tool: 'drag', args: normalizeCuaArgs(args) };
    case 'focus_app':
      return { tool: 'bring_to_front', args: normalizeCuaArgs(args) };
    case 'doctor':
      return { tool: 'health_report', args };
    case 'status':
      return { tool: 'health_report', args };
    default:
      throw new Error(`Unsupported computer_use action: ${(input as { action?: unknown }).action}`);
  }
}

function assertSafeInput(input: ComputerUseInput): void {
  if (input.action === 'type' && typeof input.text === 'string') {
    const blocked = BLOCKED_TEXT_PATTERNS.find((pattern) => pattern.test(input.text ?? ''));
    if (blocked) throw new Error('Blocked unsafe text input pattern.');
  }
  if (input.action === 'key' && typeof input.keys === 'string') {
    const blocked = BLOCKED_KEY_PATTERNS.find((pattern) => pattern.test(input.keys ?? ''));
    if (blocked) throw new Error('Blocked unsafe key sequence.');
  }
}

async function callCuaTool(input: ComputerUseInput, ctx: ExtensionBackendContext): Promise<unknown> {
  assertSafeInput(input);
  const { tool, args } = mcpToolFor(input);
  const resolution = resolveCuaDriver();
  ctx.log.info('Calling Cua Driver tool', { action: input.action, tool, command: resolution.command });
  const result = (await callMcpToolDirect(cuaServerConfig(resolution), tool, args, {
    env: resolution.env,
    timeoutMs: input.action === 'doctor' || input.action === 'status' ? 20_000 : 30_000,
    log: (message: string) => ctx.log.info(message),
  })) as McpOperationResult;
  if (result.error || result.exitCode !== 0) {
    throw new Error(result.error ?? result.stderr ?? `Cua Driver ${tool} failed.`);
  }
  return result.data ?? result.stdout ?? result;
}

export async function computerUse(input: ComputerUseInput, ctx: ExtensionBackendContext): Promise<unknown> {
  if (!input || typeof input !== 'object' || typeof input.action !== 'string') throw new Error('action is required.');
  if (input.action === 'status') return computerUseStatus({}, ctx);
  if (input.action === 'doctor') return computerUseDoctor(input, ctx);
  if (input.action === 'focus_app' && process.platform === 'darwin') {
    return {
      ok: true,
      focused: false,
      message:
        'Cua Driver does not bring macOS apps to the foreground; input actions are delivered directly to the target pid without focus.',
    };
  }
  if (MUTATING_ACTIONS.has(input.action)) {
    // The extension host/tool approval layer should be used for explicit confirmation; this guard keeps the handler safe too.
    assertSafeInput(input);
  }
  try {
    return await callCuaTool(input, ctx);
  } catch (error) {
    if (isCuaDriverUnavailable(error)) return cuaDriverUnavailableResult(error);
    throw error;
  }
}

export async function computerUseStatus(_input: unknown, ctx: ExtensionBackendContext): Promise<unknown> {
  try {
    const resolution = resolveCuaDriver();
    const version = await ctx.shell.exec({ command: resolution.command, args: ['--version'], env: resolution.env, timeoutMs: 10_000 });
    const health = await callCuaTool({ action: 'status' }, ctx).catch((error) => ({ error: messageFrom(error) }));
    return {
      ok: true,
      installed: true,
      version: version.stdout.trim() || version.stderr.trim(),
      telemetry: 'disabled',
      health,
    };
  } catch (error) {
    return { installed: false, ...cuaDriverUnavailableResult(error) };
  }
}

export async function computerUseDoctor(input: ComputerUseInput, ctx: ExtensionBackendContext): Promise<unknown> {
  try {
    return await callCuaTool({ ...input, action: 'doctor' }, ctx);
  } catch (error) {
    return isCuaDriverUnavailable(error)
      ? cuaDriverUnavailableResult(error)
      : {
          ok: false,
          message: 'Cua Driver doctor could not run.',
          error: messageFrom(error),
          installHint:
            'Run the “Install Cua Driver” command, then grant Accessibility and Screen Recording permissions when prompted by your OS.',
        };
  }
}

export async function computerUseInstall(_input: unknown, ctx: ExtensionBackendContext): Promise<unknown> {
  const platform = process.platform;
  const command =
    platform === 'win32'
      ? 'irm https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/scripts/install.ps1 | iex'
      : '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/scripts/install.sh)"';
  const shell = platform === 'win32' ? 'powershell.exe' : '/bin/bash';
  const args = platform === 'win32' ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command] : ['-lc', command];
  let result;
  try {
    result = await ctx.shell.exec({ command: shell, args, timeoutMs: 120_000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    return {
      ok: false,
      message: 'Cua Driver installer failed.',
      error: messageFrom(error),
      installCommand: command,
    };
  }
  const resolution = resolveCuaDriver();
  const version = await ctx.shell
    .exec({ command: resolution.command, args: ['--version'], env: resolution.env, timeoutMs: 10_000 })
    .then((output) => output.stdout.trim() || output.stderr.trim())
    .catch((error) => `Unable to verify version: ${messageFrom(error)}`);
  const health = await callCuaTool({ action: 'status' }, ctx).catch((error) => ({ error: messageFrom(error) }));
  return {
    ok: true,
    stdout: result.stdout,
    stderr: result.stderr,
    version,
    health,
    message: 'Cua Driver installer finished and version verification ran. Run Computer Use doctor next to verify OS permissions.',
  };
}
