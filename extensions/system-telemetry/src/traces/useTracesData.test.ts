// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTracesData } from './useTracesData.js';

const endpoints = [
  '/traces/summary',
  '/traces/model-usage',
  '/traces/cost-by-conversation',
  '/traces/tool-health',
  '/traces/context',
  '/traces/agent-loop',
  '/traces/tokens-daily',
  '/traces/tool-flow',
  '/traces/auto-mode',
  '/traces/cache-efficiency',
  '/traces/system-prompt',
  '/traces/context-pointers',
  '/traces/session-integrity',
] as const;

const payloads: Record<string, unknown> = {
  '/traces/summary': { totalTraces: 7 },
  '/traces/model-usage': { models: [{ model: 'gpt-5' }], throughput: [{ bucket: 'now' }] },
  '/traces/cost-by-conversation': [{ conversationId: 'conv-1' }],
  '/traces/tool-health': [{ name: 'bash' }],
  '/traces/context': { sessions: [{ sessionId: 'session-1' }], compactions: [{ id: 'compaction-1' }], compactionAggs: { total: 1 } },
  '/traces/agent-loop': { loops: 2 },
  '/traces/tokens-daily': [{ day: '2026-05-22' }],
  '/traces/tool-flow': { nodes: [] },
  '/traces/auto-mode': { total: 3 },
  '/traces/cache-efficiency': { series: [], aggregate: { reads: 4 } },
  '/traces/system-prompt': { series: [], aggregate: { total: 5 } },
  '/traces/context-pointers': { pointers: [] },
  '/traces/session-integrity': [{ id: 'event-1' }],
};

function pathFromRequest(input: RequestInfo | URL): string {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  return new URL(url, 'http://localhost').pathname.replace('/api/extensions/system-telemetry/routes', '');
}

describe('useTracesData', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = pathFromRequest(input);
      return { ok: true, json: async () => payloads[path] };
    });
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches every telemetry endpoint for the selected range and maps aggregate payloads', async () => {
    const { result } = renderHook(() => useTracesData('6h'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(endpoints.length);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
      endpoints.map((path) => `/api/extensions/system-telemetry/routes${path}?range=6h`),
    );
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

  it('keeps partial data when one endpoint fails and logs the rejected endpoint', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const path = pathFromRequest(input);
      if (path === '/traces/tool-health') return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, json: async () => payloads[path] };
    });

    const { result } = renderHook(() => useTracesData('24h'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.toolHealth).toBeNull();
    expect(result.current.summary).toEqual({ totalTraces: 7 });
    expect(warnSpy).toHaveBeenCalledWith('[telemetry] endpoint failed:', expect.any(Error));
  });

  it('reports all endpoint failures and refetches on demand', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const { result } = renderHook(() => useTracesData('1h'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('All telemetry endpoints failed');
    expect(fetchMock).toHaveBeenCalledTimes(endpoints.length);

    fetchMock.mockClear();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({ ok: true, json: async () => payloads[pathFromRequest(input)] }));
    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchMock).toHaveBeenCalledTimes(endpoints.length);
    expect(result.current.error).toBeNull();
    expect(result.current.summary).toEqual({ totalTraces: 7 });
  });

  it('refetches with the new range when the range changes', async () => {
    const { rerender } = renderHook(({ range }) => useTracesData(range), { initialProps: { range: '1h' as const } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(endpoints.length));

    fetchMock.mockClear();
    rerender({ range: '30d' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(endpoints.length));

    expect(fetchMock.mock.calls.every(([input]) => String(input).endsWith('?range=30d'))).toBe(true);
  });
});
