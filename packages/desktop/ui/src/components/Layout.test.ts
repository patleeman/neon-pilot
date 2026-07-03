/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import type { SessionMeta } from '../shared/types';
import {
  clearSelectedWorkbenchTool,
  clearWorkbenchOnlySearchParamsForCompact,
  focusComposerTextarea,
  focusFirstSidebarControl,
  readStoredPanelWidth,
  readStoredWorkbenchExplorerOpen,
  readStoredWorkbenchTabs,
  removeTerminalWorkbenchTabs,
  resolveActiveWorkspaceCwd,
  shouldAllowWorkbenchRailSurface,
  shouldOpenFilesWorkbenchByDefaultForEmbeddedWindow,
  shouldResetEmptyArtifactsRail,
} from './Layout';
import { isArtifactsRailMode, resolveActiveExtensionWorkbenchSurface, resolveWorkbenchRailMode } from './layout/workbenchRailModel';
import { shouldRenderExtensionToolPanelInWorkbenchNav } from './workbenchNav';

function createSession(overrides: Partial<SessionMeta>): SessionMeta {
  return {
    id: 'conversation-1',
    file: '/tmp/conversation-1.jsonl',
    timestamp: '2026-04-01T00:00:00.000Z',
    cwd: '/tmp/worktree',
    cwdSlug: 'worktree',
    model: 'openai/gpt-5.4',
    title: 'Conversation 1',
    messageCount: 1,
    ...overrides,
  };
}

describe('Layout workspace selection', () => {
  it('uses the active conversation cwd for the workbench workspace', () => {
    expect(resolveActiveWorkspaceCwd([createSession({ id: 'local', cwd: '/tmp/local' })], 'local')).toBe('/tmp/local');
    expect(resolveActiveWorkspaceCwd([createSession({ id: 'other', cwd: '/tmp/other' })], 'missing')).toBeNull();
  });

  it('uses the draft cwd while the new conversation route is active', () => {
    expect(
      resolveActiveWorkspaceCwd([createSession({ id: 'local', cwd: '/tmp/local' })], null, {
        pathname: '/conversations/new',
        draftCwd: ' /tmp/draft-workspace ',
      }),
    ).toBe('/tmp/draft-workspace');
    expect(
      resolveActiveWorkspaceCwd([createSession({ id: 'local', cwd: '/tmp/local' })], 'local', {
        pathname: '/conversations/new',
        draftCwd: '',
      }),
    ).toBeNull();
  });
});

describe('Layout focus commands', () => {
  it('reports whether the composer focus command moved focus', () => {
    document.body.innerHTML = '<main><button type="button">Main</button></main>';

    expect(focusComposerTextarea()).toBe(false);

    document.body.innerHTML = '<textarea placeholder="Message Codex"></textarea>';
    const composer = document.querySelector('textarea');

    expect(focusComposerTextarea()).toBe(true);
    expect(document.activeElement).toBe(composer);
  });

  it('reports whether the sidebar focus command moved focus', () => {
    document.body.innerHTML = '<main><button type="button">Main</button></main>';

    expect(focusFirstSidebarControl()).toBe(false);

    document.body.innerHTML = '<main><button type="button">Main</button></main><aside><button type="button">Chat</button></aside>';
    const sidebarButton = document.querySelector('aside button');

    expect(focusFirstSidebarControl()).toBe(true);
    expect(document.activeElement).toBe(sidebarButton);
  });
});

describe('Layout workbench rail state', () => {
  it('defaults the workbench sidebar open and restores an explicit collapsed state', () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
    } as Storage;

    expect(readStoredWorkbenchExplorerOpen(localStorage)).toBe(true);

    storage.set('pa:workbench-explorer-open', 'false');
    expect(readStoredWorkbenchExplorerOpen(localStorage)).toBe(false);

    storage.set('pa:workbench-explorer-open', 'true');
    expect(readStoredWorkbenchExplorerOpen(localStorage)).toBe(true);
  });

  it('keeps extension-backed empty workbench rails active', () => {
    expect(
      shouldResetEmptyArtifactsRail({
        activeTool: 'artifacts',
        artifactsLoading: false,
        artifactCount: 0,
        hasArtifactsExtensionSurface: true,
      }),
    ).toBe(false);
    expect(
      shouldResetEmptyArtifactsRail({
        activeTool: 'artifacts',
        artifactsLoading: false,
        artifactCount: 0,
        hasArtifactsExtensionSurface: false,
      }),
    ).toBe(true);
  });

  it('keeps picker rails available before a file is selected', () => {
    expect(shouldAllowWorkbenchRailSurface({ activeToolSlot: 'knowledge', hasPairedDocument: false })).toBe(true);
    expect(shouldAllowWorkbenchRailSurface({ activeToolSlot: 'files', hasPairedDocument: false, hasWorkspaceCwd: true })).toBe(true);
    expect(shouldAllowWorkbenchRailSurface({ activeToolSlot: 'files', hasPairedDocument: false, hasWorkspaceCwd: false })).toBe(false);
    expect(shouldAllowWorkbenchRailSurface({ activeToolSlot: 'files', hasPairedDocument: true })).toBe(true);
    expect(shouldAllowWorkbenchRailSurface({ activeToolSlot: 'artifacts', hasPairedDocument: false })).toBe(false);
  });

  it('defaults embedded windowed chat workbenches with a workspace to Files', () => {
    expect(
      shouldOpenFilesWorkbenchByDefaultForEmbeddedWindow({
        embeddedWindowChrome: true,
        forceWorkbench: true,
        activeWorkbenchTool: 'new',
        hasWorkspaceCwd: true,
        hasActiveWorkbenchTab: false,
        hasSavedConversationTool: false,
      }),
    ).toBe(true);
    expect(
      shouldOpenFilesWorkbenchByDefaultForEmbeddedWindow({
        embeddedWindowChrome: false,
        forceWorkbench: true,
        activeWorkbenchTool: 'new',
        hasWorkspaceCwd: true,
        hasActiveWorkbenchTab: false,
        hasSavedConversationTool: false,
      }),
    ).toBe(false);
    expect(
      shouldOpenFilesWorkbenchByDefaultForEmbeddedWindow({
        embeddedWindowChrome: true,
        forceWorkbench: true,
        activeWorkbenchTool: 'new',
        hasWorkspaceCwd: true,
        hasActiveWorkbenchTab: false,
        hasSavedConversationTool: true,
      }),
    ).toBe(false);
  });

  it('normalizes declared rail slots to stable built-in modes', () => {
    expect(
      resolveWorkbenchRailMode('artifacts', { extensionId: 'system-artifacts', id: 'artifacts-tool', toolSlot: 'artifacts' } as never),
    ).toBe('artifacts');
  });

  it('does not hide extension panels by extension id', () => {
    expect(shouldRenderExtensionToolPanelInWorkbenchNav('system-files')).toBe(true);
    expect(shouldRenderExtensionToolPanelInWorkbenchNav('system-artifacts')).toBe(true);
  });

  it('resolves built-in slot detail views without extension mode state', () => {
    expect(
      resolveActiveExtensionWorkbenchSurface({
        activeWorkbenchTool: 'files',
        extensionRightToolPanels: [
          { extensionId: 'system-files', id: 'files-tool', detailView: 'files-workbench', toolSlot: 'files' } as never,
        ],
        extensionWorkbenchSurfaces: [{ extensionId: 'system-files', id: 'files-workbench' } as never],
      }),
    ).toEqual({ extensionId: 'system-files', id: 'files-workbench' });

    expect(
      resolveActiveExtensionWorkbenchSurface({
        activeWorkbenchTool: 'browser',
        extensionRightToolPanels: [
          { extensionId: 'system-browser', id: 'browser-tool', detailView: 'browser-workbench', toolSlot: 'browser' } as never,
        ],
        extensionWorkbenchSurfaces: [{ extensionId: 'system-browser', id: 'browser-workbench' } as never],
      }),
    ).toEqual({ extensionId: 'system-browser', id: 'browser-workbench' });
  });

  it('recognizes extension-backed artifacts as artifacts rail mode', () => {
    expect(isArtifactsRailMode('artifacts')).toBe(true);
    expect(isArtifactsRailMode('extension:system-artifacts:conversation-artifacts')).toBe(false);
    expect(isArtifactsRailMode('extension:system-files:file-explorer')).toBe(false);
  });

  it('clears workbench-only diff and run params when switching to compact mode', () => {
    expect(clearWorkbenchOnlySearchParamsForCompact('checkpoint=abc123&run=run-1&file=notes%2Ftodo.md&artifact=artifact-1')).toBe(
      'file=notes%2Ftodo.md&artifact=artifact-1',
    );
  });

  it('retires terminal tabs when the workbench is hidden', () => {
    expect(
      removeTerminalWorkbenchTabs(
        [
          { id: 'files-1', mode: 'files' },
          { id: 'terminal-1', mode: 'terminal' },
          { id: 'chat-1', mode: 'chat', conversationId: 'chat-1' },
        ],
        'terminal-1',
      ),
    ).toEqual({
      nextTabs: [
        { id: 'files-1', mode: 'files' },
        { id: 'chat-1', mode: 'chat', conversationId: 'chat-1' },
      ],
      nextActiveTabId: 'chat-1',
      removed: true,
    });

    expect(removeTerminalWorkbenchTabs([{ id: 'files-1', mode: 'files' }], 'files-1')).toEqual({
      nextTabs: [{ id: 'files-1', mode: 'files' }],
      nextActiveTabId: 'files-1',
      removed: false,
    });

    expect(
      removeTerminalWorkbenchTabs(
        [
          { id: 'terminal-1', mode: 'terminal' },
          { id: 'files-1', mode: 'files' },
          { id: 'chat-1', mode: 'chat', conversationId: 'chat-1' },
        ],
        'terminal-1',
      ),
    ).toEqual({
      nextTabs: [
        { id: 'files-1', mode: 'files' },
        { id: 'chat-1', mode: 'chat', conversationId: 'chat-1' },
      ],
      nextActiveTabId: 'files-1',
      removed: true,
    });
  });

  it('clears stale conversation tool selections when terminal tabs are retired', () => {
    expect(
      clearSelectedWorkbenchTool(
        {
          'conversation-1': 'terminal',
          'conversation-2': 'files',
        },
        'terminal',
      ),
    ).toEqual({
      'conversation-2': 'files',
    });

    const preserved = {
      'conversation-1': 'files',
      'conversation-2': 'chat',
    } as const;
    expect(clearSelectedWorkbenchTool(preserved, 'terminal')).toBe(preserved);
  });

  it('restores persisted workbench tabs with the saved active tab', () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
    } as Storage;
    storage.set(
      'pa:workbench-tabs',
      JSON.stringify({
        tabs: [
          { id: 'files', mode: 'files' },
          { id: 'terminal-1', mode: 'terminal' },
          { id: 'extension-notes', mode: 'extension:system-notes:notes' },
        ],
        activeTabId: 'terminal-1',
      }),
    );

    expect(readStoredWorkbenchTabs(localStorage)).toEqual({
      tabs: [
        { id: 'files', mode: 'files' },
        { id: 'terminal-1', mode: 'terminal' },
        { id: 'extension-notes', mode: 'extension:system-notes:notes' },
      ],
      activeTabId: 'terminal-1',
    });
  });

  it('drops persisted tabs for removed workbench tools', () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
    } as Storage;
    storage.set(
      'pa:workbench-tabs',
      JSON.stringify({
        tabs: [
          { id: 'scratchpad', mode: 'scratchpad' },
          { id: 'files', mode: 'files' },
        ],
        activeTabId: 'scratchpad',
      }),
    );

    expect(readStoredWorkbenchTabs(localStorage)).toEqual({
      tabs: [{ id: 'files', mode: 'files' }],
      activeTabId: null,
    });
  });
});

describe('Layout panel sizing', () => {
  it('ignores malformed stored panel widths instead of partially parsing them', () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
    } as Storage;
    storage.set('panel-width', '320px');

    expect(readStoredPanelWidth('panel-width', 280, 180, localStorage)).toBe(280);

    storage.set('panel-width', String(Number.MAX_SAFE_INTEGER + 1));
    expect(readStoredPanelWidth('panel-width', 280, 180, localStorage)).toBe(280);
  });
});
