// @vitest-environment jsdom

import type { NativeExtensionClient } from '@neon-pilot/extensions';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTracesData } from './useTracesData.js';

const payload = {
  summary: { totalTraces: 7 },
  modelUsage: { models: [{ model: 'gpt-5' }], throughput: [{ bucket: 'now' }] },
  costByConversation: [{ conversationId: 'conv-1' }],
  toolHealth: [{ name: 'bash' }],
  context: { sessions: [{ sessionId: 'session-1' }], compactions: [{ id: 'compaction-1' }], compactionAggs: { total: 1 } },
  agentLoop: { loops: 2 },
  tokensDaily: [{ day: '2026-05-22' }],
  toolFlow: { nodes: [] },
  autoMode: { total: 3 },
  cacheEfficiency: { series: [], aggregate: { reads: 4 } },
  systemPrompt: { series: [], aggregate: { total: 5 } },
  contextPointers: { pointers: [] },
  sessionIntegrity: [{ id: 'event-1' }],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createPa(invoke = vi.fn(async () => payload)): NativeExtensionClient {
  return { extension: { invoke } } as unknown as NativeExtensionClient;
}

describe('useTracesData', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('fetch should not be used by telemetry UI'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads telemetry through the native extension action bridge and maps aggregate payloads', async () => {
    const invoke = vi.fn(async () => payload);
    const pa = createPa(invoke);
    const { result } = renderHook(() => useTracesData('6h', pa));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(invoke).toHaveBeenCalledWith('getTelemetryData', { range: '6h' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.summary).toEqual({ totalTraces: 7 });
    expect(result.current.modelUsage).toEqual([{ model: 'gpt-5' }]);
    expect(result.current.throughput).toEqual([{ bucket: 'now' }]);
    expect(result.current.contextSessions).toEqual([{ sessionId: 'session-1' }]);
    expect(result.current.compactions).toEqual([{ id: 'compaction-1' }]);
    expect(result.current.compactionAggs).toEqual({ total: 1 });
    expect(result.current.cacheEfficiency).toEqual({ reads: 4 });
    expect(result.current.systemPrompt).toEqual({ total: 5 });
  });

  it('reports action failures and refetches on demand', async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(payload);
    const pa = createPa(invoke);
    const { result } = renderHook(() => useTracesData('1h', pa));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');

    await act(async () => {
      await result.current.refetch();
    });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.summary).toEqual({ totalTraces: 7 });
  });

  it('refetches with the new range when the range changes', async () => {
    const invoke = vi.fn(async () => payload);
    const pa = createPa(invoke);
    const { rerender } = renderHook(({ range }) => useTracesData(range, pa), { initialProps: { range: '1h' as const } });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('getTelemetryData', { range: '1h' }));

    rerender({ range: '30d' });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('getTelemetryData', { range: '30d' }));
  });

  it('ignores stale telemetry responses after the range changes', async () => {
    const first = createDeferred<typeof payload>();
    const second = createDeferred<typeof payload>();
    const invoke = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const pa = createPa(invoke);
    const { result, rerender } = renderHook(({ range }) => useTracesData(range, pa), { initialProps: { range: '1h' as const } });

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('getTelemetryData', { range: '1h' }));
    rerender({ range: '30d' });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('getTelemetryData', { range: '30d' }));

    await act(async () => {
      second.resolve({ ...payload, summary: { totalTraces: 30 } });
    });
    await waitFor(() => expect(result.current.summary).toEqual({ totalTraces: 30 }));

    await act(async () => {
      first.resolve({ ...payload, summary: { totalTraces: 1 } });
    });

    expect(result.current.summary).toEqual({ totalTraces: 30 });
  });
});
