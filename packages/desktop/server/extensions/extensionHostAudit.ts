export interface ExtensionHostAuditEvent {
  id: number;
  requestType: string;
  requestName: string;
  ok: boolean;
  durationMs: number;
  at: string;
  error?: string;
}

const maxExtensionHostAuditEvents = 500;

let nextExtensionHostAuditEventId = 1;
const extensionHostAuditEvents: ExtensionHostAuditEvent[] = [];

export function recordExtensionHostAuditEvent(event: Omit<ExtensionHostAuditEvent, 'id' | 'at'> & { at?: string }): ExtensionHostAuditEvent {
  const recorded: ExtensionHostAuditEvent = {
    id: nextExtensionHostAuditEventId,
    requestType: event.requestType,
    requestName: event.requestName,
    ok: event.ok,
    durationMs: event.durationMs,
    at: event.at ?? new Date().toISOString(),
    ...(event.error ? { error: event.error } : {}),
  };
  nextExtensionHostAuditEventId += 1;
  extensionHostAuditEvents.push(recorded);
  if (extensionHostAuditEvents.length > maxExtensionHostAuditEvents) {
    extensionHostAuditEvents.splice(0, extensionHostAuditEvents.length - maxExtensionHostAuditEvents);
  }
  return recorded;
}

export function listExtensionHostAuditEvents(): ExtensionHostAuditEvent[] {
  return extensionHostAuditEvents.map((event) => ({ ...event }));
}

export function clearExtensionHostAuditEvents(): void {
  nextExtensionHostAuditEventId = 1;
  extensionHostAuditEvents.length = 0;
}
