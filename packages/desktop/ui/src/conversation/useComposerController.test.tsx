// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useComposerController } from './useComposerController';

describe('useComposerController', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  it('inserts through host state without mutating textarea value directly', () => {
    const inputRef = { current: 'hello world' };
    const textareaRef = createRef<HTMLTextAreaElement>();
    const selectionRef = { current: { start: 6, end: 11 } };
    const setInput = vi.fn((next: string) => {
      inputRef.current = next;
    });
    const scheduleResize = vi.fn();
    const onTextInserted = vi.fn();
    const textarea = document.createElement('textarea');
    textarea.value = 'hello world';
    textarea.setSelectionRange(6, 11);
    const valueSetter = vi.spyOn(textarea, 'value', 'set');
    textareaRef.current = textarea;

    const { result } = renderHook(() =>
      useComposerController({ inputRef, textareaRef, selectionRef, setInput, scheduleResize, onTextInserted }),
    );

    act(() => result.current.insertText(' user '));

    expect(setInput).toHaveBeenCalledWith('hello user');
    expect(valueSetter).not.toHaveBeenCalled();
    expect(onTextInserted).toHaveBeenCalledOnce();
    expect(scheduleResize).toHaveBeenCalledOnce();
    expect(selectionRef.current).toEqual({ start: 10, end: 10 });
    expect(textarea.selectionStart).toBe(10);
    expect(textarea.selectionEnd).toBe(10);
  });

  it('uses the latest input ref when the textarea is unavailable', () => {
    const inputRef = { current: 'fresh draft' };
    const textareaRef = createRef<HTMLTextAreaElement>();
    const selectionRef = { current: { start: 5, end: 5 } };
    const setInput = vi.fn();

    const { result } = renderHook(() => useComposerController({ inputRef, textareaRef, selectionRef, setInput, scheduleResize: vi.fn() }));

    act(() => result.current.insertText(' async '));

    expect(setInput).toHaveBeenCalledWith('fresh async draft');
  });
});
