import type {
  CreateTerminalInput,
  CreateTerminalResult,
  DrainTerminalResult,
  TerminalOkResult,
} from '@neon-pilot/extensions/backend/terminal';

import { callServerModuleExport } from './serverModuleResolver.js';

const TERMINAL_SESSIONS = '../terminalSessions.js';

export type { CreateTerminalInput, CreateTerminalResult, DrainTerminalResult, TerminalOkResult };

export async function createTerminalSession(...args: unknown[]) {
  return callServerModuleExport<CreateTerminalResult>(TERMINAL_SESSIONS, 'createTerminalSession', ...args);
}

export async function writeTerminalSession(...args: unknown[]) {
  return callServerModuleExport<TerminalOkResult>(TERMINAL_SESSIONS, 'writeTerminalSession', ...args);
}

export async function drainTerminalSession(...args: unknown[]) {
  return callServerModuleExport<DrainTerminalResult>(TERMINAL_SESSIONS, 'drainTerminalSession', ...args);
}

export async function resizeTerminalSession(...args: unknown[]) {
  return callServerModuleExport<TerminalOkResult>(TERMINAL_SESSIONS, 'resizeTerminalSession', ...args);
}

export async function closeTerminalSession(...args: unknown[]) {
  return callServerModuleExport<TerminalOkResult>(TERMINAL_SESSIONS, 'closeTerminalSession', ...args);
}

export async function streamTerminalSession(...args: unknown[]) {
  return callServerModuleExport(TERMINAL_SESSIONS, 'streamTerminalSession', ...args);
}
