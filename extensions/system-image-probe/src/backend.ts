import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { runAgentTask } from '@neon-pilot/extensions/backend/agent';
import {
  type AudioProbeTranscriptionResult,
  getAudioProbeAttachments,
  getAudioProbeAttachmentsById,
  getAudioProbeAttachmentsByIdFromAnySession,
  type StoredAudioProbeAttachment,
  transcribeAudioAttachment,
} from '@neon-pilot/extensions/backend/audio';
import {
  type DocumentProbeExtractionResult,
  extractDocumentText,
  getDocumentProbeAttachments,
  getDocumentProbeAttachmentsById,
  getDocumentProbeAttachmentsByIdFromAnySession,
  type StoredDocumentProbeAttachment,
} from '@neon-pilot/extensions/backend/documents';
import {
  getImageProbeAttachments,
  getImageProbeAttachmentsById,
  getImageProbeAttachmentsByIdFromAnySession,
  type StoredImageProbeAttachment,
} from '@neon-pilot/extensions/backend/images';
import {
  getVideoProbeAttachments,
  getVideoProbeAttachmentsById,
  getVideoProbeAttachmentsByIdFromAnySession,
  sampleVideoFrames,
  type StoredVideoProbeAttachment,
  transcribeVideo,
  type VideoProbeFrameResult,
  type VideoProbeTranscriptionResult,
} from '@neon-pilot/extensions/backend/videos';

interface ProbeImageInput {
  imageIds?: unknown;
  question?: unknown;
}

interface ProbeMediaInput extends ProbeImageInput {
  videoIds?: unknown;
  audioIds?: unknown;
  documentIds?: unknown;
  startSec?: unknown;
  endSec?: unknown;
  frameCount?: unknown;
  includeAudio?: unknown;
  language?: unknown;
}

interface VideoFrameProbeAttachment {
  type: 'video-frame';
  videoId: string;
  timestampMs: number;
  data: string;
  mimeType: string;
  name: string;
}

interface VideoProbeContext {
  video: StoredVideoProbeAttachment;
  frames: VideoFrameProbeAttachment[];
  transcript?: string;
  transcriptError?: string;
}

interface AudioProbeContext {
  audio: StoredAudioProbeAttachment;
  transcript?: string;
  transcriptError?: string;
}

interface DocumentProbeContext {
  document: StoredDocumentProbeAttachment;
  text?: string;
  extractionError?: string;
  extractor?: string;
  truncated?: boolean;
}

interface ProbeFailureDetails {
  imageIds: string[];
  availableImageIds: string[];
  imagePaths: string[];
  model?: string;
  provider?: string;
}

function readImageIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Probe image requires at least one image ID.');
  if (value.length > 8) throw new Error('Probe image supports at most 8 image IDs.');
  return readIdArray(value, /^img_[a-f0-9]{12}$/, 'image ID');
}

function readIdArray(value: unknown, pattern: RegExp, label: string): string[] {
  const seen = new Set<string>();
  return value.map((item) => {
    if (typeof item !== 'string' || !pattern.test(item)) throw new Error(`Invalid ${label}: ${String(item)}`);
    if (seen.has(item)) throw new Error(`Duplicate ${label}: ${item}`);
    seen.add(item);
    return item;
  });
}

function readOptionalImageIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('imageIds must be an array when provided.');
  if (value.length > 8) throw new Error('Probe media supports at most 8 image IDs.');
  return readIdArray(value, /^img_[a-f0-9]{12}$/, 'image ID');
}

function readOptionalVideoIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('videoIds must be an array when provided.');
  if (value.length > 3) throw new Error('Probe media supports at most 3 video IDs at once.');
  return readIdArray(value, /^vid_[a-f0-9]{12}$/, 'video ID');
}

function readOptionalAudioIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('audioIds must be an array when provided.');
  if (value.length > 6) throw new Error('Probe media supports at most 6 audio IDs at once.');
  return readIdArray(value, /^aud_[a-f0-9]{12}$/, 'audio ID');
}

function readOptionalDocumentIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('documentIds must be an array when provided.');
  if (value.length > 8) throw new Error('Probe media supports at most 8 document IDs at once.');
  return readIdArray(value, /^doc_[a-f0-9]{12}$/, 'document ID');
}

function readQuestion(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Probe image question is required.');
  if (value.length > 8000) throw new Error('Probe image question is too long.');
  return value.trim();
}

function readOptionalSeconds(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number.`);
  return number;
}

function readOptionalFrameCount(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > 8) {
    throw new Error('frameCount must be an integer between 1 and 8.');
  }
  return number;
}

function readOptionalBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  throw new Error('includeAudio must be true or false when provided.');
}

function readOptionalLanguage(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new Error('language must be a string when provided.');
  const language = value.trim();
  if (language.length > 32) throw new Error('language is too long.');
  return language;
}

function classifyVisionProbeFailure(error: unknown, modelRef: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (/(402|insufficient\s+(balance|credits|funds|quota)|payment required|credits|billing)/.test(normalized)) {
    return `The configured vision model could not analyze the image because the provider reported a billing or credit problem. Check the provider account for ${modelRef}. Error: ${message}`;
  }
  if (/(does not support|not support|multimodal|image input|image_url|unsupported|does not accept images)/.test(normalized)) {
    return `The configured vision model does not appear to support this image request. Pick a different image-capable vision model in Settings. Model: ${modelRef}. Error: ${message}`;
  }
  if (/(too large|payload|413|content_too_large|request_too_large|exceeds|size limit)/.test(normalized)) {
    return `The selected image is too large for the configured vision model. Try a smaller screenshot or compressed image. Model: ${modelRef}. Error: ${message}`;
  }
  if (/(invalid image|unsupported format|corrupt|decode|mime)/.test(normalized)) {
    return `The vision model rejected the image format or could not decode the image. Try a PNG or JPEG screenshot. Error: ${message}`;
  }
  return `The configured vision model failed while analyzing the image. Model: ${modelRef}. Error: ${message}`;
}

function buildProbePrompt(attachments: StoredImageProbeAttachment[], question: string): string {
  return [
    'You are a vision probe for a text-only agent.',
    '',
    'The calling agent cannot see the attached images. Act as its eyes.',
    'Fully describe the relevant visual parts of the image, then answer the question directly.',
    'Include enough visual detail and evidence for the calling agent to reason from your answer without seeing the image.',
    '',
    'Guidelines:',
    '- Start with the direct answer.',
    '- Then describe the visual evidence that supports it.',
    '- Quote visible text exactly when relevant.',
    '- Mention uncertainty, occlusion, low resolution, or ambiguity.',
    '- Include nearby or contextual visual details likely relevant to the caller intent.',
    '- Do not give one-word answers unless the question explicitly asks for one.',
    '- Do not invent hidden state, off-screen content, or user intent beyond what is visible.',
    '- When multiple images are provided, refer to each image by ID.',
    '',
    'Selected images:',
    ...attachments.map((image) => `- ${image.id}: ${image.name?.trim() || 'unnamed image'} (${image.mimeType})`),
    '',
    `Question: ${question}`,
  ].join('\n');
}

function buildMediaProbePrompt(
  images: StoredImageProbeAttachment[],
  videos: VideoProbeContext[],
  audios: AudioProbeContext[],
  documents: DocumentProbeContext[],
  question: string,
): string {
  const lines = [
    'You are a multimedia probe for a text-only agent.',
    '',
    'The calling agent cannot see the attached images, video frames, audio, or documents directly. Act as its multimedia probe.',
    'Fully describe the relevant visual parts of the media, then answer the question directly.',
    'Include enough visual detail and evidence for the calling agent to reason from your answer without seeing the media.',
    '',
    'Guidelines:',
    '- Start with the direct answer.',
    '- Then describe the visual or transcript evidence that supports it.',
    '- Quote visible text exactly when relevant.',
    '- Mention uncertainty, occlusion, low resolution, motion gaps, or ambiguity.',
    '- When multiple images or videos are provided, refer to each image ID, video ID, and timestamp.',
    '- Do not invent hidden state, off-screen content, or user intent beyond what is visible or transcribed.',
    '',
  ];

  if (images.length > 0) {
    lines.push(
      'Selected images:',
      ...images.map((image) => `- ${image.id}: ${image.name?.trim() || 'unnamed image'} (${image.mimeType})`),
      '',
    );
  }

  if (videos.length > 0) {
    lines.push('Selected videos:');
    for (const videoContext of videos) {
      const label = videoContext.video.name?.trim() || videoContext.video.path;
      lines.push(`- ${videoContext.video.id}: ${label} (${videoContext.video.mimeType})`);
      for (const frame of videoContext.frames) {
        lines.push(`  - frame at ${(frame.timestampMs / 1000).toFixed(3)}s: ${frame.name} (${frame.mimeType})`);
      }
      if (videoContext.transcript) {
        lines.push(`  - audio transcript: ${videoContext.transcript}`);
      } else if (videoContext.transcriptError) {
        lines.push(`  - audio transcript unavailable: ${videoContext.transcriptError}`);
      } else if (videoContext.video.hasAudio === false) {
        lines.push('  - audio transcript: no audio track was detected');
      }
    }
    lines.push('');
  }

  if (audios.length > 0) {
    lines.push('Selected audio:');
    for (const audioContext of audios) {
      const label = audioContext.audio.name?.trim() || audioContext.audio.path;
      lines.push(`- ${audioContext.audio.id}: ${label} (${audioContext.audio.mimeType})`);
      if (audioContext.transcript) {
        lines.push(`  - transcript: ${audioContext.transcript}`);
      } else if (audioContext.transcriptError) {
        lines.push(`  - transcript unavailable: ${audioContext.transcriptError}`);
      }
    }
    lines.push('');
  }

  if (documents.length > 0) {
    lines.push('Selected documents:');
    for (const documentContext of documents) {
      const label = documentContext.document.name?.trim() || documentContext.document.path;
      lines.push(`- ${documentContext.document.id}: ${label} (${documentContext.document.mimeType})`);
      if (documentContext.text) {
        lines.push(`  - extracted text${documentContext.extractor ? ` via ${documentContext.extractor}` : ''}:`);
        lines.push(documentContext.text);
        if (documentContext.truncated) lines.push('  - note: extracted text was truncated');
      } else if (documentContext.extractionError) {
        lines.push(`  - text extraction unavailable: ${documentContext.extractionError}`);
      }
    }
    lines.push('');
  }

  lines.push(`Question: ${question}`);
  return lines.join('\n');
}

function resultDetails(
  attachments: StoredImageProbeAttachment[],
  available: StoredImageProbeAttachment[],
  model?: string,
  provider?: string,
): ProbeFailureDetails {
  return {
    imageIds: attachments.map((image) => image.id),
    availableImageIds: available.map((image) => image.id),
    imagePaths: attachments.map((image) => image.path),
    ...(model ? { model } : {}),
    ...(provider ? { provider } : {}),
  };
}

async function resolveImageAttachments(sessionId: string, imageIds: string[]) {
  const [availableAttachments, sessionAttachments] = await Promise.all([
    getImageProbeAttachments(sessionId) as Promise<StoredImageProbeAttachment[]>,
    getImageProbeAttachmentsById(sessionId, imageIds) as Promise<StoredImageProbeAttachment[]>,
  ]);
  let attachments = sessionAttachments;
  // If the session ID changed (e.g. after archive/re-live), fall back to scanning
  // all sessions for matching image IDs.
  if (attachments.length !== imageIds.length) {
    const allSessionAttachments = (await getImageProbeAttachmentsByIdFromAnySession(imageIds)) as StoredImageProbeAttachment[];
    if (allSessionAttachments.length > 0) {
      attachments = allSessionAttachments;
    }
  }
  return { availableAttachments, attachments };
}

async function resolveVideoAttachments(sessionId: string, videoIds: string[]) {
  const [availableVideos, sessionVideos] = await Promise.all([
    getVideoProbeAttachments(sessionId) as Promise<StoredVideoProbeAttachment[]>,
    getVideoProbeAttachmentsById(sessionId, videoIds) as Promise<StoredVideoProbeAttachment[]>,
  ]);
  let videos = sessionVideos;
  if (videos.length !== videoIds.length) {
    const allSessionVideos = (await getVideoProbeAttachmentsByIdFromAnySession(videoIds)) as StoredVideoProbeAttachment[];
    if (allSessionVideos.length > 0) {
      videos = allSessionVideos;
    }
  }
  return { availableVideos, videos };
}

async function resolveAudioAttachments(sessionId: string, audioIds: string[]) {
  const [availableAudios, sessionAudios] = await Promise.all([
    getAudioProbeAttachments(sessionId) as Promise<StoredAudioProbeAttachment[]>,
    getAudioProbeAttachmentsById(sessionId, audioIds) as Promise<StoredAudioProbeAttachment[]>,
  ]);
  let audios = sessionAudios;
  if (audios.length !== audioIds.length) {
    const allSessionAudios = (await getAudioProbeAttachmentsByIdFromAnySession(audioIds)) as StoredAudioProbeAttachment[];
    if (allSessionAudios.length > 0) {
      audios = allSessionAudios;
    }
  }
  return { availableAudios, audios };
}

async function resolveDocumentAttachments(sessionId: string, documentIds: string[]) {
  const [availableDocuments, sessionDocuments] = await Promise.all([
    getDocumentProbeAttachments(sessionId) as Promise<StoredDocumentProbeAttachment[]>,
    getDocumentProbeAttachmentsById(sessionId, documentIds) as Promise<StoredDocumentProbeAttachment[]>,
  ]);
  let documents = sessionDocuments;
  if (documents.length !== documentIds.length) {
    const allSessionDocuments = (await getDocumentProbeAttachmentsByIdFromAnySession(documentIds)) as StoredDocumentProbeAttachment[];
    if (allSessionDocuments.length > 0) {
      documents = allSessionDocuments;
    }
  }
  return { availableDocuments, documents };
}

function assertAllRequestedFound(kind: 'image' | 'video' | 'audio' | 'document', requestedIds: string[], foundIds: string[]): void {
  if (requestedIds.length === 0) return;
  if (foundIds.length === 0) throw new Error(`None of the requested ${kind} IDs are available to probe for this conversation.`);
  if (foundIds.length !== requestedIds.length) {
    const found = new Set(foundIds);
    const missing = requestedIds.filter((id) => !found.has(id));
    throw new Error(`Unknown ${kind} ID${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
  }
}

function defaultFrameCount(imageCount: number, videoCount: number): number {
  if (videoCount === 0) return 0;
  const remainingSlots = Math.max(1, 8 - imageCount);
  return Math.max(1, Math.min(videoCount === 1 ? 6 : 4, Math.floor(remainingSlots / videoCount)));
}

async function buildVideoProbeContexts(input: {
  videos: StoredVideoProbeAttachment[];
  startSec?: number;
  endSec?: number;
  frameCount: number;
  includeAudio: boolean;
  language?: string;
}): Promise<VideoProbeContext[]> {
  const contexts: VideoProbeContext[] = [];
  for (const video of input.videos) {
    const frameResult = (await sampleVideoFrames({
      videoId: video.id,
      ...(input.startSec !== undefined ? { startSec: input.startSec } : {}),
      ...(input.endSec !== undefined ? { endSec: input.endSec } : {}),
      count: input.frameCount,
    })) as VideoProbeFrameResult;
    const imageContent = frameResult.content.filter(
      (item): item is { type: 'image'; data: string; mimeType: string } => item.type === 'image',
    );
    const frames = imageContent.map((item, index) => {
      const frameDetails = frameResult.details.frames[index];
      const timestampMs = frameDetails?.timestampMs ?? 0;
      return {
        type: 'video-frame' as const,
        videoId: video.id,
        timestampMs,
        data: item.data,
        mimeType: item.mimeType,
        name: `${video.id} frame ${(timestampMs / 1000).toFixed(3)}s`,
      };
    });

    let transcript: string | undefined;
    let transcriptError: string | undefined;
    if (input.includeAudio && video.hasAudio !== false) {
      try {
        const transcription = (await transcribeVideo({
          videoId: video.id,
          ...(input.startSec !== undefined ? { startSec: input.startSec } : {}),
          ...(input.endSec !== undefined ? { endSec: input.endSec } : {}),
          ...(input.language ? { language: input.language } : {}),
        })) as VideoProbeTranscriptionResult;
        transcript = transcription.text.trim();
      } catch (error) {
        transcriptError = error instanceof Error ? error.message : String(error);
      }
    }

    contexts.push({ video, frames, ...(transcript ? { transcript } : {}), ...(transcriptError ? { transcriptError } : {}) });
  }
  return contexts;
}

async function buildAudioProbeContexts(input: { audios: StoredAudioProbeAttachment[]; language?: string }): Promise<AudioProbeContext[]> {
  const contexts: AudioProbeContext[] = [];
  for (const audio of input.audios) {
    let transcript: string | undefined;
    let transcriptError: string | undefined;
    try {
      const transcription = (await transcribeAudioAttachment({
        audioId: audio.id,
        ...(input.language ? { language: input.language } : {}),
      })) as AudioProbeTranscriptionResult;
      transcript = transcription.text.trim();
    } catch (error) {
      transcriptError = error instanceof Error ? error.message : String(error);
    }
    contexts.push({ audio, ...(transcript ? { transcript } : {}), ...(transcriptError ? { transcriptError } : {}) });
  }
  return contexts;
}

async function buildDocumentProbeContexts(input: { documents: StoredDocumentProbeAttachment[] }): Promise<DocumentProbeContext[]> {
  const contexts: DocumentProbeContext[] = [];
  for (const document of input.documents) {
    let text: string | undefined;
    let extractionError: string | undefined;
    let extractor: string | undefined;
    let truncated: boolean | undefined;
    try {
      const extraction = (await extractDocumentText({ documentId: document.id })) as DocumentProbeExtractionResult;
      text = extraction.text.trim();
      extractor = extraction.details.extractor;
      truncated = extraction.details.truncated;
    } catch (error) {
      extractionError = error instanceof Error ? error.message : String(error);
    }
    contexts.push({
      document,
      ...(text ? { text } : {}),
      ...(extractionError ? { extractionError } : {}),
      ...(extractor ? { extractor } : {}),
      ...(typeof truncated === 'boolean' ? { truncated } : {}),
    });
  }
  return contexts;
}

function buildTextOnlyMediaProbeResult(input: {
  audioContexts: AudioProbeContext[];
  documentContexts: DocumentProbeContext[];
  question: string;
}) {
  const lines = ['Probe media extracted text-only context for the calling agent.', '', `Question: ${input.question}`, ''];
  if (input.audioContexts.length > 0) {
    lines.push('Audio transcripts:');
    for (const context of input.audioContexts) {
      lines.push(`- ${context.audio.id}: ${context.audio.name?.trim() || 'unnamed audio'} (${context.audio.mimeType})`);
      lines.push(context.transcript ? context.transcript : `Transcript unavailable: ${context.transcriptError ?? 'unknown error'}`);
    }
    lines.push('');
  }
  if (input.documentContexts.length > 0) {
    lines.push('Document text:');
    for (const context of input.documentContexts) {
      lines.push(`- ${context.document.id}: ${context.document.name?.trim() || 'unnamed document'} (${context.document.mimeType})`);
      lines.push(context.text ? context.text : `Text extraction unavailable: ${context.extractionError ?? 'unknown error'}`);
      if (context.truncated) lines.push('[Document text was truncated.]');
    }
  }
  const text = lines.join('\n').trim();
  return {
    text,
    content: [{ type: 'text' as const, text }],
    details: {
      audioIds: input.audioContexts.map((context) => context.audio.id),
      documentIds: input.documentContexts.map((context) => context.document.id),
      documentExtractors: input.documentContexts.flatMap((context) =>
        context.extractor ? [{ documentId: context.document.id, extractor: context.extractor }] : [],
      ),
    },
  };
}

export async function probeImage(input: ProbeImageInput, ctx: ExtensionBackendContext) {
  const preferredVisionModel = ctx.toolContext?.preferredVisionModel?.trim();
  if (!preferredVisionModel) throw new Error('Probe image requires a configured preferred vision model.');
  const sessionId = ctx.toolContext?.sessionId ?? ctx.toolContext?.conversationId;
  if (!sessionId) throw new Error('Probe image requires an active conversation.');

  const imageIds = readImageIds(input.imageIds);
  const question = readQuestion(input.question);
  const { availableAttachments, attachments } = await resolveImageAttachments(sessionId, imageIds);
  assertAllRequestedFound(
    'image',
    imageIds,
    attachments.map((attachment) => attachment.id),
  );

  try {
    const result = await runAgentTask(
      {
        cwd: ctx.toolContext?.cwd,
        modelRef: preferredVisionModel,
        prompt: buildProbePrompt(attachments, question),
        images: attachments.map((image) => ({ type: 'image' as const, data: image.data, mimeType: image.mimeType })),
        tools: 'none',
      },
      ctx,
    );
    const text = result.text.trim() || '(vision subagent returned no text)';
    return {
      text,
      content: [{ type: 'text' as const, text }],
      details: resultDetails(attachments, availableAttachments, result.model, result.provider),
    };
  } catch (error) {
    const text = classifyVisionProbeFailure(error, preferredVisionModel);
    return {
      text,
      content: [{ type: 'text' as const, text }],
      details: resultDetails(attachments, availableAttachments),
      isError: true,
    };
  }
}

export async function probeMedia(input: ProbeMediaInput, ctx: ExtensionBackendContext) {
  const preferredVisionModel = ctx.toolContext?.preferredVisionModel?.trim();
  const sessionId = ctx.toolContext?.sessionId ?? ctx.toolContext?.conversationId;
  if (!sessionId) throw new Error('Probe media requires an active conversation.');

  const imageIds = readOptionalImageIds(input.imageIds);
  const videoIds = readOptionalVideoIds(input.videoIds);
  const audioIds = readOptionalAudioIds(input.audioIds);
  const documentIds = readOptionalDocumentIds(input.documentIds);
  if (imageIds.length === 0 && videoIds.length === 0 && audioIds.length === 0 && documentIds.length === 0) {
    throw new Error('Probe media requires at least one image ID, video ID, audio ID, or document ID.');
  }
  const question = readQuestion(input.question);
  const startSec = readOptionalSeconds(input.startSec, 'startSec');
  const endSec = readOptionalSeconds(input.endSec, 'endSec');
  if (startSec !== undefined && endSec !== undefined && endSec < startSec) {
    throw new Error('endSec must be greater than or equal to startSec.');
  }
  const frameCount = readOptionalFrameCount(input.frameCount, defaultFrameCount(imageIds.length, videoIds.length));
  const includeAudio = readOptionalBoolean(input.includeAudio, true);
  const language = readOptionalLanguage(input.language);
  if (imageIds.length + videoIds.length * frameCount > 8) {
    throw new Error('Probe media supports at most 8 total images and sampled video frames per request.');
  }
  if ((imageIds.length > 0 || videoIds.length > 0) && !preferredVisionModel) {
    throw new Error('Probe media requires a configured preferred vision model for images and video frames.');
  }

  const [
    { availableAttachments, attachments },
    { availableVideos, videos },
    { availableAudios, audios },
    { availableDocuments, documents },
  ] = await Promise.all([
    resolveImageAttachments(sessionId, imageIds),
    resolveVideoAttachments(sessionId, videoIds),
    resolveAudioAttachments(sessionId, audioIds),
    resolveDocumentAttachments(sessionId, documentIds),
  ]);
  assertAllRequestedFound(
    'image',
    imageIds,
    attachments.map((attachment) => attachment.id),
  );
  assertAllRequestedFound(
    'video',
    videoIds,
    videos.map((video) => video.id),
  );
  assertAllRequestedFound(
    'audio',
    audioIds,
    audios.map((audio) => audio.id),
  );
  assertAllRequestedFound(
    'document',
    documentIds,
    documents.map((document) => document.id),
  );

  const [videoContexts, audioContexts, documentContexts] = await Promise.all([
    buildVideoProbeContexts({
      videos,
      startSec,
      endSec,
      frameCount,
      includeAudio,
      ...(language ? { language } : {}),
    }),
    buildAudioProbeContexts({ audios, ...(language ? { language } : {}) }),
    buildDocumentProbeContexts({ documents }),
  ]);
  const mediaImages = [
    ...attachments.map((image) => ({ type: 'image' as const, data: image.data, mimeType: image.mimeType })),
    ...videoContexts.flatMap((videoContext) =>
      videoContext.frames.map((frame) => ({ type: 'image' as const, data: frame.data, mimeType: frame.mimeType })),
    ),
  ];

  if (mediaImages.length === 0) {
    return {
      ...buildTextOnlyMediaProbeResult({ audioContexts, documentContexts, question }),
      details: {
        audioIds: audios.map((audio) => audio.id),
        availableAudioIds: availableAudios.map((audio) => audio.id),
        audioPaths: audios.map((audio) => audio.path),
        documentIds: documents.map((document) => document.id),
        availableDocumentIds: availableDocuments.map((document) => document.id),
        documentPaths: documents.map((document) => document.path),
        documentExtractors: documentContexts.flatMap((context) =>
          context.extractor ? [{ documentId: context.document.id, extractor: context.extractor }] : [],
        ),
      },
    };
  }

  try {
    const result = await runAgentTask(
      {
        cwd: ctx.toolContext?.cwd,
        modelRef: preferredVisionModel,
        prompt: buildMediaProbePrompt(attachments, videoContexts, audioContexts, documentContexts, question),
        images: mediaImages,
        tools: 'none',
      },
      ctx,
    );
    const text = result.text.trim() || '(vision subagent returned no text)';
    return {
      text,
      content: [{ type: 'text' as const, text }],
      details: {
        imageIds: attachments.map((image) => image.id),
        availableImageIds: availableAttachments.map((image) => image.id),
        imagePaths: attachments.map((image) => image.path),
        videoIds: videos.map((video) => video.id),
        availableVideoIds: availableVideos.map((video) => video.id),
        videoPaths: videos.map((video) => video.path),
        audioIds: audios.map((audio) => audio.id),
        availableAudioIds: availableAudios.map((audio) => audio.id),
        audioPaths: audios.map((audio) => audio.path),
        documentIds: documents.map((document) => document.id),
        availableDocumentIds: availableDocuments.map((document) => document.id),
        documentPaths: documents.map((document) => document.path),
        sampledFrames: videoContexts.flatMap((videoContext) =>
          videoContext.frames.map((frame) => ({ videoId: frame.videoId, timestampMs: frame.timestampMs, mimeType: frame.mimeType })),
        ),
        ...(result.model ? { model: result.model } : {}),
        ...(result.provider ? { provider: result.provider } : {}),
      },
    };
  } catch (error) {
    const text = classifyVisionProbeFailure(error, preferredVisionModel);
    return {
      text,
      content: [{ type: 'text' as const, text }],
      details: {
        imageIds: attachments.map((image) => image.id),
        availableImageIds: availableAttachments.map((image) => image.id),
        imagePaths: attachments.map((image) => image.path),
        videoIds: videos.map((video) => video.id),
        availableVideoIds: availableVideos.map((video) => video.id),
        videoPaths: videos.map((video) => video.path),
        audioIds: audios.map((audio) => audio.id),
        availableAudioIds: availableAudios.map((audio) => audio.id),
        audioPaths: audios.map((audio) => audio.path),
        documentIds: documents.map((document) => document.id),
        availableDocumentIds: availableDocuments.map((document) => document.id),
        documentPaths: documents.map((document) => document.path),
      },
      isError: true,
    };
  }
}
