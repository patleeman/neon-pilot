// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConversationScroll } from './useConversationScroll.js';

function setScrollMetrics(el: HTMLDivElement, metrics: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: metrics.clientHeight });
  el.scrollTop = metrics.scrollTop;
}

describe('useConversationScroll', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(performance.now()), 0));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => window.clearTimeout(handle));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not let stale programmatic scrolls re-pin after the user detaches during streaming', () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    const scrollRef = { current: scrollEl };
    const messages = [{ type: 'text' as const, ts: '1', text: 'hello' }];

    const { result, rerender } = renderHook(
      ({ isStreaming }) =>
        useConversationScroll({
          conversationId: 'conversation-1',
          messages,
          scrollRef,
          sessionLoading: false,
          isStreaming,
          initialScrollKey: null,
        }),
      { initialProps: { isStreaming: false } },
    );

    const scrollToBottomFromBeforeStreamingRender = result.current.scrollToBottom;

    act(() => {
      scrollEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -80 }));
    });
    expect(result.current.atBottom).toBe(false);

    rerender({ isStreaming: true });
    act(() => {
      scrollToBottomFromBeforeStreamingRender();
    });

    expect(scrollEl.scrollTop).toBe(600);
    expect(result.current.atBottom).toBe(false);
  });

  it('keeps the viewport pinned when the user wheels down at the bottom', () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    const scrollRef = { current: scrollEl };
    const messages = [{ type: 'text' as const, ts: '1', text: 'hello' }];

    const { result } = renderHook(() =>
      useConversationScroll({
        conversationId: 'conversation-1',
        messages,
        scrollRef,
        sessionLoading: false,
        isStreaming: true,
        initialScrollKey: null,
      }),
    );

    act(() => {
      scrollEl.dispatchEvent(new WheelEvent('wheel', { deltaY: 80 }));
    });

    expect(result.current.atBottom).toBe(true);
  });

  it('keeps short transcripts pinned when the user clicks in the transcript', () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 320, clientHeight: 400, scrollTop: 0 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    scrollEl.getBoundingClientRect = vi.fn().mockReturnValue({ left: 0, right: 400, top: 0, bottom: 400 });
    const scrollRef = { current: scrollEl };
    const messages = [{ type: 'text' as const, ts: '1', text: 'hello' }];

    const { result } = renderHook(() =>
      useConversationScroll({
        conversationId: 'conversation-1',
        messages,
        scrollRef,
        sessionLoading: false,
        isStreaming: true,
        initialScrollKey: null,
      }),
    );

    act(() => {
      scrollEl.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10 }));
    });

    expect(result.current.atBottom).toBe(true);
  });

  it('does not move the viewport when an implicitly placed streaming tail grows', () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    const scrollRef = { current: scrollEl };

    const { result, rerender } = renderHook(
      ({ messages, isStreaming }) =>
        useConversationScroll({
          conversationId: 'conversation-1',
          messages,
          scrollRef,
          sessionLoading: false,
          isStreaming,
          initialScrollKey: null,
        }),
      {
        initialProps: {
          isStreaming: false,
          messages: [{ type: 'text' as const, ts: '1', text: 'hello' }],
        },
      },
    );

    rerender({ isStreaming: true, messages: [{ type: 'text' as const, ts: '1', text: 'hello' }] });
    setScrollMetrics(scrollEl, { scrollHeight: 1120, clientHeight: 400, scrollTop: 600 });
    rerender({ isStreaming: true, messages: [{ type: 'text' as const, ts: '1', text: 'hello streamed text' }] });

    expect(scrollEl.scrollTop).toBe(600);
    expect(result.current.atBottom).toBe(false);
  });

  it('anchors a new streaming assistant turn to the preceding user message', () => {
    const scrollEl = document.createElement('div');
    const scrollIntoView = vi.fn();
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn((selector: string) =>
      selector === '[data-message-index="4"]'
        ? {
            scrollIntoView,
          }
        : null,
    );
    const scrollRef = { current: scrollEl };
    const userMessage = { type: 'user' as const, ts: '1', text: 'Explain this.' };

    const { result, rerender } = renderHook(
      ({ messages, isStreaming }) =>
        useConversationScroll({
          conversationId: 'conversation-1',
          messages,
          scrollRef,
          sessionLoading: false,
          isStreaming,
          initialScrollKey: null,
          messageIndexOffset: 4,
        }),
      {
        initialProps: {
          isStreaming: true,
          messages: [userMessage],
        },
      },
    );

    rerender({
      isStreaming: true,
      messages: [userMessage, { type: 'text' as const, ts: '2', text: 'Streaming answer starts.' }],
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      inline: 'nearest',
    });
    expect(result.current.atBottom).toBe(false);
  });

  it('does not treat the submitted user prompt bottom sync as consent to follow a long streaming reply', () => {
    const scrollEl = document.createElement('div');
    const scrollIntoView = vi.fn();
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn((selector: string) =>
      selector === '[data-message-index="4"]'
        ? {
            scrollIntoView,
          }
        : null,
    );
    const scrollRef = { current: scrollEl };
    const earlierReply = { type: 'text' as const, ts: '1', text: 'Earlier answer.' };
    const userMessage = { type: 'user' as const, ts: '2', text: 'Write the long version.' };

    const { result, rerender } = renderHook(
      ({ messages, isStreaming }) =>
        useConversationScroll({
          conversationId: 'conversation-1',
          messages,
          scrollRef,
          sessionLoading: false,
          isStreaming,
          initialScrollKey: null,
          messageIndexOffset: 3,
        }),
      {
        initialProps: {
          isStreaming: false,
          messages: [earlierReply],
        },
      },
    );

    rerender({
      isStreaming: true,
      messages: [earlierReply, userMessage],
    });

    act(() => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.atBottom).toBe(true);

    rerender({
      isStreaming: true,
      messages: [earlierReply, userMessage, { type: 'text' as const, ts: '3', text: 'Long answer starts.' }],
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      inline: 'nearest',
    });
    expect(result.current.atBottom).toBe(false);
  });

  it('resumes following streaming tail growth after an explicit jump to latest', async () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    const scrollRef = { current: scrollEl };
    const messages = [{ type: 'text' as const, ts: '1', text: 'hello' }];

    const { result, rerender } = renderHook(
      ({ currentMessages }) =>
        useConversationScroll({
          conversationId: 'conversation-1',
          messages: currentMessages,
          scrollRef,
          sessionLoading: false,
          isStreaming: true,
          initialScrollKey: null,
        }),
      {
        initialProps: {
          currentMessages: messages,
        },
      },
    );

    act(() => {
      result.current.scrollToBottom({ force: true });
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    setScrollMetrics(scrollEl, { scrollHeight: 1120, clientHeight: 400, scrollTop: 600 });
    rerender({ currentMessages: [{ type: 'text' as const, ts: '1', text: 'hello streamed text' }] });

    expect(scrollEl.scrollTop).toBe(720);
    expect(result.current.atBottom).toBe(true);
  });

  it('does not preserve streaming tail growth after the user detaches', () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    const scrollRef = { current: scrollEl };

    const { result, rerender } = renderHook(
      ({ messages, isStreaming }) =>
        useConversationScroll({
          conversationId: 'conversation-1',
          messages,
          scrollRef,
          sessionLoading: false,
          isStreaming,
          initialScrollKey: null,
        }),
      {
        initialProps: {
          isStreaming: true,
          messages: [{ type: 'text' as const, ts: '1', text: 'hello' }],
        },
      },
    );

    act(() => {
      scrollEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -80 }));
    });
    expect(result.current.atBottom).toBe(false);

    setScrollMetrics(scrollEl, { scrollHeight: 1120, clientHeight: 400, scrollTop: 560 });
    rerender({ isStreaming: true, messages: [{ type: 'text' as const, ts: '1', text: 'hello streamed text' }] });

    expect(scrollEl.scrollTop).toBe(560);
    expect(result.current.atBottom).toBe(false);
  });

  it('allows explicit scroll-to-bottom actions to re-pin during streaming', () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    const scrollRef = { current: scrollEl };
    const messages = [{ type: 'text' as const, ts: '1', text: 'hello' }];

    const { result, rerender } = renderHook(
      ({ isStreaming }) =>
        useConversationScroll({
          conversationId: 'conversation-1',
          messages,
          scrollRef,
          sessionLoading: false,
          isStreaming,
          initialScrollKey: null,
        }),
      { initialProps: { isStreaming: false } },
    );

    act(() => {
      scrollEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -80 }));
    });
    expect(result.current.atBottom).toBe(false);

    rerender({ isStreaming: true });
    act(() => {
      result.current.scrollToBottom({ force: true });
    });

    expect(scrollEl.scrollTop).toBe(600);
    expect(result.current.atBottom).toBe(true);
  });

  it('treats transcript keyboard navigation as reader intent to stop following', () => {
    const scrollEl = document.createElement('div');
    setScrollMetrics(scrollEl, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollEl.querySelector = vi.fn().mockReturnValue(null);
    const scrollRef = { current: scrollEl };
    const messages = [{ type: 'text' as const, ts: '1', text: 'hello' }];

    const { result } = renderHook(() =>
      useConversationScroll({
        conversationId: 'conversation-1',
        messages,
        scrollRef,
        sessionLoading: false,
        isStreaming: true,
        initialScrollKey: null,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp' }));
    });

    expect(result.current.atBottom).toBe(false);
  });
});
