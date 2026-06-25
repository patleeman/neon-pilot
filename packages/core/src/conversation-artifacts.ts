import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

import { validateConversationId } from './conversation-project-links.js';
import { getStateRoot } from './runtime/paths.js';

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
const ARTIFACT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const ARTIFACT_METADATA_SLUG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const ARTIFACT_KINDS = ['html', 'mermaid', 'latex'] as const;

export type ConversationArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface ResolveConversationArtifactOptions {
  profile: string;
  conversationId: string;
  stateRoot?: string;
}

export interface ResolveConversationArtifactPathOptions extends ResolveConversationArtifactOptions {
  artifactId: string;
}

export interface ConversationArtifactSummary {
  id: string;
  conversationId: string;
  title: string;
  kind: ConversationArtifactKind;
  metadata?: ConversationArtifactMetadata;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface ConversationArtifactRecord extends ConversationArtifactSummary {
  content: string;
}

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

function getConversationArtifactStateRoot(stateRoot?: string): string {
  return resolve(stateRoot ?? getStateRoot());
}

function validateProfileName(profile: string): void {
  if (!PROFILE_NAME_PATTERN.test(profile)) {
    throw new Error(`Invalid profile name "${profile}". Profile names may only include letters, numbers, dashes, and underscores.`);
  }
}

export function validateConversationArtifactId(artifactId: string): void {
  if (!ARTIFACT_ID_PATTERN.test(artifactId)) {
    throw new Error(`Invalid artifact id "${artifactId}". Artifact ids may only include letters, numbers, dots, dashes, and underscores.`);
  }
}

export function validateConversationArtifactKind(kind: string): asserts kind is ConversationArtifactKind {
  if (!ARTIFACT_KINDS.includes(kind as ConversationArtifactKind)) {
    throw new Error(`Invalid artifact kind "${kind}". Expected one of: ${ARTIFACT_KINDS.join(', ')}.`);
  }
}

function normalizeIsoTimestamp(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return new Date(parsed).toISOString();
}

function normalizeTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error('Artifact title is required.');
  }
  return normalized;
}

function normalizeContent(content: string): string {
  if (typeof content !== 'string') {
    throw new Error('Artifact content must be a string.');
  }

  return content;
}

function normalizeMetadataSlug(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Artifact ${label} must be a string.`);
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (!ARTIFACT_METADATA_SLUG_PATTERN.test(normalized)) {
    throw new Error(`Invalid artifact ${label} "${value}". Use a lowercase slug such as visual-plan.`);
  }
  return normalized;
}

function normalizeMetadataText(value: unknown, label: string, maxLength = 800): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`Artifact ${label} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > maxLength) {
    throw new Error(`Artifact ${label} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function normalizeMetadataPaths(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('Artifact source paths must be an array of strings.');
  }
  const paths = value.map((item) => normalizeMetadataText(item, 'source path', 300)).filter((item): item is string => Boolean(item));
  return paths.length ? paths.slice(0, 50) : undefined;
}

function normalizeStyleOverrides(value: unknown): ConversationArtifactStyleOverrides | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Artifact styleOverrides must be an object.');
  }
  const candidate = value as Partial<ConversationArtifactStyleOverrides>;
  const overrides: ConversationArtifactStyleOverrides = {};
  const theme = normalizeMetadataText(candidate.theme, 'styleOverrides.theme', 80);
  const accent = normalizeMetadataText(candidate.accent, 'styleOverrides.accent', 80);
  const density = normalizeMetadataText(candidate.density, 'styleOverrides.density', 80);
  const notes = normalizeMetadataText(candidate.notes, 'styleOverrides.notes', 800);
  if (theme) overrides.theme = theme;
  if (accent) overrides.accent = accent;
  if (density) overrides.density = density;
  if (notes) overrides.notes = notes;
  return Object.keys(overrides).length ? overrides : undefined;
}

function normalizeSourceMetadata(value: unknown): ConversationArtifactSourceMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Artifact source metadata must be an object.');
  }
  const candidate = value as Partial<ConversationArtifactSourceMetadata>;
  const source: ConversationArtifactSourceMetadata = {};
  const kind = normalizeMetadataSlug(candidate.kind, 'source kind');
  const label = normalizeMetadataText(candidate.label, 'source label', 200);
  const messageId = normalizeMetadataText(candidate.messageId, 'source messageId', 120);
  const selection = normalizeMetadataText(candidate.selection, 'source selection', 2000);
  const paths = normalizeMetadataPaths(candidate.paths);
  const command = normalizeMetadataText(candidate.command, 'source command', 120);
  if (kind) source.kind = kind;
  if (label) source.label = label;
  if (messageId) source.messageId = messageId;
  if (selection) source.selection = selection;
  if (paths) source.paths = paths;
  if (command) source.command = command;
  return Object.keys(source).length ? source : undefined;
}

export function normalizeConversationArtifactMetadata(value: unknown): ConversationArtifactMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Artifact metadata must be an object.');
  }
  const candidate = value as Partial<ConversationArtifactMetadata>;
  const metadata: ConversationArtifactMetadata = {};
  const type = normalizeMetadataSlug(candidate.type, 'type');
  const stylePreset = normalizeMetadataSlug(candidate.stylePreset, 'stylePreset');
  const styleOverrides = normalizeStyleOverrides(candidate.styleOverrides);
  const source = normalizeSourceMetadata(candidate.source);
  const templateVersion = normalizeMetadataText(candidate.templateVersion, 'templateVersion', 80);
  const generator = normalizeMetadataText(candidate.generator, 'generator', 120);
  if (type) metadata.type = type;
  if (stylePreset) metadata.stylePreset = stylePreset;
  if (styleOverrides) metadata.styleOverrides = styleOverrides;
  if (source) metadata.source = source;
  if (templateVersion) metadata.templateVersion = templateVersion;
  if (generator) metadata.generator = generator;
  return Object.keys(metadata).length ? metadata : undefined;
}

function slugifyArtifactId(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'artifact';
}

function createUniqueArtifactId(options: ResolveConversationArtifactOptions & { baseTitle: string }): string {
  const baseId = slugifyArtifactId(options.baseTitle);
  let nextId = baseId;
  let suffix = 2;

  while (
    existsSync(
      resolveConversationArtifactPath({
        stateRoot: options.stateRoot,
        profile: options.profile,
        conversationId: options.conversationId,
        artifactId: nextId,
      }),
    )
  ) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

export function resolveProfileConversationArtifactsDir(options: { profile: string; stateRoot?: string }): string {
  validateProfileName(options.profile);
  return join(getConversationArtifactStateRoot(options.stateRoot), 'pi-agent', 'state', 'conversation-artifacts', options.profile);
}

export function resolveConversationArtifactsDir(options: ResolveConversationArtifactOptions): string {
  validateProfileName(options.profile);
  validateConversationId(options.conversationId);
  return join(resolveProfileConversationArtifactsDir(options), options.conversationId);
}

export function resolveConversationArtifactPath(options: ResolveConversationArtifactPathOptions): string {
  validateProfileName(options.profile);
  validateConversationId(options.conversationId);
  validateConversationArtifactId(options.artifactId);
  return join(resolveConversationArtifactsDir(options), `${options.artifactId}.json`);
}

export function readConversationArtifact(path: string): ConversationArtifactRecord {
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<ConversationArtifactRecord>;
  const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
  const conversationId = typeof parsed.conversationId === 'string' ? parsed.conversationId.trim() : '';
  const title = typeof parsed.title === 'string' ? parsed.title : '';
  const kind = typeof parsed.kind === 'string' ? parsed.kind : '';
  const metadata = normalizeConversationArtifactMetadata(parsed.metadata);
  const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : '';
  const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';
  const revision = typeof parsed.revision === 'number' ? parsed.revision : Number.NaN;
  const content = typeof parsed.content === 'string' ? parsed.content : '';

  validateConversationArtifactId(id);
  validateConversationId(conversationId);
  validateConversationArtifactKind(kind);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error(`Invalid artifact revision in ${path}`);
  }

  return {
    id,
    conversationId,
    title: normalizeTitle(title),
    kind,
    ...(metadata ? { metadata } : {}),
    createdAt: normalizeIsoTimestamp(createdAt, 'artifact createdAt'),
    updatedAt: normalizeIsoTimestamp(updatedAt, 'artifact updatedAt'),
    revision,
    content,
  };
}

export function getConversationArtifact(options: ResolveConversationArtifactPathOptions): ConversationArtifactRecord | null {
  const path = resolveConversationArtifactPath(options);
  if (!existsSync(path)) {
    return null;
  }

  return readConversationArtifact(path);
}

export function listConversationArtifacts(options: ResolveConversationArtifactOptions): ConversationArtifactSummary[] {
  const dir = resolveConversationArtifactsDir(options);
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .flatMap((entry) => {
      try {
        return [readConversationArtifact(join(dir, entry))];
      } catch {
        return [];
      }
    })
    .map(({ content: _content, ...summary }) => summary)
    .sort((left, right) => {
      const updatedDiff = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      return updatedDiff !== 0 ? updatedDiff : left.id.localeCompare(right.id);
    });
}

export function saveConversationArtifact(options: {
  profile: string;
  conversationId: string;
  artifactId?: string;
  title: string;
  kind: ConversationArtifactKind;
  content: string;
  metadata?: ConversationArtifactMetadata;
  stateRoot?: string;
  createdAt?: string;
  updatedAt?: string;
}): ConversationArtifactRecord {
  validateProfileName(options.profile);
  validateConversationId(options.conversationId);
  validateConversationArtifactKind(options.kind);

  const title = normalizeTitle(options.title);
  const content = normalizeContent(options.content);
  const metadata = normalizeConversationArtifactMetadata(options.metadata);
  const artifactId = options.artifactId?.trim()
    ? options.artifactId.trim()
    : createUniqueArtifactId({
        stateRoot: options.stateRoot,
        profile: options.profile,
        conversationId: options.conversationId,
        baseTitle: title,
      });

  validateConversationArtifactId(artifactId);

  const existing = getConversationArtifact({
    stateRoot: options.stateRoot,
    profile: options.profile,
    conversationId: options.conversationId,
    artifactId,
  });

  const createdAt = existing?.createdAt ?? normalizeIsoTimestamp(options.createdAt ?? new Date().toISOString(), 'artifact createdAt');
  const updatedAt = normalizeIsoTimestamp(options.updatedAt ?? new Date().toISOString(), 'artifact updatedAt');
  const revision = (existing?.revision ?? 0) + 1;

  const record: ConversationArtifactRecord = {
    id: artifactId,
    conversationId: options.conversationId,
    title,
    kind: options.kind,
    ...(metadata ? { metadata } : {}),
    content,
    createdAt,
    updatedAt,
    revision,
  };

  const path = resolveConversationArtifactPath({
    stateRoot: options.stateRoot,
    profile: options.profile,
    conversationId: options.conversationId,
    artifactId,
  });

  mkdirSync(
    resolveConversationArtifactsDir({
      stateRoot: options.stateRoot,
      profile: options.profile,
      conversationId: options.conversationId,
    }),
    { recursive: true },
  );
  writeFileSync(path, JSON.stringify(record, null, 2) + '\n');

  return record;
}

export function deleteConversationArtifact(options: ResolveConversationArtifactPathOptions): boolean {
  const path = resolveConversationArtifactPath(options);
  if (!existsSync(path)) {
    return false;
  }

  rmSync(path, { force: true });
  return true;
}
