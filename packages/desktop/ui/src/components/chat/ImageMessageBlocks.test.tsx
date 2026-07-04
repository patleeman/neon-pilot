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
    expect(container.querySelector('.ui-image-inspect-backdrop')).not.toBeNull();
    expect(container.querySelector('.ui-image-inspect-dialog')).not.toBeNull();
    expect(container.querySelector('.ui-image-inspect-stage')).not.toBeNull();
    expect(container.querySelector('.ui-image-inspect-toolbar')).not.toBeNull();
    expect(container.querySelector('.ui-image-inspect-caption')).not.toBeNull();
    expect(container.querySelector('.ui-image-inspect-caption__label')).not.toBeNull();
    expect(container.querySelector('.ui-image-inspect-media')).not.toBeNull();

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

    expect(container.querySelectorAll('.ui-image-preview')).toHaveLength(2);
    expect(container.querySelector('.ui-image-preview')?.getAttribute('data-loaded')).toBe('true');
    expect(container.querySelectorAll('.ui-image-preview__button')).toHaveLength(2);
    expect(container.querySelectorAll('.ui-image-preview__media')).toHaveLength(2);

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

  it('renders stable hooks for deferred image placeholders and captions', () => {
    const onLoad = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <ImagePreview alt="Chart pending" caption="Deferred chart" width={640} height={360} maxHeight={140} deferred onLoad={onLoad} />,
      );
    });

    expect(container.querySelector('.ui-image-preview')?.getAttribute('data-loaded')).toBeNull();
    expect(container.querySelector('.ui-image-preview__placeholder')).not.toBeNull();
    expect(container.querySelector('.ui-image-preview__placeholder-icon')).not.toBeNull();
    expect(container.querySelector('.ui-image-preview__placeholder-label')?.textContent).toBe('Chart pending');
    expect(container.querySelector('.ui-image-preview__placeholder-meta')?.textContent).toBe('640×360');
    expect(container.querySelector('.ui-image-preview__caption')).not.toBeNull();
    expect(container.querySelector('.ui-image-preview__caption-text')?.textContent).toBe('Deferred chart');
  });
});
