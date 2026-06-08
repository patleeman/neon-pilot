import type { AgentSession } from '@earendil-works/pi-coding-agent';

import type { WebLiveConversationRunState } from './conversationRuns.js';
import type { SseEvent } from './liveSessionEvents.js';
import type { LiveSessionSubscriptionListener } from './liveSessionSubscription.js';

export interface LiveSessionDestroyHost {
  sessionId: string;
  session: AgentSession;
  listeners: Set<LiveSessionSubscriptionListener>;
}

export function destroyLiveSession<TEntry extends LiveSessionDestroyHost>(
  sessionId: string,
  input: {
    registry: Map<string, TEntry>;
    pendingConversationWorkingDirectoryChanges: Map<string, unknown>;
    clearContextUsageTimer: (entry: TEntry) => void;
    syncDurableConversationRun: (
      entry: TEntry,
      state: WebLiveConversationRunState,
      input: { force?: boolean; lastError?: string },
    ) => Promise<void>;
    publishSessionMetaChanged: (sessionId: string) => void;
  },
): void {
  input.pendingConversationWorkingDirectoryChanges.delete(sessionId);
  const entry = input.registry.get(sessionId);
  if (!entry) return;
  input.clearContextUsageTimer(entry);

  if (entry.session.isStreaming) {
    // Broadcast a terminal agent_end event so connected SSE listeners
    // don't get stuck with isStreaming = true on the client.
    const terminalEvent: SseEvent = { type: 'agent_end' };
    for (const listener of entry.listeners) {
      try {
        listener.send(terminalEvent);
      } catch {
        // Silently drop — the listener's SSE connection may have closed.
      }
    }
  }

  input
    .syncDurableConversationRun(entry, entry.session.isStreaming ? 'interrupted' : 'waiting', {
      force: true,
      ...(entry.session.isStreaming ? { lastError: 'Live session disposed while a response was active.' } : {}),
    })
    .catch((error: unknown) => {
      console.error('[liveSessionDestroy] sync failed', error);
    });
  entry.session.dispose();
  input.registry.delete(sessionId);
  input.publishSessionMetaChanged(sessionId);
}
