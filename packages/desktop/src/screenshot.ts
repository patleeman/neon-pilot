import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import type { WebContents } from 'electron';

interface DesktopScreenshotImage {
  name?: string;
  mimeType: string;
  data: string;
}

export interface DesktopScreenshotCaptureResult {
  cancelled: boolean;
  image?: DesktopScreenshotImage;
}

export interface WindowedDesktopScreenshotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowedDesktopScreenshotInput {
  bounds?: WindowedDesktopScreenshotBounds | null;
  windowId?: string | null;
  browserSessionKey?: string | null;
}

export interface WindowedDesktopScreenshotImage {
  mimeType: 'image/png';
  data: string;
  width: number;
  height: number;
  capturedAt: string;
  bounds?: WindowedDesktopScreenshotBounds;
  windowId?: string;
}

export interface WindowedDesktopScreenshotCaptureResult {
  image: WindowedDesktopScreenshotImage;
}

interface ScreenshotCommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
}

interface WindowedBrowserScreenshotInput {
  windowId?: string | null;
}

interface CaptureDesktopScreenshotDeps {
  platform: NodeJS.Platform;
  tmpdir: () => string;
  mkdtemp: typeof mkdtemp;
  readFile: typeof readFile;
  rm: typeof rm;
  runInteractiveScreencapture: (outputPath: string) => Promise<ScreenshotCommandResult>;
}

const MAX_DESKTOP_SCREENSHOT_BYTES = 8 * 1024 * 1024;

const defaultDeps: CaptureDesktopScreenshotDeps = {
  platform: process.platform,
  tmpdir,
  mkdtemp,
  readFile,
  rm,
  runInteractiveScreencapture,
};

export async function captureDesktopScreenshot(deps: CaptureDesktopScreenshotDeps = defaultDeps): Promise<DesktopScreenshotCaptureResult> {
  if (deps.platform !== 'darwin') {
    throw new Error('Built-in screenshot capture is currently only available on macOS.');
  }

  const tempDir = await deps.mkdtemp(join(deps.tmpdir(), 'neon-pilot-screenshot-'));
  const fileName = `Screenshot ${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  const outputPath = join(tempDir, fileName);

  try {
    const result = await deps.runInteractiveScreencapture(outputPath);
    const imageBytes = await deps.readFile(outputPath).catch((error) => {
      if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
        return null;
      }
      throw error;
    });

    if (imageBytes && imageBytes.length > 0) {
      if (imageBytes.length > MAX_DESKTOP_SCREENSHOT_BYTES) {
        throw new Error(
          `Screenshot is too large to send through the native desktop bridge (${imageBytes.length} bytes; max ${MAX_DESKTOP_SCREENSHOT_BYTES} bytes). Capture a smaller region and try again.`,
        );
      }

      return {
        cancelled: false,
        image: {
          name: basename(outputPath),
          mimeType: 'image/png',
          data: imageBytes.toString('base64'),
        },
      };
    }

    if (result.signal) {
      throw new Error(`Screenshot capture was interrupted (${result.signal}).`);
    }

    const stderr = result.stderr.trim();
    if (result.code === 1 && stderr.length === 0) {
      return { cancelled: true };
    }

    if (/not authorized|not permitted|permission/i.test(stderr)) {
      throw new Error('macOS blocked screenshot capture. Enable Screen Recording for Neon Pilot in System Settings and try again.');
    }

    if (stderr.length > 0) {
      throw new Error(stderr);
    }

    if (result.code === 0) {
      return { cancelled: true };
    }

    throw new Error(`Screenshot capture failed with exit code ${String(result.code)}.`);
  } finally {
    await deps.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function sanitizeWindowedScreenshotBounds(
  bounds: WindowedDesktopScreenshotBounds | null | undefined,
): WindowedDesktopScreenshotBounds | undefined {
  if (bounds === undefined || bounds === null) return undefined;
  const { x, y, width, height } = bounds;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('Windowed OS screenshot bounds must include finite positive width and height.');
  }
  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export async function captureWindowedDesktopScreenshot(
  webContents: Pick<WebContents, 'capturePage'>,
  input: WindowedDesktopScreenshotInput = {},
): Promise<WindowedDesktopScreenshotCaptureResult> {
  const bounds = sanitizeWindowedScreenshotBounds(input.bounds);
  const nativeImage = await webContents.capturePage(bounds);
  const png = nativeImage.toPNG();
  if (png.length > MAX_DESKTOP_SCREENSHOT_BYTES) {
    throw new Error(
      `Windowed OS screenshot is too large to send through the native desktop bridge (${png.length} bytes; max ${MAX_DESKTOP_SCREENSHOT_BYTES} bytes). Capture a smaller window and try again.`,
    );
  }
  const size = nativeImage.getSize();
  return {
    image: {
      mimeType: 'image/png',
      data: png.toString('base64'),
      width: size.width,
      height: size.height,
      capturedAt: new Date().toISOString(),
      ...(bounds ? { bounds } : {}),
      ...(input.windowId ? { windowId: input.windowId } : {}),
    },
  };
}

export async function captureWindowedBrowserScreenshot(
  capture: () => Promise<unknown>,
  input: WindowedBrowserScreenshotInput = {},
): Promise<WindowedDesktopScreenshotCaptureResult> {
  const rawCapture = await capture();
  const captureResult = rawCapture && typeof rawCapture === 'object' ? (rawCapture as Record<string, unknown>) : {};
  const viewport =
    captureResult.viewport && typeof captureResult.viewport === 'object' ? (captureResult.viewport as Record<string, unknown>) : {};
  const dataBase64 = typeof captureResult.dataBase64 === 'string' ? captureResult.dataBase64 : '';
  const capturedAt = typeof captureResult.capturedAt === 'string' ? captureResult.capturedAt : new Date().toISOString();
  const width = typeof viewport.width === 'number' && Number.isFinite(viewport.width) ? viewport.width : 1;
  const height = typeof viewport.height === 'number' && Number.isFinite(viewport.height) ? viewport.height : 1;
  if (captureResult.mimeType !== 'image/png' || dataBase64.length === 0) {
    throw new Error('Workbench browser screenshot did not return a PNG payload.');
  }
  const png = Buffer.from(dataBase64, 'base64');
  if (png.length > MAX_DESKTOP_SCREENSHOT_BYTES) {
    throw new Error(
      `Windowed OS screenshot is too large to send through the native desktop bridge (${png.length} bytes; max ${MAX_DESKTOP_SCREENSHOT_BYTES} bytes). Capture a smaller window and try again.`,
    );
  }

  return {
    image: {
      mimeType: 'image/png',
      data: dataBase64,
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      capturedAt,
      ...(input.windowId ? { windowId: input.windowId } : {}),
    },
  };
}

async function runInteractiveScreencapture(outputPath: string): Promise<ScreenshotCommandResult> {
  return new Promise((resolve, reject) => {
    // Keep the interaction to the single-shot legacy crosshair/window picker.
    // The newer toolbar mode (`-U`) can leave screencapture running after the
    // user takes a shot, which leaves the composer spinner stuck.
    const child = spawn('screencapture', ['-i', '-x', outputPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: string | Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      const normalized =
        (error as NodeJS.ErrnoException).code === 'ENOENT' ? new Error('macOS screencapture is unavailable on this machine.') : error;
      reject(normalized);
    });
    child.once('close', (code, signal) => {
      resolve({ code, signal, stderr });
    });
  });
}
