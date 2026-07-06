// localApiDesktopControl.ts
//
// Server-side broker for semantic Windowed OS desktop control commands. The
// renderer still owns the real window model; this module only queues validated
// commands, streams them to the active desktop renderer, and resolves callers
// after renderer acknowledgement.

const DEFAULT_CONTROL_TIMEOUT_MS = 5_000;
const MAX_CONTROL_TIMEOUT_MS = 30_000;
const MAX_STRING_LENGTH = 2048;
const MAX_ERROR_LENGTH = 2048;

export type DesktopControlAction = 'open' | 'focus' | 'move' | 'resize' | 'snap' | 'minimize' | 'restore' | 'close';
export type DesktopControlSnapTarget = 'left' | 'right' | 'top' | 'bottom' | 'maximize';

export interface DesktopControlBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopControlCommandInput {
  action?: unknown;
  windowId?: unknown;
  appId?: unknown;
  route?: unknown;
  bounds?: unknown;
  snapTarget?: unknown;
  timeoutMs?: unknown;
}

export interface DesktopControlCommand {
  id: string;
  action: DesktopControlAction;
  createdAt: string;
  windowId?: string;
  appId?: string;
  route?: string;
  bounds?: DesktopControlBounds;
  snapTarget?: DesktopControlSnapTarget;
}

export interface DesktopControlAckInput {
  commandId?: unknown;
  ok?: unknown;
  error?: unknown;
}

export interface DesktopControlResult {
  ok: boolean;
  commandId: string;
  action: DesktopControlAction;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
}

interface PendingControlCommand {
  command: DesktopControlCommand;
  resolve: (result: DesktopControlResult) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const CONTROL_ACTIONS = new Set<DesktopControlAction>(['open', 'focus', 'move', 'resize', 'snap', 'minimize', 'restore', 'close']);
const SNAP_TARGETS = new Set<DesktopControlSnapTarget>(['left', 'right', 'top', 'bottom', 'maximize']);

let nextCommandId = 1;
const pendingCommands = new Map<string, PendingControlCommand>();
const subscribers = new Set<(command: DesktopControlCommand) => void>();

export class DesktopControlValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'DesktopControlValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new DesktopControlValidationError(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_STRING_LENGTH ? trimmed.slice(0, MAX_STRING_LENGTH) : trimmed;
}

function sanitizeAction(value: unknown): DesktopControlAction {
  if (typeof value !== 'string' || !CONTROL_ACTIONS.has(value as DesktopControlAction)) {
    throw new DesktopControlValidationError('desktop_control action is required and must be a supported action.');
  }
  return value as DesktopControlAction;
}

function sanitizeBounds(value: unknown): DesktopControlBounds | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new DesktopControlValidationError('desktop_control bounds must be an object.');
  }
  const { x, y, width, height } = value;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new DesktopControlValidationError('desktop_control bounds must include finite positive width and height.');
  }
  return { x, y, width, height };
}

function sanitizeSnapTarget(value: unknown): DesktopControlSnapTarget | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !SNAP_TARGETS.has(value as DesktopControlSnapTarget)) {
    throw new DesktopControlValidationError('desktop_control snapTarget must be left, right, top, bottom, or maximize.');
  }
  return value as DesktopControlSnapTarget;
}

function sanitizeTimeoutMs(value: unknown): number {
  if (value === undefined || value === null) return DEFAULT_CONTROL_TIMEOUT_MS;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DesktopControlValidationError('desktop_control timeoutMs must be a finite number.');
  }
  return Math.max(100, Math.min(MAX_CONTROL_TIMEOUT_MS, Math.round(value)));
}

function buildDesktopControlCommand(input: DesktopControlCommandInput): { command: DesktopControlCommand; timeoutMs: number } {
  if (!isRecord(input)) {
    throw new DesktopControlValidationError('desktop_control input must be an object.');
  }
  const action = sanitizeAction(input.action);
  const windowId = sanitizeString(input.windowId, 'windowId');
  const appId = sanitizeString(input.appId, 'appId');
  const route = sanitizeString(input.route, 'route');
  const bounds = sanitizeBounds(input.bounds);
  const snapTarget = sanitizeSnapTarget(input.snapTarget);
  const timeoutMs = sanitizeTimeoutMs(input.timeoutMs);

  if (action === 'open') {
    if (!appId && !route) {
      throw new DesktopControlValidationError('desktop_control open requires appId or route.');
    }
  } else if (!windowId) {
    throw new DesktopControlValidationError(`desktop_control ${action} requires windowId.`);
  }
  if ((action === 'move' || action === 'resize') && !bounds) {
    throw new DesktopControlValidationError(`desktop_control ${action} requires bounds.`);
  }
  if (action === 'snap' && !snapTarget) {
    throw new DesktopControlValidationError('desktop_control snap requires snapTarget.');
  }

  return {
    command: {
      id: `desktop-control-${Date.now().toString(36)}-${nextCommandId++}`,
      action,
      createdAt: new Date().toISOString(),
      ...(windowId ? { windowId } : {}),
      ...(appId ? { appId } : {}),
      ...(route ? { route } : {}),
      ...(bounds ? { bounds } : {}),
      ...(snapTarget ? { snapTarget } : {}),
    },
    timeoutMs,
  };
}

function publishControlCommand(command: DesktopControlCommand): void {
  for (const subscriber of subscribers) {
    subscriber(command);
  }
}

export function subscribeDesktopControlCommands(listener: (command: DesktopControlCommand) => void): () => void {
  subscribers.add(listener);
  for (const pending of pendingCommands.values()) {
    listener(pending.command);
  }
  return () => {
    subscribers.delete(listener);
  };
}

export function issueDesktopControlCommand(input: DesktopControlCommandInput): Promise<DesktopControlResult> {
  const { command, timeoutMs } = buildDesktopControlCommand(input);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(command.id);
      resolve({
        ok: false,
        commandId: command.id,
        action: command.action,
        status: 'timeout',
        error: 'Timed out waiting for the Windowed OS renderer to acknowledge the desktop control command.',
      });
    }, timeoutMs);
    timeout.unref?.();
    pendingCommands.set(command.id, { command, resolve, timeout });
    publishControlCommand(command);
  });
}

export function acknowledgeDesktopControlCommand(input: DesktopControlAckInput): DesktopControlResult {
  if (!isRecord(input)) {
    throw new DesktopControlValidationError('desktop_control acknowledgement must be an object.');
  }
  const commandId = sanitizeString(input.commandId, 'commandId');
  if (!commandId) {
    throw new DesktopControlValidationError('desktop_control acknowledgement requires commandId.');
  }
  const pending = pendingCommands.get(commandId);
  if (!pending) {
    throw new DesktopControlValidationError('desktop_control command is no longer pending.');
  }
  pendingCommands.delete(commandId);
  clearTimeout(pending.timeout);
  const rawError = typeof input.error === 'string' ? input.error.trim() : '';
  const error = rawError.length > MAX_ERROR_LENGTH ? rawError.slice(0, MAX_ERROR_LENGTH) : rawError;
  const result: DesktopControlResult = {
    ok: input.ok === true,
    commandId,
    action: pending.command.action,
    status: input.ok === true ? 'completed' : 'failed',
    ...(input.ok === true ? {} : { error: error || 'Windowed OS renderer rejected the desktop control command.' }),
  };
  pending.resolve(result);
  return result;
}

export function resetDesktopControlForTests(): void {
  for (const pending of pendingCommands.values()) {
    clearTimeout(pending.timeout);
  }
  pendingCommands.clear();
  subscribers.clear();
  nextCommandId = 1;
}
