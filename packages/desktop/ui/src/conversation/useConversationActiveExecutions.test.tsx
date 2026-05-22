/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('useConversationActiveExecutions', () => {
  beforeEach(() => {
    vi.mocked(api.conversationExecutions).mockReset();
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
});
