import { useEffect, useLayoutEffect, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import type { ConversationBootstrapState } from '../shared/types';

interface CachedConversationBootstrapEntry {
  data: ConversationBootstrapState;
  versionKey: string;
}

interface ConversationBootstrapOptions {
  tailBlocks?: number;
  includeToolBlocks?: boolean;
}

function readConversationBootstrapSessionSignature(data: ConversationBootstrapState | null | undefined): string | undefined {
  const sessionDetailSignature = data?.sessionDetail?.signature?.trim();
  if (sessionDetailSignature) {
    return sessionDetailSignature;
  }

  const bootstrapSignature = data?.sessionDetailSignature?.trim();
  return bootstrapSignature || undefined;
}

function normalizeConversationBootstrapState(data: ConversationBootstrapState): ConversationBootstrapState {
  const sessionDetailSignature = readConversationBootstrapSessionSignature(data) ?? null;
  const liveSession = data.liveSession ?? { live: false as const };
  const liveSessionChanged = liveSession !== data.liveSession;
  if (!data.sessionDetail) {
    return data.sessionDetailSignature === sessionDetailSignature && !liveSessionChanged
      ? data
      : {
          ...data,
          liveSession,
          sessionDetailSignature,
        };
  }

  const normalizedSessionDetail =
    sessionDetailSignature && data.sessionDetail.signature !== sessionDetailSignature
      ? {
          ...data.sessionDetail,
          signature: sessionDetailSignature,
        }
      : data.sessionDetail;

  if (normalizedSessionDetail === data.sessionDetail && data.sessionDetailSignature === sessionDetailSignature && !liveSessionChanged) {
    return data;
  }

  return {
    ...data,
    liveSession,
    sessionDetail: normalizedSessionDetail,
    sessionDetailSignature,
  };
}

function stripConversationBootstrapTransientFlags(data: ConversationBootstrapState): ConversationBootstrapState {
  const normalized = normalizeConversationBootstrapState(data);
  const rest = { ...normalized };
  delete rest.sessionDetailUnchanged;
  delete rest.sessionDetailAppendOnly;
  return rest;
}

const conversationBootstrapCache = new Map<string, CachedConversationBootstrapEntry>();
const conversationBootstrapInflight = new Map<string, Promise<ConversationBootstrapState>>();
const MAX_CACHED_CONVERSATION_BOOTSTRAPS = 24;

function buildConversationBootstrapCacheKey(conversationId: string, options?: ConversationBootstrapOptions): string {
  return `${conversationId}::${options?.tailBlocks ?? 'all'}::${options?.includeToolBlocks === false ? 'conversation' : 'full'}`;
}

function readCachedConversationBootstrapEntry(
  conversationId: string,
  options?: ConversationBootstrapOptions,
): CachedConversationBootstrapEntry | null {
  const cacheKey = buildConversationBootstrapCacheKey(conversationId, options);
  const cached = conversationBootstrapCache.get(cacheKey) ?? null;
  if (!cached) {
    return null;
  }

  const normalized = normalizeConversationBootstrapState(cached.data);
  const normalizedEntry =
    normalized === cached.data
      ? cached
      : {
          ...cached,
          data: normalized,
        };
  conversationBootstrapCache.delete(cacheKey);
  conversationBootstrapCache.set(cacheKey, normalizedEntry);
  return normalizedEntry;
}

export function readCachedConversationBootstrap(
  conversationId: string,
  options?: ConversationBootstrapOptions,
): ConversationBootstrapState | null {
  return readCachedConversationBootstrapEntry(conversationId, options)?.data ?? null;
}

function trimConversationBootstrapCache(): void {
  while (conversationBootstrapCache.size > MAX_CACHED_CONVERSATION_BOOTSTRAPS) {
    const oldestKey = conversationBootstrapCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    conversationBootstrapCache.delete(oldestKey);
  }
}

function writeConversationBootstrapCacheEntry(
  conversationId: string,
  data: ConversationBootstrapState,
  options?: ConversationBootstrapOptions,
  versionKey = '0',
): CachedConversationBootstrapEntry {
  const cacheKey = buildConversationBootstrapCacheKey(conversationId, options);
  const entry = {
    data: stripConversationBootstrapTransientFlags(data),
    versionKey,
  } satisfies CachedConversationBootstrapEntry;
  conversationBootstrapCache.set(cacheKey, entry);
  trimConversationBootstrapCache();
  return entry;
}

function readConversationBootstrapEntry(
  conversationId: string,
  options?: ConversationBootstrapOptions,
): CachedConversationBootstrapEntry | null {
  return readCachedConversationBootstrapEntry(conversationId, options);
}

export function readCachedConversationBootstrapSeed(
  conversationId: string,
  options?: ConversationBootstrapOptions,
): ConversationBootstrapState | null {
  return readConversationBootstrapEntry(conversationId, options)?.data ?? null;
}

export function primeConversationBootstrapCache(
  conversationId: string,
  data: ConversationBootstrapState,
  options?: ConversationBootstrapOptions,
  versionKey = '0',
): void {
  writeConversationBootstrapCacheEntry(conversationId, data, options, versionKey);
}

export function fetchConversationBootstrapCached(
  conversationId: string,
  options?: ConversationBootstrapOptions,
  versionKey = '0',
): Promise<ConversationBootstrapState> {
  const cacheKey = buildConversationBootstrapCacheKey(conversationId, options);
  const inflightKey = `${cacheKey}::v${versionKey}`;
  const inflight = conversationBootstrapInflight.get(inflightKey);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const cached = readCachedConversationBootstrapEntry(conversationId, options);
    if (cached && cached.versionKey === versionKey) {
      return cached.data;
    }

    const nextData = await api.conversationBootstrap(conversationId, options);
    return writeConversationBootstrapCacheEntry(conversationId, nextData, options, versionKey).data;
  })().finally(() => {
    conversationBootstrapInflight.delete(inflightKey);
  });

  conversationBootstrapInflight.set(inflightKey, request);
  return request;
}

export function buildConversationBootstrapVersionKey(input: { sessionsVersion: number; sessionFilesVersion: number }): string {
  // Bootstrap is only the conversation-open fast path. The page and rail keep the
  // rest of their state incremental with separate invalidations. Session-file bumps
  // still rotate the bootstrap version key, but the server can now reuse a cached
  // transcript window when the conversation file itself did not actually change.
  return `${input.sessionsVersion}:${input.sessionFilesVersion}`;
}

function resolveConversationBootstrapSeed(
  conversationId: string | undefined,
  options?: ConversationBootstrapOptions,
): {
  data: ConversationBootstrapState | null;
  loading: boolean;
} {
  if (!conversationId) {
    return {
      data: null,
      loading: false,
    };
  }

  const cached = readCachedConversationBootstrapEntry(conversationId, options);
  return {
    data: cached?.data ?? null,
    loading: !cached,
  };
}

const useCacheSeedEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useConversationBootstrap(
  conversationId: string | undefined,
  options?: ConversationBootstrapOptions & { versionKey?: string },
) {
  const { versions } = useAppEvents();
  const versionKey =
    options?.versionKey ??
    buildConversationBootstrapVersionKey({
      sessionsVersion: versions.sessions,
      sessionFilesVersion: versions.sessionFiles,
    });
  const initialSeed = resolveConversationBootstrapSeed(conversationId, options);
  const [data, setData] = useState<ConversationBootstrapState | null>(initialSeed.data);
  const [loading, setLoading] = useState(initialSeed.loading);
  const [error, setError] = useState<string | null>(null);

  useCacheSeedEffect(() => {
    const seed = resolveConversationBootstrapSeed(conversationId, options);
    setData(seed.data);
    setLoading(seed.loading);
    setError(null);
  }, [conversationId, options?.includeToolBlocks, options?.tailBlocks]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    let cancelled = false;
    const cached = readCachedConversationBootstrapEntry(conversationId, options);

    if (!cached) {
      const seeded = readConversationBootstrapEntry(conversationId, options);
      if (seeded && !cancelled) {
        setData((current) => current ?? seeded.data);
        setLoading(false);
      }
    }

    if (cached?.versionKey === versionKey) {
      return () => {
        cancelled = true;
      };
    }

    void fetchConversationBootstrapCached(conversationId, options, versionKey)
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        setData(nextData);
        setLoading(false);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : String(nextError));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, options?.includeToolBlocks, options?.tailBlocks, versionKey]);

  return { data, loading, error };
}
