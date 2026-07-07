import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

import { type DesktopRootLayout, getRuntimeProbeDir } from '@neon-pilot/core';
import type { AudioProbeTranscriptionResult, StoredAudioProbeAttachment } from '@neon-pilot/extensions/backend/audio';

import type { PromptAudioAttachment } from '../conversations/liveSessionQueue.js';
import { transcribeAudio } from '../transcription/transcriptionService.js';

export type { StoredAudioProbeAttachment };

interface PersistedAudioProbeAttachmentDocument {
  version: 1;
  attachments: StoredAudioProbeAttachment[];
}

const attachmentsBySession = new Map<string, Map<string, StoredAudioProbeAttachment>>();
const MAX_AUDIO_PROBE_ATTACHMENTS_PER_PROMPT = 12;
const MAX_AUDIO_PROBE_BYTES = 250 * 1024 * 1024;

function safeFileName(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function resolveAudioProbeSessionDir(sessionId: string, layout?: DesktopRootLayout): string {
  return join(getRuntimeProbeDir(layout), 'audio-probes', safeFileName(sessionId, 'session'));
}

function resolveAudioProbeMetadataPath(sessionId: string, layout?: DesktopRootLayout): string {
  return join(resolveAudioProbeSessionDir(sessionId, layout), 'metadata.json');
}

function audioIdForFile(path: string, sizeBytes: number, mtimeMs: number): string {
  const hash = createHash('sha256').update(path).update('\0').update(String(sizeBytes)).update('\0').update(String(mtimeMs)).digest('hex');
  return `aud_${hash.slice(0, 12)}`;
}

function normalizeStoredAudio(value: unknown): StoredAudioProbeAttachment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<StoredAudioProbeAttachment>;
  if (typeof candidate.id !== 'string' || !/^aud_[a-f0-9]{12}$/.test(candidate.id)) return null;
  if (typeof candidate.path !== 'string' || !candidate.path.trim() || !existsSync(candidate.path)) return null;
  if (typeof candidate.mimeType !== 'string' || !candidate.mimeType.toLowerCase().startsWith('audio/')) return null;
  if (!Number.isSafeInteger(candidate.sizeBytes) || Number(candidate.sizeBytes) < 0) return null;
  return {
    id: candidate.id,
    path: candidate.path,
    mimeType: candidate.mimeType,
    ...(typeof candidate.name === 'string' && candidate.name.trim() ? { name: candidate.name.trim() } : {}),
    sizeBytes: Number(candidate.sizeBytes),
    ...(Number.isFinite(candidate.durationMs) && Number(candidate.durationMs) >= 0 ? { durationMs: Number(candidate.durationMs) } : {}),
  };
}

function readPersistedAudioProbeAttachments(sessionId: string, layout?: DesktopRootLayout): Map<string, StoredAudioProbeAttachment> {
  const metadataPath = resolveAudioProbeMetadataPath(sessionId, layout);
  if (!existsSync(metadataPath)) return new Map();
  try {
    const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Partial<PersistedAudioProbeAttachmentDocument>;
    const next = new Map<string, StoredAudioProbeAttachment>();
    for (const attachment of Array.isArray(parsed.attachments) ? parsed.attachments : []) {
      const normalized = normalizeStoredAudio(attachment);
      if (normalized) next.set(normalized.id, normalized);
    }
    return next;
  } catch {
    return new Map();
  }
}

function writePersistedAudioProbeAttachments(
  sessionId: string,
  attachments: Map<string, StoredAudioProbeAttachment>,
  layout?: DesktopRootLayout,
): void {
  const metadataPath = resolveAudioProbeMetadataPath(sessionId, layout);
  const document: PersistedAudioProbeAttachmentDocument = { version: 1, attachments: Array.from(attachments.values()) };
  mkdirSync(resolveAudioProbeSessionDir(sessionId, layout), { recursive: true });
  writeFileSync(metadataPath, `${JSON.stringify(document, null, 2)}\n`);
}

function getSessionAttachments(sessionId: string, layout?: DesktopRootLayout): Map<string, StoredAudioProbeAttachment> {
  const cached = attachmentsBySession.get(sessionId);
  if (cached) return cached;
  const persisted = readPersistedAudioProbeAttachments(sessionId, layout);
  attachmentsBySession.set(sessionId, persisted);
  return persisted;
}

function readAudioPath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('audio path is required.');
  const path = value.trim();
  if (!isAbsolute(path)) throw new Error('Audio attachments must use absolute local file paths.');
  if (!existsSync(path)) throw new Error(`Audio file does not exist: ${path}`);
  const stats = statSync(path);
  if (!stats.isFile()) throw new Error(`Audio path is not a file: ${path}`);
  if (stats.size > MAX_AUDIO_PROBE_BYTES) throw new Error(`Audio file is too large for probing (${stats.size} bytes).`);
  return path;
}

function normalizeAudioId(value: unknown): string {
  if (typeof value !== 'string' || !/^aud_[a-f0-9]{12}$/.test(value.trim())) {
    throw new Error('audioId must be a valid audio attachment ID.');
  }
  return value.trim();
}

function resolveAudioById(audioId: string, layout?: DesktopRootLayout): StoredAudioProbeAttachment {
  const attachments = getAudioProbeAttachmentsByIdFromAnySession([audioId], layout);
  const attachment = attachments[0];
  if (!attachment) throw new Error(`Unknown audio ID: ${audioId}`);
  return attachment;
}

export function rememberAudioProbeAttachments(
  sessionId: string,
  audios: PromptAudioAttachment[],
  layout?: DesktopRootLayout,
): StoredAudioProbeAttachment[] {
  if (audios.length > MAX_AUDIO_PROBE_ATTACHMENTS_PER_PROMPT) {
    throw new Error(`Audio probing supports at most ${MAX_AUDIO_PROBE_ATTACHMENTS_PER_PROMPT} audio files per prompt.`);
  }

  const sessionAttachments = getSessionAttachments(sessionId, layout);
  const stored = audios.map((audio, index) => {
    const path = readAudioPath(audio.path);
    const stats = statSync(path);
    const id = audioIdForFile(path, stats.size, stats.mtimeMs);
    const attachment: StoredAudioProbeAttachment = {
      id,
      path,
      mimeType: audio.mimeType.trim().toLowerCase().startsWith('audio/') ? audio.mimeType.trim() : 'audio/*',
      name: audio.name?.trim() || basename(path) || `audio-${index + 1}`,
      sizeBytes: stats.size,
    };
    sessionAttachments.set(id, attachment);
    return attachment;
  });
  attachmentsBySession.set(sessionId, sessionAttachments);
  writePersistedAudioProbeAttachments(sessionId, sessionAttachments, layout);
  return stored;
}

export function getAudioProbeAttachments(sessionId: string, layout?: DesktopRootLayout): StoredAudioProbeAttachment[] {
  return Array.from(getSessionAttachments(sessionId, layout).values());
}

export function getAudioProbeAttachmentsById(
  sessionId: string,
  audioIds: string[],
  layout?: DesktopRootLayout,
): StoredAudioProbeAttachment[] {
  const sessionAttachments = getSessionAttachments(sessionId, layout);
  return audioIds
    .map((id) => sessionAttachments.get(id))
    .filter((attachment): attachment is StoredAudioProbeAttachment => Boolean(attachment));
}

export function getAudioProbeAttachmentsByIdFromAnySession(audioIds: string[], layout?: DesktopRootLayout): StoredAudioProbeAttachment[] {
  const found = new Map<string, StoredAudioProbeAttachment>();
  const remaining = new Set(audioIds);
  for (const [, sessionAttachments] of attachmentsBySession) {
    for (const [id, attachment] of sessionAttachments) {
      if (remaining.has(id)) {
        found.set(id, attachment);
        remaining.delete(id);
      }
    }
  }
  if (remaining.size > 0) {
    const probesDirs = [join(getRuntimeProbeDir(layout), 'audio-probes')];
    if (layout) {
      // Also scan the legacy path for backward compatibility during migration.
      probesDirs.push(join(getRuntimeProbeDir(), 'audio-probes'));
    }
    for (const probesDir of probesDirs) {
      if (remaining.size === 0 || !existsSync(probesDir)) continue;
      for (const entry of readdirSync(probesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sessionAttachments = readPersistedAudioProbeAttachments(entry.name);
        if (sessionAttachments.size === 0) continue;
        attachmentsBySession.set(entry.name, sessionAttachments);
        for (const [id, attachment] of sessionAttachments) {
          if (remaining.has(id)) {
            found.set(id, attachment);
            remaining.delete(id);
          }
        }
        if (remaining.size === 0) break;
      }
    }
  }
  return audioIds.map((id) => found.get(id)!).filter(Boolean);
}

export async function transcribeAudioAttachment(input: { audioId: string; language?: string }): Promise<AudioProbeTranscriptionResult> {
  const audioId = normalizeAudioId(input.audioId);
  const attachment = resolveAudioById(audioId, undefined);
  const buffer = await readFile(attachment.path);
  const transcription = await transcribeAudio({
    dataBase64: buffer.toString('base64'),
    mimeType: attachment.mimeType,
    fileName: attachment.name ?? basename(attachment.path),
    ...(typeof input.language === 'string' && input.language.trim() ? { language: input.language.trim() } : {}),
  });
  const segments = (transcription.segments ?? []).flatMap((segment) => {
    if (!segment || typeof segment.text !== 'string' || !segment.text.trim()) return [];
    return [
      {
        text: segment.text.trim(),
        ...(Number.isFinite(segment.startMs) ? { startMs: Number(segment.startMs) } : {}),
        ...(Number.isFinite(segment.endMs) ? { endMs: Number(segment.endMs) } : {}),
      },
    ];
  });
  const text = transcription.text.trim();
  const details = {
    audioId,
    ...(typeof transcription.language === 'string' && transcription.language.trim() ? { language: transcription.language.trim() } : {}),
    ...(Number.isFinite(transcription.durationMs) ? { durationMs: Number(transcription.durationMs) } : {}),
    segments,
  };
  return {
    text: text || '(no speech detected)',
    content: [{ type: 'text', text: text || '(no speech detected)' }],
    details,
  };
}

export function clearAudioProbeAttachmentCacheForTests(): void {
  attachmentsBySession.clear();
}
