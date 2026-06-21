import { describe, expect, it } from 'vitest';

import type { SessionMeta } from '../shared/types';
import { buildActivityTreeGroupId, buildSidebarActivityTreeItems } from './sidebarActivityTreeModel';
import type { SidebarConversationGroup, SidebarConversationItem } from './sidebarThreadModel';

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

function item(sessionMeta: SessionMeta, overrides: Partial<SidebarConversationItem> = {}): SidebarConversationItem {
  return {
    session: sessionMeta,
    section: 'open',
    pinned: false,
    originalIndex: 0,
    ...overrides,
  };
}

function buildTree(overrides: Partial<Parameters<typeof buildSidebarActivityTreeItems>[0]> = {}) {
  return buildSidebarActivityTreeItems({
    backgroundWorkKindByConversationId: new Map(),
    groupedConversationRows: [],
    liveTitles: new Map(),
    pendingExecutionConversationIds: new Set(),
    pinnedConversationIds: [],
    renderedConversationItems: [],
    runningAutomationConversationIds: new Set(),
    threadsFilterMode: 'all',
    threadsOrganizeMode: 'chronological',
    ...overrides,
  });
}

describe('sidebar activity tree model', () => {
  it('returns flat conversation items in chronological mode', () => {
    const tree = buildTree({
      renderedConversationItems: [item(session({ id: 'one', title: 'One' }))],
    });

    expect(tree).toEqual([
      expect.objectContaining({
        id: 'conversation:one',
        kind: 'conversation',
        parentId: undefined,
        title: 'One',
      }),
    ]);
  });

  it('creates project groups and parents conversations under them', () => {
    const conversation = item(session({ id: 'alpha-thread', cwd: '/work/alpha', title: 'Alpha thread' }));
    const groups: SidebarConversationGroup[] = [
      {
        key: '/work/alpha',
        cwd: '/work/alpha',
        label: 'Alpha',
        defaultLabel: 'alpha',
        items: [conversation],
      },
      {
        key: '/work/empty',
        cwd: '/work/empty',
        label: 'Empty',
        defaultLabel: 'empty',
        items: [],
      },
    ];

    const tree = buildTree({
      groupedConversationRows: groups,
      renderedConversationItems: [conversation],
      threadsOrganizeMode: 'project',
    });

    expect(tree.map((treeItem) => treeItem.id)).toEqual([
      buildActivityTreeGroupId('/work/alpha'),
      buildActivityTreeGroupId('/work/empty'),
      'conversation:alpha-thread',
    ]);
    expect(tree[0]).toEqual(
      expect.objectContaining({
        kind: 'group',
        metadata: { cwd: '/work/alpha', defaultLabel: 'alpha', groupKey: '/work/alpha' },
        subtitle: '/work/alpha',
        title: 'Alpha',
      }),
    );
    expect(tree[2]).toEqual(expect.objectContaining({ parentId: buildActivityTreeGroupId('/work/alpha') }));
  });

  it('omits unused groups outside the all filter mode', () => {
    const conversation = item(session({ id: 'alpha-thread', cwd: '/work/alpha' }));
    const tree = buildTree({
      groupedConversationRows: [
        { key: '/work/alpha', cwd: '/work/alpha', label: 'Alpha', defaultLabel: 'alpha', items: [conversation] },
        { key: '/work/empty', cwd: '/work/empty', label: 'Empty', defaultLabel: 'empty', items: [] },
      ],
      renderedConversationItems: [conversation],
      threadsFilterMode: 'human',
      threadsOrganizeMode: 'project',
    });

    expect(tree.map((treeItem) => treeItem.id)).toEqual([buildActivityTreeGroupId('/work/alpha'), 'conversation:alpha-thread']);
  });

  it('applies pin and background work metadata without relying on row state', () => {
    const tree = buildTree({
      backgroundWorkKindByConversationId: new Map([['queued', 'command']]),
      pendingExecutionConversationIds: new Set(['queued']),
      pinnedConversationIds: ['pinned'],
      renderedConversationItems: [item(session({ id: 'pinned' })), item(session({ id: 'running' })), item(session({ id: 'queued' }))],
      runningAutomationConversationIds: new Set(['running']),
    });

    expect(tree.find((treeItem) => treeItem.id === 'conversation:pinned')?.metadata).toEqual(expect.objectContaining({ isPinned: true }));
    expect(tree.find((treeItem) => treeItem.id === 'conversation:running')).toEqual(
      expect.objectContaining({
        status: 'idle',
        metadata: expect.objectContaining({ hasPendingRuns: true, isRunning: false }),
      }),
    );
    expect(tree.find((treeItem) => treeItem.id === 'conversation:queued')?.metadata).toEqual(
      expect.objectContaining({ backgroundWorkKind: 'command', hasPendingRuns: true }),
    );
  });

  it('uses live titles before activity tree formatting', () => {
    const tree = buildTree({
      liveTitles: new Map([['draft', 'Live draft title']]),
      renderedConversationItems: [item(session({ id: 'draft', title: 'Stale title' }))],
    });

    expect(tree[0]?.title).toBe('Live draft title');
  });
});
