export function shouldRefreshDesktopConversationStateForAppEvent(
  conversationId: string,
  event: { type?: string; topics?: unknown; sessionId?: unknown },
): boolean {
  if (event.type === 'invalidate') {
    const topics = Array.isArray(event.topics) ? event.topics : [];
    return topics.includes('sessions') || topics.includes('sessionFiles');
  }

  if (
    (event.type === 'live_title' || event.type === 'session_meta_changed' || event.type === 'session_file_changed') &&
    typeof event.sessionId === 'string'
  ) {
    return event.sessionId === conversationId;
  }

  return false;
}
