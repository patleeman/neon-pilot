export function shouldCloseSubscription(closed: boolean): boolean {
  return !closed;
}

export function markSubscriptionClosed(): true {
  return true;
}

export function buildDesktopCloseEvent(): { type: 'close' } {
  return { type: 'close' };
}
