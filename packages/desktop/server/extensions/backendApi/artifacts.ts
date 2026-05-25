import type {
  ConversationArtifactKind,
  ConversationArtifactRecord,
  ConversationArtifactSelector,
  ConversationArtifactSummary,
} from '@neon-pilot/extensions/backend/artifacts';

import { callServerModuleExport } from './serverModuleResolver.js';

export type { ConversationArtifactKind, ConversationArtifactRecord, ConversationArtifactSelector, ConversationArtifactSummary };

export async function deleteConversationArtifact(...args: unknown[]) {
  return callServerModuleExport<boolean>('@neon-pilot/core', 'deleteConversationArtifact', ...args);
}

export async function getConversationArtifact(...args: unknown[]) {
  return callServerModuleExport<ConversationArtifactRecord | null>('@neon-pilot/core', 'getConversationArtifact', ...args);
}

export async function listConversationArtifacts(...args: unknown[]) {
  return callServerModuleExport<ConversationArtifactSummary[]>('@neon-pilot/core', 'listConversationArtifacts', ...args);
}

export async function saveConversationArtifact(...args: unknown[]) {
  return callServerModuleExport<ConversationArtifactRecord>('@neon-pilot/core', 'saveConversationArtifact', ...args);
}
