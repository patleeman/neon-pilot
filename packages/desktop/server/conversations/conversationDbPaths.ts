import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { getPiAgentRuntimeDir } from '@neon-pilot/core';

export const CONVERSATIONS_DB_FILE_NAME = 'conversations.db';

export function resolveAgentRuntimeDir(): string {
  return getPiAgentRuntimeDir();
}

export function resolveConversationsDbFile(): string {
  return join(resolveAgentRuntimeDir(), CONVERSATIONS_DB_FILE_NAME);
}

export function ensureConversationsDbFile(): string {
  const dbFile = resolveConversationsDbFile();
  mkdirSync(dirname(dbFile), { recursive: true });
  return dbFile;
}
