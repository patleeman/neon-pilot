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

function renderTree(renderItems: ActivityTreeItem[] = items) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ActivityTreeView
        items={renderItems}
        renderContextMenu={(item) => (
          <div role="menu" aria-label={`${item.title} actions`}>
            <button type="button" role="menuitem">
              Open
            </button>
          </div>
        )}
      />,
    );
  });

  return {
    container,
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
});
