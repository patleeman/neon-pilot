import { describe, expect, it } from 'vitest';

import { buildConversationOffshootMetadataData, CONVERSATION_OFFSHOOT_METADATA_CUSTOM_TYPE } from './sessionOffshootMetadataEntry';

describe('sessionOffshootMetadataEntry', () => {
  it('exports the offshoot metadata custom type', () => {
    expect(CONVERSATION_OFFSHOOT_METADATA_CUSTOM_TYPE).toBe('conversation_offshoot_metadata');
  });

  it('builds detached metadata data', () => {
    expect(buildConversationOffshootMetadataData({ detached: true, kind: 'branch' })).toEqual({ detached: true });
  });

  it('builds linked offshoot metadata data with only present fields', () => {
    expect(
      buildConversationOffshootMetadataData({
        kind: 'branch',
        parentSessionFile: '/tmp/parent.jsonl',
        parentSessionId: 'parent',
        parentMessageId: 'msg',
        sourceRunId: 'run',
      }),
    ).toEqual({
      kind: 'branch',
      parentSessionFile: '/tmp/parent.jsonl',
      parentSessionId: 'parent',
      parentMessageId: 'msg',
      sourceRunId: 'run',
    });
    expect(buildConversationOffshootMetadataData({ kind: 'branch' })).toEqual({ kind: 'branch' });
  });
});
