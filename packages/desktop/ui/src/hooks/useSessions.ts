import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import type { SessionDetail, SessionDetailResult } from '../shared/types';

interface CachedSessionDetailEntry {
  detail: SessionDetail;
  version: number;
}

interface SessionDetailOptions {
  tailBlocks?: number;
  signal?: AbortSignal;
}

const sessionDetailCache = new Map<string, CachedSessionDetailEntry>();
const sessionDetailInflight = new Map<string, Promise<SessionDetail>>();
const MAX_CACHED_SESSION_DETAILS = 24;

function readFreshSessionDetailResult(result: SessionDetailResult): SessionDetail {
  if ('unchanged' in result || 'appendOnly' in result) {
    throw new Error('Session detail response did not include an authoritative transcript payload.');
  }

  return result;
}

function buildSessionDetailCacheKey(sessionId: string, options?: SessionDetailOptions): string {
  return `${sessionId}::${options?.tailBlocks ?? 'all'}`;
}

function readCachedSessionDetailEntry(sessionId: string, options?: SessionDetailOptions): CachedSessionDetailEntry | null {
  const cacheKey = buildSessionDetailCacheKey(sessionId, options);
  const cached = sessionDetailCache.get(cacheKey) ?? null;
  if (cached) {
    sessionDetailCache.delete(cacheKey);
    sessionDetailCache.set(cacheKey, cached);
  }
  return cached;
}

function trimSessionDetailCache(): void {
  while (sessionDetailCache.size > MAX_CACHED_SESSION_DETAILS) {
    const oldestKey = sessionDetailCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    sessionDetailCache.delete(oldestKey);
  }
}

export function primeSessionDetailCache(sessionId: string, detail: SessionDetail, options?: SessionDetailOptions, version = 0): void {
  const cacheKey = buildSessionDetailCacheKey(sessionId, options);
  sessionDetailCache.set(cacheKey, { detail, version });
  trimSessionDetailCache();
}

export function fetchSessionDetailCached(sessionId: string, options?: SessionDetailOptions, version = 0): Promise<SessionDetail> {
  const cacheOptions = options ? { tailBlocks: options.tailBlocks } : undefined;
  const cacheKey = buildSessionDetailCacheKey(sessionId, cacheOptions);
  const cached = readCachedSessionDetailEntry(sessionId, cacheOptions);
  if (cached && cached.version === version) {
    return Promise.resolve(cached.detail);
  }

  const inflightKey = `${cacheKey}::v${version}`;
  const inflight = sessionDetailInflight.get(inflightKey);
  if (inflight) {
    return inflight;
  }

  const request = api
    .sessionDetail(sessionId, options)
    .then((result) => {
      const detail = readFreshSessionDetailResult(result);
      sessionDetailCache.set(cacheKey, { detail, version });
      trimSessionDetailCache();
      return detail;
    })
    .finally(() => {
      sessionDetailInflight.delete(inflightKey);
    });

  sessionDetailInflight.set(inflightKey, request);
  return request;
}

function resolveSessionDetailSeed(
  sessionId: string | undefined,
  options?: SessionDetailOptions,
): {
  detail: SessionDetail | null;
  loading: boolean;
} {
  if (!sessionId) {
    return {
      detail: null,
      loading: false,
    };
  }

  const cached = readCachedSessionDetailEntry(sessionId, options);
  return {
    detail: cached?.detail ?? null,
    loading: !cached,
  };
}

const useCacheSeedEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useSessionDetail(sessionId: string | undefined, options?: SessionDetailOptions & { version?: number }) {
  const { versions } = useAppEvents();
  const detailVersion = options?.version ?? versions.sessionFiles;
  const cacheOptions = options ? { tailBlocks: options.tailBlocks } : undefined;
  const initialSeedRef = useRef<ReturnType<typeof resolveSessionDetailSeed> | null>(null);
  if (initialSeedRef.current === null) {
    initialSeedRef.current = resolveSessionDetailSeed(sessionId, cacheOptions);
  }
  const [detail, setDetail] = useState<SessionDetail | null>(initialSeedRef.current.detail);
  const [loading, setLoading] = useState(initialSeedRef.current.loading);
  const [error, setError] = useState<string | null>(null);
  const didApplyInitialSeedRef = useRef(false);

  useCacheSeedEffect(() => {
    if (!didApplyInitialSeedRef.current) {
      didApplyInitialSeedRef.current = true;
      return;
    }

    const seed = resolveSessionDetailSeed(sessionId, cacheOptions);
    setDetail(seed.detail);
    setLoading(seed.loading);
    setError(null);
  }, [cacheOptions?.tailBlocks, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const cached = readCachedSessionDetailEntry(sessionId, cacheOptions);
    const hasFreshCache = cached?.version === detailVersion;

    if (hasFreshCache) {
      return;
    }

    fetchSessionDetailCached(sessionId, { ...cacheOptions, signal: abortController.signal }, detailVersion)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setDetail(data);
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
      abortController.abort();
    };
  }, [cacheOptions?.tailBlocks, detailVersion, sessionId]);

  return { detail, loading, error };
}
