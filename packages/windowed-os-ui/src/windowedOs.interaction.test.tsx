// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WindowedDialog } from './windowedOs';

function rect(input: { left: number; top: number; width: number; height: number }): DOMRect {
  return {
    left: input.left,
    top: input.top,
    width: input.width,
    height: input.height,
    right: input.left + input.width,
    bottom: input.top + input.height,
    x: input.left,
    y: input.top,
    toJSON: () => input,
  } as DOMRect;
}

function setElementRect(element: Element, nextRect: DOMRect): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => nextRect,
  });
}

describe('WindowedDialog interactions', () => {
  it('lets modeless subwindows drag by their titlebar', () => {
    render(
      <WindowedDialog title="Gateway activity" accent="gateways" onClose={() => undefined}>
        Activity
      </WindowedDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Gateway activity' });
    fireEvent.mouseDown(screen.getByText('Gateway activity'), { button: 0, clientX: 120, clientY: 80 });
    fireEvent.mouseMove(window, { clientX: 168, clientY: 116 });

    expect(dialog.getAttribute('data-dragging')).toBe('true');
    expect(dialog.getAttribute('style')).toContain('translate(48px, 36px)');

    fireEvent.mouseUp(window);
    expect(dialog.getAttribute('data-dragging')).toBeNull();
  });

  it('keeps modeless subwindows recoverable when dragged past the desktop edges', () => {
    render(
      <WindowedDialog title="Automation details" accent="automations" onClose={() => undefined}>
        Details
      </WindowedDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Automation details' });
    const layer = dialog.parentElement;
    const titlebar = screen.getByText('Automation details').closest('header');
    if (!layer || !titlebar) throw new Error('Missing dialog geometry elements.');

    setElementRect(layer, rect({ left: 0, top: 0, width: 600, height: 420 }));
    setElementRect(dialog, rect({ left: 120, top: 64, width: 320, height: 220 }));
    setElementRect(titlebar, rect({ left: 120, top: 64, width: 320, height: 44 }));

    fireEvent.mouseDown(titlebar, { button: 0, clientX: 160, clientY: 84 });
    fireEvent.mouseMove(window, { clientX: -700, clientY: -600 });

    expect(dialog.getAttribute('style')).toContain('translate(-344px, -90px)');

    fireEvent.mouseMove(window, { clientX: 900, clientY: 720 });

    expect(dialog.getAttribute('style')).toContain('translate(384px, 322px)');

    fireEvent.mouseUp(window);
  });

  it('keeps modal subwindows fixed for blocking flows', () => {
    render(
      <WindowedDialog title="Confirm install" accent="extensions" modal onClose={() => undefined}>
        Install extension
      </WindowedDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Confirm install' });
    fireEvent.mouseDown(screen.getByText('Confirm install'), { button: 0, clientX: 120, clientY: 80 });
    fireEvent.mouseMove(window, { clientX: 168, clientY: 116 });

    expect(dialog.getAttribute('data-dragging')).toBeNull();
    expect(dialog.getAttribute('style')).toBeNull();
  });
});
