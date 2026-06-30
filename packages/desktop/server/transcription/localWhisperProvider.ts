import { existsSync, mkdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  TranscriptionInstallResult,
  TranscriptionModelStatus,
  TranscriptionResult,
  TranscriptionRuntimeStatus,
  TranscriptionSegment,
} from '@neon-pilot/extensions/backend/transcription';

const DEFAULT_LOCAL_WHISPER_MODEL = 'base.en';
const PCM_SAMPLE_RATE = 16_000;

const MODEL_ALIASES: Record<string, string> = {
  'openai_whisper-tiny': 'tiny',
  'openai_whisper-tiny.en': 'tiny.en',
  'openai_whisper-base': 'base',
  'openai_whisper-base.en': 'base.en',
  'openai_whisper-small': 'small',
  'openai_whisper-small.en': 'small.en',
  'openai_whisper-medium': 'medium',
  'openai_whisper-medium.en': 'medium.en',
};

const MODEL_FILE_NAMES: Record<string, string> = {
  tiny: 'ggml-tiny.bin',
  'tiny.en': 'ggml-tiny.en.bin',
  base: 'ggml-base.bin',
  'base.en': 'ggml-base.en.bin',
  small: 'ggml-small.bin',
  'small.en': 'ggml-small.en.bin',
  medium: 'ggml-medium.bin',
  'medium.en': 'ggml-medium.en.bin',
};

const MODEL_DOWNLOAD_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

type WhisperContext = Awaited<ReturnType<typeof import('whisper-cpp-node').createWhisperContext>>;

interface WhisperCppNodeModule {
  createWhisperContext(options: { model: string; use_gpu?: boolean; no_prints?: boolean }): WhisperContext;
  transcribeAsync(
    ctx: WhisperContext,
    options: { pcmf32: Float32Array; language?: string; no_timestamps?: boolean; no_prints?: boolean },
  ): Promise<{ segments: Array<[string, string, string]> }>;
}

export interface TranscriptionFileInput {
  data: Buffer;
  mimeType: string;
  fileName?: string;
}

export interface TranscriptionOptions {
  language?: string;
  signal?: AbortSignal;
}

interface WhisperCppTranscriptionProviderOptions {
  model?: string;
  modelRootPath: string;
  audioConverter?: AudioConverter;
}

interface PreparedAudio {
  pcmf32: Float32Array;
  sampleRate: number;
}

export type AudioConverter = (input: TranscriptionFileInput, options?: { signal?: AbortSignal }) => Promise<PreparedAudio>;

const contextCache = new Map<string, { ctx: WhisperContext; module: WhisperCppNodeModule }>();

function readElectronResourcesPath(): string | undefined {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  return typeof resourcesPath === 'string' && resourcesPath.trim() ? resourcesPath : undefined;
}

export function normalizeLocalWhisperModel(value: string | undefined): string {
  const model = value?.trim() || DEFAULT_LOCAL_WHISPER_MODEL;
  return MODEL_ALIASES[model] ?? model;
}

export function resolveCustomHuggingFaceUrl(model: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(model);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'huggingface.co') return null;
  if (!parsed.pathname.includes('/resolve/')) return null;
  if (!basename(parsed.pathname).endsWith('.bin')) return null;
  return parsed;
}

export function resolveModelFileName(model: string): string {
  const trimmed = model.trim();
  const customUrl = resolveCustomHuggingFaceUrl(trimmed);
  if (customUrl) return basename(customUrl.pathname);
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error('Custom Whisper models must be direct Hugging Face /resolve/ URLs to .bin files.');
  }
  const normalizedModel = normalizeLocalWhisperModel(trimmed);
  if (!/^[A-Za-z0-9._-]+$/.test(normalizedModel)) {
    throw new Error('Invalid Whisper model name.');
  }
  return MODEL_FILE_NAMES[normalizedModel] ?? `ggml-${normalizedModel}.bin`;
}

export function resolveModelFilePath(modelRootPath: string, model: string): string {
  return join(modelRootPath, resolveModelFileName(model));
}

export function resolveModelDownloadUrl(model: string): string {
  const customUrl = resolveCustomHuggingFaceUrl(model.trim());
  if (customUrl) return customUrl.toString();
  return `${MODEL_DOWNLOAD_BASE_URL}/${resolveModelFileName(model)}`;
}

function isPcm16Input(input: TranscriptionFileInput): boolean {
  return input.mimeType.toLowerCase().startsWith('audio/pcm') || input.fileName?.toLowerCase().endsWith('.pcm') === true;
}

export function pcm16ToFloat32(data: Buffer): Float32Array {
  if (data.length === 0) {
    return new Float32Array();
  }
  if (data.length % 2 !== 0) {
    throw new Error('Local Whisper PCM audio must have an even byte length.');
  }

  const output = new Float32Array(data.length / 2);
  for (let offset = 0; offset < data.length; offset += 2) {
    const sample = data.readInt16LE(offset);
    output[offset / 2] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return output;
}

export function buildWhisperRequireCandidatePaths(moduleUrl: string, cwd: string, resourcesPath = readElectronResourcesPath()): string[] {
  const moduleFile = fileURLToPath(moduleUrl);
  const candidates = [join(cwd, 'package.json'), moduleFile];

  if (resourcesPath) {
    candidates.push(join(resourcesPath, 'package.json'));
    candidates.push(join(resourcesPath, 'app.asar', 'package.json'));
    candidates.push(join(resourcesPath, 'app.asar.unpacked', 'package.json'));
  }

  let current = dirname(moduleFile);
  for (let depth = 0; depth < 8; depth += 1) {
    candidates.push(join(current, 'package.json'));
    candidates.push(join(current, 'packages', 'desktop', 'package.json'));
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return [...new Set(candidates)];
}

let whisperCppModule: WhisperCppNodeModule | undefined;

function buildUnavailableWhisperMessage(): string {
  return 'Local dictation is missing its native Whisper runtime. Reinstall or update Neon Pilot. In development, run pnpm install from the repo.';
}

export function readWhisperCppRuntimeStatus(): TranscriptionRuntimeStatus {
  const candidates = buildWhisperRequireCandidatePaths(import.meta.url, process.cwd());
  const errors: string[] = [];
  let available = false;

  if (whisperCppModule) {
    available = true;
  } else {
    for (const candidate of candidates) {
      try {
        whisperCppModule = createRequire(candidate)('whisper-cpp-node') as WhisperCppNodeModule;
        available = true;
        break;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const error = available ? undefined : buildUnavailableWhisperMessage();
  return {
    provider: 'local-whisper',
    available,
    ...(error ? { error } : {}),
    dependencies: [
      {
        id: 'whisper-cpp-node',
        label: 'Native Whisper runtime',
        available,
        ...(error ? { error } : {}),
      },
    ],
  };
}

function loadWhisperCpp(): WhisperCppNodeModule {
  if (!whisperCppModule) {
    const errors: string[] = [];
    for (const candidate of buildWhisperRequireCandidatePaths(import.meta.url, process.cwd())) {
      try {
        whisperCppModule = createRequire(candidate)('whisper-cpp-node') as WhisperCppNodeModule;
        break;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (!whisperCppModule) {
      throw new Error(`${buildUnavailableWhisperMessage()} Tried ${errors.length} resolution paths.`);
    }
  }
  return whisperCppModule;
}

function getOrCreateContext(modelRootPath: string, model: string, module_: WhisperCppNodeModule): WhisperContext {
  const normalizedModel = normalizeLocalWhisperModel(model);
  const modelPath = resolveModelFilePath(modelRootPath, normalizedModel);
  const cacheKey = modelPath;
  const cached = contextCache.get(cacheKey);
  if (cached && cached.module === module_) {
    return cached.ctx;
  }

  if (!existsSync(modelPath)) {
    throw new Error(
      `Whisper model not found at ${modelPath}. Download it first via the Settings page or manually:\n` +
        `curl -L -o "${modelPath}" "${resolveModelDownloadUrl(normalizedModel)}"`,
    );
  }

  const ctx = module_.createWhisperContext({
    model: modelPath,
    use_gpu: true,
    no_prints: true,
  });
  contextCache.set(cacheKey, { ctx, module: module_ });
  return ctx;
}

type WhisperSegment = { start: string; end: string; text: string } | [string, string, string];

function readWhisperSegmentText(segment: WhisperSegment): string {
  return Array.isArray(segment) ? segment[2] : segment.text;
}

function readWhisperSegmentStart(segment: WhisperSegment): string | undefined {
  return Array.isArray(segment) ? segment[0] : segment.start;
}

function readWhisperSegmentEnd(segment: WhisperSegment): string | undefined {
  return Array.isArray(segment) ? segment[1] : segment.end;
}

export function parseWhisperTimestampMs(value: string | undefined): number | undefined {
  const normalized = value?.trim().replace(',', '.');
  if (!normalized) return undefined;

  const parts = normalized.split(':');
  if (parts.length > 3 || parts.some((part) => part.trim() === '')) return undefined;

  let seconds = 0;
  for (const part of parts) {
    const parsed = Number(part);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    seconds = seconds * 60 + parsed;
  }

  return Math.round(seconds * 1000);
}

export function normalizeWhisperSegments(segments: WhisperSegment[]): TranscriptionSegment[] {
  return segments.flatMap((segment) => {
    const text = readWhisperSegmentText(segment).trim().replace(/\s+/g, ' ');
    if (!text) return [];

    const startMs = parseWhisperTimestampMs(readWhisperSegmentStart(segment));
    const endMs = parseWhisperTimestampMs(readWhisperSegmentEnd(segment));
    return [
      {
        ...(startMs !== undefined ? { startMs } : {}),
        ...(endMs !== undefined && (startMs === undefined || endMs >= startMs) ? { endMs } : {}),
        text,
      },
    ];
  });
}

export function formatWhisperSegments(segments: WhisperSegment[]): string {
  return normalizeWhisperSegments(segments)
    .map((segment) => segment.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function downloadModel(modelRootPath: string, model: string): Promise<void> {
  const normalizedModel = normalizeLocalWhisperModel(model);
  const modelPath = resolveModelFilePath(modelRootPath, normalizedModel);

  if (existsSync(modelPath)) {
    return;
  }

  mkdirSync(modelRootPath, { recursive: true });

  const url = resolveModelDownloadUrl(normalizedModel);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download whisper model: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(modelPath, buffer);
}

async function getModelFileSize(modelRootPath: string, model: string): Promise<number | null> {
  const modelPath = resolveModelFilePath(modelRootPath, normalizeLocalWhisperModel(model));

  try {
    const stats = statSync(modelPath);
    return stats.isFile() ? stats.size : null;
  } catch {
    return null;
  }
}

export class LocalWhisperTranscriptionProvider {
  readonly provider = 'local-whisper';
  readonly label = 'Local Whisper';
  private readonly model: string;
  private readonly modelRootPath: string;
  private readonly audioConverter: AudioConverter;

  constructor(options: WhisperCppTranscriptionProviderOptions) {
    this.model = normalizeLocalWhisperModel(options.model);
    this.modelRootPath = options.modelRootPath;
    this.audioConverter = options.audioConverter ?? defaultAudioConverter;
  }

  async isAvailable(): Promise<boolean> {
    return readWhisperCppRuntimeStatus().available;
  }

  async getRuntimeStatus(): Promise<TranscriptionRuntimeStatus> {
    return readWhisperCppRuntimeStatus();
  }

  async installModel(): Promise<TranscriptionInstallResult> {
    await downloadModel(this.modelRootPath, this.model);
    return {
      provider: this.provider,
      model: this.model,
      cacheDir: this.modelRootPath,
    };
  }

  async getModelStatus(): Promise<TranscriptionModelStatus> {
    const sizeBytes = await getModelFileSize(this.modelRootPath, this.model);
    const runtime = await this.getRuntimeStatus();
    return {
      provider: this.provider,
      model: this.model,
      cacheDir: this.modelRootPath,
      installed: sizeBytes !== null && sizeBytes > 0,
      runtime,
      ...(sizeBytes !== null ? { sizeBytes } : {}),
    };
  }

  async transcribeFile(input: TranscriptionFileInput, options: TranscriptionOptions = {}): Promise<TranscriptionResult> {
    const audio = isPcm16Input(input)
      ? { pcmf32: pcm16ToFloat32(input.data), sampleRate: PCM_SAMPLE_RATE }
      : await this.audioConverter(input, { signal: options.signal });

    if (audio.pcmf32.length === 0) {
      throw new Error('Local Whisper requires non-empty audio.');
    }

    const whisperModule = loadWhisperCpp();
    const ctx = getOrCreateContext(this.modelRootPath, this.model, whisperModule);

    const result = await whisperModule.transcribeAsync(ctx, {
      pcmf32: audio.pcmf32,
      language: options.language === 'auto' ? undefined : options.language,
      no_timestamps: false,
      no_prints: true,
    });

    const segments = normalizeWhisperSegments(result.segments);
    const text = formatWhisperSegments(result.segments);
    if (!text) {
      throw new Error('Local Whisper returned an empty transcript. Try speaking longer or check microphone input.');
    }

    return {
      text,
      provider: this.provider,
      model: this.model,
      ...(options.language ? { language: options.language } : {}),
      durationMs: Math.round((audio.pcmf32.length / audio.sampleRate) * 1000),
      segments,
    };
  }
}

async function defaultAudioConverter(): Promise<PreparedAudio> {
  throw new Error('Audio conversion is unavailable.');
}
