// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { ActivityTreeView } from './ActivityTreeView';

const rowRenderCounts = vi.hoisted(() => new Map<string, number>());

vi.mock('./ActivityTreeRow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ActivityTreeRow')>();
  const react = await import('react');
  const CountedActivityTreeRow = react.memo(function CountedActivityTreeRow(props: React.ComponentProps<typeof actual.ActivityTreeRow>) {
    rowRenderCounts.set(props.item.id, (rowRenderCounts.get(props.item.id) ?? 0) + 1);
    return react.createElement(actual.ActivityTreeRow, props);
  });
  return { ...actual, ActivityTreeRow: CountedActivityTreeRow };
});

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items: ActivityTreeItem[] = [
  { id: 'conversation:one', kind: 'conversation', title: 'One', status: 'idle', metadata: { conversationId: 'one' } },
  { id: 'conversation:two', kind: 'conversation', title: 'Two', status: 'idle', metadata: { conversationId: 'two' } },
  { id: 'conversation:three', kind: 'conversation', title: 'Three', status: 'idle', metadata: { conversationId: 'three' } },
];

function Harness({ activeItemId, treeItems = items }: { activeItemId?: string; treeItems?: readonly ActivityTreeItem[] }) {
  const [, setTick] = useState(0);
  return (
    <div>
      <button type="button" onClick={() => setTick((current) => current + 1)}>
        rerender
      </button>
      <ActivityTreeView
        items={treeItems}
        activeItemId={activeItemId}
        canDragItem={stableCanDragItem}
        canDropItem={stableCanDropItem}
        onArchiveItem={stableArchiveItem}
        onCreateChildItem={stableCreateChildItem}
        onOpenItem={stableOpenItem}
      />
    </div>
  );
}

const stableArchiveItem = () => {};
const stableCanDragItem = () => true;
const stableCanDropItem = () => true;
const stableCreateChildItem = () => {};
const stableOpenItem = () => {};

function dispatchDragEvent(element: Element | null, type: string, clientY = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientY', { value: clientY });
  Object.defineProperty(event, 'dataTransfer', { value: { dropEffect: 'none' } });
  Object.defineProperty(element, 'getBoundingClientRect', { configurable: true, value: () => ({ top: 0, height: 20 }) });
  element?.dispatchEvent(event);
}

describe('ActivityTreeView row rendering', () => {
  it('does not re-render unchanged rows when the parent rerenders', () => {
    rowRenderCounts.clear();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<Harness />);
      });
      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 1,
        'conversation:three': 1,
        'conversation:two': 1,
      });

      act(() => {
        container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });

      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 1,
        'conversation:three': 1,
        'conversation:two': 1,
      });
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('does not re-render unchanged rows when callers pass an equivalent item array', () => {
    rowRenderCounts.clear();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const cloneItems = () => items.map((item) => ({ ...item, metadata: { ...item.metadata } }));

    try {
      act(() => {
        root.render(<Harness treeItems={cloneItems()} />);
      });
      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 1,
        'conversation:three': 1,
        'conversation:two': 1,
      });

      act(() => {
        root.render(<Harness treeItems={cloneItems()} />);
      });

      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 1,
        'conversation:three': 1,
        'conversation:two': 1,
      });
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('only re-renders rows whose active state changes', () => {
    rowRenderCounts.clear();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<Harness activeItemId="conversation:one" />);
      });
      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 1,
        'conversation:three': 1,
        'conversation:two': 1,
      });

      act(() => {
        root.render(<Harness activeItemId="conversation:two" />);
      });

      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 2,
        'conversation:three': 1,
        'conversation:two': 2,
      });
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('only re-renders rows whose drag state changes', () => {
    rowRenderCounts.clear();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<Harness />);
      });
      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 1,
        'conversation:three': 1,
        'conversation:two': 1,
      });

      act(() => {
        dispatchDragEvent(container.querySelector('[data-sidebar-session-id="one"]'), 'dragstart');
      });

      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 2,
        'conversation:three': 1,
        'conversation:two': 1,
      });

      act(() => {
        dispatchDragEvent(container.querySelector('[data-sidebar-session-id="two"]'), 'dragover', 2);
      });

      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 2,
        'conversation:three': 1,
        'conversation:two': 2,
      });

      act(() => {
        dispatchDragEvent(container.querySelector('[data-sidebar-session-id="one"]'), 'dragend');
      });

      expect(Object.fromEntries(rowRenderCounts)).toEqual({
        'conversation:one': 3,
        'conversation:three': 1,
        'conversation:two': 3,
      });
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
