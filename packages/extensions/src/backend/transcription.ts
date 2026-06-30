function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/transcription must be resolved by the Neon Pilot host runtime.');
}

export type TranscriptionProviderId = 'local-whisper' | string;

export interface TranscriptionAudioInput {
  dataBase64: string;
  mimeType?: string;
  fileName?: string;
  language?: string;
  model?: string;
}

export interface TranscriptionSegment {
  startMs?: number;
  endMs?: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  provider: TranscriptionProviderId;
  model?: string;
  language?: string;
  durationMs?: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionInstallInput {
  model?: string;
}

export interface TranscriptionInstallResult {
  provider: TranscriptionProviderId;
  model: string;
  cacheDir: string;
}

export interface TranscriptionModelStatusInput {
  model?: string;
}

export interface TranscriptionModelStatus {
  provider: TranscriptionProviderId;
  model: string;
  cacheDir: string;
  installed: boolean;
  sizeBytes?: number;
  runtime?: TranscriptionRuntimeStatus;
}

export interface TranscriptionRuntimeDependencyStatus {
  id: string;
  label: string;
  available: boolean;
  error?: string;
}

export interface TranscriptionRuntimeStatus {
  provider: TranscriptionProviderId;
  available: boolean;
  dependencies: TranscriptionRuntimeDependencyStatus[];
  error?: string;
}

export const transcribeAudio = (_input: TranscriptionAudioInput): Promise<TranscriptionResult> => hostResolved();
export const installTranscriptionModel = (_input?: TranscriptionInstallInput): Promise<TranscriptionInstallResult> => hostResolved();
export const readTranscriptionModelStatus = (_input?: TranscriptionModelStatusInput): Promise<TranscriptionModelStatus> => hostResolved();
export const readTranscriptionRuntimeStatus = (): Promise<TranscriptionRuntimeStatus> => hostResolved();
