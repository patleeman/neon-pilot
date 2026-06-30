import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import {
  installTranscriptionModel,
  readTranscriptionModelStatus,
  readTranscriptionRuntimeStatus,
  transcribeAudio,
} from '@neon-pilot/extensions/backend/transcription';

import { buildDictationSettingsState, readDictationSettings, writeDictationSettings } from './settings.js';

function settingsFile(runtimeDir: string): string {
  return join(runtimeDir, 'settings.json');
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredBase64(value: unknown, label: string): Buffer {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized))
    throw new Error(`${label} must contain valid base64 data.`);
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length === 0) throw new Error(`${label} must decode to non-empty data.`);
  return decoded;
}

export async function readSettings(_input: unknown, ctx: ExtensionBackendContext) {
  return buildDictationSettingsState(settingsFile(ctx.runtimeDir));
}

export async function updateSettings(input: { model?: unknown }, ctx: ExtensionBackendContext) {
  const update: Parameters<typeof writeDictationSettings>[1] = {};
  if ('model' in input) {
    const model = readOptionalString(input.model);
    if (!model) throw new Error('model must be a non-empty string');
    update.model = model;
  }
  // Write runtime settings first (persistent storage), then runtime.
  // If the process crashes between writes, runtime settings have the latest
  // values so the next startup loads them correctly. If runtime write
  // fails but runtime settings succeeds, the change is durable across restarts.
  writeDictationSettings(ctx.runtimeSettingsFilePath, update);
  writeDictationSettings(settingsFile(ctx.runtimeDir), update);
  return buildDictationSettingsState(settingsFile(ctx.runtimeDir));
}

export async function modelStatus(input: { model?: unknown }, ctx: ExtensionBackendContext) {
  const settings = readDictationSettings(settingsFile(ctx.runtimeDir));
  const model = readOptionalString(input.model) ?? settings.model;
  return readTranscriptionModelStatus({ model });
}

export async function runtimeStatus() {
  return readTranscriptionRuntimeStatus();
}

export async function installModel(input: { model?: unknown }, ctx: ExtensionBackendContext) {
  const settings = readDictationSettings(settingsFile(ctx.runtimeDir));
  const model = readOptionalString(input.model) ?? settings.model;
  return installTranscriptionModel({ model });
}

export async function transcribeFile(
  input: { dataBase64?: unknown; mimeType?: unknown; fileName?: unknown; language?: unknown },
  ctx: ExtensionBackendContext,
) {
  const settings = readDictationSettings(settingsFile(ctx.runtimeDir));
  const data = readRequiredBase64(input.dataBase64, 'dataBase64');
  return transcribeAudio({
    dataBase64: data.toString('base64'),
    mimeType: readOptionalString(input.mimeType) ?? 'audio/pcm',
    fileName: readOptionalString(input.fileName),
    language: readOptionalString(input.language),
    model: settings.model,
  });
}

export async function dictationCli(input: unknown, ctx: ExtensionBackendContext) {
  const body = asRecord(input);
  const cli = asRecord(body.cli);
  const args = Array.isArray(cli.args) ? cli.args.filter((arg): arg is string => typeof arg === 'string') : [];
  const flags = asRecord(cli.flags);
  const action = typeof body.action === 'string' ? body.action : 'settings';
  if (action === 'settings') return readSettings(body, ctx);
  if (action === 'settings-set') return updateSettings({ model: flags.model }, ctx);
  if (action === 'runtime-status') return runtimeStatus();
  if (action === 'model-status') return modelStatus({ model: flags.model ?? args[0] }, ctx);
  if (action === 'model-install') return installModel({ model: flags.model ?? args[0] }, ctx);
  if (action === 'transcribe') {
    const path = args[0];
    if (!path) throw new Error('audio file path is required.');
    const data = readFileSync(path);
    return transcribeFile(
      {
        dataBase64: data.toString('base64'),
        mimeType: readOptionalString(flags.mimeType) ?? readOptionalString(flags['mime-type']),
        fileName: readOptionalString(flags.fileName) ?? basename(path),
        language: flags.language,
      },
      ctx,
    );
  }
  throw new Error(`Unsupported dictation CLI action: ${action}`);
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
}
