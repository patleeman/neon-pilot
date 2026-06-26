import { primeDesktopConversationStateCache } from '../hooks/useDesktopConversationState';
import { primeSessionDetailCache } from '../hooks/useSessions';
import type { LiveSessionCreateResult } from '../shared/types';

export function isConversationSessionNotLiveError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.trim().toLowerCase().replace(/\.$/, '');
  return (
    normalized === 'session not live' ||
    normalized === 'not a live session' ||
    (normalized.startsWith('session ') && normalized.endsWith(' is not live')) ||
    /\bsession\s+\S+\s+is not live\b/.test(normalized)
  );
}

export function formatConversationMessageActionFailure(action: 'Bash command' | 'Edit' | 'Fork' | 'Rewind', error: unknown): string {
  if (isConversationSessionNotLiveError(error)) {
    return `${action} failed: Conversation is still reconnecting. Try again in a moment.`;
  }

  const message = (error instanceof Error ? error.message : String(error)).trim();
  const routeErrorMatch = /^\d{3}\s+[^:]+ from \/api\/[^:]+:\s*(.+)$/i.exec(message);
  const visibleMessage = routeErrorMatch?.[1]?.trim() || message;
  return `${action} failed: ${visibleMessage}`;
}

export function formatConversationLocalActionFailure(error: unknown, fallback = 'Action failed.'): string {
  if (isConversationSessionNotLiveError(error)) {
    return 'Conversation is still reconnecting. Try again in a moment.';
  }

  const message = (error instanceof Error ? error.message : String(error)).trim();
  if (!message) {
    return fallback;
  }

  const routeErrorMatch = /^\d{3}\s+[^:]+ from \/api\/[^:]+:\s*(.+)$/i.exec(message);
  if (!routeErrorMatch && /local api route did not complete|file:\/\/|localApi\.js|Module\./i.test(message)) {
    return fallback;
  }

  const visibleMessage = routeErrorMatch?.[1]?.trim() || message;
  return visibleMessage || fallback;
}

export async function retryConversationActionAfterNotLive<T>(input: {
  attemptAction: () => Promise<T>;
  recoverLiveSession: () => Promise<void>;
}): Promise<T> {
  try {
    return await input.attemptAction();
  } catch (error) {
    if (!isConversationSessionNotLiveError(error)) {
      throw error;
    }

    await input.recoverLiveSession();
    return input.attemptAction();
  }
}

export function primeCreatedConversationOpenCaches(
  created: LiveSessionCreateResult,
  options: {
    tailBlocks: number;
    bootstrapVersionKey: string;
    sessionDetailVersion: number;
  },
): void {
  if (!created.bootstrap) {
    return;
  }

  primeDesktopConversationStateCache(created.id, created.bootstrap, { tailBlocks: options.tailBlocks, includeToolBlocks: false });

  if (created.bootstrap.sessionDetail) {
    primeSessionDetailCache(created.id, created.bootstrap.sessionDetail, { tailBlocks: options.tailBlocks }, options.sessionDetailVersion);
  }
}
