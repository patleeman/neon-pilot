import type {
  TranscriptionAudioInput,
  TranscriptionInstallInput,
  TranscriptionInstallResult,
  TranscriptionModelStatus,
  TranscriptionModelStatusInput,
  TranscriptionResult,
  TranscriptionRuntimeStatus,
} from '@neon-pilot/extensions/backend/transcription';

import { callServerModuleExport } from './serverModuleResolver.js';

const TRANSCRIPTION_SERVICE = '../../transcription/transcriptionService.js';

export type {
  TranscriptionAudioInput,
  TranscriptionInstallInput,
  TranscriptionInstallResult,
  TranscriptionModelStatus,
  TranscriptionModelStatusInput,
  TranscriptionResult,
  TranscriptionRuntimeStatus,
} from '@neon-pilot/extensions/backend/transcription';

export function transcribeAudio(input: TranscriptionAudioInput): Promise<TranscriptionResult> {
  return callServerModuleExport(TRANSCRIPTION_SERVICE, 'transcribeAudio', input);
}

export function installTranscriptionModel(input?: TranscriptionInstallInput): Promise<TranscriptionInstallResult> {
  return callServerModuleExport(TRANSCRIPTION_SERVICE, 'installTranscriptionModel', input);
}

export function readTranscriptionModelStatus(input?: TranscriptionModelStatusInput): Promise<TranscriptionModelStatus> {
  return callServerModuleExport(TRANSCRIPTION_SERVICE, 'readTranscriptionModelStatus', input);
}

export function readTranscriptionRuntimeStatus(): Promise<TranscriptionRuntimeStatus> {
  return callServerModuleExport(TRANSCRIPTION_SERVICE, 'readTranscriptionRuntimeStatus');
}
