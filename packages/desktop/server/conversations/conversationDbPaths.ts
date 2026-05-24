import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { getPiAgentRuntimeDir } from '@neon-pilot/core';

export const CONVERSATIONS_DB_FILE_NAME = 'conversations.db';
export const LEGACY_CONVERSATION_CONTEXT_DB_FILE_NAME = 'conversation-context.db';

export function resolveAgentRuntimeDir(): string {
  return getPiAgentRuntimeDir();
}

export function resolveConversationsDbFile(): string {
  return join(resolveAgentRuntimeDir(), CONVERSATIONS_DB_FILE_NAME);
}

export function resolveLegacyConversationContextDbFile(): string {
  return join(resolveAgentRuntimeDir(), LEGACY_CONVERSATION_CONTEXT_DB_FILE_NAME);
}

export function ensureConversationsDbFileMigrated(): string {
  const dbFile = resolveConversationsDbFile();
  mkdirSync(dirname(dbFile), { recursive: true });

  const legacyDbFile = resolveLegacyConversationContextDbFile();
  if (!existsSync(dbFile) && existsSync(legacyDbFile)) {
    copyFileSync(legacyDbFile, dbFile);
  }

  return dbFile;
}
