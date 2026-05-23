export function shouldIgnoreConversationStateLiveEvent(closed: boolean): boolean {
  return closed;
}

export function shouldSubscribeConversationStateLiveEvents(live: boolean): boolean {
  return live;
}

export function buildConversationStateSubscriptionSurface(input: {
  surfaceId?: string;
  surfaceType?: 'desktop_web' | 'mobile_web';
}): { surface: { surfaceId: string; surfaceType: 'desktop_web' | 'mobile_web' } } | Record<string, never> {
  return input.surfaceId && input.surfaceType ? { surface: { surfaceId: input.surfaceId, surfaceType: input.surfaceType } } : {};
}
