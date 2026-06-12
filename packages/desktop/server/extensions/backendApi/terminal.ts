import type {
  CreateTerminalInput,
  CreateTerminalResult,
  DrainTerminalResult,
  TerminalOkResult,
} from '@neon-pilot/extensions/backend/terminal';

import { callServerModuleExport } from './serverModuleResolver.js';

const TERMINAL_SESSIONS = '../terminalSessions.js';
const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendApiGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

export type { CreateTerminalInput, CreateTerminalResult, DrainTerminalResult, TerminalOkResult };

interface TerminalStreamRouteRequest {
  query?: Record<string, string | string[]>;
}

interface TerminalStreamRouteResponse {
  status?: number;
  body?: unknown;
  stream?: 'sse';
  events?: AsyncIterable<{ data: unknown }>;
}

function workerBridge(): ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE] {
  return (globalThis as ExtensionBackendApiGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

async function* streamWorkerTerminalEvents(
  workerBridgeFn: NonNullable<ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE]>,
  id: string,
) {
  for (;;) {
    const drained = (await workerBridgeFn('terminal', 'drain', { id })) as DrainTerminalResult;
    if (!drained.ok) return;
    if (drained.output) yield { data: { type: 'output', data: drained.output } };
    if (drained.exited) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function readTerminalIdFromRouteRequest(request: TerminalStreamRouteRequest): string | undefined {
  const idParam = request.query?.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  return typeof id === 'string' && id ? id : undefined;
}

export async function createTerminalSession(...args: unknown[]) {
  const bridge = workerBridge();
  if (bridge) return bridge('terminal', 'create', args[0]) as Promise<CreateTerminalResult>;
  return callServerModuleExport<CreateTerminalResult>(TERMINAL_SESSIONS, 'createTerminalSession', ...args);
}

export async function writeTerminalSession(...args: unknown[]) {
  const bridge = workerBridge();
  if (bridge) return bridge('terminal', 'write', args[0]) as Promise<TerminalOkResult>;
  return callServerModuleExport<TerminalOkResult>(TERMINAL_SESSIONS, 'writeTerminalSession', ...args);
}

export async function drainTerminalSession(...args: unknown[]) {
  const bridge = workerBridge();
  if (bridge) return bridge('terminal', 'drain', args[0]) as Promise<DrainTerminalResult>;
  return callServerModuleExport<DrainTerminalResult>(TERMINAL_SESSIONS, 'drainTerminalSession', ...args);
}

export async function resizeTerminalSession(...args: unknown[]) {
  const bridge = workerBridge();
  if (bridge) return bridge('terminal', 'resize', args[0]) as Promise<TerminalOkResult>;
  return callServerModuleExport<TerminalOkResult>(TERMINAL_SESSIONS, 'resizeTerminalSession', ...args);
}

export async function closeTerminalSession(...args: unknown[]) {
  const bridge = workerBridge();
  if (bridge) return bridge('terminal', 'close', args[0]) as Promise<TerminalOkResult>;
  return callServerModuleExport<TerminalOkResult>(TERMINAL_SESSIONS, 'closeTerminalSession', ...args);
}

export async function streamTerminalSession(...args: unknown[]) {
  const bridge = workerBridge();
  if (bridge) {
    const request = args[0] as TerminalStreamRouteRequest;
    const id = readTerminalIdFromRouteRequest(request);
    if (!id) return { status: 404, body: { error: 'Terminal not found or already closed.' } };
    const response = await bridge('terminal', 'stream', { id });
    if (response && typeof response === 'object' && (response as { stream?: unknown }).stream === 'sse') {
      return response;
    }
    return { stream: 'sse', events: streamWorkerTerminalEvents(bridge, id) } satisfies TerminalStreamRouteResponse;
  }
  return callServerModuleExport(TERMINAL_SESSIONS, 'streamTerminalSession', ...args);
}
