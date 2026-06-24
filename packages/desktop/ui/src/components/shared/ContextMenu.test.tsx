// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContextMenu, ContextMenuSection, ContextMenuSections } from './ContextMenu';

(globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean }).React = React;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ContextMenu', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the shared shell and clamps itself inside the viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 300 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 490,
      y: 290,
      width: 224,
      height: 80,
      top: 290,
      right: 714,
      bottom: 370,
      left: 490,
      toJSON: () => ({}),
    });

    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(
        <ContextMenu aria-label="Actions" minWidth={224} position={{ x: 490, y: 290 }}>
          <button type="button">Action</button>
        </ContextMenu>,
      );
    });

    const menu = document.body.querySelector<HTMLElement>('[role="menu"]');
    expect(menu?.className).toContain('ui-menu-shell');
    expect(menu?.style.left).toBe('264px');
    expect(menu?.style.top).toBe('208px');

    act(() => root.unmount());
  });

  it('closes on outside pointerdown and Escape', async () => {
    const onClose = vi.fn();
    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(
        <ContextMenu aria-label="Actions" onClose={onClose} position={{ x: 12, y: 12 }}>
          <button type="button">Action</button>
        </ContextMenu>,
      );
    });

    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    act(() => root.unmount());
  });

  it('renders separators only between context menu sections', async () => {
    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);

    await act(async () => {
      root.render(
        <ContextMenu aria-label="Actions" position={{ x: 12, y: 12 }}>
          <ContextMenuSections>
            <ContextMenuSection label="One">
              <button type="button">First</button>
            </ContextMenuSection>
            <ContextMenuSection>
              <button type="button">Second</button>
            </ContextMenuSection>
            <ContextMenuSection>
              <button type="button">Third</button>
            </ContextMenuSection>
          </ContextMenuSections>
        </ContextMenu>,
      );
    });

    expect(document.body.querySelectorAll('[role="separator"]')).toHaveLength(2);
    expect(document.body.querySelector('.ui-menu-group-label')?.textContent).toBe('One');

    await act(async () => {
      root.render(
        <ContextMenu aria-label="Actions" position={{ x: 12, y: 12 }}>
          <ContextMenuSections>
            <ContextMenuSection>
              <button type="button">Only</button>
            </ContextMenuSection>
          </ContextMenuSections>
        </ContextMenu>,
      );
    });

    expect(document.body.querySelectorAll('[role="separator"]')).toHaveLength(0);

    act(() => root.unmount());
  });
});
