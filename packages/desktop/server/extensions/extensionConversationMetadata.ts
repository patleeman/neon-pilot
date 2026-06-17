import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { getStateRoot } from '@neon-pilot/core';

import { invalidateAppTopics, publishAppEvent } from '../shared/appEvents.js';
import { publishExtensionHostEvent } from './extensionSubscriptions.js';

interface ConversationMetadataFile {
  version: 1;
  conversationId: string;
  namespaces: Record<string, Record<string, unknown>>;
  updatedAt: string;
}

export interface ConversationMetadataQuery {
  namespace: string;
  where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
  limit?: number;
}

function encodeId(id: string): string {
  const normalized = id.trim();
  if (!normalized) throw new Error('conversationId required');
  return encodeURIComponent(normalized);
}

function metadataDir(runtimeScope: string, stateRoot = getStateRoot()): string {
  return join(stateRoot, 'conversation-metadata', runtimeScope || 'shared');
}

function metadataPath(conversationId: string, runtimeScope: string, stateRoot?: string): string {
  return join(metadataDir(runtimeScope, stateRoot), `${encodeId(conversationId)}.json`);
}

function readFile(conversationId: string, runtimeScope: string, stateRoot?: string): ConversationMetadataFile {
  const file = metadataPath(conversationId, runtimeScope, stateRoot);
  if (!existsSync(file)) {
    return { version: 1, conversationId: conversationId.trim(), namespaces: {}, updatedAt: new Date(0).toISOString() };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as Partial<ConversationMetadataFile>;
    return {
      version: 1,
      conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : conversationId.trim(),
      namespaces: parsed.namespaces && typeof parsed.namespaces === 'object' && !Array.isArray(parsed.namespaces) ? parsed.namespaces : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return { version: 1, conversationId: conversationId.trim(), namespaces: {}, updatedAt: new Date(0).toISOString() };
  }
}

function writeFile(state: ConversationMetadataFile, runtimeScope: string, stateRoot?: string): void {
  const file = metadataPath(state.conversationId, runtimeScope, stateRoot);
  const namespaces = Object.fromEntries(Object.entries(state.namespaces).filter(([, value]) => Object.keys(value).length > 0));
  if (Object.keys(namespaces).length === 0) {
    rmSync(file, { force: true });
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...state, namespaces }, null, 2)}\n`, 'utf-8');
}

function namespaceKey(namespace: string | undefined, fallback: string): string {
  const key = namespace?.trim() || fallback.trim();
  if (!key) throw new Error('namespace required');
  return key;
}

function matchesWhere(metadata: Record<string, unknown>, where: ConversationMetadataQuery['where']): boolean {
  for (const clause of where ?? []) {
    const key = clause.key?.trim();
    if (!key) return false;
    const op = clause.op ?? 'eq';
    const actual = metadata[key];
    if (op === 'exists') {
      if (!(key in metadata)) return false;
      continue;
    }
    if (op === 'eq' && actual !== clause.value) return false;
    if (op === 'neq' && actual === clause.value) return false;
    if (op === 'in') {
      if (!Array.isArray(clause.value) || !clause.value.includes(actual)) return false;
    }
  }
  return true;
}

export function readConversationMetadata(input: {
  conversationId: string;
  namespace?: string;
  extensionId: string;
  runtimeScope?: string;
  stateRoot?: string;
}): Record<string, unknown> {
  const namespace = namespaceKey(input.namespace, input.extensionId);
  return { ...(readFile(input.conversationId, input.runtimeScope ?? 'shared', input.stateRoot).namespaces[namespace] ?? {}) };
}

export function listConversationMetadataNamespaces(input: { conversationId: string; runtimeScope?: string; stateRoot?: string }): string[] {
  return Object.entries(readFile(input.conversationId, input.runtimeScope ?? 'shared', input.stateRoot).namespaces)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0)
    .map(([namespace]) => namespace)
    .sort();
}

export async function writeConversationMetadata(input: {
  conversationId: string;
  namespace?: string;
  values: Record<string, unknown>;
  extensionId: string;
  runtimeScope?: string;
  stateRoot?: string;
}): Promise<Record<string, unknown>> {
  if (!input.values || typeof input.values !== 'object' || Array.isArray(input.values)) throw new Error('values must be an object');
  const runtimeScope = input.runtimeScope ?? 'shared';
  const namespace = namespaceKey(input.namespace, input.extensionId);
  const state = readFile(input.conversationId, runtimeScope, input.stateRoot);
  const existing = state.namespaces[namespace] ?? {};
  const next = { ...existing };
  for (const [key, value] of Object.entries(input.values)) {
    if (!key.trim()) continue;
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
  }
  const updated: ConversationMetadataFile = {
    version: 1,
    conversationId: input.conversationId.trim(),
    namespaces: { ...state.namespaces, [namespace]: next },
    updatedAt: new Date().toISOString(),
  };
  writeFile(updated, runtimeScope, input.stateRoot);
  invalidateAppTopics('sessions');
  publishAppEvent({ type: 'session_meta_changed', sessionId: input.conversationId.trim() });
  await publishExtensionHostEvent('conversationSessions', {
    type: 'session.metadata.updated',
    conversationId: input.conversationId.trim(),
    namespace,
    updatedAt: updated.updatedAt,
  });
  return { ...next };
}

export function queryConversationMetadata(input: ConversationMetadataQuery & { runtimeScope?: string; stateRoot?: string }): Array<{
  conversationId: string;
  metadata: Record<string, unknown>;
}> {
  const dir = metadataDir(input.runtimeScope ?? 'shared', input.stateRoot);
  if (!existsSync(dir)) return [];
  const limit = Number.isSafeInteger(input.limit) && input.limit && input.limit > 0 ? Math.min(input.limit, 1000) : 1000;
  const results: Array<{ conversationId: string; metadata: Record<string, unknown> }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const conversationId = decodeURIComponent(entry.name.slice(0, -'.json'.length));
    const metadata = readFile(conversationId, input.runtimeScope ?? 'shared', input.stateRoot).namespaces[input.namespace] ?? {};
    if (!matchesWhere(metadata, input.where)) continue;
    results.push({ conversationId, metadata: { ...metadata } });
    if (results.length >= limit) break;
  }
  return results;
}
