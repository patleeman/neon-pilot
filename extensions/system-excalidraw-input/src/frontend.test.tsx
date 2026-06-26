// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ExcalidrawEditorSavePayload } from './editorModal';
import { ExcalidrawInputTool } from './frontend';

const payload: ExcalidrawEditorSavePayload = {
  title: 'Sketch',
  scene: { elements: [], appState: {}, files: {} } as never,
  sourceData: '{}',
  sourceMimeType: 'application/vnd.excalidraw+json',
  sourceName: 'sketch.excalidraw',
  previewData: 'data:image/png;base64,abc',
  previewMimeType: 'image/png',
  previewName: 'sketch.png',
  previewUrl: 'data:image/png;base64,abc',
};

function pointerDown(button: HTMLElement) {
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  fireEvent(button, event);
}

function renderTool(overrides?: { composerDisabled?: boolean; modalResult?: unknown; modalError?: Error }) {
  const listeners = new Map<string, (event: { payload?: unknown }) => void>();
  const upsertDrawingAttachment = vi.fn();
  const openModal = vi.fn(async () => {
    if (overrides?.modalError) throw overrides.modalError;
    return overrides?.modalResult ?? payload;
  });
  const toast = vi.fn();
  const pa = {
    events: {
      subscribe: vi.fn((eventName: string, handler: (event: { payload?: unknown }) => void) => {
        listeners.set(eventName, handler);
        return { unsubscribe: vi.fn() };
      }),
    },
    ui: { openModal, toast },
  };

  render(
    <ExcalidrawInputTool
      pa={pa as never}
      toolContext={{
        conversationId: 'conversation-1',
        composerDisabled: overrides?.composerDisabled ?? false,
        streamIsStreaming: false,
        upsertDrawingAttachment,
      }}
    />,
  );

  return { button: screen.getByRole('button', { name: 'Create drawing' }), listeners, openModal, toast, upsertDrawingAttachment };
}

describe('ExcalidrawInputTool', () => {
  it('opens the drawing modal and attaches the returned drawing payload', async () => {
    const { button, openModal, toast, upsertDrawingAttachment } = renderTool();

    pointerDown(button);

    await waitFor(() => expect(openModal).toHaveBeenCalledWith(expect.objectContaining({ component: 'ExcalidrawEditorModal' })));
    expect(upsertDrawingAttachment).toHaveBeenCalledWith(payload);
    expect(toast).toHaveBeenCalledWith('Drawing attached to composer.');
  });

  it('attaches drawings published through the extension event channel', () => {
    const { listeners, upsertDrawingAttachment } = renderTool();

    listeners.get('excalidraw:saved')?.({ payload });

    expect(upsertDrawingAttachment).toHaveBeenCalledWith(payload);
  });

  it('does not open the drawing modal while the composer is disabled', () => {
    const { button, openModal } = renderTool({ composerDisabled: true });

    pointerDown(button);
    fireEvent.keyDown(button, { key: 'Enter' });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(openModal).not.toHaveBeenCalled();
  });

  it('handles drawing modal load failures with safe copy', async () => {
    const { button, openModal, toast, upsertDrawingAttachment } = renderTool({
      modalError: new Error('Failed to fetch dynamically imported module: neon-pilot://app/assets/frontend-secret.js'),
    });

    pointerDown(button);

    await waitFor(() => expect(openModal).toHaveBeenCalled());
    expect(upsertDrawingAttachment).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Drawing editor could not be opened. Try again after reloading Neon Pilot.');
    expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('frontend-secret.js'));
    expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('neon-pilot://app'));
  });
});
