import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach } from 'vitest';

function createTestStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(String(key)) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(String(key));
    },
    setItem(key: string, value: string) {
      values.set(String(key), String(value));
    },
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createTestStorage(),
    writable: true,
  });
}

if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: globalThis.localStorage,
    writable: true,
  });
}

import { closeActivityDbs } from './packages/core/src/activity.js';
import { closeAutomationDbs } from './packages/desktop/server/automation/store.js';
import { resetAllStores } from './packages/desktop/ui/src/store/stores';

// JSDOM doesn't provide EventSource; provide a minimal mock for components
// that create EventSource instances during render (e.g. VaultFileTree).
if (typeof globalThis.EventSource !== 'function') {
  class EventSourceMock {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSED = 2;
    readyState = EventSourceMock.CONNECTING;
    url: string;
    withCredentials = false;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    constructor(url: string | URL) {
      this.url = String(url);
      queueMicrotask(() => {
        this.readyState = EventSourceMock.OPEN;
        this.dispatchEvent(new Event('open'));
      });
    }
    close() {
      this.readyState = EventSourceMock.CLOSED;
    }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent(event: Event) {
      const handler = this[`on${event.type}` as keyof this];
      if (typeof handler === 'function') {
        (handler as (event: Event) => void).call(this, event);
      }
      return true;
    }
  }
  globalThis.EventSource = EventSourceMock as unknown as typeof EventSource;
}

const GLOBAL_KEY = '__NEON_PILOT_VITEST_STATE_ROOT__' as const;

const globalForTestStateRoot = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: string;
};

if (!globalForTestStateRoot[GLOBAL_KEY]) {
  const stateRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-vitest-state-'));
  globalForTestStateRoot[GLOBAL_KEY] = stateRoot;

  process.once('exit', () => {
    rmSync(stateRoot, { recursive: true, force: true });
  });
}

if (!process.env.NEON_PILOT_STATE_ROOT) {
  process.env.NEON_PILOT_STATE_ROOT = globalForTestStateRoot[GLOBAL_KEY]!;
}

beforeEach(() => {
  resetAllStores();
});

afterEach(() => {
  closeActivityDbs();
  closeAutomationDbs();
});
