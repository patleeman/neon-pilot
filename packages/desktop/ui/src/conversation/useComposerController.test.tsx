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

  it('inserts through host state and updates the visible textarea immediately', () => {
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
    textareaRef.current = textarea;

    const { result } = renderHook(() =>
      useComposerController({ inputRef, textareaRef, selectionRef, setInput, scheduleResize, onTextInserted }),
    );

    act(() => result.current.insertText(' user '));

    expect(setInput).toHaveBeenCalledWith('hello user');
    expect(textarea.value).toBe('hello user');
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

  it('keeps long-lived extension insertion callbacks fresh across async completion', () => {
    const inputRef = { current: '' };
    const textareaRef = createRef<HTMLTextAreaElement>();
    const selectionRef = { current: { start: 0, end: 0 } };
    const setInput = vi.fn((next: string) => {
      inputRef.current = next;
    });

    const { result } = renderHook(() => useComposerController({ inputRef, textareaRef, selectionRef, setInput, scheduleResize: vi.fn() }));
    const extensionInsertText = result.current.insertText;

    inputRef.current = 'typed while dictating';
    selectionRef.current = { start: inputRef.current.length, end: inputRef.current.length };

    act(() => extensionInsertText('transcript'));

    expect(setInput).toHaveBeenCalledWith('typed while dictating transcript');
  });

  it('appends text at the end for dictation-style insertion', () => {
    const inputRef = { current: 'typed while dictating' };
    const textareaRef = createRef<HTMLTextAreaElement>();
    const selectionRef = { current: { start: 0, end: 5 } };
    const setInput = vi.fn((next: string) => {
      inputRef.current = next;
    });
    const textarea = document.createElement('textarea');
    textarea.value = 'stale visible value';
    textarea.setSelectionRange(0, 5);
    textareaRef.current = textarea;

    const { result } = renderHook(() => useComposerController({ inputRef, textareaRef, selectionRef, setInput, scheduleResize: vi.fn() }));

    act(() => result.current.appendText('transcript'));

    expect(setInput).toHaveBeenCalledWith('typed while dictating transcript');
    expect(selectionRef.current).toEqual({ start: 32, end: 32 });
  });
});
