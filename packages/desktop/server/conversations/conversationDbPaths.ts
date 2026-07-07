import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type DesktopRootLayout, getPiAgentRuntimeDir } from '@neon-pilot/core';

export const CONVERSATIONS_DB_FILE_NAME = 'conversations.db';

// Module-level default layout for conversation database path resolution.
// Set via setConversationsDbLayout (typically from conversationService context).
let defaultLayout: DesktopRootLayout | undefined;

/**
 * Set the default DesktopRootLayout for conversation database path resolution.
 * Modules that access the DB through module-level singletons (catalog, summaries,
 * search index) use this when no explicit layout is passed.
 * Pass undefined to reset (primarily for test isolation).
 */
export function setConversationsDbLayout(layout: DesktopRootLayout | undefined): void {
  defaultLayout = layout;
}

export function resolveConversationsDbFileFromLayout(layout: DesktopRootLayout): string {
  return join(layout.systemConversations, CONVERSATIONS_DB_FILE_NAME);
}

export function resolveAgentRuntimeDir(): string {
  return getPiAgentRuntimeDir();
}

export function resolveConversationsDbFile(layout?: DesktopRootLayout): string {
  if (layout) {
    return resolveConversationsDbFileFromLayout(layout);
  }
  if (defaultLayout) {
    return resolveConversationsDbFileFromLayout(defaultLayout);
  }
  return join(resolveAgentRuntimeDir(), CONVERSATIONS_DB_FILE_NAME);
}

export function ensureConversationsDbFile(layout?: DesktopRootLayout): string {
  const dbFile = resolveConversationsDbFile(layout);
  mkdirSync(dirname(dbFile), { recursive: true });
  return dbFile;
}
