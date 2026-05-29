/**
 * createEntityStore — a normalized reactive entity store with per-ID subscriptions.
 *
 * Designed to work with React's useSyncExternalStore:
 *   - getSnapshot(id) returns a STABLE object reference until that ID is mutated
 *   - subscribe(id, callback) notifies only when that ID changes
 *   - Entities can have any shape; the store uses string keys for lookup.
 */

export interface EntityStore<T> {
  /** Subscribe to changes for a single entity. Returns unsubscribe. */
  subscribe(id: string, callback: () => void): () => void;

  /** Subscribe to any entity being added/removed/changed. Returns unsubscribe. */
  subscribeAll(callback: () => void): () => void;

  /** Stable snapshot for useSyncExternalStore — same ref until ID is mutated. */
  get(id: string): T | undefined;

  /** All entities as a readonly array. */
  getAll(): readonly T[];

  /** Number of tracked entities. */
  get size(): number;

  // ── Mutations ──────────────────────────────────────────────

  /** Add or replace a single entity. */
  upsert(entity: T): void;

  /** Merge partial updates into an existing entity. No-op if the id doesn't exist. */
  patch(id: string, partial: Partial<T>): void;

  /** Replace the entire store contents (e.g. on initial snapshot from SSE). */
  replaceAll(entities: T[]): void;

  /** Remove a single entity. */
  remove(id: string): void;
}

export function createEntityStore<T>(initial?: T[], idAccessor?: (entity: T) => string): EntityStore<T> {
  const getId = idAccessor ?? ((entity: unknown) => (entity as { id: string }).id);
  const entities = new Map<string, T>();
  let snapshots = new Map<string, T>();
  let allSnapshot: readonly T[] = [];
  const listeners = new Map<string, Set<() => void>>();
  const allListeners = new Set<() => void>();

  const rebuildAllSnapshot = () => {
    allSnapshot = Array.from(entities.values());
  };

  const notifyId = (id: string) => {
    listeners.get(id)?.forEach((cb) => cb());
  };

  const notifyAll = () => {
    allListeners.forEach((cb) => cb());
  };

  // Hydrate from initial data
  if (initial) {
    for (const entity of initial) {
      const key = getId(entity);
      entities.set(key, entity);
    }
    snapshots = new Map(entities);
    rebuildAllSnapshot();
  }

  return {
    subscribe(id: string, callback: () => void): () => void {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id)!.add(callback);
      return () => {
        listeners.get(id)?.delete(callback);
      };
    },

    subscribeAll(callback: () => void): () => void {
      allListeners.add(callback);
      return () => {
        allListeners.delete(callback);
      };
    },

    get(id: string): T | undefined {
      return snapshots.get(id);
    },

    getAll(): readonly T[] {
      return allSnapshot;
    },

    get size(): number {
      return entities.size;
    },

    // ── Mutations ──

    upsert(entity: T): void {
      const key = getId(entity);
      entities.set(key, entity);
      snapshots.set(key, entity);
      rebuildAllSnapshot();
      notifyId(key);
      notifyAll();
    },

    patch(id: string, partial: Partial<T>): void {
      const current = entities.get(id);
      if (!current) return;

      // Short-circuit if nothing changed
      let changed = false;
      const keys = Object.keys(partial) as (keyof T)[];
      for (const key of keys) {
        if (current[key] !== partial[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return;

      const next = { ...current, ...partial };
      entities.set(id, next);
      snapshots.set(id, next);
      rebuildAllSnapshot();
      notifyId(id);
      notifyAll();
    },

    replaceAll(newEntities: T[]): void {
      const newMap = new Map<string, T>();
      for (const entity of newEntities) {
        newMap.set(getId(entity), entity);
      }

      // Detect which existing IDs are affected so we can notify them
      const affectedIds = new Set<string>();
      for (const [id, current] of entities) {
        const next = newMap.get(id);
        if (!next) {
          affectedIds.add(id); // removed
        } else if (JSON.stringify(current) !== JSON.stringify(next)) {
          affectedIds.add(id); // changed
        }
      }
      for (const id of newMap.keys()) {
        if (!entities.has(id)) {
          affectedIds.add(id); // added
        }
      }

      entities.clear();
      snapshots.clear();
      for (const [id, entity] of newMap) {
        entities.set(id, entity);
        snapshots.set(id, entity);
      }
      rebuildAllSnapshot();

      for (const id of affectedIds) {
        notifyId(id);
      }
      if (affectedIds.size > 0) {
        notifyAll();
      }
    },

    remove(id: string): void {
      const existed = entities.delete(id);
      snapshots.delete(id);
      rebuildAllSnapshot();
      if (existed) {
        notifyId(id);
        notifyAll();
      }
    },
  };
}
