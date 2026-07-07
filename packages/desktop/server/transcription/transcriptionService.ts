import { join } from 'node:path';

import { type DesktopRootLayout, getStateRoot, resolveDesktopRootLayout } from '@neon-pilot/core';
import type {
  TranscriptionAudioInput,
  TranscriptionInstallInput,
  TranscriptionInstallResult,
  TranscriptionModelStatus,
  TranscriptionModelStatusInput,
  TranscriptionResult,
  TranscriptionRuntimeStatus,
} from '@neon-pilot/extensions/backend/transcription';

import { convertAudioWithFfmpeg } from './audioConversion.js';
import { LocalWhisperTranscriptionProvider } from './localWhisperProvider.js';

const DEFAULT_TRANSCRIPTION_MODEL = 'base.en';

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredBase64(value: unknown, label: string): Buffer {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error(`${label} must contain valid base64 data.`);
  }
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length === 0) throw new Error(`${label} must decode to non-empty data.`);
  return decoded;
}

function resolveTranscriptionModelRoot(layout?: DesktopRootLayout): string {
  if (layout) {
    return join(layout.systemState, 'transcription-models');
  }
  return join(getStateRoot(), 'transcription-models');
}

function createLocalProvider(
  model: string | undefined,
  layout: DesktopRootLayout = resolveDesktopRootLayout(),
): LocalWhisperTranscriptionProvider {
  return new LocalWhisperTranscriptionProvider({
    model: readOptionalString(model) ?? DEFAULT_TRANSCRIPTION_MODEL,
    modelRootPath: resolveTranscriptionModelRoot(layout),
    audioConverter: convertAudioWithFfmpeg,
  });
}

async function ensureProviderModelInstalled(provider: LocalWhisperTranscriptionProvider): Promise<void> {
  const status = await provider.getModelStatus();
  if (!status.installed) {
    await provider.installModel();
  }
}

export async function readTranscriptionModelStatus(input: TranscriptionModelStatusInput = {}): Promise<TranscriptionModelStatus> {
  return createLocalProvider(input.model).getModelStatus();
}

export async function readTranscriptionRuntimeStatus(): Promise<TranscriptionRuntimeStatus> {
  return createLocalProvider(undefined).getRuntimeStatus();
}

export async function installTranscriptionModel(input: TranscriptionInstallInput = {}): Promise<TranscriptionInstallResult> {
  return createLocalProvider(input.model).installModel();
}

export async function transcribeAudio(input: TranscriptionAudioInput): Promise<TranscriptionResult> {
  const provider = createLocalProvider(input.model);
  await ensureProviderModelInstalled(provider);
  return provider.transcribeFile(
    {
      data: readRequiredBase64(input.dataBase64, 'dataBase64'),
      mimeType: readOptionalString(input.mimeType) ?? 'application/octet-stream',
      fileName: readOptionalString(input.fileName),
    },
    { language: readOptionalString(input.language) },
  );
}

export const testExports = {
  createLocalProvider,
  readRequiredBase64,
  resolveTranscriptionModelRoot,
};
