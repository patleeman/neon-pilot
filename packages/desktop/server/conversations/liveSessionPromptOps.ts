import type { AgentSession } from '@earendil-works/pi-coding-agent';

import { rememberImageProbeAttachments, type StoredImageProbeAttachment } from '../extensions/imageProbeAttachmentStore.js';
import { rememberVideoProbeAttachments, type StoredVideoProbeAttachment } from '../extensions/videoProbeAttachmentStore.js';
import { readSavedModelPreferences } from '../models/modelPreferences.js';
import { getRuntimeSettingsFilePath } from '../ui/settingsPersistence.js';
import type { PromptImageAttachment, PromptVideoAttachment } from './liveSessionQueue.js';

export interface LiveSessionPromptHost {
  sessionId: string;
  session: AgentSession;
}

export type LiveSessionPromptBehavior = 'steer' | 'followUp' | undefined;

const pendingPromptStartupByEntry = new WeakMap<LiveSessionPromptHost, { key: string; completion: Promise<void> }>();

function buildPromptStartupKey(
  text: string,
  images: PromptImageAttachment[] | undefined,
  videos: PromptVideoAttachment[] | undefined,
): string {
  return JSON.stringify({
    text,
    images: (images ?? []).map((image) => ({
      type: image.type,
      mimeType: image.mimeType,
      name: image.name ?? '',
      data: image.data,
    })),
    videos: (videos ?? []).map((video) => ({
      type: video.type,
      mimeType: video.mimeType,
      name: video.name ?? '',
      path: video.path,
      sizeBytes: video.sizeBytes ?? 0,
    })),
  });
}

function extractMessageText(message: unknown): string {
  const content = (message as { content?: unknown } | undefined)?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '',
      )
      .join('')
      .trim();
  }
  const text = (message as { text?: unknown } | undefined)?.text;
  return typeof text === 'string' ? text.trim() : '';
}

function hasActivePromptText(session: AgentSession, text: string): boolean {
  if (!(session as { isStreaming?: unknown }).isStreaming) {
    return false;
  }
  const messages = (session as { messages?: Array<{ role?: string; content?: unknown; text?: unknown }> }).messages;
  if (!messages || messages.length === 0) {
    return false;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'user') {
      continue;
    }
    return extractMessageText(message) === text.trim();
  }
  return false;
}

export function isLikelyUnsupportedImageInputError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  const mentionsImageInput = normalized.includes('image') || normalized.includes('vision') || normalized.includes('multimodal');

  const indicatesUnsupported =
    normalized.includes('not support') ||
    normalized.includes('unsupported') ||
    normalized.includes('not enabled') ||
    normalized.includes('text-only') ||
    normalized.includes('text only') ||
    normalized.includes('invalid image') ||
    normalized.includes('image input');

  return mentionsImageInput && indicatesUnsupported;
}

/** Ensure the last assistant message in agent state has usage data.
 *  pi-coding-agent's _checkCompaction() crashes via calculateContextTokens(undefined)
 *  when an assistant message with a valid stopReason lacks usage (e.g. imported sessions). */
function sealLastAssistantUsage(session: AgentSession): void {
  const msgs = (session as { messages?: Array<{ role: string; stopReason?: string; usage?: unknown }> }).messages;
  if (!msgs || msgs.length === 0) return;
  const last = msgs[msgs.length - 1];
  if (last?.role === 'assistant' && last.stopReason !== 'aborted' && last.stopReason !== 'error' && !last.usage) {
    (last as { usage: Record<string, unknown> }).usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };
  }
}

function liveSessionModelAcceptsImages(model: unknown): boolean {
  const input = (model as { input?: unknown } | undefined)?.input;
  return Array.isArray(input) && input.includes('image');
}

function getPreferredVisionModel(): string {
  return readSavedModelPreferences(getRuntimeSettingsFilePath()).currentVisionModel;
}

function appendImageProbeNotice(text: string, images: StoredImageProbeAttachment[], preferredVisionModel: string): string {
  const names = images.map((image) => `- ${image.id}: ${image.name?.trim() || 'unnamed image'} (${image.mimeType})`).join('\n');
  const instruction = preferredVisionModel
    ? 'Use the probe_image tool with explicit imageIds to inspect these image(s) before answering image-specific questions.'
    : 'No preferred vision model is configured, so image probing is unavailable. Ask the user to configure a preferred vision model before analyzing these images.';
  const notice = [
    '[Image attachments received]',
    `The user attached ${images.length} image${images.length === 1 ? '' : 's'}, but the current model cannot receive image input directly.`,
    instruction,
    names ? `Attached image IDs:\n${names}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `${text.trim()}\n\n${notice}`.trim();
}

function formatVideoDuration(durationMs: number | undefined): string {
  if (!Number.isFinite(durationMs)) return 'duration unknown';
  return `${(Number(durationMs) / 1000).toFixed(3)}s`;
}

function formatVideoResolution(video: StoredVideoProbeAttachment): string {
  return video.width && video.height ? `${video.width}x${video.height}` : 'resolution unknown';
}

function appendVideoProbeNotice(text: string, videos: StoredVideoProbeAttachment[]): string {
  if (videos.length === 0) return text;
  const names = videos
    .map((video) => {
      const label = video.name?.trim() || 'unnamed video';
      const audio = video.hasAudio === true ? 'audio track' : video.hasAudio === false ? 'no detected audio track' : 'audio unknown';
      return `- ${video.id}: ${label} (${video.mimeType}, ${formatVideoDuration(video.durationMs)}, ${formatVideoResolution(video)}, ${audio})`;
    })
    .join('\n');
  const notice = [
    '[Video attachments received]',
    `The user attached ${videos.length} local video${videos.length === 1 ? '' : 's'}. You cannot view videos directly.`,
    'Use extract_video_frame or sample_video_frames to inspect visuals. Use transcribe_video to inspect speech/audio. Transcript segment timestamps are absolute to the original video.',
    names ? `Attached video IDs:\n${names}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `${text.trim()}\n\n${notice}`.trim();
}

export async function runPromptOnLiveEntry<TEntry extends LiveSessionPromptHost>(
  entry: TEntry,
  text: string,
  behavior: LiveSessionPromptBehavior,
  images: PromptImageAttachment[] | undefined,
  videos: PromptVideoAttachment[] | undefined,
  callbacks: {
    repairLiveSessionTranscriptTail: (sessionId: string) => unknown;
    broadcastQueueState: (entry: TEntry, force?: boolean) => void;
  },
): Promise<void> {
  const { session } = entry;
  const hasImages = Boolean(images && images.length > 0);
  const hasVideos = Boolean(videos && videos.length > 0);
  const shouldUseTextOnlyImageHandling = hasImages && !liveSessionModelAcceptsImages(session.model);
  const preferredVisionModel = shouldUseTextOnlyImageHandling ? getPreferredVisionModel() : '';
  const storedImages = hasImages && images ? rememberImageProbeAttachments(entry.sessionId, images) : [];
  const storedVideos = hasVideos && videos ? await rememberVideoProbeAttachments(entry.sessionId, videos) : [];
  const imagePromptText = shouldUseTextOnlyImageHandling ? appendImageProbeNotice(text, storedImages, preferredVisionModel) : text;
  const promptText = appendVideoProbeNotice(imagePromptText, storedVideos);

  if (behavior === undefined || !session.isStreaming) {
    callbacks.repairLiveSessionTranscriptTail(entry.sessionId);
  }

  // Guard: pi-coding-agent's _checkCompaction() crashes when the last
  // assistant message has stopReason but no usage. Pre-fill a zero usage
  // so calculateContextTokens(undefined) doesn't throw.
  sealLastAssistantUsage(session);

  const runPrompt = async (allowImages: boolean): Promise<void> => {
    if (behavior === 'steer') {
      await (allowImages && hasImages ? session.steer(promptText, images) : session.steer(promptText));
      callbacks.broadcastQueueState(entry, true);
      return;
    }

    if (behavior === 'followUp') {
      await (allowImages && hasImages ? session.followUp(promptText, images) : session.followUp(promptText));
      callbacks.broadcastQueueState(entry, true);
      return;
    }

    await (allowImages && hasImages ? session.prompt(promptText, { images }) : session.prompt(promptText));
  };

  try {
    await runPrompt(!shouldUseTextOnlyImageHandling);
  } catch (error) {
    if (!hasImages || !isLikelyUnsupportedImageInputError(error)) {
      throw error;
    }

    await runPrompt(false);
  }
}

export async function submitPromptOnLiveEntry<TEntry extends LiveSessionPromptHost>(
  entry: TEntry,
  text: string,
  behavior: LiveSessionPromptBehavior,
  images: PromptImageAttachment[] | undefined,
  videos: PromptVideoAttachment[] | undefined,
  callbacks: {
    runPromptOnLiveEntry: (
      entry: TEntry,
      text: string,
      behavior: LiveSessionPromptBehavior,
      images?: PromptImageAttachment[],
      videos?: PromptVideoAttachment[],
    ) => Promise<void>;
  },
): Promise<{ acceptedAs: 'started' | 'queued'; completion: Promise<void> }> {
  if (
    behavior === 'followUp' &&
    (!images || images.length === 0) &&
    (!videos || videos.length === 0) &&
    hasActivePromptText(entry.session, text)
  ) {
    return {
      acceptedAs: 'queued',
      completion: Promise.resolve(),
    };
  }

  if (behavior === 'steer' || behavior === 'followUp') {
    await callbacks.runPromptOnLiveEntry(entry, text, behavior, images, videos);
    return {
      acceptedAs: 'queued',
      completion: Promise.resolve(),
    };
  }

  const startupKey = buildPromptStartupKey(text, images, videos);
  const pendingStartup = pendingPromptStartupByEntry.get(entry);
  if (pendingStartup?.key === startupKey) {
    return {
      acceptedAs: 'started',
      completion: pendingStartup.completion,
    };
  }
  if ((!images || images.length === 0) && (!videos || videos.length === 0) && hasActivePromptText(entry.session, text)) {
    return {
      acceptedAs: 'started',
      completion: Promise.resolve(),
    };
  }

  const completion = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      void callbacks.runPromptOnLiveEntry(entry, text, behavior, images, videos).then(resolve, reject);
    }, 250);
    timer.unref?.();
  });
  void completion.catch(() => {
    // Accepted prompts expose their eventual failure through the transcript and
    // higher-level callers also attach their own completion logging. Keep this
    // detached startup from becoming an unhandled rejection.
  });
  pendingPromptStartupByEntry.set(entry, { key: startupKey, completion });
  const clearPendingStartup = () => {
    if (pendingPromptStartupByEntry.get(entry)?.completion === completion) {
      pendingPromptStartupByEntry.delete(entry);
    }
  };
  void completion.then(clearPendingStartup, clearPendingStartup);

  return {
    acceptedAs: 'started',
    completion,
  };
}
