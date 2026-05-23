import { type ConversationCommitCheckpointFile } from '@neon-pilot/core';

export interface CreatedConversationCheckpointLike {
  metadata: {
    commitSha: string;
    shortSha: string;
    subject: string;
    body?: string;
    authorName?: string;
    authorEmail?: string;
    committedAt?: string;
  };
  files: ConversationCommitCheckpointFile[];
  linesAdded: number;
  linesDeleted: number;
}

export function buildConversationCheckpointRecordInput(input: {
  profile: string;
  conversationId: string;
  cwd: string;
  created: CreatedConversationCheckpointLike;
}) {
  return {
    profile: input.profile,
    conversationId: input.conversationId,
    checkpointId: input.created.metadata.commitSha,
    title: input.created.metadata.subject,
    cwd: input.cwd,
    commitSha: input.created.metadata.commitSha,
    shortSha: input.created.metadata.shortSha,
    subject: input.created.metadata.subject,
    body: input.created.metadata.body,
    authorName: input.created.metadata.authorName ?? 'Unknown',
    authorEmail: input.created.metadata.authorEmail,
    committedAt: input.created.metadata.committedAt ?? new Date().toISOString(),
    files: input.created.files,
    linesAdded: input.created.linesAdded,
    linesDeleted: input.created.linesDeleted,
  };
}
