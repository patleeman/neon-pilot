import type {
  ConversationCommitCheckpointFile,
  ConversationCommitCheckpointFileStatus,
} from '../../../../core/src/conversation-commit-checkpoints.js';
import { callServerModuleExport } from './serverModuleResolver.js';

export type { ConversationCommitCheckpointFile, ConversationCommitCheckpointFileStatus };

export async function getConversationCommitCheckpoint(...args: unknown[]) {
  return callServerModuleExport('@neon-pilot/core', 'getConversationCommitCheckpoint', ...args);
}

export async function listConversationCommitCheckpoints(...args: unknown[]) {
  return callServerModuleExport('@neon-pilot/core', 'listConversationCommitCheckpoints', ...args);
}

export async function saveConversationCommitCheckpoint(...args: unknown[]) {
  return callServerModuleExport('@neon-pilot/core', 'saveConversationCommitCheckpoint', ...args);
}
