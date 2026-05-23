export function shouldProcessDesktopAppEvent(closed: boolean): boolean {
  return !closed;
}

export function buildDesktopAppBridgeEvent(event: unknown): { type: 'event'; event: unknown } {
  return { type: 'event', event };
}

export function buildDesktopAppBridgeError(error: unknown): { type: 'error'; message: string } {
  return { type: 'error', message: error instanceof Error ? error.message : String(error) };
}
