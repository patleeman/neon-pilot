import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join } from 'node:path';

import { type DesktopRootLayout, getRuntimeProbeDir } from '@neon-pilot/core';
import type {
  StoredVideoProbeAttachment,
  VideoProbeFrameResult,
  VideoProbeTranscriptionResult,
} from '@neon-pilot/extensions/backend/videos';

import type { PromptVideoAttachment } from '../conversations/liveSessionQueue.js';
import { resolveFfmpegBinary } from '../transcription/audioConversion.js';
import { transcribeAudio } from '../transcription/transcriptionService.js';
import { rememberGeneratedImageProbeAttachments } from './imageProbeAttachmentStore.js';

export type { StoredVideoProbeAttachment };

interface PersistedVideoProbeAttachmentDocument {
  version: 1;
  attachments: StoredVideoProbeAttachment[];
}

interface RunResult {
  stdout: string;
  stderr: string;
}

interface VideoProbeInvocationContext {
  sessionId?: string;
  desktopRootLayout?: DesktopRootLayout;
}

const attachmentsBySession = new Map<string, Map<string, StoredVideoProbeAttachment>>();
const MAX_VIDEO_FRAME_COUNT = 12;
const FRAME_MIME_TYPE = 'image/jpeg';
const FRAME_FILE_EXTENSION = 'jpg';
const FRAME_MAX_DIMENSION = 2000;
const FRAME_JPEG_QUALITY = 3;
const MEDIA_PROBE_RUNTIME_DIR = 'media-probes';
const LEGACY_VIDEO_PROBE_RUNTIME_DIR = 'video-probes';

function safeFileName(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function resolveVideoProbeSessionDir(sessionId: string, layout?: DesktopRootLayout): string {
  return join(getRuntimeProbeDir(layout), MEDIA_PROBE_RUNTIME_DIR, safeFileName(sessionId, 'session'));
}

function resolveVideoProbeMetadataPath(sessionId: string, layout?: DesktopRootLayout): string {
  return join(resolveVideoProbeSessionDir(sessionId, layout), 'metadata.json');
}

function resolveLegacyVideoProbeMetadataPath(sessionId: string): string {
  return join(getRuntimeProbeDir(), LEGACY_VIDEO_PROBE_RUNTIME_DIR, safeFileName(sessionId, 'session'), 'metadata.json');
}

function videoIdForFile(path: string, sizeBytes: number, mtimeMs: number): string {
  const hash = createHash('sha256').update(path).update('\0').update(String(sizeBytes)).update('\0').update(String(mtimeMs)).digest('hex');
  return `vid_${hash.slice(0, 12)}`;
}

function normalizeStoredVideo(value: unknown): StoredVideoProbeAttachment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<StoredVideoProbeAttachment>;
  if (typeof candidate.id !== 'string' || !/^vid_[a-f0-9]{12}$/.test(candidate.id)) return null;
  if (typeof candidate.path !== 'string' || !candidate.path.trim() || !existsSync(candidate.path)) return null;
  if (typeof candidate.mimeType !== 'string' || !candidate.mimeType.toLowerCase().startsWith('video/')) return null;
  if (!Number.isSafeInteger(candidate.sizeBytes) || Number(candidate.sizeBytes) < 0) return null;
  return {
    id: candidate.id,
    path: candidate.path,
    mimeType: candidate.mimeType,
    ...(typeof candidate.name === 'string' && candidate.name.trim() ? { name: candidate.name.trim() } : {}),
    sizeBytes: Number(candidate.sizeBytes),
    ...(Number.isFinite(candidate.durationMs) && Number(candidate.durationMs) >= 0 ? { durationMs: Number(candidate.durationMs) } : {}),
    ...(Number.isSafeInteger(candidate.width) && Number(candidate.width) > 0 ? { width: Number(candidate.width) } : {}),
    ...(Number.isSafeInteger(candidate.height) && Number(candidate.height) > 0 ? { height: Number(candidate.height) } : {}),
    ...(Number.isFinite(candidate.fps) && Number(candidate.fps) > 0 ? { fps: Number(candidate.fps) } : {}),
    ...(typeof candidate.hasAudio === 'boolean' ? { hasAudio: candidate.hasAudio } : {}),
  };
}

function readPersistedVideoProbeAttachments(sessionId: string, layout?: DesktopRootLayout): Map<string, StoredVideoProbeAttachment> {
  const metadataPath = existsSync(resolveVideoProbeMetadataPath(sessionId, layout))
    ? resolveVideoProbeMetadataPath(sessionId, layout)
    : resolveLegacyVideoProbeMetadataPath(sessionId);
  if (!existsSync(metadataPath)) return new Map();

  try {
    const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Partial<PersistedVideoProbeAttachmentDocument>;
    const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
    const next = new Map<string, StoredVideoProbeAttachment>();
    for (const attachment of attachments) {
      const normalized = normalizeStoredVideo(attachment);
      if (normalized) next.set(normalized.id, normalized);
    }
    return next;
  } catch {
    return new Map();
  }
}

function writePersistedVideoProbeAttachments(
  sessionId: string,
  attachments: Map<string, StoredVideoProbeAttachment>,
  layout?: DesktopRootLayout,
): void {
  const metadataPath = resolveVideoProbeMetadataPath(sessionId, layout);
  const document: PersistedVideoProbeAttachmentDocument = {
    version: 1,
    attachments: Array.from(attachments.values()),
  };
  mkdirSync(resolveVideoProbeSessionDir(sessionId, layout), { recursive: true });
  writeFileSync(metadataPath, `${JSON.stringify(document, null, 2)}\n`);
}

function getSessionAttachments(sessionId: string, layout?: DesktopRootLayout): Map<string, StoredVideoProbeAttachment> {
  const cached = attachmentsBySession.get(sessionId);
  if (cached) return cached;
  const persisted = readPersistedVideoProbeAttachments(sessionId, layout);
  attachmentsBySession.set(sessionId, persisted);
  return persisted;
}

function runFfmpeg(args: string[]): Promise<RunResult> {
  const binary = resolveFfmpegBinary();
  if (!binary) throw new Error('ffmpeg is unavailable.');

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Video probing needs ffmpeg, but ffmpeg is not available.'));
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString('utf-8'),
        stderr: Buffer.concat(stderr).toString('utf-8'),
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      reject(new Error(result.stderr.trim() || `ffmpeg failed with exit code ${code ?? 'unknown'}.`));
    });
  });
}

function parseDurationMs(stderr: string): number | undefined {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1] ?? '0', 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  const seconds = Number.parseFloat(match[3] ?? '0');
  const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : undefined;
}

function parseVideoDimensions(stderr: string): { width?: number; height?: number } {
  const match = /Stream\s+#.*Video:.*?(\d{2,5})x(\d{2,5})/.exec(stderr);
  if (!match) return {};
  const width = Number.parseInt(match[1] ?? '', 10);
  const height = Number.parseInt(match[2] ?? '', 10);
  return {
    ...(Number.isSafeInteger(width) && width > 0 ? { width } : {}),
    ...(Number.isSafeInteger(height) && height > 0 ? { height } : {}),
  };
}

function parseFps(stderr: string): number | undefined {
  const match = /(?:,\s*|\s)(\d+(?:\.\d+)?)\s*fps\b/.exec(stderr);
  if (!match) return undefined;
  const fps = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(fps) && fps > 0 ? fps : undefined;
}

async function probeVideoMetadata(path: string): Promise<Partial<StoredVideoProbeAttachment>> {
  try {
    const result = await runFfmpeg(['-hide_banner', '-i', path]);
    const text = `${result.stderr}\n${result.stdout}`;
    return {
      durationMs: parseDurationMs(text),
      ...parseVideoDimensions(text),
      fps: parseFps(text),
      hasAudio: /Stream\s+#.*Audio:/i.test(text),
    };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return {
      durationMs: parseDurationMs(text),
      ...parseVideoDimensions(text),
      fps: parseFps(text),
      hasAudio: /Stream\s+#.*Audio:/i.test(text),
    };
  }
}

function readVideoPath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('video path is required.');
  const path = value.trim();
  if (!isAbsolute(path)) throw new Error('Video attachments must use absolute local file paths.');
  if (!existsSync(path)) throw new Error(`Video file does not exist: ${path}`);
  const stats = statSync(path);
  if (!stats.isFile()) throw new Error(`Video path is not a file: ${path}`);
  return path;
}

function normalizeSeconds(value: unknown, label: string, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number.`);
  return number;
}

function normalizeFrameCount(value: unknown): number {
  const number = value === undefined ? 1 : typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > MAX_VIDEO_FRAME_COUNT) {
    throw new Error(`count must be an integer between 1 and ${MAX_VIDEO_FRAME_COUNT}.`);
  }
  return number;
}

function normalizeFrameTimestamps(input: { startSec: number; endSec: number; count: number; durationMs?: number; fps?: number }): number[] {
  const durationSec = Number.isFinite(input.durationMs) && Number(input.durationMs) > 0 ? Number(input.durationMs) / 1000 : undefined;
  const durationToleranceSec = 0.001;
  if (durationSec !== undefined) {
    if (input.startSec > durationSec + durationToleranceSec) {
      throw new Error('startSec exceeds the video duration.');
    }
    if (input.endSec > durationSec + durationToleranceSec) {
      throw new Error('endSec exceeds the video duration.');
    }
  }

  const span = Math.max(0, input.endSec - input.startSec);
  const requested =
    input.count === 1
      ? [input.startSec + span / 2]
      : Array.from({ length: input.count }, (_, index) => input.startSec + (span * index) / Math.max(1, input.count - 1));

  if (durationSec === undefined) {
    return requested;
  }

  const frameDurationSec = Number.isFinite(input.fps) && Number(input.fps) > 0 ? 1 / Number(input.fps) : 0;
  const lastFrameMarginSec = Math.max(0.1, frameDurationSec + 0.01);
  const lastFrameSec = Math.max(0, durationSec - lastFrameMarginSec);
  return requested.map((timestampSec) => Math.max(0, Math.min(timestampSec, lastFrameSec)));
}

function normalizeVideoId(value: unknown): string {
  if (typeof value !== 'string' || !/^vid_[a-f0-9]{12}$/.test(value.trim()))
    throw new Error('videoId must be a valid video attachment ID.');
  return value.trim();
}

function resolveVideoById(videoId: string): StoredVideoProbeAttachment {
  const attachments = getVideoProbeAttachmentsByIdFromAnySession([videoId]);
  const attachment = attachments[0];
  if (!attachment) throw new Error(`Unknown video ID: ${videoId}`);
  return attachment;
}

function buildFrameSummary(
  video: StoredVideoProbeAttachment,
  frames: Array<{ timestampMs: number; sizeBytes: number; imageId?: string }>,
): string {
  const label = video.name?.trim() || basename(video.path);
  const lines = frames.map(
    (frame, index) =>
      `- frame ${index + 1}: ${(frame.timestampMs / 1000).toFixed(3)}s (${frame.sizeBytes} bytes)${
        frame.imageId ? `, image ID ${frame.imageId}` : ''
      }`,
  );
  return [`Sampled ${frames.length} frame${frames.length === 1 ? '' : 's'} from ${video.id} (${label}).`, ...lines].join('\n');
}

function buildFrameScaleFilter(maxDimension = FRAME_MAX_DIMENSION): string {
  return [
    `scale='min(${maxDimension},iw)'`,
    `'min(${maxDimension},ih)'`,
    'force_original_aspect_ratio=decrease',
    'force_divisible_by=2',
  ].join(':');
}

function buildFrameExtractionArgs(input: { videoPath: string; timestampSec: number; outputPath: string }): string[] {
  return [
    '-y',
    '-ss',
    input.timestampSec.toFixed(3),
    '-i',
    input.videoPath,
    '-frames:v',
    '1',
    '-vf',
    buildFrameScaleFilter(),
    '-q:v',
    String(FRAME_JPEG_QUALITY),
    '-f',
    'image2',
    input.outputPath,
  ];
}

function addSegmentOffset(segment: { text: string; startMs?: number; endMs?: number }, offsetMs: number) {
  return {
    text: segment.text,
    ...(Number.isFinite(segment.startMs) ? { startMs: Number(segment.startMs) + offsetMs } : {}),
    ...(Number.isFinite(segment.endMs) ? { endMs: Number(segment.endMs) + offsetMs } : {}),
  };
}

export async function rememberVideoProbeAttachments(
  sessionId: string,
  videos: PromptVideoAttachment[],
  layout?: DesktopRootLayout,
): Promise<StoredVideoProbeAttachment[]> {
  const sessionAttachments = getSessionAttachments(sessionId, layout);
  const stored: StoredVideoProbeAttachment[] = [];

  for (const video of videos) {
    const path = readVideoPath(video.path);
    const stats = statSync(path);
    const id = videoIdForFile(path, stats.size, stats.mtimeMs);
    const metadata = await probeVideoMetadata(path);
    const attachment: StoredVideoProbeAttachment = {
      id,
      path,
      mimeType: video.mimeType.trim().toLowerCase().startsWith('video/') ? video.mimeType.trim() : 'video/*',
      name: video.name?.trim() || basename(path),
      sizeBytes: stats.size,
      ...metadata,
    };
    sessionAttachments.set(id, attachment);
    stored.push(attachment);
  }

  attachmentsBySession.set(sessionId, sessionAttachments);
  writePersistedVideoProbeAttachments(sessionId, sessionAttachments, layout);
  return stored;
}

export function getVideoProbeAttachments(sessionId: string, layout?: DesktopRootLayout): StoredVideoProbeAttachment[] {
  return Array.from(getSessionAttachments(sessionId, layout).values());
}

export function getVideoProbeAttachmentsById(
  sessionId: string,
  videoIds: string[],
  layout?: DesktopRootLayout,
): StoredVideoProbeAttachment[] {
  const sessionAttachments = getSessionAttachments(sessionId, layout);
  return videoIds
    .map((id) => sessionAttachments.get(id))
    .filter((attachment): attachment is StoredVideoProbeAttachment => Boolean(attachment));
}

export function getVideoProbeAttachmentsByIdFromAnySession(videoIds: string[], layout?: DesktopRootLayout): StoredVideoProbeAttachment[] {
  const found = new Map<string, StoredVideoProbeAttachment>();
  const remaining = new Set(videoIds);

  for (const [, sessionAttachments] of attachmentsBySession) {
    for (const [id, attachment] of sessionAttachments) {
      if (!remaining.has(id)) continue;
      found.set(id, attachment);
      remaining.delete(id);
    }
  }

  for (const probesDir of [
    join(getRuntimeProbeDir(layout), MEDIA_PROBE_RUNTIME_DIR),
    join(getRuntimeProbeDir(), LEGACY_VIDEO_PROBE_RUNTIME_DIR),
  ]) {
    if (remaining.size === 0 || !existsSync(probesDir)) continue;
    for (const entry of readdirSync(probesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sessionAttachments = readPersistedVideoProbeAttachments(entry.name);
      if (sessionAttachments.size > 0) attachmentsBySession.set(entry.name, sessionAttachments);
      for (const [id, attachment] of sessionAttachments) {
        if (!remaining.has(id)) continue;
        found.set(id, attachment);
        remaining.delete(id);
      }
      if (remaining.size === 0) break;
    }
  }

  return videoIds.map((id) => found.get(id)).filter((attachment): attachment is StoredVideoProbeAttachment => Boolean(attachment));
}

export async function sampleVideoFrames(input: unknown, context?: VideoProbeInvocationContext): Promise<VideoProbeFrameResult> {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const video = resolveVideoById(normalizeVideoId(record.videoId));
  const count = normalizeFrameCount(record.count);
  const defaultEndSec = video.durationMs ? video.durationMs / 1000 : normalizeSeconds(record.startSec, 'startSec', 0);
  const startSec = normalizeSeconds(record.startSec, 'startSec', 0);
  const endSec = normalizeSeconds(record.endSec, 'endSec', defaultEndSec);
  if (endSec < startSec) throw new Error('endSec must be greater than or equal to startSec.');
  const timestamps = normalizeFrameTimestamps({ startSec, endSec, count, durationMs: video.durationMs, fps: video.fps });

  const tempRoot = await mkdtemp(join(tmpdir(), 'neon-pilot-media-probe-'));
  try {
    const frames: Array<{ timestampMs: number; mimeType: string; data: string; sizeBytes: number }> = [];
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestampSec = timestamps[index] ?? startSec;
      const outputPath = join(tempRoot, `frame-${index + 1}.${FRAME_FILE_EXTENSION}`);
      await runFfmpeg(buildFrameExtractionArgs({ videoPath: video.path, timestampSec, outputPath }));
      if (!existsSync(outputPath)) {
        throw new Error(`ffmpeg did not produce a frame at ${timestampSec.toFixed(3)}s.`);
      }
      const data = await readFile(outputPath);
      frames.push({
        timestampMs: Math.round(timestampSec * 1000),
        mimeType: FRAME_MIME_TYPE,
        data: data.toString('base64'),
        sizeBytes: data.byteLength,
      });
    }
    const registeredFrames = context?.sessionId
      ? rememberGeneratedImageProbeAttachments(
          context.sessionId,
          frames.map((frame, index) => ({
            type: 'image' as const,
            data: frame.data,
            mimeType: frame.mimeType,
            name: `${video.id}-frame-${index + 1}-${(frame.timestampMs / 1000).toFixed(3)}s.${FRAME_FILE_EXTENSION}`,
          })),
          context.desktopRootLayout,
        )
      : [];
    const frameDetails = frames.map((frame, index) => {
      const registered = registeredFrames[index];
      return {
        timestampMs: frame.timestampMs,
        mimeType: frame.mimeType,
        sizeBytes: frame.sizeBytes,
        ...(registered ? { imageId: registered.id, imageName: registered.name } : {}),
      };
    });
    const text = buildFrameSummary(video, frameDetails);
    return {
      text,
      content: [{ type: 'text', text }, ...frames.map((frame) => ({ type: 'image' as const, data: frame.data, mimeType: frame.mimeType }))],
      details: {
        videoId: video.id,
        frames: frameDetails,
      },
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function extractVideoFrame(input: unknown, context?: VideoProbeInvocationContext): Promise<VideoProbeFrameResult> {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const timeSec = normalizeSeconds(record.timeSec ?? record.timestampSec, 'timeSec', 0);
  return sampleVideoFrames({ videoId: record.videoId, startSec: timeSec, endSec: timeSec, count: 1 }, context);
}

export async function transcribeVideo(input: unknown): Promise<VideoProbeTranscriptionResult> {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const video = resolveVideoById(normalizeVideoId(record.videoId));
  const startSec = normalizeSeconds(record.startSec, 'startSec', 0);
  const requestedEndSec = record.endSec === undefined ? undefined : normalizeSeconds(record.endSec, 'endSec', startSec);
  if (requestedEndSec !== undefined && requestedEndSec < startSec) throw new Error('endSec must be greater than or equal to startSec.');
  const language = typeof record.language === 'string' && record.language.trim() ? record.language.trim() : undefined;

  const tempRoot = await mkdtemp(join(tmpdir(), 'neon-pilot-video-transcription-'));
  const outputPath = join(tempRoot, 'audio.pcm');
  try {
    await runFfmpeg([
      '-y',
      '-ss',
      startSec.toFixed(3),
      ...(requestedEndSec !== undefined ? ['-to', requestedEndSec.toFixed(3)] : []),
      '-i',
      video.path,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      outputPath,
    ]);
    const audio = await readFile(outputPath);
    const transcription = await transcribeAudio({
      dataBase64: audio.toString('base64'),
      mimeType: 'audio/pcm;rate=16000;channels=1',
      fileName: `${video.id}.pcm`,
      ...(language ? { language } : {}),
    });
    const offsetMs = Math.round(startSec * 1000);
    const segments = (transcription.segments ?? []).map((segment) => addSegmentOffset(segment, offsetMs));
    const text = transcription.text.trim() || '(no speech detected)';
    return {
      text,
      content: [{ type: 'text', text }],
      details: {
        videoId: video.id,
        startMs: offsetMs,
        ...(requestedEndSec !== undefined ? { endMs: Math.round(requestedEndSec * 1000) } : {}),
        ...(language ? { language } : {}),
        ...(video.durationMs !== undefined ? { durationMs: video.durationMs } : {}),
        segments,
      },
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export function clearVideoProbeAttachmentCacheForTests(): void {
  attachmentsBySession.clear();
}

export const testExports = {
  buildFrameExtractionArgs,
  buildFrameScaleFilter,
  buildFrameSummary,
  FRAME_MAX_DIMENSION,
  FRAME_MIME_TYPE,
  parseDurationMs,
  parseFps,
  parseVideoDimensions,
  normalizeFrameTimestamps,
  videoIdForFile,
};
