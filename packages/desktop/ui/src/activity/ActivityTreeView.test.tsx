// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { ActivityTreeView, getActivityTreeRowPaddingLeftRem } from './ActivityTreeView';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items: ActivityTreeItem[] = [
  {
    id: 'conversation:test',
    kind: 'conversation',
    title: 'Test thread',
    status: 'idle',
    metadata: { conversationId: 'test' },
  },
];

function renderTree(renderItems: ActivityTreeItem[] = items, activeItemId?: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ActivityTreeView
        items={renderItems}
        activeItemId={activeItemId}
        renderContextMenu={(item) => (
          <div role="menu" aria-label={`${item.title} actions`}>
            <button type="button" role="menuitem">
              Open
            </button>
          </div>
        )}
        onArchiveItem={() => {}}
      />,
    );
  });

  return {
    container,
    rerender: (nextItems: ActivityTreeItem[] = renderItems, nextActiveItemId?: string) => {
      act(() => {
        root.render(
          <ActivityTreeView
            items={nextItems}
            activeItemId={nextActiveItemId}
            renderContextMenu={(item) => (
              <div role="menu" aria-label={`${item.title} actions`}>
                <button type="button" role="menuitem">
                  Open
                </button>
              </div>
            )}
            onArchiveItem={() => {}}
          />,
        );
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('ActivityTreeView', () => {
  it('uses compact sidebar indentation for nested rows', () => {
    const group: ActivityTreeItem = { id: 'group:test', kind: 'group', title: 'Project', status: 'idle' };
    const child: ActivityTreeItem = { ...items[0]!, parentId: group.id };

    expect(getActivityTreeRowPaddingLeftRem(group, 0)).toBe(0.25);
    expect(getActivityTreeRowPaddingLeftRem(child, 1)).toBe(0.625);
    expect(getActivityTreeRowPaddingLeftRem(child, 3)).toBe(1.375);
  });

  it('closes the context menu when clicking outside the tree', () => {
    const { container, unmount } = renderTree();

    try {
      const row = container.querySelector<HTMLButtonElement>('[role="treeitem"]');
      expect(row).not.toBeNull();

      act(() => {
        row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 12 }));
      });
      expect(container.querySelector('[role="menu"]')).not.toBeNull();

      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      });
      expect(container.querySelector('[role="menu"]')).toBeNull();
    } finally {
      unmount();
    }
  });

  it('renders expandable conversation branches in the tree', () => {
    const nestedItems: ActivityTreeItem[] = [
      { id: 'conversation:parent', kind: 'conversation', title: 'Parent thread', status: 'idle', metadata: { conversationId: 'parent' } },
      {
        id: 'conversation:child',
        kind: 'conversation',
        parentId: 'conversation:parent',
        title: 'Child branch',
        status: 'idle',
        metadata: { conversationId: 'child' },
      },
    ];
    const { container, unmount } = renderTree(nestedItems);

    try {
      expect(container.textContent).toContain('Parent thread');
      expect(container.textContent).not.toContain('Child branch');

      const expander = container.querySelector<HTMLElement>('[aria-label="Expand Parent thread"]');
      expect(expander).not.toBeNull();

      act(() => {
        expander?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      expect(container.textContent).toContain('Child branch');
    } finally {
      unmount();
    }
  });

  it('auto-expands every ancestor for a selected nested branch and keeps descendants visible after selecting the parent', () => {
    const nestedItems: ActivityTreeItem[] = [
      { id: 'conversation:root', kind: 'conversation', title: 'Root thread', status: 'idle', metadata: { conversationId: 'root' } },
      {
        id: 'conversation:parent',
        kind: 'conversation',
        parentId: 'conversation:root',
        title: 'Parent branch',
        status: 'idle',
        metadata: { conversationId: 'parent' },
      },
      {
        id: 'conversation:child',
        kind: 'conversation',
        parentId: 'conversation:parent',
        title: 'Nested child branch',
        status: 'idle',
        metadata: { conversationId: 'child' },
      },
    ];
    const { container, rerender, unmount } = renderTree(nestedItems, 'conversation:child');

    try {
      expect(container.textContent).toContain('Root thread');
      expect(container.textContent).toContain('Parent branch');
      expect(container.textContent).toContain('Nested child branch');

      rerender(nestedItems, 'conversation:parent');

      expect(container.textContent).toContain('Nested child branch');
    } finally {
      unmount();
    }
  });

  it('lets an expanded parent branch collapse even when the selected item is a descendant', () => {
    const nestedItems: ActivityTreeItem[] = [
      { id: 'conversation:parent', kind: 'conversation', title: 'Parent thread', status: 'idle', metadata: { conversationId: 'parent' } },
      {
        id: 'conversation:child',
        kind: 'conversation',
        parentId: 'conversation:parent',
        title: 'Rewound child branch',
        status: 'idle',
        metadata: { conversationId: 'child' },
      },
    ];
    const { container, unmount } = renderTree(nestedItems, 'conversation:child');

    try {
      expect(container.textContent).toContain('Parent thread');
      expect(container.textContent).toContain('Rewound child branch');

      const expander = container.querySelector<HTMLElement>('[aria-label="Collapse Parent thread"]');
      expect(expander).not.toBeNull();

      act(() => {
        expander?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      expect(container.textContent).toContain('Parent thread');
      expect(container.textContent).not.toContain('Rewound child branch');
    } finally {
      unmount();
    }
  });

  it('does not show archive affordances for non-closable lineage rows', () => {
    const nestedItems: ActivityTreeItem[] = [
      {
        id: 'conversation:parent',
        kind: 'conversation',
        title: 'Archived parent scaffold',
        status: 'idle',
        metadata: { conversationId: 'parent', canArchive: false },
      },
      {
        id: 'conversation:child',
        kind: 'conversation',
        parentId: 'conversation:parent',
        title: 'Open child branch',
        status: 'idle',
        metadata: { conversationId: 'child' },
      },
    ];
    const { container, unmount } = renderTree(nestedItems, 'conversation:child');

    try {
      const rows = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]'));
      const parentRow = rows.find((candidate) => candidate.textContent?.includes('Archived parent scaffold'));
      const childRow = rows.find((candidate) => candidate.textContent?.includes('Open child branch'));

      expect(parentRow?.querySelector('[aria-label="Archive thread"]')).toBeNull();
      expect(childRow?.querySelector('[aria-label="Archive thread"]')).not.toBeNull();
    } finally {
      unmount();
    }
  });

  it('keeps child branches visually nested even if caller order changes', () => {
    const parent: ActivityTreeItem = {
      id: 'conversation:parent',
      kind: 'conversation',
      title: 'Parent thread',
      status: 'idle',
      metadata: { conversationId: 'parent' },
    };
    const child: ActivityTreeItem = {
      id: 'conversation:child',
      kind: 'conversation',
      parentId: 'conversation:parent',
      title: 'Child branch',
      status: 'idle',
      metadata: { conversationId: 'child' },
    };
    const sibling: ActivityTreeItem = {
      id: 'conversation:sibling',
      kind: 'conversation',
      title: 'Sibling root',
      status: 'idle',
      metadata: { conversationId: 'sibling' },
    };
    const { container, rerender, unmount } = renderTree([parent, child, sibling], 'conversation:child');

    try {
      rerender([parent, sibling, child], 'conversation:child');
      const rows = Array.from(container.querySelectorAll<HTMLElement>('[role="treeitem"]'));
      const parentRowIndex = rows.findIndex((candidate) => candidate.textContent?.includes('Parent thread'));
      const childRow = rows.find((candidate) => candidate.textContent?.includes('Child branch'));
      const childRowIndex = rows.indexOf(childRow!);

      expect(parentRowIndex).toBeGreaterThanOrEqual(0);
      expect(childRowIndex).toBe(parentRowIndex + 1);
      expect(childRow?.style.paddingLeft).toBe('0.625rem');
    } finally {
      unmount();
    }
  });
});
