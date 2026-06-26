export interface DesktopAppEventBridgeMessage {
  type: 'desktop-app-event';
  event: Record<string, unknown>;
}

export function isDesktopAppEventBridgeMessage(value: unknown): value is DesktopAppEventBridgeMessage {
  return (
    Boolean(value && typeof value === 'object') &&
    (value as { type?: unknown }).type === 'desktop-app-event' &&
    Boolean((value as { event?: unknown }).event && typeof (value as { event?: unknown }).event === 'object')
  );
}
