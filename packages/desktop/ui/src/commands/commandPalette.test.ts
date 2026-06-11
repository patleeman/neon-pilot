import { describe, expect, it } from 'vitest';

import {
  type CommandPaletteItem,
  isCommandPaletteThreadDataLoading,
  isHostCommandDisabledInPalette,
  searchCommandPaletteItems,
  selectCommandPaletteScopedItems,
  shouldBootstrapCommandPaletteThreads,
} from './commandPalette';

interface TestAction {
  kind: string;
}

const ITEMS: CommandPaletteItem<TestAction>[] = [
  {
    id: 'open:alpha',
    section: 'open',
    title: 'Alpha issue triage',
    subtitle: '/tmp/alpha',
    keywords: ['conv-open-1', 'alpha body text'],
    order: 1,
    action: { kind: 'open' },
  },
  {
    id: 'archived:beta',
    section: 'archived',
    title: 'Beta cleanup',
    subtitle: '/tmp/archive',
    keywords: ['conv-archive-1', 'beta body text'],
    order: 1,
    action: { kind: 'restore' },
  },
  {
    id: 'file:guide',
    section: 'knowledge',
    title: 'Workspace Files',
    subtitle: 'notes/workspace-files.md',
    keywords: ['workspaces', 'workspace layout guide'],
    order: 1,
    action: { kind: 'file' },
  },
  {
    id: 'run:daily-build',
    section: 'runs',
    title: 'Daily build run',
    subtitle: 'runs/daily-build',
    keywords: ['automation', 'build'],
    order: 1,
    action: { kind: 'run' },
  },
];

describe('command palette search', () => {
  it('keeps bridge-handled app chrome host commands selectable in the command palette', () => {
    expect(isHostCommandDisabledInPalette('layout.toggleSidebar', { activeConversationId: null })).toBe(false);
    expect(isHostCommandDisabledInPalette('page.find', { activeConversationId: null })).toBe(false);
  });

  it('disables host commands that require arguments the command palette cannot supply', () => {
    expect(isHostCommandDisabledInPalette('app.navigate', { activeConversationId: 'conversation-1' })).toBe(true);
    expect(isHostCommandDisabledInPalette('rail.open', { activeConversationId: 'conversation-1' })).toBe(true);
    expect(isHostCommandDisabledInPalette('layout.set', { activeConversationId: 'conversation-1' })).toBe(true);
  });

  it('disables active-conversation host commands when no conversation is active', () => {
    expect(isHostCommandDisabledInPalette('conversation.close', { activeConversationId: null })).toBe(true);
    expect(isHostCommandDisabledInPalette('conversation.close', { activeConversationId: 'conversation-1' })).toBe(false);
  });

  it('disables context-gated host commands when their prerequisites are unavailable', () => {
    expect(
      isHostCommandDisabledInPalette('app.goBack', {
        activeConversationId: 'conversation-1',
        context: { 'app.canGoBack': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('app.goBack', {
        activeConversationId: 'conversation-1',
        context: { 'app.canGoBack': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('app.goForward', {
        activeConversationId: 'conversation-1',
        context: { 'app.canGoForward': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('app.goForward', {
        activeConversationId: 'conversation-1',
        context: { 'app.canGoForward': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('page.findNext', {
        activeConversationId: 'conversation-1',
        context: { 'pageSearch.hasMatches': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('page.findNext', {
        activeConversationId: 'conversation-1',
        context: { 'pageSearch.hasMatches': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('page.findPrevious', {
        activeConversationId: 'conversation-1',
        context: { 'pageSearch.hasMatches': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('page.findPrevious', {
        activeConversationId: 'conversation-1',
        context: { 'pageSearch.hasMatches': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('page.closeFind', {
        activeConversationId: 'conversation-1',
        context: { 'pageSearch.open': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('page.closeFind', {
        activeConversationId: 'conversation-1',
        context: { 'pageSearch.open': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('conversation.saveTitle', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.titleEditorOpen': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('conversation.saveTitle', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.titleEditorOpen': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('conversation.cancelTitleEdit', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.titleEditorOpen': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('conversation.cancelTitleEdit', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.titleEditorOpen': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('notifications.markAllRead', {
        activeConversationId: 'conversation-1',
        context: { 'notifications.hasUnread': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('notifications.markAllRead', {
        activeConversationId: 'conversation-1',
        context: { 'notifications.hasUnread': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('notifications.dismissAll', {
        activeConversationId: 'conversation-1',
        context: { 'notifications.hasVisible': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('notifications.dismissAll', {
        activeConversationId: 'conversation-1',
        context: { 'notifications.hasVisible': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('browser.goBack', {
        activeConversationId: 'conversation-1',
        context: { 'browser.canGoBack': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('browser.goBack', {
        activeConversationId: 'conversation-1',
        context: { 'browser.canGoBack': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('browser.goForward', {
        activeConversationId: 'conversation-1',
        context: { 'browser.canGoForward': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('browser.goForward', {
        activeConversationId: 'conversation-1',
        context: { 'browser.canGoForward': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('browser.reloadOrStop', {
        activeConversationId: 'conversation-1',
        context: { 'browser.active': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('browser.reloadOrStop', {
        activeConversationId: 'conversation-1',
        context: { 'browser.active': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('conversation.saveCwd', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.cwdEditorOpen': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('conversation.saveCwd', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.cwdEditorOpen': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('conversation.cancelCwdEdit', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.cwdEditorOpen': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('conversation.cancelCwdEdit', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.cwdEditorOpen': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('browser.focusLocation', {
        activeConversationId: 'conversation-1',
        context: { 'browser.active': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('browser.focusLocation', {
        activeConversationId: 'conversation-1',
        context: { 'browser.active': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('artifact.copySource', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.active': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('artifact.copySource', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.active': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('artifact.toggleSource', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.canShowSource': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('artifact.toggleSource', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.canShowSource': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('artifact.toggleFullscreen', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.active': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('artifact.toggleFullscreen', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.active': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('artifact.close', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.active': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('artifact.close', {
        activeConversationId: 'conversation-1',
        context: { 'artifact.active': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('imagePreview.close', {
        activeConversationId: 'conversation-1',
        context: { 'imagePreview.active': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('imagePreview.close', {
        activeConversationId: 'conversation-1',
        context: { 'imagePreview.active': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('composer.submit', {
        activeConversationId: 'conversation-1',
        context: { 'composer.canSubmit': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('composer.openSettings', {
        activeConversationId: 'conversation-1',
        context: { 'composer.settingsAvailable': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('composer.openSettings', {
        activeConversationId: 'conversation-1',
        context: { 'composer.settingsAvailable': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('composer.submit', {
        activeConversationId: 'conversation-1',
        context: { 'composer.canSubmit': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('composer.stop', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.isStreaming': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('composer.stop', {
        activeConversationId: 'conversation-1',
        context: { 'conversation.isStreaming': true },
      }),
    ).toBe(false);
    expect(
      isHostCommandDisabledInPalette('dictation.toggle', {
        activeConversationId: 'conversation-1',
        context: { 'system-local-dictation.toggleAvailable': false },
      }),
    ).toBe(true);
    expect(
      isHostCommandDisabledInPalette('dictation.toggle', {
        activeConversationId: 'conversation-1',
        context: { 'system-local-dictation.toggleAvailable': true },
      }),
    ).toBe(false);
  });

  it('filters extension quick-open matches in the requested extension scope', () => {
    const results = searchCommandPaletteItems(ITEMS, { query: 'workspace', scope: 'knowledge', sectionLabels: { knowledge: 'Knowledge' } });

    expect(results).toHaveLength(1);
    expect(results[0]?.section).toBe('knowledge');
    expect(results[0]?.label).toBe('Knowledge');
    expect(results[0]?.items.map((item) => item.id)).toEqual(['file:guide']);
  });

  it('keeps extension quick-open surfaces isolated from each other', () => {
    const scoped = selectCommandPaletteScopedItems({
      scope: 'runs',
      query: '',
      openConversationItems: [ITEMS[0]!],
      archivedConversationItems: [ITEMS[1]!],
      fileItems: [ITEMS[2]!, ITEMS[3]!],
      searchedConversationItems: [],
      searchedFileItems: [],
    });

    expect(scoped.map((item) => item.id)).toEqual(['run:daily-build']);
  });

  it('matches across multiple tokens and keywords', () => {
    const results = searchCommandPaletteItems(ITEMS, { query: 'beta body', scope: 'threads' });

    expect(results).toHaveLength(1);
    expect(results[0]?.section).toBe('archived');
    expect(results[0]?.items[0]?.id).toBe('archived:beta');
  });

  it('filters to the requested thread scope', () => {
    const results = searchCommandPaletteItems(ITEMS, { query: '', scope: 'threads' });

    expect(results.map((group) => group.section)).toEqual(['open', 'archived']);
  });

  it('keeps local file title matches while adding file content-search results', () => {
    const scoped = selectCommandPaletteScopedItems({
      scope: 'knowledge',
      query: 'workspace',
      openConversationItems: [ITEMS[0]!],
      archivedConversationItems: [ITEMS[1]!],
      fileItems: [ITEMS[2]!],
      searchedConversationItems: [],
      searchedFileItems: [
        {
          ...ITEMS[2]!,
          id: 'file-search:guide',
          title: 'Workspace file excerpt',
        },
      ],
    });

    expect(scoped.map((item) => item.id)).toEqual(['file:guide', 'file-search:guide']);

    const results = searchCommandPaletteItems(scoped, { query: 'workspace', scope: 'knowledge' });
    expect(results.flatMap((group) => group.items.map((item) => item.id))).toContain('file:guide');
  });

  it('supports overriding empty-query limits for lazy-loaded thread history', () => {
    const items = [
      ITEMS[1]!,
      {
        ...ITEMS[1]!,
        id: 'archived:gamma',
        title: 'Gamma cleanup',
        order: 2,
      },
    ];
    const results = searchCommandPaletteItems(items, {
      query: '',
      scope: 'threads',
      emptyQueryLimits: { archived: 1 },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.total).toBe(2);
    expect(results[0]?.items.map((item) => item.id)).toEqual(['archived:beta']);

    const malformedLimitResults = searchCommandPaletteItems(items, {
      query: '',
      scope: 'threads',
      emptyQueryLimits: { archived: 1.5 },
    });
    expect(malformedLimitResults[0]?.items.map((item) => item.id)).toEqual(['archived:beta', 'archived:gamma']);
  });

  it('caps excessive empty-query limit overrides', () => {
    const items = Array.from({ length: 150 }, (_, index) => ({
      ...ITEMS[1]!,
      id: `archived:${index}`,
      title: `Archived ${index}`,
      order: index,
    }));

    const results = searchCommandPaletteItems(items, {
      query: '',
      scope: 'threads',
      emptyQueryLimits: { archived: 5000 },
    });

    expect(results[0]?.items).toHaveLength(100);
  });

  it('caps non-empty query results per section to keep keystrokes bounded', () => {
    const items = Array.from({ length: 150 }, (_, index) => ({
      ...ITEMS[1]!,
      id: `archived:${index}`,
      title: `Archived beta ${index}`,
      order: index,
    }));

    const results = searchCommandPaletteItems(items, { query: 'beta', scope: 'threads' });

    expect(results[0]?.total).toBe(150);
    expect(results[0]?.items).toHaveLength(80);
  });

  it('bootstraps thread results when the palette opens before sessions load', () => {
    expect(
      shouldBootstrapCommandPaletteThreads({
        open: true,
        scope: 'threads',
        sessions: null,
        alreadyRequested: false,
      }),
    ).toBe(true);

    expect(
      shouldBootstrapCommandPaletteThreads({
        open: true,
        scope: 'knowledge',
        sessions: null,
        alreadyRequested: false,
      }),
    ).toBe(false);
  });

  it('does not re-bootstrap thread results after the first request or once sessions are loaded', () => {
    expect(
      shouldBootstrapCommandPaletteThreads({
        open: true,
        scope: 'threads',
        sessions: null,
        alreadyRequested: true,
      }),
    ).toBe(false);

    expect(
      shouldBootstrapCommandPaletteThreads({
        open: true,
        scope: 'threads',
        sessions: [],
        alreadyRequested: false,
      }),
    ).toBe(false);

    expect(
      shouldBootstrapCommandPaletteThreads({
        open: false,
        scope: 'threads',
        sessions: null,
        alreadyRequested: false,
      }),
    ).toBe(false);
  });

  it('treats unknown sessions as a loading state for thread sections', () => {
    expect(isCommandPaletteThreadDataLoading({ sessions: null, sessionsLoading: false })).toBe(true);
    expect(isCommandPaletteThreadDataLoading({ sessions: [], sessionsLoading: true })).toBe(true);
    expect(isCommandPaletteThreadDataLoading({ sessions: [], sessionsLoading: false })).toBe(false);
  });
});
