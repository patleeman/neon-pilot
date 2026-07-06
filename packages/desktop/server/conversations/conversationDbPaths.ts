import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type DesktopRootLayout, getPiAgentRuntimeDir } from '@neon-pilot/core';

export const CONVERSATIONS_DB_FILE_NAME = 'conversations.db';

export function resolveConversationsDbFileFromLayout(layout: DesktopRootLayout): string {
  return join(layout.systemRuntime, CONVERSATIONS_DB_FILE_NAME);
}

export function resolveAgentRuntimeDir(): string {
  return getPiAgentRuntimeDir();
}

export function resolveConversationsDbFile(layout?: DesktopRootLayout): string {
  return layout ? resolveConversationsDbFileFromLayout(layout) : join(resolveAgentRuntimeDir(), CONVERSATIONS_DB_FILE_NAME);
}

export function ensureConversationsDbFile(layout?: DesktopRootLayout): string {
  const dbFile = resolveConversationsDbFile(layout);
  mkdirSync(dirname(dbFile), { recursive: true });
  return dbFile;
}
