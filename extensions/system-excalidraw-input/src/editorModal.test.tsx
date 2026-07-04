// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ExcalidrawEditorModal } from './editorModal';

vi.mock('@excalidraw/excalidraw/index.css?raw', () => ({ default: '' }));

const scene = { elements: [], appState: {}, files: {} };

vi.mock('@neon-pilot/extensions/excalidraw', () => ({
  buildDrawingFileNames: (title: string) => ({ sourceName: `${title}.excalidraw`, previewName: `${title}.png` }),
  loadExcalidrawComponent: async () =>
    function FakeExcalidraw(props: { theme?: string }) {
      return <div data-testid="fake-excalidraw-theme">{props.theme ?? 'unset'}</div>;
    },
  parseExcalidrawSceneFromSourceData: () => scene,
  serializeExcalidrawScene: async () => ({
    sourceData: '{"type":"excalidraw"}',
    sourceMimeType: 'application/vnd.excalidraw+json',
    previewData: 'data:image/png;base64,abc',
    previewMimeType: 'image/png',
    previewUrl: 'data:image/png;base64,abc',
  }),
}));

function createPa() {
  return {
    conversations: {
      createAttachment: vi.fn(async () => ({
        attachment: {
          id: 'drawing-1',
          kind: 'excalidraw',
          title: 'Drawing',
          currentRevision: 1,
          latestRevision: {
            revision: 1,
            sourceName: 'Drawing.excalidraw',
            sourceMimeType: 'application/vnd.excalidraw+json',
            previewName: 'Drawing.png',
            previewMimeType: 'image/png',
          },
        },
      })),
      updateAttachment: vi.fn(),
    },
    events: {
      publish: vi.fn(),
    },
    ui: {
      toast: vi.fn(),
    },
    workbench: {
      setDetailState: vi.fn(),
    },
    commands: {
      execute: vi.fn(),
    },
  };
}

describe('ExcalidrawEditorModal', () => {
  it('publishes saved composer payloads after persisting a drawing', async () => {
    const pa = createPa();
    const close = vi.fn();
    document.body.setAttribute('data-neon-pilot-windowed-shell-active', 'true');

    render(
      <ExcalidrawEditorModal
        pa={pa as never}
        close={close}
        props={{
          conversationId: 'conversation-1',
          localId: 'composer-drawing-1',
          initialScene: scene as never,
          saveLabel: 'Attach to chat',
        }}
      />,
    );

    expect((await screen.findByTestId('fake-excalidraw-theme')).textContent).toBe('light');
    expect(document.querySelector('.excalidraw-editor-modal')).toBeTruthy();
    expect(document.querySelector('.excalidraw-editor-modal__toolbar')).toBeTruthy();
    expect(document.querySelector('.excalidraw-editor-modal__canvas')).toBeTruthy();
    expect(document.querySelector('.ui-windowed-excalidraw-status')?.textContent).toBe('draft');
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));

    await waitFor(() => expect(pa.conversations.createAttachment).toHaveBeenCalledTimes(1));
    expect(pa.events.publish).toHaveBeenCalledWith(
      'excalidraw:attachments-changed',
      expect.objectContaining({
        conversationId: 'conversation-1',
        attachment: expect.objectContaining({ id: 'drawing-1' }),
      }),
    );
    expect(pa.events.publish).toHaveBeenCalledWith(
      'excalidraw:saved',
      expect.objectContaining({
        attachmentId: 'drawing-1',
        dirty: false,
        localId: 'composer-drawing-1',
        revision: 1,
        title: 'Drawing',
        sourceName: 'Drawing.excalidraw',
        previewName: 'Drawing.png',
      }),
    );
    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentId: 'drawing-1',
        dirty: false,
        localId: 'composer-drawing-1',
        revision: 1,
      }),
    );
  });

  it('renders saved drawing revision state in the windowed toolbar status pill', async () => {
    const pa = createPa();

    render(
      <ExcalidrawEditorModal
        pa={pa as never}
        close={vi.fn()}
        props={{
          conversationId: 'conversation-1',
          initialAttachmentId: 'drawing-1',
          initialRevision: 3,
          initialScene: scene as never,
        }}
      />,
    );

    expect((await screen.findByTestId('fake-excalidraw-theme')).textContent).toBe('light');
    expect(document.querySelector('.ui-windowed-excalidraw-status')?.textContent).toBe('rev 3');
  });
});
