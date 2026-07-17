// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageInspectModal, ImagePreview } from './ImageMessageBlocks';
import {
  IMAGE_PREVIEW_CLOSE_COMMAND_EVENT,
  IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT,
  IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT,
  type ImagePreviewCommandDetail,
} from './imagePreviewCommands';

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
      root?.render(
        <ImageInspectModal image={{ alt: 'Plot', src: 'data:image/png;base64,ZmFrZQ==', caption: 'Run chart' }} onClose={onClose} />,
      );
    });
    expect(container.querySelector('[role="dialog"][aria-label="Run chart"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(IMAGE_PREVIEW_CLOSE_COMMAND_EVENT));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('inspects and loads the first eligible image preview from shared commands', () => {
    const onInspectFirst = vi.fn();
    const onInspectSecond = vi.fn();
    const onLoadFirst = vi.fn();
    const onLoadSecond = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <>
          <ImagePreview
            alt="First"
            src="data:image/png;base64,Zmlyc3Q="
            maxHeight={120}
            deferred
            onLoad={onLoadFirst}
            onInspect={onInspectFirst}
          />
          <ImagePreview
            alt="Second"
            src="data:image/png;base64,c2Vjb25k"
            maxHeight={120}
            deferred
            onLoad={onLoadSecond}
            onInspect={onInspectSecond}
          />
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new CustomEvent<ImagePreviewCommandDetail>(IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT, { detail: {} }));
      window.dispatchEvent(new CustomEvent<ImagePreviewCommandDetail>(IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT, { detail: {} }));
    });

    expect(onInspectFirst).toHaveBeenCalledWith({
      alt: 'First',
      src: 'data:image/png;base64,Zmlyc3Q=',
      caption: undefined,
      width: undefined,
      height: undefined,
    });
    expect(onInspectSecond).not.toHaveBeenCalled();
    expect(onLoadFirst).toHaveBeenCalledOnce();
    expect(onLoadSecond).not.toHaveBeenCalled();
  });
});
