import type { ExtensionBackendContext, ExtensionRouteRequest, ExtensionRouteResponse } from '@neon-pilot/extensions';
import {
  closeTerminalSession,
  createTerminalSession,
  drainTerminalSession,
  resizeTerminalSession,
  streamTerminalSession,
  writeTerminalSession,
} from '@neon-pilot/extensions/backend/terminal';

export async function createTerminal(
  input: { cwd?: string },
  ctx: ExtensionBackendContext,
): Promise<{ id: string; pid: number | null; usingPty: boolean; initialOutput: string; realtimeUrl?: string }> {
  const result = await createTerminalSession(input);
  ctx.log.info('Terminal created', { id: result.id, pid: result.pid, cwd: input.cwd });
  return result;
}

export async function writeTerminal(input: { id: string; data: string }): Promise<{ ok: boolean }> {
  return writeTerminalSession(input);
}

export async function drainTerminal(input: {
  id: string;
}): Promise<{ ok: boolean; output: string; exited: boolean; exitCode: number | null }> {
  return drainTerminalSession(input);
}

export async function resizeTerminal(input: { id: string; cols: number; rows: number }): Promise<{ ok: boolean }> {
  return resizeTerminalSession(input);
}

export async function closeTerminal(input: { id: string }): Promise<{ ok: boolean }> {
  return closeTerminalSession(input);
}

export async function terminalCli(input: unknown, ctx: ExtensionBackendContext): Promise<unknown> {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const cli = body.cli && typeof body.cli === 'object' ? (body.cli as Record<string, unknown>) : {};
  const args = Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
  const flags = cli.flags && typeof cli.flags === 'object' ? (cli.flags as Record<string, unknown>) : {};
  const action = typeof body.action === 'string' ? body.action : 'create';
  if (action === 'create') {
    return createTerminal({ cwd: typeof flags.cwd === 'string' ? flags.cwd : undefined }, ctx);
  }
  if (action === 'write') {
    return writeTerminal({ id: requiredArg(args[0], 'id'), data: args.slice(1).join(' ') || stringFlag(flags.data, 'data') });
  }
  if (action === 'drain') {
    return drainTerminal({ id: requiredArg(args[0], 'id') });
  }
  if (action === 'resize') {
    return resizeTerminal({ id: requiredArg(args[0], 'id'), cols: numberFlag(flags.cols, 'cols'), rows: numberFlag(flags.rows, 'rows') });
  }
  if (action === 'close') {
    return closeTerminal({ id: requiredArg(args[0], 'id') });
  }
  throw new Error(`Unsupported terminal CLI action: ${action}`);
}

function requiredArg(value: unknown, name: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new Error(`${name} is required.`);
}

function stringFlag(value: unknown, name: string): string {
  if (typeof value === 'string') return value;
  throw new Error(`${name} is required.`);
}

function numberFlag(value: unknown, name: string): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  throw new Error(`${name} must be a number.`);
}

export async function streamTerminal(request: ExtensionRouteRequest): Promise<ExtensionRouteResponse> {
  return streamTerminalSession(request) as Promise<ExtensionRouteResponse>;
}
