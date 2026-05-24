import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listConversationSessionsSnapshotMock, readConversationSessionMetaMock, readIndexedConversationSearchTextMock } = vi.hoisted(() => ({
  listConversationSessionsSnapshotMock: vi.fn(),
  readConversationSessionMetaMock: vi.fn(),
  readIndexedConversationSearchTextMock: vi.fn(),
}));

vi.mock('./conversationService.js', () => ({
  listConversationSessionsSnapshot: listConversationSessionsSnapshotMock,
  readConversationSessionMeta: readConversationSessionMetaMock,
}));

vi.mock('./conversationSearchIndex.js', () => ({
  readIndexedConversationSearchText: readIndexedConversationSearchTextMock,
}));

import {
  readConversationSessionMetaCapability,
  readConversationSessionsCapability,
  readConversationSessionSearchIndexCapability,
} from './conversationSessionCapability.js';

beforeEach(() => {
  listConversationSessionsSnapshotMock.mockReset();
  readConversationSessionMetaMock.mockReset();
  readIndexedConversationSearchTextMock.mockReset();
});

describe('conversationSessionCapability', () => {
  it('reads the decorated session snapshot', () => {
    listConversationSessionsSnapshotMock.mockReturnValue([{ id: 'conversation-1', title: 'Conversation 1' }]);

    expect(readConversationSessionsCapability()).toEqual([{ id: 'conversation-1', title: 'Conversation 1' }]);
    expect(listConversationSessionsSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('reads normalized session metadata when present', () => {
    readConversationSessionMetaMock.mockReturnValue({ id: 'conversation-1', title: 'Conversation 1' });

    expect(readConversationSessionMetaCapability('  conversation-1  ')).toEqual({ id: 'conversation-1', title: 'Conversation 1' });
    expect(readConversationSessionMetaMock).toHaveBeenCalledWith('conversation-1');
  });

  it('returns null for blank or missing session metadata', () => {
    readConversationSessionMetaMock.mockReturnValue(null);

    expect(readConversationSessionMetaCapability('   ')).toBeNull();
    expect(readConversationSessionMetaMock).not.toHaveBeenCalled();
    expect(readConversationSessionMetaCapability('conversation-missing')).toBeNull();
    expect(readConversationSessionMetaMock).toHaveBeenCalledWith('conversation-missing');
  });

  it('builds a normalized session search index and tolerates missing sessions', () => {
    readIndexedConversationSearchTextMock.mockReturnValue({
      'conversation-1': 'hello world',
      'conversation-2': '',
    });

    expect(
      readConversationSessionSearchIndexCapability({
        sessionIds: [' conversation-1 ', 'conversation-2', '', 42],
      }),
    ).toEqual({
      index: {
        'conversation-1': 'hello world',
        'conversation-2': '',
      },
    });
    expect(readIndexedConversationSearchTextMock).toHaveBeenCalledWith(['conversation-1', 'conversation-2']);
  });

  it('returns an empty search index when no valid session ids are provided', () => {
    expect(readConversationSessionSearchIndexCapability({ sessionIds: [null, '   ', 123] })).toEqual({ index: {} });
    expect(readIndexedConversationSearchTextMock).not.toHaveBeenCalled();
  });
});
