/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppEventsContext, INITIAL_APP_EVENT_VERSIONS } from '../app/contexts';
import { api } from '../client/api';
import type { ExecutionRecord } from '../shared/types';
import { useConversationActiveExecutions } from './useConversationActiveExecutions';

vi.mock('../client/api', () => ({
  api: {
    conversationExecutions: vi.fn(),
  },
}));

function execution(overrides: Partial<ExecutionRecord> & Pick<ExecutionRecord, 'id'>): ExecutionRecord {
  return {
    id: overrides.id,
    kind: 'subagent',
    visibility: 'primary',
    conversationId: 'conv-1',
    title: 'Background work',
    status: 'running',
    capabilities: { canCancel: true, canRerun: false, canFollowUp: false, hasLog: true, hasResult: false },
    ...overrides,
  };
}

function createWrapper(overrides: { versions?: Partial<typeof INITIAL_APP_EVENT_VERSIONS> } = {}) {
  const value = {
    versions: {
      ...INITIAL_APP_EVENT_VERSIONS,
      ...overrides.versions,
    },
    conversationVersions: {},
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    return <AppEventsContext.Provider value={value}>{children}</AppEventsContext.Provider>;
  };
}

function setDocumentVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useConversationActiveExecutions', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(api.conversationExecutions).mockReset();
  });

  afterEach(() => {
    setDocumentVisibility('visible');
    vi.useRealTimers();
  });

  it('loads active primary executions from scoped backend truth', async () => {
    vi.mocked(api.conversationExecutions).mockResolvedValue({
      conversationId: 'conv-1',
      primary: [execution({ id: 'run-1' })],
      system: [],
      hidden: [],
      executions: [execution({ id: 'run-1' })],
    });

    const { result } = renderHook(() => useConversationActiveExecutions('conv-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.executions.map((item) => item.id)).toEqual(['run-1']));
    expect(api.conversationExecutions).toHaveBeenCalledWith('conv-1', { active: true, visibility: 'primary' });
  });

  it('hides the shelf when scoped backend truth has no active executions', async () => {
    vi.mocked(api.conversationExecutions).mockResolvedValue({
      conversationId: 'conv-1',
      primary: [],
      system: [],
      hidden: [],
      executions: [],
    });

    const { result } = renderHook(() => useConversationActiveExecutions('conv-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(api.conversationExecutions).toHaveBeenCalled());
    expect(result.current.executions).toEqual([]);
  });

  it('refreshes when the executions app version changes', async () => {
    vi.mocked(api.conversationExecutions)
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        primary: [execution({ id: 'run-1' })],
        system: [],
        hidden: [],
        executions: [execution({ id: 'run-1' })],
      })
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        primary: [execution({ id: 'run-2' })],
        system: [],
        hidden: [],
        executions: [execution({ id: 'run-2' })],
      });

    let executionsVersion = 0;
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <AppEventsContext.Provider
          value={{ versions: { ...INITIAL_APP_EVENT_VERSIONS, executions: executionsVersion }, conversationVersions: {} }}
        >
          {children}
        </AppEventsContext.Provider>
      );
    }

    const { result, rerender } = renderHook(() => useConversationActiveExecutions('conv-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.executions.map((item) => item.id)).toEqual(['run-1']));

    executionsVersion = 1;
    rerender();

    await waitFor(() => expect(result.current.executions.map((item) => item.id)).toEqual(['run-2']));
  });

  it('polls while active and clears rows when backend truth becomes empty', async () => {
    vi.useFakeTimers();
    vi.mocked(api.conversationExecutions)
      .mockResolvedValueOnce({
        conversationId: 'conv-1',
        primary: [execution({ id: 'run-1' })],
        system: [],
        hidden: [],
        executions: [execution({ id: 'run-1' })],
      })
      .mockResolvedValueOnce({ conversationId: 'conv-1', primary: [], system: [], hidden: [], executions: [] });

    const { result } = renderHook(() => useConversationActiveExecutions('conv-1'), { wrapper: createWrapper() });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.executions.map((item) => item.id)).toEqual(['run-1']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.executions).toEqual([]);
  });

  it('does not start the active execution poll loop while the document is hidden', async () => {
    vi.useFakeTimers();
    setDocumentVisibility('hidden');
    vi.mocked(api.conversationExecutions).mockResolvedValue({
      conversationId: 'conv-1',
      primary: [execution({ id: 'run-1' })],
      system: [],
      hidden: [],
      executions: [execution({ id: 'run-1' })],
    });

    const { result } = renderHook(() => useConversationActiveExecutions('conv-1'), { wrapper: createWrapper() });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(result.current.executions).toEqual([]);
    expect(api.conversationExecutions).not.toHaveBeenCalled();
  });
});
