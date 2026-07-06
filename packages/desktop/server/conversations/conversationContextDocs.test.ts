import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DesktopRootLayout } from '@neon-pilot/core';
import { describe, expect, it } from 'vitest';

import {
  buildAttachedConversationContextDocsContext,
  readConversationContextDocs,
  resolveConversationContextDocsDirFromLayout,
  resolveConversationContextDocsPathFromLayout,
  writeConversationContextDocs,
} from './conversationContextDocs.js';

function createStateRoot(): string {
  return mkdtempSync(join(tmpdir(), 'neon-pilot-conversation-context-docs-'));
}

describe('conversationContextDocs', () => {
  it('writes, dedupes, and reads attached context docs', () => {
    const stateRoot = createStateRoot();

    const saved = writeConversationContextDocs({
      stateRoot,
      conversationId: 'conversation-1',
      attachedContextDocs: [
        {
          path: '/knowledge/work/design.md',
          title: 'Design',
          kind: 'doc',
          mentionId: '@design',
          summary: 'Primary design brief',
        },
        {
          path: '/knowledge/work/design.md',
          title: 'Duplicate',
          kind: 'doc',
        },
        {
          path: '/knowledge/references/schema.sql',
          title: 'schema.sql',
          kind: 'file',
        },
      ],
    });

    expect(saved).toEqual([
      {
        path: '/knowledge/work/design.md',
        title: 'Design',
        kind: 'doc',
        mentionId: '@design',
        summary: 'Primary design brief',
      },
      {
        path: '/knowledge/references/schema.sql',
        title: 'schema.sql',
        kind: 'file',
      },
    ]);

    expect(readConversationContextDocs('conversation-1', stateRoot)).toEqual(saved);
  });

  describe('layout-based resolvers', () => {
    function createLayout(): DesktopRootLayout {
      const root = createStateRoot();
      return {
        root,
        data: join(root, 'data'),
      } as DesktopRootLayout;
    }

    it('resolves the context docs directory from a DesktopRootLayout', () => {
      const layout = {
        root: '/tmp/test-neon-pilot',
        data: '/tmp/test-neon-pilot/data',
      } as DesktopRootLayout;

      const dir = resolveConversationContextDocsDirFromLayout(layout);

      expect(dir).toBe('/tmp/test-neon-pilot/data/conversations/context-docs');
    });

    it('resolves the per-conversation file path from a DesktopRootLayout', () => {
      const layout = {
        root: '/tmp/test-neon-pilot',
        data: '/tmp/test-neon-pilot/data',
      } as DesktopRootLayout;

      const path = resolveConversationContextDocsPathFromLayout(layout, 'conv-abc');

      expect(path).toBe('/tmp/test-neon-pilot/data/conversations/context-docs/conv-abc.json');
    });

    it('uses the data directory, not the legacy pi-agent/state nest', () => {
      const layout = {
        root: '/custom/agent-root',
        data: '/custom/agent-root/data',
      } as DesktopRootLayout;

      const dir = resolveConversationContextDocsDirFromLayout(layout);
      const path = resolveConversationContextDocsPathFromLayout(layout, 'sentinel-conv');

      expect(dir).toContain('/custom/agent-root/data');
      expect(dir).not.toContain('pi-agent');
      expect(dir).not.toContain('state');

      expect(path).toContain('/custom/agent-root/data');
      expect(path).not.toContain('pi-agent');
      expect(path).not.toContain('state');
      expect(path).toContain('sentinel-conv.json');
    });

    it('writes, reads, and removes docs under the layout data directory', () => {
      const layout = createLayout();

      const saved = writeConversationContextDocs({
        stateRoot: layout,
        conversationId: 'layout conversation',
        attachedContextDocs: [
          {
            path: '/knowledge/work/layout.md',
            title: 'Layout',
            kind: 'doc',
          },
        ],
      });

      const layoutPath = resolveConversationContextDocsPathFromLayout(layout, 'layout conversation');
      const legacyPath = join(layout.root, 'pi-agent', 'state', 'conversation-context-docs', 'layout%20conversation.json');

      expect(layoutPath).toBe(join(layout.data, 'conversations', 'context-docs', 'layout%20conversation.json'));
      expect(existsSync(layoutPath)).toBe(true);
      expect(existsSync(legacyPath)).toBe(false);
      expect(readConversationContextDocs('layout conversation', layout)).toEqual(saved);

      writeConversationContextDocs({
        stateRoot: layout,
        conversationId: 'layout conversation',
        attachedContextDocs: [],
      });

      expect(existsSync(layoutPath)).toBe(false);
    });
  });

  it('builds a readable prompt context block', () => {
    const context = buildAttachedConversationContextDocsContext([
      {
        path: '/knowledge/work/design.md',
        title: 'Design',
        kind: 'doc',
        mentionId: '@design',
        summary: 'Primary design brief',
      },
    ]);

    expect(context).toContain('Attached conversation context docs:');
    expect(context).toContain('Design');
    expect(context).toContain('/knowledge/work/design.md');
    expect(context).toContain('Primary design brief');
    expect(context).toContain('@design');
  });
});
