// localApiDesktopEvents.ts
//
// Server-side broker for symmetric Windowed OS desktop user-action events.
// The renderer publishes events only for direct user actions on agent-touched
// windows, and agents can subscribe without polling the full desktop state.

const MAX_DESKTOP_EVENT_BUFFER = 100;
const MAX_STRING_LENGTH = 2048;

export type DesktopUserAction = 'focus' | 'minimize' | 'restore' | 'close' | 'move' | 'resize' | 'maximize' | 'snap';

export interface DesktopUserActionEventInput {
  action?: unknown;
  windowId?: unknown;
  kind?: unknown;
  title?: unknown;
  route?: unknown;
  createdAt?: unknown;
}

export interface DesktopUserActionEvent {
  id: string;
  source: 'user';
  action: DesktopUserAction;
  windowId: string;
  kind?: string;
  title?: string;
  route?: string;
  createdAt: string;
}

export interface PublishDesktopUserActionEventResult {
  ok: true;
  event: DesktopUserActionEvent;
}

const USER_ACTIONS = new Set<DesktopUserAction>(['focus', 'minimize', 'restore', 'close', 'move', 'resize', 'maximize', 'snap']);

let nextEventId = 1;
const recentEvents: DesktopUserActionEvent[] = [];
const subscribers = new Set<(event: DesktopUserActionEvent) => void>();

export class DesktopUserActionEventValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'DesktopUserActionEventValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new DesktopUserActionEventValidationError(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_STRING_LENGTH ? trimmed.slice(0, MAX_STRING_LENGTH) : trimmed;
}

function sanitizeAction(value: unknown): DesktopUserAction {
  if (typeof value !== 'string' || !USER_ACTIONS.has(value as DesktopUserAction)) {
    throw new DesktopUserActionEventValidationError('desktop user-action event action is required and must be supported.');
  }
  return value as DesktopUserAction;
}

function sanitizeCreatedAt(value: unknown): string {
  const createdAt = sanitizeString(value, 'createdAt');
  if (!createdAt) return new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(createdAt)) {
    throw new DesktopUserActionEventValidationError('createdAt must be an ISO timestamp.');
  }
  return createdAt;
}

function buildDesktopUserActionEvent(input: DesktopUserActionEventInput): DesktopUserActionEvent {
  if (!isRecord(input)) {
    throw new DesktopUserActionEventValidationError('desktop user-action event input must be an object.');
  }
  const action = sanitizeAction(input.action);
  const windowId = sanitizeString(input.windowId, 'windowId');
  if (!windowId) {
    throw new DesktopUserActionEventValidationError('desktop user-action event requires windowId.');
  }
  return {
    id: `desktop-user-action-${Date.now().toString(36)}-${nextEventId++}`,
    source: 'user',
    action,
    windowId,
    createdAt: sanitizeCreatedAt(input.createdAt),
    ...(sanitizeString(input.kind, 'kind') ? { kind: sanitizeString(input.kind, 'kind') } : {}),
    ...(sanitizeString(input.title, 'title') ? { title: sanitizeString(input.title, 'title') } : {}),
    ...(sanitizeString(input.route, 'route') ? { route: sanitizeString(input.route, 'route') } : {}),
  };
}

function rememberDesktopUserActionEvent(event: DesktopUserActionEvent): void {
  recentEvents.push(event);
  if (recentEvents.length > MAX_DESKTOP_EVENT_BUFFER) {
    recentEvents.splice(0, recentEvents.length - MAX_DESKTOP_EVENT_BUFFER);
  }
}

export function publishDesktopUserActionEvent(input: DesktopUserActionEventInput): PublishDesktopUserActionEventResult {
  const event = buildDesktopUserActionEvent(input);
  rememberDesktopUserActionEvent(event);
  for (const subscriber of subscribers) {
    subscriber(event);
  }
  return { ok: true, event };
}

export function subscribeDesktopUserActionEvents(listener: (event: DesktopUserActionEvent) => void): () => void {
  subscribers.add(listener);
  for (const event of recentEvents) {
    listener(event);
  }
  return () => {
    subscribers.delete(listener);
  };
}

export function resetDesktopUserActionEventsForTests(): void {
  recentEvents.length = 0;
  subscribers.clear();
  nextEventId = 1;
}
