function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/videos must be resolved by the Neon Pilot host runtime.');
}

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionBackendGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: (capability: string, operation: string, input?: unknown) => Promise<unknown>;
};

export interface StoredVideoProbeAttachment {
  id: string;
  path: string;
  mimeType: string;
  name?: string;
  sizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio?: boolean;
}

export interface VideoProbeFrame {
  videoId: string;
  timestampMs: number;
  mimeType: string;
  data: string;
}

export interface VideoProbeFrameResult {
  text: string;
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  details: {
    videoId: string;
    frames: Array<{ timestampMs: number; mimeType: string; sizeBytes: number }>;
  };
}

export interface VideoProbeTranscriptionSegment {
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface VideoProbeTranscriptionResult {
  text: string;
  content: Array<{ type: 'text'; text: string }>;
  details: {
    videoId: string;
    startMs: number;
    endMs?: number;
    language?: string;
    durationMs?: number;
    segments: VideoProbeTranscriptionSegment[];
  };
}

function getHostCapabilityBridge(): ((capability: string, operation: string, input?: unknown) => Promise<unknown>) | undefined {
  return (globalThis as ExtensionBackendGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

async function callVideoCapability(operation: string, input?: unknown): Promise<unknown> {
  const bridge = getHostCapabilityBridge();
  if (!bridge) {
    throw new Error('Video host capability is unavailable outside an extension backend worker request.');
  }
  return bridge('video', operation, input);
}

export function hasVideoHostCapability(): boolean {
  return typeof getHostCapabilityBridge() === 'function';
}

export const clearVideoProbeAttachmentCacheForTests = (..._args: unknown[]): unknown => hostResolved();
export const getVideoProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const getVideoProbeAttachmentsById = (..._args: unknown[]): unknown => hostResolved();
export const getVideoProbeAttachmentsByIdFromAnySession = (..._args: unknown[]): unknown => hostResolved();
export const rememberVideoProbeAttachments = (..._args: unknown[]): unknown => hostResolved();

export async function extractVideoFrame(input: unknown): Promise<unknown> {
  return callVideoCapability('extractFrame', input);
}

export async function sampleVideoFrames(input: unknown): Promise<unknown> {
  return callVideoCapability('sampleFrames', input);
}

export async function transcribeVideo(input: unknown): Promise<unknown> {
  return callVideoCapability('transcribe', input);
}
