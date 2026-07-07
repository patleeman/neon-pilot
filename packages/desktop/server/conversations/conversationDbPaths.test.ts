import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { type DesktopRootLayout } from '@neon-pilot/core';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CONVERSATIONS_DB_ENV_KEY,
  ensureConversationsDbFile,
  resolveConversationsDbFile,
  resolveConversationsDbFileFromLayout,
  setConversationsDbLayout,
} from './conversationDbPaths.js';

const tempRoots: string[] = [];
const originalConversationsDbEnv = process.env[CONVERSATIONS_DB_ENV_KEY];

function createLayout(): DesktopRootLayout {
  const root = mkdtempSync(join(tmpdir(), 'neon-pilot-conversation-db-layout-'));
  tempRoots.push(root);
  return {
    systemRuntime: join(root, 'system', 'runtime'),
    systemConversations: join(root, 'system', 'conversations'),
  } as DesktopRootLayout;
}

describe('conversation db paths', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
    setConversationsDbLayout(undefined);
    if (originalConversationsDbEnv === undefined) {
      delete process.env[CONVERSATIONS_DB_ENV_KEY];
    } else {
      process.env[CONVERSATIONS_DB_ENV_KEY] = originalConversationsDbEnv;
    }
  });

  it('resolves the conversations database under layout system conversations area', () => {
    const layout = createLayout();
    const expected = join(layout.systemConversations, 'conversations.db');

    expect(resolveConversationsDbFileFromLayout(layout)).toBe(expected);
    expect(resolveConversationsDbFile(layout)).toBe(expected);
  });

  it('ensures the layout conversations database directory exists', () => {
    const layout = createLayout();
    const dbFile = ensureConversationsDbFile(layout);

    expect(dbFile).toBe(join(layout.systemConversations, 'conversations.db'));
    expect(existsSync(dirname(dbFile))).toBe(true);
  });

  it('resolves conversations database from default layout when no explicit layout passed', () => {
    const layout = createLayout();
    const expected = join(layout.systemConversations, 'conversations.db');

    try {
      setConversationsDbLayout(layout);
      expect(resolveConversationsDbFile()).toBe(expected);
      const dbFile = ensureConversationsDbFile();
      expect(dbFile).toBe(expected);
      expect(existsSync(dirname(dbFile))).toBe(true);
    } finally {
      setConversationsDbLayout(undefined);
    }
  });

  describe('env fallback', () => {
    it('uses env var when no layout and no default layout are set', () => {
      const envPath = '/env/fallback/conversations.db';
      process.env[CONVERSATIONS_DB_ENV_KEY] = envPath;

      expect(resolveConversationsDbFile()).toBe(envPath);
    });

    it('env var is ignored when an explicit layout is provided', () => {
      const layout = createLayout();
      const expected = join(layout.systemConversations, 'conversations.db');

      process.env[CONVERSATIONS_DB_ENV_KEY] = '/env/override/should-not-be-used.db';

      expect(resolveConversationsDbFile(layout)).toBe(expected);
    });

    it('env var is ignored when default layout is set', () => {
      const layout = createLayout();
      const expected = join(layout.systemConversations, 'conversations.db');

      process.env[CONVERSATIONS_DB_ENV_KEY] = '/env/override/should-not-be-used.db';

      try {
        setConversationsDbLayout(layout);
        expect(resolveConversationsDbFile()).toBe(expected);
      } finally {
        setConversationsDbLayout(undefined);
      }
    });
  });
});
