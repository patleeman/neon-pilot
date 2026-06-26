import type {
  StoredVideoProbeAttachment,
  VideoProbeFrameResult,
  VideoProbeTranscriptionResult,
} from '@neon-pilot/extensions/backend/videos';

import { callServerModuleExport } from './serverModuleResolver.js';

export type { StoredVideoProbeAttachment, VideoProbeFrameResult, VideoProbeTranscriptionResult };

const VIDEO_PROBE_STORE = '../../extensions/videoProbeAttachmentStore.js';

export async function clearVideoProbeAttachmentCacheForTests(...args: unknown[]) {
  return callServerModuleExport<void>(VIDEO_PROBE_STORE, 'clearVideoProbeAttachmentCacheForTests', ...args);
}

export async function getVideoProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredVideoProbeAttachment[]>(VIDEO_PROBE_STORE, 'getVideoProbeAttachments', ...args);
}

export async function getVideoProbeAttachmentsById(...args: unknown[]) {
  return callServerModuleExport<StoredVideoProbeAttachment[]>(VIDEO_PROBE_STORE, 'getVideoProbeAttachmentsById', ...args);
}

export async function getVideoProbeAttachmentsByIdFromAnySession(...args: unknown[]) {
  return callServerModuleExport<StoredVideoProbeAttachment[]>(VIDEO_PROBE_STORE, 'getVideoProbeAttachmentsByIdFromAnySession', ...args);
}

export async function rememberVideoProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredVideoProbeAttachment[]>(VIDEO_PROBE_STORE, 'rememberVideoProbeAttachments', ...args);
}

export async function extractVideoFrame(...args: unknown[]) {
  return callServerModuleExport<VideoProbeFrameResult>(VIDEO_PROBE_STORE, 'extractVideoFrame', ...args);
}

export async function sampleVideoFrames(...args: unknown[]) {
  return callServerModuleExport<VideoProbeFrameResult>(VIDEO_PROBE_STORE, 'sampleVideoFrames', ...args);
}

export async function transcribeVideo(...args: unknown[]) {
  return callServerModuleExport<VideoProbeTranscriptionResult>(VIDEO_PROBE_STORE, 'transcribeVideo', ...args);
}
