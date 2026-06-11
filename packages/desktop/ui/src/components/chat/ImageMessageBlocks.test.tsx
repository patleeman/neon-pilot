// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IMAGE_PREVIEW_CLOSE_COMMAND_EVENT } from './imagePreviewCommands';
import { ImageInspectModal } from './ImageMessageBlocks';

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

describe('ImageInspectModal', () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  it('closes from the shared image preview command event', () => {
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<ImageInspectModal image={{ alt: 'Plot', src: 'data:image/png;base64,ZmFrZQ==', caption: 'Run chart' }} onClose={onClose} />);
    });
    expect(container.querySelector('[role="dialog"][aria-label="Run chart"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

