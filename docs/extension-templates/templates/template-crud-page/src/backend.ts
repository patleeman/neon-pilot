import { randomUUID } from 'node:crypto';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// ── domain types ─────────────────────────────────────────────────────────────

export interface Item {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── persistence ───────────────────────────────────────────────────────────────
// Replace this in-memory store with sqlite, a JSON file, or any other backend.
// For sqlite, see docs/sqlite-migrations.md and use ctx.db from ExtensionBackendContext.

const store = new Map<string, Item>();

// ── actions ───────────────────────────────────────────────────────────────────

export async function list(_input: unknown, _ctx: ExtensionBackendContext): Promise<{ items: Item[] }> {
  const items = [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items };
}

export async function get(input: unknown, _ctx: ExtensionBackendContext): Promise<{ item: Item | null }> {
  const { id } = input as { id: string };
  return { item: store.get(id) ?? null };
}

export async function save(input: unknown, _ctx: ExtensionBackendContext): Promise<{ item: Item }> {
  const { id, name, description, enabled } = input as Partial<Item>;

  const now = new Date().toISOString();

  if (id && store.has(id)) {
    // Update
    const existing = store.get(id)!;
    const updated: Item = {
      ...existing,
      name: name ?? existing.name,
      description: description ?? existing.description,
      enabled: enabled ?? existing.enabled,
      updatedAt: now,
    };
    store.set(id, updated);
    return { item: updated };
  }

  // Create
  const newItem: Item = {
    id: randomUUID(),
    name: name ?? 'Untitled',
    description: description ?? '',
    enabled: enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
  store.set(newItem.id, newItem);
  return { item: newItem };
}

export async function del(input: unknown, _ctx: ExtensionBackendContext): Promise<{ ok: boolean }> {
  const { id } = input as { id: string };
  const deleted = store.delete(id);
  return { ok: deleted };
}

// Note: "delete" is a reserved word in JS; export it under the handler name expected by extension.json.
export { del as delete };
