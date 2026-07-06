// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../client/api';
import { useApi } from '../hooks/useApi';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import type { DocumentRecord, InboxListResult } from '../shared/types';
import { InboxPage } from './InboxPage';

vi.mock('../hooks/useApi', () => ({
  useApi: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock('../hooks/useInvalidateOnTopics', () => ({
  useInvalidateOnTopics: vi.fn(),
}));

const useInvalidateOnTopicsMock = vi.mocked(useInvalidateOnTopics);
const mockUseApi = vi.mocked(useApi);

function buildUseApiResult<T>(overrides: Partial<ReturnType<typeof useApi<T>>> = {}) {
  return {
    data: null,
    loading: true,
    refreshing: false,
    error: null,
    refetch: vi.fn(),
    replaceData: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useApi>;
}

function mockApiCalls(...results: Array<ReturnType<typeof useApi>>) {
  const lastResult = results[results.length - 1];
  const queue = [...results];
  mockUseApi.mockImplementation(() => queue.shift() ?? lastResult);
}

function makeRecord(overrides: Partial<DocumentRecord> & { id: string }): DocumentRecord {
  return {
    owner: 'system-inbox',
    collection: 'messages',
    body: {
      from: 'worker-1',
      fromKind: 'worker',
      subject: 'Run finished',
      body: 'Done.',
      kind: 'result',
      read: false,
      archived: false,
    },
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as DocumentRecord;
}

function renderInboxPage() {
  return render(
    <MemoryRouter initialEntries={['/inbox']}>
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InboxPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockUseApi.mockReset();
  });

  it('subscribes to the inbox and documents invalidation topics', () => {
    mockApiCalls(buildUseApiResult({ loading: true, data: null }));
    renderInboxPage();
    expect(useInvalidateOnTopicsMock).toHaveBeenCalledWith(['inbox', 'documents'], expect.any(Function));
  });

  it('renders the Inbox heading', () => {
    mockApiCalls(buildUseApiResult({ loading: true, data: null }));
    renderInboxPage();
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeTruthy();
  });

  it('shows loading state', () => {
    mockApiCalls(buildUseApiResult({ loading: true, data: null }));
    renderInboxPage();
    expect(screen.getByLabelText('Loading messages')).toBeTruthy();
  });

  it('shows error state when the list fetch fails', () => {
    mockApiCalls(buildUseApiResult({ loading: false, error: 'API unavailable', data: null }));
    renderInboxPage();
    expect(screen.getByText('API unavailable')).toBeTruthy();
  });

  it('shows empty state when there are no messages', () => {
    mockApiCalls(buildUseApiResult({ loading: false, data: { records: [], total: 0 } as InboxListResult }));
    renderInboxPage();
    expect(screen.getByText('No messages yet')).toBeTruthy();
  });

  it('renders the list of messages with subject and from', () => {
    const records = [
      makeRecord({
        id: 'msg-a',
        body: { from: 'worker-1', fromKind: 'worker', subject: 'Subject A', body: 'Body A', kind: 'result', read: false, archived: false },
      }),
      makeRecord({
        id: 'msg-b',
        body: {
          from: 'faceless-agent',
          fromKind: 'persona',
          subject: 'Subject B',
          body: 'Body B',
          kind: 'note',
          read: true,
          archived: false,
        },
      }),
    ];
    mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 2 } as InboxListResult }));
    renderInboxPage();

    expect(screen.getByText('Subject A')).toBeTruthy();
    expect(screen.getByText('Subject B')).toBeTruthy();
    expect(screen.getByText('worker-1')).toBeTruthy();
    expect(screen.getByText('faceless-agent')).toBeTruthy();
  });

  it('shows unread count in the Inbox tab', () => {
    const records = [
      makeRecord({
        id: 'msg-a',
        body: { from: 'w', fromKind: 'worker', subject: 'A', body: 'b', kind: 'result', read: false, archived: false },
      }),
      makeRecord({
        id: 'msg-b',
        body: { from: 'w', fromKind: 'worker', subject: 'B', body: 'b', kind: 'result', read: false, archived: false },
      }),
      makeRecord({
        id: 'msg-c',
        body: { from: 'w', fromKind: 'worker', subject: 'C', body: 'b', kind: 'result', read: true, archived: false },
      }),
    ];
    mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 3 } as InboxListResult }));
    renderInboxPage();

    expect(screen.getByRole('tab', { name: /Inbox/ }).textContent).toMatch(/2 unread/);
  });

  it('selects a message and shows detail in the aside', () => {
    const records = [
      makeRecord({
        id: 'msg-1',
        body: {
          from: 'worker-1',
          fromKind: 'worker',
          to: 'user',
          subject: 'Detail subject',
          body: 'Detail body content',
          kind: 'result',
          refId: 'run-1',
          read: true,
          archived: false,
        },
      }),
    ];
    mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult }));
    renderInboxPage();

    fireEvent.click(screen.getByText('Detail subject'));

    expect(screen.getByText('Message Detail')).toBeTruthy();
    // The message body text also shows in the truncated row preview, so it
    // should appear at least once in the detail aside as well.
    expect(screen.getAllByText('Detail body content').length).toBeGreaterThan(0);
    expect(screen.getByText('run-1')).toBeTruthy();
  });

  it('marks a message read automatically when first opened and patches the record', async () => {
    const patchSpy = vi.spyOn(api.inbox, 'patch').mockResolvedValue({
      document: makeRecord({
        id: 'msg-1',
        body: { from: 'w', fromKind: 'worker', subject: 'A', body: 'b', kind: 'result', read: true, archived: false },
      }),
    });
    const replaceData = vi.fn();
    const records = [
      makeRecord({
        id: 'msg-1',
        body: { from: 'w', fromKind: 'worker', subject: 'A', body: 'b', kind: 'result', read: false, archived: false },
      }),
    ];
    mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult, replaceData }));

    renderInboxPage();
    fireEvent.click(screen.getByText('A'));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('msg-1', { read: true });
    });
  });

  it('archives a selected message via the detail action', async () => {
    const archivedDoc = makeRecord({
      id: 'msg-1',
      body: { from: 'w', fromKind: 'worker', subject: 'A', body: 'b', kind: 'result', read: true, archived: true },
    });
    const patchSpy = vi.spyOn(api.inbox, 'patch').mockResolvedValue({ document: archivedDoc });
    const replaceData = vi.fn();
    const records = [
      makeRecord({
        id: 'msg-1',
        body: { from: 'w', fromKind: 'worker', subject: 'A', body: 'b', kind: 'result', read: true, archived: false },
      }),
    ];
    mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult, replaceData }));

    renderInboxPage();
    fireEvent.click(screen.getByText('A'));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('msg-1', { archived: true });
    });
    expect(replaceData).toHaveBeenCalled();
  });

  it('deletes a selected message via the detail action', async () => {
    const deleteSpy = vi.spyOn(api.inbox, 'delete').mockResolvedValue({ deleted: true });
    const replaceData = vi.fn();
    const records = [
      makeRecord({
        id: 'msg-1',
        body: { from: 'w', fromKind: 'worker', subject: 'A', body: 'b', kind: 'result', read: true, archived: false },
      }),
    ];
    mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult, replaceData }));

    renderInboxPage();
    fireEvent.click(screen.getByText('A'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('msg-1');
    });
  });

  it('switches to the archived view when the Archived tab is clicked', () => {
    const listSpy = vi.spyOn(api.inbox, 'list').mockResolvedValue({ records: [], total: 0 } as InboxListResult);
    mockApiCalls(buildUseApiResult({ loading: false, data: { records: [], total: 0 } as InboxListResult }));

    renderInboxPage();
    listSpy.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));

    // The fetcher key changes; verify the next list call requests archived=true.
    const fetcher = mockUseApi.mock.calls.at(-1)?.[0] as (() => Promise<InboxListResult>) | undefined;
    expect(fetcher).toBeTruthy();
    void fetcher?.();
    expect(listSpy).toHaveBeenCalledWith({ archived: true, limit: 50, offset: 0 });
  });

  it('shows archived empty state with restore hint', () => {
    mockApiCalls(buildUseApiResult({ loading: false, data: { records: [], total: 0 } as InboxListResult }));
    renderInboxPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));

    expect(screen.getByText('No archived messages')).toBeTruthy();
    expect(screen.getByText(/Restoring a message moves it back/)).toBeTruthy();
  });

  it('shows pagination in the archived view', () => {
    mockApiCalls(buildUseApiResult({ loading: false, data: { records: [], total: 60 } as InboxListResult }));
    renderInboxPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));

    expect(screen.getAllByText('60 messages')).toHaveLength(2);
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('fetches the inbox list with the default view on mount', async () => {
    const listSpy = vi.spyOn(api.inbox, 'list').mockResolvedValue({ records: [], total: 0 } as InboxListResult);
    mockApiCalls(buildUseApiResult({ loading: false, data: { records: [], total: 0 } as InboxListResult }));

    renderInboxPage();
    const fetcher = mockUseApi.mock.calls[0]?.[0] as (() => Promise<InboxListResult>) | undefined;
    expect(fetcher).toBeTruthy();
    await fetcher?.();

    expect(listSpy).toHaveBeenCalledWith({ archived: false, limit: 50, offset: 0 });
  });

  describe('question answering', () => {
    it('shows the answer input section for question-kind messages', async () => {
      vi.spyOn(api.inbox, 'patch').mockResolvedValue({
        document: makeRecord({
          id: 'q-1',
          body: {
            from: 'persona',
            fromKind: 'persona',
            subject: 'Continue?',
            body: 'Should we proceed?',
            kind: 'question',
            read: true,
            archived: false,
          },
        }),
      });
      const records = [
        makeRecord({
          id: 'q-1',
          body: {
            from: 'persona',
            fromKind: 'persona',
            subject: 'Continue?',
            body: 'Should we proceed?',
            kind: 'question',
            read: false,
            archived: false,
          },
        }),
      ];
      mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult }));
      renderInboxPage();

      fireEvent.click(screen.getByText('Continue?'));

      // Wait for auto-mark-read mutation to settle so the button reads "Submit Answer".
      await screen.findByRole('button', { name: 'Submit Answer' });
      expect(screen.getByPlaceholderText('Type your answer...')).toBeTruthy();
    });

    it('shows answer text for already-answered question messages', () => {
      const records = [
        makeRecord({
          id: 'q-answered',
          body: {
            from: 'persona',
            fromKind: 'persona',
            subject: 'Approved?',
            body: 'Can I proceed?',
            kind: 'question',
            read: true,
            archived: false,
            answer: { text: 'Yes, approved', answeredAt: '2026-01-15T10:00:00.000Z' },
          },
        }),
      ];
      mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult }));
      renderInboxPage();

      fireEvent.click(screen.getByText('Approved?'));

      expect(screen.getByText('Answer')).toBeTruthy();
      expect(screen.getByText('Yes, approved')).toBeTruthy();
      expect(screen.getAllByText(/Answered/).length).toBeGreaterThan(0);
      // No answer input when already answered
      expect(screen.queryByPlaceholderText('Type your answer...')).toBeNull();
    });

    it('submits an answer via PATCH when Submit Answer is clicked', async () => {
      const patchSpy = vi.spyOn(api.inbox, 'patch').mockResolvedValue({
        document: makeRecord({
          id: 'q-2',
          body: {
            from: 'persona',
            fromKind: 'persona',
            subject: 'Deploy?',
            body: 'Should we deploy?',
            kind: 'question',
            read: true,
            archived: false,
            answer: { text: 'Yes', answeredAt: '2026-01-15T10:00:00.000Z' },
          },
        }),
      });
      const replaceData = vi.fn();
      const records = [
        makeRecord({
          id: 'q-2',
          body: {
            from: 'persona',
            fromKind: 'persona',
            subject: 'Deploy?',
            body: 'Should we deploy?',
            kind: 'question',
            read: false,
            archived: false,
          },
        }),
      ];
      mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult, replaceData }));

      renderInboxPage();
      fireEvent.click(screen.getByText('Deploy?'));

      // Wait for auto-mark-read mutation to settle before interacting.
      const submitBtn = await screen.findByRole('button', { name: 'Submit Answer' });
      const textarea = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(textarea, { target: { value: 'Yes, deploy now' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith('q-2', { answer: 'Yes, deploy now' });
      });
    });

    it('disables the Submit Answer button when the input is empty', async () => {
      vi.spyOn(api.inbox, 'patch').mockResolvedValue({
        document: makeRecord({
          id: 'q-3',
          body: {
            from: 'persona',
            fromKind: 'persona',
            subject: 'Empty input?',
            body: 'Test',
            kind: 'question',
            read: true,
            archived: false,
          },
        }),
      });
      const records = [
        makeRecord({
          id: 'q-3',
          body: {
            from: 'persona',
            fromKind: 'persona',
            subject: 'Empty input?',
            body: 'Test',
            kind: 'question',
            read: false,
            archived: false,
          },
        }),
      ];
      mockApiCalls(buildUseApiResult({ loading: false, data: { records, total: 1 } as InboxListResult }));
      renderInboxPage();

      fireEvent.click(screen.getByText('Empty input?'));

      // Wait for the auto-mark-read mutation to settle so mutating state releases.
      const submitBtn = await screen.findByRole('button', { name: 'Submit Answer' });
      expect(submitBtn.hasAttribute('disabled')).toBe(true);
    });
  });
});
