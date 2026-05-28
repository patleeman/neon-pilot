import { type SetStateAction, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const useReloadStateLayoutEffect =
  typeof window === 'undefined' || /\b(jsdom|happy-dom)\b/i.test(window.navigator?.userAgent ?? '') ? useEffect : useLayoutEffect;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ReadStoredStateOptions<T> {
  key: string | null;
  fallback: T;
  storage?: StorageLike | null;
  deserialize?: (raw: string) => T;
}

interface PersistStoredStateOptions<T> {
  key: string | null;
  value: T;
  storage?: StorageLike | null;
  serialize?: (value: T) => string;
  shouldPersist?: (value: T) => boolean;
}

interface UseReloadStateOptions<T> {
  storageKey: string | null;
  initialValue: T;
  storage?: StorageLike | null;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  shouldPersist?: (value: T) => boolean;
}

export function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStoredState<T>({
  key,
  fallback,
  storage = getSessionStorage(),
  deserialize = (raw) => JSON.parse(raw) as T,
}: ReadStoredStateOptions<T>): T {
  if (!storage || !key) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);
    if (raw !== null) {
      return deserialize(raw);
    }
  } catch {
    // Ignore malformed or unavailable storage.
  }

  return fallback;
}

export function persistStoredState<T>({
  key,
  value,
  storage = getSessionStorage(),
  serialize = (next) => JSON.stringify(next),
  shouldPersist = () => true,
}: PersistStoredStateOptions<T>): void {
  if (!storage || !key) {
    return;
  }

  try {
    if (!shouldPersist(value)) {
      storage.removeItem(key);
      return;
    }

    storage.setItem(key, serialize(value));
  } catch {
    // Ignore storage write failures.
  }
}

export function clearStoredState(storage: StorageLike | null | undefined, key: string | null): void {
  if (!storage || !key) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage write failures.
  }
}

export function useReloadState<T>({
  storageKey,
  initialValue,
  storage = getSessionStorage(),
  serialize,
  deserialize,
  shouldPersist,
}: UseReloadStateOptions<T>) {
  const [stateRecord, setStateRecord] = useState<{ key: string | null; value: T }>(() => ({
    key: storageKey,
    value: readStoredState({
      key: storageKey,
      fallback: initialValue,
      storage,
      deserialize,
    }),
  }));
  const state = stateRecord.value;
  const hydratedKeyRef = useRef(storageKey);

  // Store callbacks in refs so callers can pass inline functions without
  // causing the persist/hydrate effects to re-run on every render.
  const serializeRef = useRef(serialize);
  serializeRef.current = serialize;
  const deserializeRef = useRef(deserialize);
  deserializeRef.current = deserialize;
  const shouldPersistRef = useRef(shouldPersist);
  shouldPersistRef.current = shouldPersist;

  useReloadStateLayoutEffect(() => {
    hydratedKeyRef.current = storageKey;
    setStateRecord({
      key: storageKey,
      value: readStoredState({
        key: storageKey,
        fallback: initialValue,
        storage,
        deserialize: deserializeRef.current,
      }),
    });
  }, [storageKey, initialValue, storage]);

  useEffect(() => {
    if (hydratedKeyRef.current !== storageKey || stateRecord.key !== storageKey) {
      return;
    }

    persistStoredState({
      key: storageKey,
      value: stateRecord.value,
      storage,
      serialize: serializeRef.current,
      shouldPersist: shouldPersistRef.current,
    });
  }, [storageKey, stateRecord, storage]);

  const setState = useCallback(
    (next: SetStateAction<T>) => {
      setStateRecord((current) => ({
        key: storageKey,
        value: typeof next === 'function' ? (next as (previous: T) => T)(current.value) : next,
      }));
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    clearStoredState(storage, storageKey);
    setStateRecord({ key: storageKey, value: initialValue });
  }, [storage, storageKey, initialValue]);

  return [state, setState, clear] as const;
}
