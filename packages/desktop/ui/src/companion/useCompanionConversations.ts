import { useCallback, useMemo, useRef, useState } from 'react';

import { api } from '../client/api.js';
import { NEW_CONVERSATION_TITLE } from '../conversation/conversationTitle.js';

/**
 * Storage key prefix for companion conversation ID lists.
 * Value is JSON.stringify(string[]) of companion conversation ids.
 */
const STORAGE_PREFIX = 'np:companions:';

function readCompanionIds(mainConversationId: string): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${mainConversationId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeCompanionIds(mainConversationId: string, ids: string[]): void {
  try {
    if (ids.length > 0) {
      localStorage.setItem(`${STORAGE_PREFIX}${mainConversationId}`, JSON.stringify(ids));
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${mainConversationId}`);
    }
  } catch {
    /* ignore */
  }
}

export interface CompanionTab {
  /** Unique tab id (same as conversationId). */
  id: string;
  /** Companion conversation id. */
  conversationId: string;
  /** User-visible title (may be stale, ChatRail will update). */
  title: string;
}

export interface UseCompanionConversationsResult {
  /** Whether a new companion is being created. */
  creating: boolean;
  /**
   * Create a fresh companion conversation (blank live session)
   * and persist the association. Returns the new conversation id.
   */
  createCompanion: (mainConversationId: string, cwd: string | null) => Promise<string>;
  /**
   * Register an already-created conversation (e.g. returned by a fork API call)
   * as a companion of the given main conversation.
   */
  registerCompanion: (mainConversationId: string, companionId: string) => void;
  /** Unregister a companion (when a tab is closed). */
  unregisterCompanion: (mainConversationId: string, companionId: string) => void;
  /** Load stored companion tabs for the given main conversation. */
  loadCompanions: (mainConversationId: string) => CompanionTab[];
}

export function useCompanionConversations(titles: Map<string, string>): UseCompanionConversationsResult {
  const [creating, setCreating] = useState(false);
  const creatingSeqRef = useRef(0);

  const loadCompanions = useCallback(
    (mainConversationId: string): CompanionTab[] => {
      const ids = readCompanionIds(mainConversationId);
      return ids.map((conversationId) => ({
        id: conversationId,
        conversationId,
        title: titles.get(conversationId) ?? NEW_CONVERSATION_TITLE,
      }));
    },
    [titles],
  );

  const createCompanion = useCallback(async (mainConversationId: string, cwd: string | null): Promise<string> => {
    const seq = ++creatingSeqRef.current;
    setCreating(true);

    try {
      const existing = readCompanionIds(mainConversationId);

      const result = await api.createLiveSession(cwd ?? undefined, undefined, {
        workspaceCwd: cwd ?? undefined,
      });

      if (seq !== creatingSeqRef.current) return result.id;

      // Persist the companion association.
      writeCompanionIds(mainConversationId, [...existing, result.id]);

      // The useDesktopConversationState hook will fetch the initial state
      // when the companion tab mounts.  SSE events from the server propagate
      // the session meta to the sidebar.
      return result.id;
    } finally {
      if (seq === creatingSeqRef.current) {
        setCreating(false);
      }
    }
  }, []);

  const registerCompanion = useCallback((mainConversationId: string, companionId: string) => {
    const existing = readCompanionIds(mainConversationId);
    if (existing.includes(companionId)) return;
    writeCompanionIds(mainConversationId, [...existing, companionId]);
  }, []);

  const unregisterCompanion = useCallback((mainConversationId: string, companionId: string) => {
    const existing = readCompanionIds(mainConversationId);
    writeCompanionIds(
      mainConversationId,
      existing.filter((id) => id !== companionId),
    );
  }, []);

  return useMemo(
    () => ({
      creating,
      createCompanion,
      registerCompanion,
      unregisterCompanion,
      loadCompanions,
    }),
    [creating, createCompanion, registerCompanion, unregisterCompanion, loadCompanions],
  );
}
