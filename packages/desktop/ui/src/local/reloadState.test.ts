// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { clearStoredState, persistStoredState, readStoredState, type StorageLike, useReloadState } from './reloadState';

function createStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

describe('reloadState helpers', () => {
  it('falls back when storage is missing or empty', () => {
    expect(readStoredState({ key: 'missing', fallback: 'draft', storage: null, deserialize: (raw) => raw })).toBe('draft');
    expect(readStoredState({ key: 'missing', fallback: 'draft', storage: createStorage(), deserialize: (raw) => raw })).toBe('draft');
  });

  it('persists and restores typed values', () => {
    const storage = createStorage();

    persistStoredState({ key: 'composer', value: { text: 'hello', count: 2 }, storage });

    expect(
      readStoredState({
        key: 'composer',
        fallback: { text: '', count: 0 },
        storage,
      }),
    ).toEqual({ text: 'hello', count: 2 });
  });

  it('removes stored values when shouldPersist returns false', () => {
    const storage = createStorage();

    persistStoredState({ key: 'composer', value: 'draft', storage, serialize: (value) => value });
    persistStoredState({
      key: 'composer',
      value: '',
      storage,
      serialize: (value) => value,
      shouldPersist: (value) => value.length > 0,
    });

    expect(readStoredState({ key: 'composer', fallback: 'fallback', storage, deserialize: (raw) => raw })).toBe('fallback');
  });

  it('clears stored values explicitly', () => {
    const storage = createStorage();

    persistStoredState({ key: 'composer', value: 'draft', storage, serialize: (value) => value });
    clearStoredState(storage, 'composer');

    expect(readStoredState({ key: 'composer', fallback: 'fallback', storage, deserialize: (raw) => raw })).toBe('fallback');
  });
});

describe('useReloadState', () => {
  it('does not persist the previous key value into the next key during hydration', () => {
    const storage = createStorage();
    storage.setItem('draft', JSON.stringify('Create a subagent'));

    const { result, rerender } = renderHook(
      ({ storageKey }) =>
        useReloadState({
          storageKey,
          initialValue: '',
          storage,
          shouldPersist: (value: string) => value.length > 0,
        }),
      { initialProps: { storageKey: 'draft' as string | null } },
    );

    expect(result.current[0]).toBe('Create a subagent');

    rerender({ storageKey: 'next' });

    expect(result.current[0]).toBe('');
    expect(storage.getItem('next')).toBeNull();
    expect(storage.getItem('draft')).toBe(JSON.stringify('Create a subagent'));
  });
});
