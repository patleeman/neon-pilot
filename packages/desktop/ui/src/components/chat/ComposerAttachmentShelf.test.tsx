// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT,
  COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT,
} from './composerAttachmentCommands';
import { ComposerAttachmentShelf } from './ComposerAttachmentShelf';
import { IMAGE_PREVIEW_CLOSE_COMMAND_EVENT } from './imagePreviewCommands';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const mountedRoots: Root[] = [];
const createObjectURLMock = vi.fn();
const revokeObjectURLMock = vi.fn();

const imageAttachment = {
  localId: 'image-1',
  name: 'Screenshot 2026-04-22.png',
  mimeType: 'image/png',
  data: 'cHJldmlldw==',
  previewUrl: 'data:image/png;base64,cHJldmlldw==',
  size: 7,
};

function renderShelf(overrides: Partial<React.ComponentProps<typeof ComposerAttachmentShelf>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const onRemoveAttachment = vi.fn();
  const onEditDrawing = vi.fn();
  const onRemoveDrawingAttachment = vi.fn();

  act(() => {
    root.render(
      <ComposerAttachmentShelf
        attachments={[]}
        drawingAttachments={[]}
        onRemoveAttachment={onRemoveAttachment}
        onEditDrawing={onEditDrawing}
        onRemoveDrawingAttachment={onRemoveDrawingAttachment}
        {...overrides}
      />,
    );
  });

  mountedRoots.push(root);
  return { container, onRemoveAttachment, onEditDrawing, onRemoveDrawingAttachment, root };
}

function click(target: Element | null) {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Expected HTMLElement target');
  }

  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ComposerAttachmentShelf', () => {
  beforeEach(() => {
    createObjectURLMock.mockReset();
    revokeObjectURLMock.mockReset();
    createObjectURLMock.mockReturnValue('blob:composer-preview');
    Object.assign(globalThis.URL, {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    for (const root of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
  });

  it('opens an image preview for composer image attachments without touching the original file', () => {
    const { container } = renderShelf({ attachments: [imageAttachment] });

    expect(container.querySelector('.ui-composer-attachment-shelf')).not.toBeNull();
    expect(container.querySelector('.ui-composer-attachment-shelf__row')).not.toBeNull();
    expect(container.querySelector('.ui-attachment-chip')).not.toBeNull();

    click(container.querySelector('button[aria-label="Preview Screenshot 2026-04-22.png"]'));

    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"][aria-label="Screenshot 2026-04-22.png"]')).not.toBeNull();

    click(container.querySelector('button[aria-label="Close image preview"]'));

    expect(revokeObjectURLMock).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens an image preview for drawing attachments', () => {
    const { container } = renderShelf({
      drawingAttachments: [
        {
          localId: 'drawing-1',
          title: 'Wireframe',
          revision: 3,
          dirty: false,
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
    });

    expect(container.querySelector('.ui-composer-attachment-shelf__row')).not.toBeNull();

    click(container.querySelector('button[aria-label="Preview Wireframe (rev 3)"]'));

    expect(container.querySelector('[role="dialog"][aria-label="Wireframe (rev 3)"]')).not.toBeNull();
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('exposes stable shelf status hooks for drawing sync states', () => {
    const { container } = renderShelf({
      drawingsBusy: true,
      drawingsError: 'Drawings failed to sync',
    });

    expect(container.querySelector('.ui-composer-attachment-shelf')).not.toBeNull();
    expect(container.querySelectorAll('.ui-composer-attachment-shelf__status')).toHaveLength(2);
    expect(container.textContent).toContain('Syncing drawings');
    expect(container.textContent).toContain('Drawings failed to sync');
  });

  it('closes the composer image preview from the shared command event', () => {
    const { container } = renderShelf({ attachments: [imageAttachment] });

    click(container.querySelector('button[aria-label="Preview Screenshot 2026-04-22.png"]'));
    expect(container.querySelector('[role="dialog"][aria-label="Screenshot 2026-04-22.png"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps remove actions wired up', () => {
    const { container, onRemoveAttachment, onRemoveDrawingAttachment } = renderShelf({
      attachments: [imageAttachment],
      drawingAttachments: [
        {
          localId: 'drawing-1',
          title: 'Wireframe',
          dirty: true,
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
    });

    click(container.querySelector('button[aria-label="Remove Screenshot 2026-04-22.png"]'));
    click(container.querySelector('button[aria-label="Remove Wireframe"]'));

    expect(onRemoveAttachment).toHaveBeenCalledWith(0);
    expect(onRemoveDrawingAttachment).toHaveBeenCalledWith('drawing-1');
  });

  it('handles shared first attachment commands', () => {
    const { container, onRemoveAttachment } = renderShelf({ attachments: [imageAttachment] });

    act(() => {
      window.dispatchEvent(new CustomEvent(COMPOSER_PREVIEW_FIRST_ATTACHMENT_COMMAND_EVENT));
    });
    expect(container.querySelector('[role="dialog"][aria-label="Screenshot 2026-04-22.png"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(COMPOSER_REMOVE_FIRST_ATTACHMENT_COMMAND_EVENT));
    });
    expect(onRemoveAttachment).toHaveBeenCalledWith(0);
  });

  it('handles shared first drawing commands', () => {
    const { container, onEditDrawing, onRemoveDrawingAttachment } = renderShelf({
      drawingAttachments: [
        {
          localId: 'drawing-1',
          title: 'Wireframe',
          revision: 3,
          dirty: false,
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
        },
      ],
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(COMPOSER_PREVIEW_FIRST_DRAWING_COMMAND_EVENT));
    });
    expect(container.querySelector('[role="dialog"][aria-label="Wireframe (rev 3)"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(COMPOSER_EDIT_FIRST_DRAWING_COMMAND_EVENT));
      window.dispatchEvent(new CustomEvent(COMPOSER_REMOVE_FIRST_DRAWING_COMMAND_EVENT));
    });

    expect(onEditDrawing).toHaveBeenCalledWith('drawing-1');
    expect(onRemoveDrawingAttachment).toHaveBeenCalledWith('drawing-1');
  });
});
