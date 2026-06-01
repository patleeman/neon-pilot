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

function workerBridge(): ExtensionBackendApiGlobal[typeof EXTENSION_HOST_CAPABILITY_BRIDGE] {
  return (globalThis as ExtensionBackendApiGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
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
  return callServerModuleExport(TERMINAL_SESSIONS, 'streamTerminalSession', ...args);
}
