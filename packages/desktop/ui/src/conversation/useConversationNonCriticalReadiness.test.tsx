// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useConversationNonCriticalReadiness } from './useConversationNonCriticalReadiness';

describe('useConversationNonCriticalReadiness', () => {
  const originalRequestIdleCallback = window.requestIdleCallback;
  const originalCancelIdleCallback = window.cancelIdleCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    window.requestIdleCallback = undefined;
    window.cancelIdleCallback = undefined;
  });

  afterEach(() => {
    window.requestIdleCallback = originalRequestIdleCallback;
    window.cancelIdleCallback = originalCancelIdleCallback;
    vi.useRealTimers();
  });

  it('marks metadata ready after two animation frames before later non-critical tiers', () => {
    const { result } = renderHook(() =>
      useConversationNonCriticalReadiness({
        conversationKey: 'conv-1',
        metadataFallbackMs: 500,
        shelvesDeferMs: 150,
        modelsDeferMs: 1200,
      }),
    );

    expect(result.current).toEqual({ metadataReady: false, shelvesReady: false, modelsReady: false });

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current).toEqual({ metadataReady: false, shelvesReady: false, modelsReady: false });

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current.metadataReady).toBe(true);
    expect(result.current.shelvesReady).toBe(false);
    expect(result.current.modelsReady).toBe(false);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.shelvesReady).toBe(true);
    expect(result.current.modelsReady).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1050);
    });
    expect(result.current.modelsReady).toBe(true);
  });

  it('defers draft models after metadata is ready', () => {
    const { result } = renderHook(() =>
      useConversationNonCriticalReadiness({
        conversationKey: 'draft',
        metadataFallbackMs: 500,
        shelvesDeferMs: 150,
        modelsDeferMs: 1200,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(result.current.metadataReady).toBe(true);
    expect(result.current.modelsReady).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.modelsReady).toBe(true);
  });

  it('resets readiness when the conversation key changes', () => {
    const { result, rerender } = renderHook(
      ({ conversationKey }) =>
        useConversationNonCriticalReadiness({
          conversationKey,
          metadataFallbackMs: 500,
          shelvesDeferMs: 150,
          modelsDeferMs: 1200,
        }),
      { initialProps: { conversationKey: 'conv-1' } },
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current).toEqual({ metadataReady: true, shelvesReady: true, modelsReady: true });

    act(() => {
      rerender({ conversationKey: 'conv-2' });
    });
    expect(result.current).toEqual({ metadataReady: false, shelvesReady: false, modelsReady: false });
  });

  it('uses a shorter idle timeout for shelves than heavier model work', () => {
    const idleCallbacks: IdleRequestCallback[] = [];
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    });
    const cancelIdleCallback = vi.fn();
    window.requestIdleCallback = requestIdleCallback;
    window.cancelIdleCallback = cancelIdleCallback;

    const { result, unmount } = renderHook(() =>
      useConversationNonCriticalReadiness({
        conversationKey: 'conv-1',
        metadataFallbackMs: 500,
        shelvesDeferMs: 150,
        modelsDeferMs: 1200,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(result.current.metadataReady).toBe(true);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 120 });
    expect(result.current.shelvesReady).toBe(false);

    act(() => {
      idleCallbacks[0]?.({ didTimeout: false, timeRemaining: () => 5 });
    });
    expect(result.current.shelvesReady).toBe(true);
    expect(result.current.modelsReady).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1050);
    });
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 1000 });

    act(() => {
      idleCallbacks[1]?.({ didTimeout: false, timeRemaining: () => 5 });
    });
    expect(result.current.modelsReady).toBe(true);

    unmount();
    expect(cancelIdleCallback).toHaveBeenCalled();
  });
});
