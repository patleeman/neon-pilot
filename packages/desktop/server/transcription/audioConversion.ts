import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import type { AudioConverter, TranscriptionFileInput } from './localWhisperProvider.js';
import { pcm16ToFloat32 } from './localWhisperProvider.js';

const TARGET_SAMPLE_RATE = 16_000;
const createDesktopRequire = createRequire(import.meta.url);

function sanitizeAudioFileName(fileName: string | undefined, mimeType: string): string {
  const candidate = fileName ? basename(fileName).replace(/[^A-Za-z0-9._-]/g, '_') : '';
  if (candidate) return candidate;
  if (mimeType.includes('ogg')) return 'input.ogg';
  if (mimeType.includes('webm')) return 'input.webm';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'input.mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'input.m4a';
  if (mimeType.includes('wav')) return 'input.wav';
  if (mimeType.includes('flac')) return 'input.flac';
  return 'input.audio';
}

export function resolveFfmpegBinary(): string | null {
  try {
    const ffmpegInstaller = createDesktopRequire('@ffmpeg-installer/ffmpeg') as { path?: unknown };
    if (typeof ffmpegInstaller.path === 'string' && existsSync(ffmpegInstaller.path)) return ffmpegInstaller.path;
  } catch {
    // Fall through to PATH lookup.
  }
  return 'ffmpeg';
}

async function runFfmpeg(args: string[], options: { signal?: AbortSignal } = {}): Promise<void> {
  const binary = resolveFfmpegBinary();
  if (!binary) throw new Error('ffmpeg is unavailable.');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderr: Buffer[] = [];
    const abort = () => child.kill('SIGTERM');

    options.signal?.addEventListener('abort', abort, { once: true });
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      options.signal?.removeEventListener('abort', abort);
      reject(error);
    });
    child.on('close', (code) => {
      options.signal?.removeEventListener('abort', abort);
      if (code === 0) {
        resolve();
        return;
      }
      const detail = Buffer.concat(stderr).toString('utf-8').trim();
      reject(new Error(detail ? `ffmpeg failed: ${detail}` : `ffmpeg failed with exit code ${code ?? 'unknown'}.`));
    });
  }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('Audio transcription needs ffmpeg to decode this format, but ffmpeg is not available.');
    }
    throw error;
  });
}

export const convertAudioWithFfmpeg: AudioConverter = async (input: TranscriptionFileInput, options = {}) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'neon-pilot-transcription-'));
  const inputPath = join(tempRoot, sanitizeAudioFileName(input.fileName, input.mimeType.toLowerCase()));
  const outputPath = join(tempRoot, 'output.pcm');
  try {
    await writeFile(inputPath, input.data);
    await runFfmpeg(
      ['-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', String(TARGET_SAMPLE_RATE), '-f', 's16le', '-acodec', 'pcm_s16le', outputPath],
      options,
    );
    const pcm = await readFile(outputPath);
    return {
      pcmf32: pcm16ToFloat32(pcm),
      sampleRate: TARGET_SAMPLE_RATE,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};
