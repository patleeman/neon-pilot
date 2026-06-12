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

export async function streamTerminal(request: ExtensionRouteRequest): Promise<ExtensionRouteResponse> {
  return streamTerminalSession(request) as Promise<ExtensionRouteResponse>;
}
