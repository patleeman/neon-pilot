function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/audio must be resolved by the Neon Pilot host runtime.');
}

export interface StoredAudioProbeAttachment {
  id: string;
  path: string;
  mimeType: string;
  name?: string;
  sizeBytes: number;
  durationMs?: number;
}

export interface AudioProbeTranscriptionSegment {
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface AudioProbeTranscriptionResult {
  text: string;
  content: Array<{ type: 'text'; text: string }>;
  details: {
    audioId: string;
    language?: string;
    durationMs?: number;
    segments: AudioProbeTranscriptionSegment[];
  };
}

export const clearAudioProbeAttachmentCacheForTests = (..._args: unknown[]): unknown => hostResolved();
export const getAudioProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const getAudioProbeAttachmentsById = (..._args: unknown[]): unknown => hostResolved();
export const getAudioProbeAttachmentsByIdFromAnySession = (..._args: unknown[]): unknown => hostResolved();
export const rememberAudioProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const transcribeAudioAttachment = (..._args: unknown[]): unknown => hostResolved();
