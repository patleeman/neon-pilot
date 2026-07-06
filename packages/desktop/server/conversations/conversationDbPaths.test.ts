import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { type DesktopRootLayout } from '@neon-pilot/core';
import { afterEach, describe, expect, it } from 'vitest';

import { ensureConversationsDbFile, resolveConversationsDbFile, resolveConversationsDbFileFromLayout } from './conversationDbPaths.js';

const tempRoots: string[] = [];

function createLayout(): DesktopRootLayout {
  const root = mkdtempSync(join(tmpdir(), 'neon-pilot-conversation-db-layout-'));
  tempRoots.push(root);
  return {
    systemRuntime: join(root, 'system', 'runtime'),
  } as DesktopRootLayout;
}

describe('conversation db paths', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('resolves the conversations database under layout system runtime', () => {
    const layout = createLayout();
    const expected = join(layout.systemRuntime, 'conversations.db');

    expect(resolveConversationsDbFileFromLayout(layout)).toBe(expected);
    expect(resolveConversationsDbFile(layout)).toBe(expected);
  });

  it('ensures the layout conversations database directory exists', () => {
    const layout = createLayout();
    const dbFile = ensureConversationsDbFile(layout);

    expect(dbFile).toBe(join(layout.systemRuntime, 'conversations.db'));
    expect(existsSync(dirname(dbFile))).toBe(true);
  });
});
