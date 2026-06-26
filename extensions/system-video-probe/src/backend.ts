import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  extractVideoFrame,
  sampleVideoFrames,
  transcribeVideo,
  type VideoProbeFrameResult,
  type VideoProbeTranscriptionResult,
} from '@neon-pilot/extensions/backend/videos';

interface FrameInput {
  videoId?: unknown;
  timeSec?: unknown;
}

interface SampleFramesInput {
  videoId?: unknown;
  startSec?: unknown;
  endSec?: unknown;
  count?: unknown;
}

interface TranscribeInput {
  videoId?: unknown;
  startSec?: unknown;
  endSec?: unknown;
  language?: unknown;
}

function readVideoId(value: unknown): string {
  if (typeof value !== 'string' || !/^vid_[a-f0-9]{12}$/.test(value.trim())) {
    throw new Error('A valid videoId is required.');
  }
  return value.trim();
}

function readOptionalSeconds(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number.`);
  return number;
}

function readRequiredSeconds(value: unknown, label: string): number {
  const number = readOptionalSeconds(value, label);
  if (number === undefined) throw new Error(`${label} is required.`);
  return number;
}

function readCount(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > 12) {
    throw new Error('count must be an integer between 1 and 12.');
  }
  return number;
}

function readLanguage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error('language must be a string when provided.');
  const language = value.trim();
  if (language.length > 32) throw new Error('language is too long.');
  return language;
}

export async function extractVideoFrameAction(input: FrameInput, _ctx: ExtensionBackendContext): Promise<VideoProbeFrameResult> {
  return extractVideoFrame({
    videoId: readVideoId(input.videoId),
    timeSec: readRequiredSeconds(input.timeSec, 'timeSec'),
  }) as Promise<VideoProbeFrameResult>;
}

export async function sampleVideoFramesAction(input: SampleFramesInput, _ctx: ExtensionBackendContext): Promise<VideoProbeFrameResult> {
  const startSec = readRequiredSeconds(input.startSec, 'startSec');
  const endSec = readRequiredSeconds(input.endSec, 'endSec');
  if (endSec < startSec) throw new Error('endSec must be greater than or equal to startSec.');
  return sampleVideoFrames({
    videoId: readVideoId(input.videoId),
    startSec,
    endSec,
    count: readCount(input.count),
  }) as Promise<VideoProbeFrameResult>;
}

export async function transcribeVideoAction(input: TranscribeInput, _ctx: ExtensionBackendContext): Promise<VideoProbeTranscriptionResult> {
  const startSec = readOptionalSeconds(input.startSec, 'startSec');
  const endSec = readOptionalSeconds(input.endSec, 'endSec');
  if (startSec !== undefined && endSec !== undefined && endSec < startSec) {
    throw new Error('endSec must be greater than or equal to startSec.');
  }
  const language = readLanguage(input.language);
  return transcribeVideo({
    videoId: readVideoId(input.videoId),
    ...(startSec !== undefined ? { startSec } : {}),
    ...(endSec !== undefined ? { endSec } : {}),
    ...(language ? { language } : {}),
  }) as Promise<VideoProbeTranscriptionResult>;
}
