import type { AudioProbeTranscriptionResult, StoredAudioProbeAttachment } from '@neon-pilot/extensions/backend/audio';

import { callServerModuleExport } from './serverModuleResolver.js';

export type { AudioProbeTranscriptionResult, StoredAudioProbeAttachment };

const AUDIO_PROBE_STORE = '../../extensions/audioProbeAttachmentStore.js';

export async function clearAudioProbeAttachmentCacheForTests(...args: unknown[]) {
  return callServerModuleExport<void>(AUDIO_PROBE_STORE, 'clearAudioProbeAttachmentCacheForTests', ...args);
}

export async function getAudioProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredAudioProbeAttachment[]>(AUDIO_PROBE_STORE, 'getAudioProbeAttachments', ...args);
}

export async function getAudioProbeAttachmentsById(...args: unknown[]) {
  return callServerModuleExport<StoredAudioProbeAttachment[]>(AUDIO_PROBE_STORE, 'getAudioProbeAttachmentsById', ...args);
}

export async function getAudioProbeAttachmentsByIdFromAnySession(...args: unknown[]) {
  return callServerModuleExport<StoredAudioProbeAttachment[]>(AUDIO_PROBE_STORE, 'getAudioProbeAttachmentsByIdFromAnySession', ...args);
}

export async function rememberAudioProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredAudioProbeAttachment[]>(AUDIO_PROBE_STORE, 'rememberAudioProbeAttachments', ...args);
}

export async function transcribeAudioAttachment(...args: unknown[]) {
  return callServerModuleExport<AudioProbeTranscriptionResult>(AUDIO_PROBE_STORE, 'transcribeAudioAttachment', ...args);
}
