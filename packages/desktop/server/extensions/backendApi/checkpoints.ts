import type {
  ConversationCommitCheckpointFile,
  ConversationCommitCheckpointFileStatus,
  ConversationCommitCheckpointRecord,
  ConversationCommitCheckpointSummary,
} from '@neon-pilot/extensions/backend/checkpoints';

import { callServerModuleExport } from './serverModuleResolver.js';

export type {
  ConversationCommitCheckpointFile,
  ConversationCommitCheckpointFileStatus,
  ConversationCommitCheckpointRecord,
  ConversationCommitCheckpointSummary,
};

export async function getConversationCommitCheckpoint(...args: unknown[]) {
  return callServerModuleExport<ConversationCommitCheckpointRecord | null>('@neon-pilot/core', 'getConversationCommitCheckpoint', ...args);
}

export async function listConversationCommitCheckpoints(...args: unknown[]) {
  return callServerModuleExport<ConversationCommitCheckpointSummary[]>('@neon-pilot/core', 'listConversationCommitCheckpoints', ...args);
}

export async function saveConversationCommitCheckpoint(...args: unknown[]) {
  return callServerModuleExport<ConversationCommitCheckpointRecord>('@neon-pilot/core', 'saveConversationCommitCheckpoint', ...args);
}
