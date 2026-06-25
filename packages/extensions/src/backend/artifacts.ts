export type ConversationArtifactKind = 'html' | 'mermaid' | 'latex';

export interface ConversationArtifactStyleOverrides {
  theme?: string;
  accent?: string;
  density?: string;
  notes?: string;
}

export interface ConversationArtifactSourceMetadata {
  kind?: string;
  label?: string;
  messageId?: string;
  selection?: string;
  paths?: string[];
  command?: string;
}

export interface ConversationArtifactMetadata {
  type?: string;
  stylePreset?: string;
  styleOverrides?: ConversationArtifactStyleOverrides;
  source?: ConversationArtifactSourceMetadata;
  templateVersion?: string;
  generator?: string;
}

export interface ConversationArtifactRecord {
  id: string;
  title: string;
  kind: ConversationArtifactKind;
  metadata?: ConversationArtifactMetadata;
  content: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface ConversationArtifactSummary {
  id: string;
  title: string;
  kind: ConversationArtifactKind;
  metadata?: ConversationArtifactMetadata;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface ConversationArtifactSelector {
  profile: string;
  conversationId: string;
}

/**
 * Backend imports are resolved by the Neon Pilot host when building trusted
 * local extensions. This package subpath exists so tooling has a real public
 * contract; runtime implementations are provided by the desktop host alias.
 */
function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/artifacts must be resolved by the Neon Pilot host runtime.');
}

export function listConversationArtifacts(_input: ConversationArtifactSelector): ConversationArtifactSummary[] {
  return hostResolved();
}

export function getConversationArtifact(_input: ConversationArtifactSelector & { artifactId: string }): ConversationArtifactRecord | null {
  return hostResolved();
}

export function saveConversationArtifact(
  _input: ConversationArtifactSelector & {
    artifactId?: string;
    title: string;
    kind: ConversationArtifactKind;
    content: string;
    metadata?: ConversationArtifactMetadata;
  },
): ConversationArtifactRecord {
  return hostResolved();
}

export function deleteConversationArtifact(_input: ConversationArtifactSelector & { artifactId: string }): boolean {
  return hostResolved();
}
