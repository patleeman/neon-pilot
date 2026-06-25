import type { ExtensionBackendContext } from '@neon-pilot/extensions/backend';
import {
  type ConversationArtifactKind,
  type ConversationArtifactMetadata,
  type ConversationArtifactSourceMetadata,
  type ConversationArtifactStyleOverrides,
  deleteConversationArtifact,
  getConversationArtifact,
  listConversationArtifacts,
  saveConversationArtifact,
} from '@neon-pilot/extensions/backend/artifacts';

const ARTIFACT_KIND_VALUES = ['html', 'mermaid', 'latex'] as const;
type ArtifactAction = 'save' | 'get' | 'list' | 'delete';

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  architecture: 'Architecture explainer',
  'data-table': 'Data table',
  'diff-review': 'Diff review',
  'fact-check': 'Fact check',
  'plan-review': 'Plan review',
  'project-recap': 'Project recap',
  report: 'Report',
  slides: 'Slide deck',
  'visual-explainer': 'Visual explainer',
  'visual-plan': 'Visual plan',
};

const STYLE_PRESET_LABELS: Record<string, string> = {
  'architecture-map': 'Architecture map',
  'review-matrix': 'Review matrix',
  'technical-report': 'Technical report',
  'visual-explainer': 'Visual explainer',
  'slide-deck': 'Slide deck',
};

interface ArtifactInput {
  action: ArtifactAction;
  conversationId?: string;
  artifactId?: string;
  kind?: string;
  title?: string;
  content?: string;
  open?: boolean;
  artifactType?: string;
  stylePreset?: string;
  styleOverrides?: ConversationArtifactStyleOverrides;
  source?: ConversationArtifactSourceMetadata;
  templateVersion?: string;
}

type ArtifactBackendContext = ExtensionBackendContext & {
  profile: string;
  toolContext?: { conversationId?: string };
};

interface ArtifactSlashInput {
  commandName?: string;
  argument?: string;
  text?: string;
  conversationId?: string;
  cwd?: string;
}

function readRequiredString(value: string | undefined, label: string): string {
  if (!value || !value.trim()) throw new Error(`${label} is required.`);
  return value;
}

function readRequiredKind(kind: string | undefined): ConversationArtifactKind {
  const normalized = readRequiredString(kind, 'kind');
  if (!ARTIFACT_KIND_VALUES.includes(normalized as ConversationArtifactKind)) throw new Error(`Invalid artifact kind "${normalized}".`);
  return normalized as ConversationArtifactKind;
}

function normalizeSlug(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function readArtifactLabel(metadata: ConversationArtifactMetadata | undefined, kind: string): string {
  const type = normalizeSlug(metadata?.type);
  return type ? (ARTIFACT_TYPE_LABELS[type] ?? type.replaceAll('-', ' ')) : kind;
}

function readStyleLabel(metadata: ConversationArtifactMetadata | undefined): string | undefined {
  const preset = normalizeSlug(metadata?.stylePreset);
  return preset ? (STYLE_PRESET_LABELS[preset] ?? preset.replaceAll('-', ' ')) : undefined;
}

function buildArtifactMetadata(input: ArtifactInput): ConversationArtifactMetadata | undefined {
  const type = normalizeSlug(input.artifactType);
  const stylePreset = normalizeSlug(input.stylePreset);
  const hasMetadataInput = Boolean(type || stylePreset || input.styleOverrides || input.source || input.templateVersion?.trim());
  if (!hasMetadataInput) return undefined;
  const metadata: ConversationArtifactMetadata = {};
  if (type) metadata.type = type;
  if (stylePreset) metadata.stylePreset = stylePreset;
  if (input.styleOverrides) metadata.styleOverrides = input.styleOverrides;
  if (input.source) metadata.source = input.source;
  if (input.templateVersion?.trim()) metadata.templateVersion = input.templateVersion.trim();
  metadata.generator = 'system-artifacts';
  return metadata;
}

function readConversationId(input: ArtifactInput, ctx: ArtifactBackendContext): string {
  return readRequiredString(ctx.toolContext?.conversationId ?? input.conversationId, 'conversationId');
}

function formatArtifactList(conversationId: string, artifacts: Awaited<ReturnType<typeof listConversationArtifacts>>): string {
  if (artifacts.length === 0) return `No artifacts saved for conversation ${conversationId}.`;
  return [
    `Artifacts for conversation ${conversationId}:`,
    ...artifacts.map(
      (artifact) =>
        `- ${artifact.id} [${readArtifactLabel(artifact.metadata, artifact.kind)}] ${artifact.title} (rev ${artifact.revision}, updated ${artifact.updatedAt})`,
    ),
  ].join('\n');
}

function formatArtifact(record: NonNullable<Awaited<ReturnType<typeof getConversationArtifact>>>): string {
  const style = readStyleLabel(record.metadata);
  return [
    `Artifact ${record.id}`,
    `Title: ${record.title}`,
    `Kind: ${record.kind}`,
    record.metadata?.type ? `Type: ${readArtifactLabel(record.metadata, record.kind)}` : undefined,
    style ? `Style: ${style}` : undefined,
    `Revision: ${record.revision}`,
    `Updated: ${record.updatedAt}`,
    '',
    record.content,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
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
        metadata: buildArtifactMetadata(input),
      });
      const openRequested = input.open ?? true;
      await Promise.resolve(ctx.ui?.invalidate('artifacts'));
      const label = readArtifactLabel(record.metadata, record.kind);
      return {
        text: `${record.revision === 1 ? 'Saved' : 'Updated'} artifact ${record.id} [${label}] "${record.title}".`,
        action: 'save',
        conversationId,
        artifactId: record.id,
        title: record.title,
        kind: record.kind,
        metadata: record.metadata,
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
        metadata: record.metadata,
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
      await Promise.resolve(ctx.ui?.invalidate('artifacts'));
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

function buildTypedArtifactPrompt(options: {
  type: string;
  stylePreset: string;
  defaultTitle: string;
  subject: string;
  cwd?: string;
  commandName: string;
}): string {
  const subject = options.subject.trim() || 'the current conversation';
  const styleLine = [
    `Use artifactType: "${options.type}" and stylePreset: "${options.stylePreset}".`,
    'Use the built-in Artifacts guidance for visual explainers and slide decks.',
    'Keep the output self-contained and render it with the artifact tool.',
  ].join(' ');
  return [
    `Create a ${ARTIFACT_TYPE_LABELS[options.type] ?? options.type} artifact for: ${subject}`,
    '',
    styleLine,
    options.cwd ? `Current working directory: ${options.cwd}` : undefined,
    '',
    'Requirements:',
    '- Prefer kind "html" unless a raw Mermaid diagram or LaTeX source is clearly the better renderer.',
    '- Use opinionated Neon Pilot artifact defaults: dense, technical, neutral, readable, no generic purple gradients.',
    '- If the user included style override instructions, honor them while preserving accessibility and readability.',
    '- Save the result with the artifact tool and open it when done.',
    '',
    `Suggested title: ${options.defaultTitle}`,
    `Source command: /${options.commandName}`,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

export async function handleArtifactSlashCommand(input: ArtifactSlashInput) {
  const commandName = normalizeSlug(input.commandName) ?? '';
  const argument = input.argument?.trim() ?? '';
  const mapping: Record<string, { type: string; stylePreset: string; title: string }> = {
    visualize: { type: 'visual-explainer', stylePreset: 'visual-explainer', title: 'Visual explainer' },
    'diff-review': { type: 'diff-review', stylePreset: 'review-matrix', title: 'Diff review' },
    'plan-review': { type: 'plan-review', stylePreset: 'review-matrix', title: 'Plan review' },
    'project-recap': { type: 'project-recap', stylePreset: 'technical-report', title: 'Project recap' },
    slides: { type: 'slides', stylePreset: 'slide-deck', title: 'Slide deck' },
  };
  const preset = mapping[commandName] ?? mapping.visualize;
  return {
    prompt: buildTypedArtifactPrompt({
      type: preset.type,
      stylePreset: preset.stylePreset,
      defaultTitle: argument ? `${preset.title}: ${argument}` : preset.title,
      subject: argument,
      cwd: input.cwd,
      commandName: commandName || 'visualize',
    }),
  };
}
