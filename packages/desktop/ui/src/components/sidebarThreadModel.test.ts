import { describe, expect, it } from 'vitest';

import type { SessionMeta } from '../shared/types';
import { buildSidebarThreadModel, getSessionWorkspaceCwd } from './sidebarThreadModel';

function session(overrides: Partial<SessionMeta> & Pick<SessionMeta, 'id'>): SessionMeta {
  return {
    id: overrides.id,
    file: `/tmp/${overrides.id}.jsonl`,
    timestamp: '2026-03-16T09:30:00.000Z',
    cwd: '/work/neon-pilot',
    cwdSlug: 'neon-pilot',
    model: 'openai/gpt-5.4',
    title: overrides.id,
    messageCount: 4,
    ...overrides,
  };
}

function buildModel(overrides: Partial<Parameters<typeof buildSidebarThreadModel>[0]> = {}) {
  return buildSidebarThreadModel({
    activeConversationId: null,
    automationConversationIds: new Set(),
    conversationGroupLabelOverrides: {},
    filterMode: 'all',
    openWorkspacePaths: [],
    organizeMode: 'project',
    pinnedSessions: [],
    pinnedWorkspacePaths: [],
    savedWorkspacePaths: [],
    sortMode: 'updated',
    visibleConversationTabs: [],
    ...overrides,
  });
}

describe('sidebar thread model', () => {
  it('prefers workspace cwd and suppresses neutral chat workspace paths', () => {
    expect(getSessionWorkspaceCwd(session({ id: 'workspace', cwd: '/work/fallback', workspaceCwd: '/work/current' }))).toBe(
      '/work/current',
    );
    expect(getSessionWorkspaceCwd(session({ id: 'fallback', cwd: '/work/fallback', workspaceCwd: '   ' }))).toBe('/work/fallback');
    expect(getSessionWorkspaceCwd(session({ id: 'neutral', cwd: '/Users/patrick/chat-workspaces/tmp' }))).toBeNull();
  });

  it('keeps pinned items first and sorts open conversations by updated activity', () => {
    const model = buildModel({
      pinnedSessions: [session({ id: 'pinned', timestamp: '2026-03-16T08:00:00.000Z' })],
      visibleConversationTabs: [
        session({ id: 'older', lastActivityAt: '2026-03-16T10:00:00.000Z' }),
        session({ id: 'newer', lastActivityAt: '2026-03-16T11:00:00.000Z' }),
      ],
    });

    expect(model.orderedConversationItems.map((item) => item.session.id)).toEqual(['pinned', 'newer', 'older']);
  });

  it('filters automation and human conversations without dropping the active subagent', () => {
    const activeSubagent = session({ id: 'active-subagent', offshootKind: 'subagent' });
    const model = buildModel({
      activeConversationId: activeSubagent.id,
      automationConversationIds: new Set(['automation']),
      filterMode: 'human',
      visibleConversationTabs: [
        session({ id: 'human' }),
        session({ id: 'automation' }),
        session({ id: 'background-child', sourceRunId: 'run-123' }),
        activeSubagent,
      ],
    });

    expect(model.filteredConversationItems.map((item) => item.session.id)).toEqual(['human', 'active-subagent']);
  });

  it('builds project groups from saved workspaces, open workspaces, and visible conversations', () => {
    const model = buildModel({
      conversationGroupLabelOverrides: { '/work/alpha': 'Alpha Custom' },
      openWorkspacePaths: ['/work/beta'],
      savedWorkspacePaths: ['/work/alpha'],
      visibleConversationTabs: [session({ id: 'alpha-thread', cwd: '/work/alpha' }), session({ id: 'ungrouped', cwd: '' })],
    });

    expect(model.workspaceOrder).toEqual(['/work/alpha', '/work/beta']);
    expect(model.groupedConversationRows.map((group) => [group.key, group.label, group.items.map((item) => item.session.id)])).toEqual([
      ['/work/alpha', 'Alpha Custom', ['alpha-thread']],
      ['/work/beta', 'beta', []],
      ['__no-cwd__', 'Chats', ['ungrouped']],
    ]);
    expect(model.renderedConversationItems.map((item) => item.session.id)).toEqual(['alpha-thread', 'ungrouped']);
  });

  it('uses a flat rendered list in chronological mode', () => {
    const model = buildModel({
      organizeMode: 'chronological',
      visibleConversationTabs: [session({ id: 'one' })],
    });

    expect(model.groupedConversationRows).toEqual([]);
    expect(model.renderedConversationItems.map((item) => item.session.id)).toEqual(['one']);
  });
});
