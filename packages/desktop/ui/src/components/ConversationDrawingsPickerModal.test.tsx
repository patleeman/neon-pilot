// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConversationAttachmentRecord, ConversationAttachmentSummary } from '../shared/types';
import { WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT } from '../windowed/windowedChildWindowEvents';
import {
  DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT,
  DRAWING_PICKER_CLOSE_COMMAND_EVENT,
  DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT,
} from './conversation/drawingPickerCommands';
import { ConversationDrawingsPickerModal } from './ConversationDrawingsPickerModal';

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const firstDrawing = drawingSummary({
  id: 'drawing-1',
  title: 'Architecture sketch',
  currentRevision: 3,
});

function drawingSummary(overrides: Partial<ConversationAttachmentSummary>): ConversationAttachmentSummary {
  const revision = overrides.currentRevision ?? 1;
  return {
    id: 'drawing',
    conversationId: 'conv-1',
    kind: 'excalidraw',
    title: 'Drawing',
    createdAt: '2026-04-30T12:00:00.000Z',
    updatedAt: '2026-04-30T12:05:00.000Z',
    currentRevision: revision,
    latestRevision: {
      revision,
      createdAt: '2026-04-30T12:05:00.000Z',
      sourceName: 'drawing.excalidraw',
      sourceMimeType: 'application/vnd.excalidraw+json',
      sourceDownloadPath: '/attachments/drawing/source',
      previewName: 'drawing.png',
      previewMimeType: 'image/png',
      previewDownloadPath: '/attachments/drawing/preview',
    },
    ...overrides,
  };
}

function drawingRecord(summary: ConversationAttachmentSummary): ConversationAttachmentRecord {
  return {
    ...summary,
    revisions: [
      { ...summary.latestRevision, revision: 3, note: 'latest' },
      { ...summary.latestRevision, revision: 2, note: 'layout' },
    ],
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ConversationDrawingsPickerModal', () => {
  it('handles shared close, attach-first, and first-history commands', async () => {
    const onClose = vi.fn();
    const onAttach = vi.fn();
    const onLoadAttachment = vi.fn(async () => drawingRecord(firstDrawing));

    render(
      <ConversationDrawingsPickerModal
        attachments={[firstDrawing]}
        onLoadAttachment={onLoadAttachment}
        onAttach={onAttach}
        onClose={onClose}
      />,
    );

    fireEvent(window, new CustomEvent(DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT));
    expect(onAttach).toHaveBeenCalledWith({ attachment: firstDrawing, revision: 3 });

    fireEvent(window, new CustomEvent(DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT));
    await waitFor(() => {
      expect(onLoadAttachment).toHaveBeenCalledWith('drawing-1');
      expect(screen.getByText('rev 2')).toBeTruthy();
    });

    fireEvent(window, new CustomEvent(DRAWING_PICKER_CLOSE_COMMAND_EVENT));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the picker for windowed OS sub-window styling', () => {
    render(
      <ConversationDrawingsPickerModal
        attachments={[firstDrawing]}
        parentWindowId="chat:planning"
        parentWindowTitle="Planning thread"
        onLoadAttachment={vi.fn(async () => drawingRecord(firstDrawing))}
        onAttach={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Conversation drawings' });
    expect(dialog.className).toContain('ui-windowed-drawings-picker');
    expect(dialog.getAttribute('data-windowed-subwindow')).toBe('drawing-picker');
    expect(dialog.getAttribute('data-parent-window-attached')).toBe('chat');
    expect(dialog.getAttribute('data-parent-window-id')).toBe('chat:planning');
    expect(dialog.getAttribute('data-parent-window-title')).toBe('Planning thread');
    expect(document.querySelector('.ui-windowed-drawings-picker-body')).toBeTruthy();
  });

  it('hides, restores, and closes with its parent chat window lifecycle', () => {
    const onClose = vi.fn();
    render(
      <ConversationDrawingsPickerModal
        attachments={[firstDrawing]}
        parentWindowId="chat:planning"
        parentWindowTitle="Planning thread"
        onLoadAttachment={vi.fn(async () => drawingRecord(firstDrawing))}
        onAttach={vi.fn()}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Conversation drawings' });

    fireEvent(
      window,
      new CustomEvent(WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT, {
        detail: {
          parentWindowId: 'chat:planning',
          parentWindowKind: 'chat',
          parentWindowTitle: 'Planning thread display text may differ',
          reason: 'minimized',
        },
      }),
    );

    expect(dialog.getAttribute('data-parent-window-minimized')).toBe('true');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent(
      window,
      new CustomEvent(WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT, {
        detail: {
          parentWindowId: 'chat:planning',
          parentWindowKind: 'chat',
          parentWindowTitle: 'Planning thread display text may differ',
          reason: 'restored',
        },
      }),
    );

    expect(dialog.getAttribute('data-parent-window-minimized')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent(
      window,
      new CustomEvent(WINDOWED_PARENT_WINDOW_LIFECYCLE_EVENT, {
        detail: {
          parentWindowId: 'chat:planning',
          parentWindowKind: 'chat',
          parentWindowTitle: 'Planning thread display text may differ',
          reason: 'closed',
        },
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('attaches the first filtered drawing from the shared command', () => {
    const secondDrawing = drawingSummary({
      id: 'drawing-2',
      title: 'Wireframe',
      currentRevision: 5,
    });
    const onAttach = vi.fn();

    render(
      <ConversationDrawingsPickerModal
        attachments={[firstDrawing, secondDrawing]}
        onLoadAttachment={vi.fn(async () => drawingRecord(secondDrawing))}
        onAttach={onAttach}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Filter drawings by id or title...'), { target: { value: 'wire' } });
    fireEvent(window, new CustomEvent(DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT));

    expect(onAttach).toHaveBeenCalledWith({ attachment: secondDrawing, revision: 5 });
  });
});
