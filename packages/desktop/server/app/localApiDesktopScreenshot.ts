const DEFAULT_SCREENSHOT_TIMEOUT_MS = 8_000;
const MAX_SCREENSHOT_TIMEOUT_MS = 30_000;
const MAX_STRING_LENGTH = 2048;
const MAX_ERROR_LENGTH = 2048;
const MAX_IMAGE_BASE64_LENGTH = Math.ceil((8 * 1024 * 1024 * 4) / 3);

export interface DesktopScreenshotRequestInput {
  windowId?: unknown;
  timeoutMs?: unknown;
}

export interface DesktopScreenshotRequest {
  id: string;
  createdAt: string;
  windowId?: string;
}

export interface DesktopScreenshotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopScreenshotImage {
  mimeType: 'image/png';
  data: string;
  width: number;
  height: number;
  capturedAt: string;
  bounds?: DesktopScreenshotBounds;
  windowId?: string;
}

export interface DesktopScreenshotAckInput {
  requestId?: unknown;
  ok?: unknown;
  image?: unknown;
  error?: unknown;
}

export interface DesktopScreenshotResult {
  ok: boolean;
  requestId: string;
  status: 'completed' | 'failed' | 'timeout';
  image?: DesktopScreenshotImage;
  error?: string;
}

interface PendingScreenshotRequest {
  request: DesktopScreenshotRequest;
  resolve: (result: DesktopScreenshotResult) => void;
  timeout: ReturnType<typeof setTimeout>;
}

let nextRequestId = 1;
const pendingRequests = new Map<string, PendingScreenshotRequest>();
const subscribers = new Set<(request: DesktopScreenshotRequest) => void>();

export class DesktopScreenshotValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'DesktopScreenshotValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new DesktopScreenshotValidationError(`${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_STRING_LENGTH ? trimmed.slice(0, MAX_STRING_LENGTH) : trimmed;
}

function sanitizeTimeoutMs(value: unknown): number {
  if (value === undefined || value === null) return DEFAULT_SCREENSHOT_TIMEOUT_MS;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DesktopScreenshotValidationError('desktop_screenshot timeoutMs must be a finite number.');
  }
  return Math.max(100, Math.min(MAX_SCREENSHOT_TIMEOUT_MS, Math.round(value)));
}

function sanitizeBounds(value: unknown): DesktopScreenshotBounds | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new DesktopScreenshotValidationError('desktop_screenshot image bounds must be an object.');
  }
  const { x, y, width, height } = value;
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
    throw new DesktopScreenshotValidationError('desktop_screenshot image bounds must include finite positive width and height.');
  }
  return { x, y, width, height };
}

function sanitizeImage(value: unknown): DesktopScreenshotImage {
  if (!isRecord(value)) {
    throw new DesktopScreenshotValidationError('desktop_screenshot acknowledgement image must be an object.');
  }
  if (value.mimeType !== 'image/png') {
    throw new DesktopScreenshotValidationError('desktop_screenshot acknowledgement image must be a PNG.');
  }
  if (typeof value.data !== 'string' || !value.data || value.data.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new DesktopScreenshotValidationError('desktop_screenshot acknowledgement image data is invalid or too large.');
  }
  if (
    typeof value.width !== 'number' ||
    typeof value.height !== 'number' ||
    !Number.isFinite(value.width) ||
    !Number.isFinite(value.height) ||
    value.width <= 0 ||
    value.height <= 0
  ) {
    throw new DesktopScreenshotValidationError('desktop_screenshot acknowledgement image must include finite positive dimensions.');
  }
  const capturedAt = sanitizeString(value.capturedAt, 'capturedAt');
  if (!capturedAt) {
    throw new DesktopScreenshotValidationError('desktop_screenshot acknowledgement image requires capturedAt.');
  }
  const bounds = sanitizeBounds(value.bounds);
  const windowId = sanitizeString(value.windowId, 'windowId');
  return {
    mimeType: 'image/png',
    data: value.data,
    width: Math.round(value.width),
    height: Math.round(value.height),
    capturedAt,
    ...(bounds ? { bounds } : {}),
    ...(windowId ? { windowId } : {}),
  };
}

function buildDesktopScreenshotRequest(input: DesktopScreenshotRequestInput): { request: DesktopScreenshotRequest; timeoutMs: number } {
  if (!isRecord(input)) {
    throw new DesktopScreenshotValidationError('desktop_screenshot input must be an object.');
  }
  const windowId = sanitizeString(input.windowId, 'windowId');
  const timeoutMs = sanitizeTimeoutMs(input.timeoutMs);
  return {
    request: {
      id: `desktop-screenshot-${Date.now().toString(36)}-${nextRequestId++}`,
      createdAt: new Date().toISOString(),
      ...(windowId ? { windowId } : {}),
    },
    timeoutMs,
  };
}

function publishScreenshotRequest(request: DesktopScreenshotRequest): void {
  for (const subscriber of subscribers) {
    subscriber(request);
  }
}

export function subscribeDesktopScreenshotRequests(listener: (request: DesktopScreenshotRequest) => void): () => void {
  subscribers.add(listener);
  for (const pending of pendingRequests.values()) {
    listener(pending.request);
  }
  return () => {
    subscribers.delete(listener);
  };
}

export function issueDesktopScreenshotRequest(input: DesktopScreenshotRequestInput = {}): Promise<DesktopScreenshotResult> {
  const { request, timeoutMs } = buildDesktopScreenshotRequest(input);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(request.id);
      resolve({
        ok: false,
        requestId: request.id,
        status: 'timeout',
        error: 'Timed out waiting for the Windowed OS renderer to acknowledge the desktop screenshot request.',
      });
    }, timeoutMs);
    timeout.unref?.();
    pendingRequests.set(request.id, { request, resolve, timeout });
    publishScreenshotRequest(request);
  });
}

export function acknowledgeDesktopScreenshotRequest(input: DesktopScreenshotAckInput): DesktopScreenshotResult {
  if (!isRecord(input)) {
    throw new DesktopScreenshotValidationError('desktop_screenshot acknowledgement must be an object.');
  }
  const requestId = sanitizeString(input.requestId, 'requestId');
  if (!requestId) {
    throw new DesktopScreenshotValidationError('desktop_screenshot acknowledgement requires requestId.');
  }
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    throw new DesktopScreenshotValidationError('desktop_screenshot request is no longer pending.');
  }
  const image = input.ok === true ? sanitizeImage(input.image) : undefined;
  pendingRequests.delete(requestId);
  clearTimeout(pending.timeout);
  const rawError = typeof input.error === 'string' ? input.error.trim() : '';
  const error = rawError.length > MAX_ERROR_LENGTH ? rawError.slice(0, MAX_ERROR_LENGTH) : rawError;
  const result: DesktopScreenshotResult = {
    ok: input.ok === true,
    requestId,
    status: input.ok === true ? 'completed' : 'failed',
    ...(image ? { image } : {}),
    ...(input.ok === true ? {} : { error: error || 'Windowed OS renderer rejected the desktop screenshot request.' }),
  };
  pending.resolve(result);
  return result;
}

export function resetDesktopScreenshotForTests(): void {
  for (const pending of pendingRequests.values()) {
    clearTimeout(pending.timeout);
  }
  pendingRequests.clear();
  subscribers.clear();
  nextRequestId = 1;
}
