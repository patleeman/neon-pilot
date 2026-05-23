import { describe, expect, it } from 'vitest';

import { buildConversationCheckpointRecordInput } from './localApiCheckpointRecord';

describe('localApiCheckpointRecord', () => {
  it('maps created checkpoint metadata to persistence input', () => {
    expect(
      buildConversationCheckpointRecordInput({
        profile: 'default',
        conversationId: 'c1',
        cwd: '/repo',
        created: {
          metadata: {
            commitSha: 'abcdef',
            shortSha: 'abc',
            subject: 'subject',
            body: 'body',
            authorName: 'Pat',
            authorEmail: 'pat@example.com',
            committedAt: 'now',
          },
          files: ['a.ts'],
          linesAdded: 1,
          linesDeleted: 2,
        },
      }),
    ).toEqual({
      profile: 'default',
      conversationId: 'c1',
      checkpointId: 'abcdef',
      title: 'subject',
      cwd: '/repo',
      commitSha: 'abcdef',
      shortSha: 'abc',
      subject: 'subject',
      body: 'body',
      authorName: 'Pat',
      authorEmail: 'pat@example.com',
      committedAt: 'now',
      files: ['a.ts'],
      linesAdded: 1,
      linesDeleted: 2,
    });
  });
});
