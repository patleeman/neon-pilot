// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WindowedDialog } from './windowedOs';

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
