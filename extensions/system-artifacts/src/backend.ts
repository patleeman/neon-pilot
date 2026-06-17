import type { ExtensionBackendContext } from '@neon-pilot/extensions/backend';
import {
  type ConversationArtifactKind,
  deleteConversationArtifact,
  getConversationArtifact,
  listConversationArtifacts,
  saveConversationArtifact,
} from '@neon-pilot/extensions/backend/artifacts';

const ARTIFACT_KIND_VALUES = ['html', 'mermaid', 'latex'] as const;
type ArtifactAction = 'save' | 'get' | 'list' | 'delete';

interface ArtifactInput {
  action: ArtifactAction;
  conversationId?: string;
  artifactId?: string;
  kind?: string;
  title?: string;
  content?: string;
  open?: boolean;
}

type ArtifactBackendContext = ExtensionBackendContext & {
  profile: string;
  toolContext?: { conversationId?: string };
};

function readRequiredString(value: string | undefined, label: string): string {
  if (!value || !value.trim()) throw new Error(`${label} is required.`);
  return value;
}

function readRequiredKind(kind: string | undefined): ConversationArtifactKind {
  const normalized = readRequiredString(kind, 'kind');
  if (!ARTIFACT_KIND_VALUES.includes(normalized as ConversationArtifactKind)) throw new Error(`Invalid artifact kind "${normalized}".`);
  return normalized as ConversationArtifactKind;
}

function readConversationId(input: ArtifactInput, ctx: ArtifactBackendContext): string {
  return readRequiredString(ctx.toolContext?.conversationId ?? input.conversationId, 'conversationId');
}

function formatArtifactList(conversationId: string, artifacts: Awaited<ReturnType<typeof listConversationArtifacts>>): string {
  if (artifacts.length === 0) return `No artifacts saved for conversation ${conversationId}.`;
  return [
    `Artifacts for conversation ${conversationId}:`,
    ...artifacts.map(
      (artifact) => `- ${artifact.id} [${artifact.kind}] ${artifact.title} (rev ${artifact.revision}, updated ${artifact.updatedAt})`,
    ),
  ].join('\n');
}

function formatArtifact(record: NonNullable<Awaited<ReturnType<typeof getConversationArtifact>>>): string {
  return [
    `Artifact ${record.id}`,
    `Title: ${record.title}`,
    `Kind: ${record.kind}`,
    `Revision: ${record.revision}`,
    `Updated: ${record.updatedAt}`,
    '',
    record.content,
  ].join('\n');
}

export async function artifact(input: ArtifactInput, ctx: ArtifactBackendContext) {
  const conversationId = readConversationId(input, ctx);
  const profile = ctx.runtimeScope;

  switch (input.action) {
    case 'save': {
      // When updating an existing artifact, preserve current content if not provided
      let content = input.content;
      if (content === undefined && input.artifactId !== undefined) {
        const existing = await getConversationArtifact({ profile, conversationId, artifactId: input.artifactId });
        if (existing) {
          content = existing.content;
        }
      }

      const record = await saveConversationArtifact({
        profile,
        conversationId,
        ...(input.artifactId !== undefined ? { artifactId: input.artifactId } : {}),
        title: readRequiredString(input.title, 'title'),
        kind: readRequiredKind(input.kind),
        content: content ?? '',
      });
      const openRequested = input.open ?? true;
      ctx.ui?.invalidate('artifacts');
      return {
        text: `${record.revision === 1 ? 'Saved' : 'Updated'} artifact ${record.id} [${record.kind}] "${record.title}".`,
        action: 'save',
        conversationId,
        artifactId: record.id,
        title: record.title,
        kind: record.kind,
        revision: record.revision,
        updatedAt: record.updatedAt,
        openRequested,
      };
    }

    case 'get': {
      const artifactId = readRequiredString(input.artifactId, 'artifactId');
      const record = await getConversationArtifact({ profile, conversationId, artifactId });
      if (!record) throw new Error(`Artifact ${artifactId} was not found.`);
      return {
        text: formatArtifact(record),
        action: 'get',
        conversationId,
        artifactId: record.id,
        title: record.title,
        kind: record.kind,
        revision: record.revision,
        updatedAt: record.updatedAt,
        content: record.content,
      };
    }

    case 'list': {
      const artifacts = await listConversationArtifacts({ profile, conversationId });
      return {
        text: formatArtifactList(conversationId, artifacts),
        action: 'list',
        conversationId,
        artifactCount: artifacts.length,
        artifactIds: artifacts.map((item) => item.id),
        artifacts,
      };
    }

    case 'delete': {
      const artifactId = readRequiredString(input.artifactId, 'artifactId');
      const deleted = await deleteConversationArtifact({ profile, conversationId, artifactId });
      ctx.ui?.invalidate('artifacts');
      return {
        text: deleted ? `Deleted artifact ${artifactId}.` : `Artifact ${artifactId} did not exist.`,
        action: 'delete',
        conversationId,
        artifactId,
        deleted,
      };
    }

    default:
      throw new Error(`Unsupported artifact action: ${String(input.action)}`);
  }
}
