// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { useActivityTreeContextMenu } from './useActivityTreeContextMenu';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item: ActivityTreeItem = {
  id: 'conversation:test',
  kind: 'conversation',
  status: 'idle',
  title: 'Test thread',
};

function Harness() {
  const { closeContextMenu, contextMenu, contextMenuRootRef, openContextMenu } = useActivityTreeContextMenu();

  return (
    <div>
      <button type="button" onClick={() => openContextMenu(item, 12, 24)}>
        open
      </button>
      <button type="button" onClick={closeContextMenu}>
        close
      </button>
      {contextMenu ? (
        <div ref={contextMenuRootRef} role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.item.title}
        </div>
      ) : null}
    </div>
  );
}

describe('useActivityTreeContextMenu', () => {
  it('opens and closes the active menu when clicking outside', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<Harness />);
      });

      act(() => {
        container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(container.querySelector('[role="menu"]')?.textContent).toContain('Test thread');

      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
      });
      expect(container.querySelector('[role="menu"]')).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
