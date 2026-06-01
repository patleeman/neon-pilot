function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/terminal must be resolved by the Neon Pilot host runtime.');
}

export interface CreateTerminalInput {
  cwd?: string;
}

export interface CreateTerminalResult {
  id: string;
  pid: number | null;
  usingPty: boolean;
  initialOutput: string;
}

export interface TerminalOkResult {
  ok: boolean;
}

export interface DrainTerminalResult extends TerminalOkResult {
  output: string;
  exited: boolean;
  exitCode: number | null;
}

export const createTerminalSession = async (_input: CreateTerminalInput): Promise<CreateTerminalResult> => hostResolved();
export const writeTerminalSession = async (_input: { id: string; data: string }): Promise<TerminalOkResult> => hostResolved();
export const drainTerminalSession = async (_input: { id: string }): Promise<DrainTerminalResult> => hostResolved();
export const resizeTerminalSession = async (_input: { id: string; cols: number; rows: number }): Promise<TerminalOkResult> =>
  hostResolved();
export const closeTerminalSession = async (_input: { id: string }): Promise<TerminalOkResult> => hostResolved();
export const streamTerminalSession = async (..._args: unknown[]): Promise<unknown> => hostResolved();
