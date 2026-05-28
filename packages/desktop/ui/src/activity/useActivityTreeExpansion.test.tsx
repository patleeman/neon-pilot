// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { buildActivityTreePathModel } from './activityTreePaths';
import { useActivityTreeExpansion } from './useActivityTreeExpansion';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const nestedItems: ActivityTreeItem[] = [
  { id: 'conversation:root', kind: 'conversation', title: 'Root thread', status: 'idle' },
  { id: 'conversation:parent', kind: 'conversation', parentId: 'conversation:root', title: 'Parent branch', status: 'idle' },
  { id: 'conversation:child', kind: 'conversation', parentId: 'conversation:parent', title: 'Child branch', status: 'idle' },
];

function titles(items: readonly ActivityTreeItem[]) {
  return items.map((item) => item.title);
}

function Harness({
  activeItemId,
  collapsedGroupItemIds,
  items = nestedItems,
  onToggleGroupItem,
}: {
  activeItemId?: string;
  collapsedGroupItemIds?: ReadonlySet<string>;
  items?: readonly ActivityTreeItem[];
  onToggleGroupItem?: (item: ActivityTreeItem) => void;
}) {
  const pathModel = buildActivityTreePathModel(items);
  const selectedPath = activeItemId ? pathModel.pathById.get(activeItemId) : undefined;
  const { isItemExpanded, toggleBranchExpanded, toggleGroupCollapsed, visibleEntries } = useActivityTreeExpansion({
    activeItemId,
    collapsedGroupItemIds,
    onToggleGroupItem,
    pathModel,
    selectedPath,
  });

  return (
    <div>
      <output data-testid="visible">{titles(visibleEntries.map((entry) => entry.item)).join('|')}</output>
      {visibleEntries.map(({ item, path }) => (
        <button
          key={item.id}
          data-expanded={String(isItemExpanded(item, path))}
          data-item-id={item.id}
          type="button"
          onClick={() => (item.kind === 'group' ? toggleGroupCollapsed(item) : toggleBranchExpanded(item.id))}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}

function renderHarness(props: React.ComponentProps<typeof Harness>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Harness {...props} />);
  });

  return {
    container,
    rerender: (nextProps: React.ComponentProps<typeof Harness>) => {
      act(() => {
        root.render(<Harness {...nextProps} />);
      });
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('useActivityTreeExpansion', () => {
  it('auto-expands selected ancestors and lets the user collapse them', () => {
    const { container, unmount } = renderHarness({ activeItemId: 'conversation:child' });

    try {
      expect(container.querySelector('[data-testid="visible"]')?.textContent).toBe('Root thread|Parent branch|Child branch');
      const rootButton = container.querySelector<HTMLButtonElement>('[data-item-id="conversation:root"]');
      expect(rootButton?.dataset.expanded).toBe('true');

      act(() => {
        rootButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      expect(container.querySelector('[data-testid="visible"]')?.textContent).toBe('Root thread');
      expect(container.querySelector<HTMLButtonElement>('[data-item-id="conversation:root"]')?.dataset.expanded).toBe('false');
    } finally {
      unmount();
    }
  });

  it('delegates controlled group toggles to the caller', () => {
    const group: ActivityTreeItem = { id: 'group:test', kind: 'group', title: 'Project', status: 'idle' };
    const child: ActivityTreeItem = { ...nestedItems[0]!, id: 'conversation:test', parentId: group.id, title: 'Project thread' };
    const onToggleGroupItem = vi.fn();
    const { container, unmount } = renderHarness({
      collapsedGroupItemIds: new Set([group.id]),
      items: [group, child],
      onToggleGroupItem,
    });

    try {
      expect(container.querySelector('[data-testid="visible"]')?.textContent).toBe('Project');

      act(() => {
        container
          .querySelector<HTMLButtonElement>('[data-item-id="group:test"]')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onToggleGroupItem).toHaveBeenCalledWith(group);
      expect(container.querySelector('[data-testid="visible"]')?.textContent).toBe('Project');
    } finally {
      unmount();
    }
  });
});
