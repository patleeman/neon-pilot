// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AttachFilesComposerControl } from './frontend';

function renderControl(overrides?: { composerDisabled?: boolean; openFilePicker?: ReturnType<typeof vi.fn> }) {
  const openFilePicker = overrides?.openFilePicker ?? vi.fn();
  render(
    <AttachFilesComposerControl
      controlContext={{
        composerDisabled: overrides?.composerDisabled ?? false,
        openFilePicker,
      }}
    />,
  );
  return { button: screen.getByRole('button', { name: 'Attach image or drawing' }), openFilePicker };
}

describe('AttachFilesComposerControl', () => {
  it('opens the composer file picker from pointer and keyboard activation', () => {
    const { button, openFilePicker } = renderControl();
    const pointerEvent = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(pointerEvent, 'pointerType', { value: 'mouse' });

    fireEvent(button, pointerEvent);
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(openFilePicker).toHaveBeenCalledTimes(2);
  });

  it('does not open the file picker while the composer is disabled', () => {
    const { button, openFilePicker } = renderControl({ composerDisabled: true });

    fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
    fireEvent.keyDown(button, { key: 'Enter' });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(openFilePicker).not.toHaveBeenCalled();
  });
});
