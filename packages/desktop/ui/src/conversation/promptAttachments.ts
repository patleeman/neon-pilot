import {
  buildDrawingFileNames,
  inferDrawingTitleFromFileName,
  loadExcalidrawSceneFromBlob,
  serializeExcalidrawScene,
} from '../content/excalidrawUtils';
import { getDesktopBridge } from '../desktop/desktopBridge';
import type { PromptAttachmentRefInput, PromptImageInput, PromptVideoInput } from '../shared/types';
import type { DraftConversationDrawingAttachment } from './draftConversation';

export type ComposerDrawingAttachment = DraftConversationDrawingAttachment;

export interface ComposerImageAttachment extends PromptImageInput {
  localId: string;
  size: number;
}

export interface ComposerVideoAttachment extends PromptVideoInput {
  localId: string;
  size: number;
}

const MAX_PROMPT_IMAGE_DIMENSION = 2000;
const MAX_PROMPT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_COMPOSER_DRAWING_REVISION = 1_000_000;

function readBlobAsDataUrl(blob: Blob, label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Failed to read ${label}`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${label}`));
    reader.readAsDataURL(blob);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return readBlobAsDataUrl(file, file.name);
}

function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image.'));
    image.src = dataUrl;
  });
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return loadImageFromDataUrl(await readBlobAsDataUrl(blob, 'image attachment'));
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to decode image.'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image.'));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function shouldAttachOriginalPromptImage(file: File, image: HTMLImageElement): boolean {
  return (
    file.size <= MAX_PROMPT_IMAGE_BYTES &&
    image.naturalWidth <= MAX_PROMPT_IMAGE_DIMENSION &&
    image.naturalHeight <= MAX_PROMPT_IMAGE_DIMENSION
  );
}

async function encodePromptImageCanvas(canvas: HTMLCanvasElement, preferredMimeType: string): Promise<Blob> {
  const outputMimeType = normalizePromptImageMimeType(preferredMimeType);
  const outputBlob = await canvasToBlob(canvas, outputMimeType, outputMimeType === 'image/png' ? undefined : 0.9);
  if (outputBlob.size > 0 && outputBlob.size <= MAX_PROMPT_IMAGE_BYTES) {
    return outputBlob;
  }

  if (outputMimeType !== 'image/jpeg') {
    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    if (jpegBlob.size > 0 && jpegBlob.size <= MAX_PROMPT_IMAGE_BYTES) {
      return jpegBlob;
    }
  }

  const compactJpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.78);
  if (compactJpegBlob.size > 0 && compactJpegBlob.size <= MAX_PROMPT_IMAGE_BYTES) {
    return compactJpegBlob;
  }

  throw new Error('Image attachment is too large after resizing.');
}

function normalizePromptImageMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  if (normalized === 'image/webp') {
    return 'image/webp';
  }

  return 'image/png';
}

export function constrainPromptImageDimensions(
  width: number,
  height: number,
  maxDimension = MAX_PROMPT_IMAGE_DIMENSION,
): { width: number; height: number } {
  const safeMaxDimension =
    Number.isSafeInteger(maxDimension) && maxDimension > 0
      ? Math.min(MAX_PROMPT_IMAGE_DIMENSION, maxDimension)
      : MAX_PROMPT_IMAGE_DIMENSION;

  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    return {
      width: Number.isSafeInteger(width) ? Math.max(1, width) : 1,
      height: Number.isSafeInteger(height) ? Math.max(1, height) : 1,
    };
  }

  const longSide = Math.max(width, height);
  if (longSide <= safeMaxDimension) {
    return {
      width,
      height,
    };
  }

  const scale = safeMaxDimension / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function preparePromptImage(file: File): Promise<ComposerImageAttachment> {
  const mimeType = file.type || 'image/png';
  const outputMimeType = normalizePromptImageMimeType(mimeType);
  const localId = createComposerImageLocalId();

  try {
    const image = await loadImageFromBlob(file);
    const targetSize = constrainPromptImageDimensions(image.naturalWidth, image.naturalHeight);
    if (shouldAttachOriginalPromptImage(file, image)) {
      const previewUrl = await readFileAsDataUrl(file);
      return {
        localId,
        name: file.name,
        mimeType,
        data: dataUrlToBase64(previewUrl),
        previewUrl,
        size: file.size,
      } satisfies ComposerImageAttachment;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to resize image.');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, targetSize.width, targetSize.height);

    const outputBlob = await encodePromptImageCanvas(canvas, outputMimeType);
    const resizedPreviewUrl = await readBlobAsDataUrl(outputBlob, file.name);

    return {
      localId,
      name: file.name,
      mimeType: outputBlob.type || outputMimeType,
      data: dataUrlToBase64(resizedPreviewUrl),
      previewUrl: resizedPreviewUrl,
      size: outputBlob.size || file.size,
    } satisfies ComposerImageAttachment;
  } catch (error) {
    if (file.size > MAX_PROMPT_IMAGE_BYTES) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not resize image attachment "${file.name || 'Unnamed file'}": ${message}`);
    }

    let previewUrl: string;
    try {
      previewUrl = await readFileAsDataUrl(file);
    } catch (readError) {
      const message = readError instanceof Error ? readError.message : String(readError);
      throw new Error(`Could not read image attachment "${file.name || 'Unnamed file'}": ${message}`);
    }

    return {
      localId,
      name: file.name,
      mimeType,
      data: dataUrlToBase64(previewUrl),
      previewUrl,
      size: file.size,
    } satisfies ComposerImageAttachment;
  }
}

function isPromptVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) {
    return true;
  }
  return /\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg)$/i.test(file.name.trim());
}

function readLocalFilePath(file: File): string {
  const desktopBridge = getDesktopBridge();
  let candidate: unknown;

  try {
    candidate = desktopBridge?.getPathForFile?.(file);
  } catch {
    candidate = undefined;
  }

  if (typeof candidate !== 'string' || !candidate.trim()) {
    candidate = (file as File & { path?: unknown }).path;
  }

  if (typeof candidate !== 'string' || !candidate.trim()) {
    throw new Error(
      `Video attachment "${file.name || 'Unnamed file'}" needs a local file path. Attach a file from the desktop picker so Neon Pilot can probe it locally.`,
    );
  }
  return candidate.trim();
}

function normalizePromptVideoMimeType(file: File): string {
  if (file.type.startsWith('video/')) {
    return file.type;
  }
  return 'video/*';
}

function preparePromptVideo(file: File): ComposerVideoAttachment {
  return {
    localId: createComposerVideoLocalId(),
    name: file.name,
    mimeType: normalizePromptVideoMimeType(file),
    path: readLocalFilePath(file),
    size: file.size,
    sizeBytes: file.size,
  };
}

export function fileExtensionForMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'image/jpeg') {
    return 'jpg';
  }

  const [, subtype] = normalized.split('/');
  return subtype || 'png';
}

export function base64ToFile(data: string, mimeType: string, name: string): File {
  const decoded = globalThis.atob(data);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return new File([bytes], name, { type: mimeType });
}

function safeBase64ToFile(data: string, mimeType: string, name: string): File | null {
  const normalizedMimeType = mimeType.trim();
  if (!data.trim() || !normalizedMimeType.toLowerCase().startsWith('image/')) {
    return null;
  }

  try {
    return base64ToFile(data.trim(), normalizedMimeType, name);
  } catch {
    return null;
  }
}

export function screenshotCaptureImageToFile(image: { data: string; mimeType: string; name?: string | null }): File {
  return base64ToFile(image.data, image.mimeType, image.name?.trim() || 'Screenshot.png');
}

function buildComposerImageAttachment(image: PromptImageInput, name: string): ComposerImageAttachment | null {
  const normalizedMimeType = image.mimeType.trim();
  const file = safeBase64ToFile(image.data, normalizedMimeType, name);
  if (!file) {
    return null;
  }

  return {
    localId: createComposerImageLocalId(),
    name,
    mimeType: normalizedMimeType,
    data: image.data,
    previewUrl: image.previewUrl ?? `data:${normalizedMimeType};base64,${image.data}`,
    size: file.size,
  };
}

export function restoreQueuedImageFiles(
  images: PromptImageInput[] | undefined | null,
  behavior: 'steer' | 'followUp',
  queueIndex: number,
): ComposerImageAttachment[] {
  const normalizedImages = Array.isArray(images) ? images : [];
  return normalizedImages.flatMap((image, imageIndex) => {
    const extension = fileExtensionForMimeType(image.mimeType);
    const name = image.name?.trim() || `queued-${behavior}-${queueIndex + 1}-${imageIndex + 1}.${extension}`;
    const attachment = buildComposerImageAttachment(image, name);
    return attachment ? [attachment] : [];
  });
}

export function restoreComposerImageFiles(
  images: PromptImageInput[] | undefined | null,
  fallbackNamePrefix: string,
): ComposerImageAttachment[] {
  const normalizedImages = Array.isArray(images) ? images : [];
  return normalizedImages.flatMap((image, imageIndex) => {
    const extension = fileExtensionForMimeType(image.mimeType);
    const name = image.name?.trim() || `${fallbackNamePrefix}-${imageIndex + 1}.${extension}`;
    const attachment = buildComposerImageAttachment(image, name);
    return attachment ? [attachment] : [];
  });
}

export function buildPromptImages(attachments: ComposerImageAttachment[]): PromptImageInput[] {
  return attachments.map(({ name, mimeType, data, previewUrl }) => ({
    ...(name ? { name } : {}),
    mimeType,
    data,
    ...(previewUrl ? { previewUrl } : {}),
  }));
}

export function buildPromptVideos(attachments: ComposerVideoAttachment[]): PromptVideoInput[] {
  return attachments.map(({ name, mimeType, path, sizeBytes }) => ({
    ...(name ? { name } : {}),
    mimeType,
    path,
    ...(Number.isSafeInteger(sizeBytes) && Number(sizeBytes) >= 0 ? { sizeBytes } : {}),
  }));
}

export interface PreparedComposerFiles {
  imageAttachments: ComposerImageAttachment[];
  videoAttachments: ComposerVideoAttachment[];
  drawingAttachments: ComposerDrawingAttachment[];
  rejectedFileNames: string[];
  drawingParseFailures: Array<{ fileName: string; message: string }>;
  imageReadFailures: Array<{ fileName: string; message: string }>;
  videoReadFailures: Array<{ fileName: string; message: string }>;
}

export interface ComposerFilePreparationNotice {
  tone: 'accent' | 'danger';
  text: string;
  durationMs?: number;
}

export type ComposerTransferFileList = Iterable<File> | ArrayLike<File> | null | undefined;

export function readComposerTransferFiles(files: ComposerTransferFileList): File[] {
  return files ? Array.from(files) : [];
}

export function hasComposerTransferFiles(files: ComposerTransferFileList): boolean {
  return readComposerTransferFiles(files).length > 0;
}

export async function prepareComposerFiles(
  files: File[],
  buildDrawing: (file: File) => Promise<ComposerDrawingAttachment> = buildComposerDrawingFromFile,
  buildImage: (file: File) => Promise<ComposerImageAttachment> = preparePromptImage,
  buildVideo: (file: File) => ComposerVideoAttachment = preparePromptVideo,
): Promise<PreparedComposerFiles> {
  const imageAttachments: ComposerImageAttachment[] = [];
  const videoAttachments: ComposerVideoAttachment[] = [];
  const drawingAttachments: ComposerDrawingAttachment[] = [];
  const rejectedFileNames: string[] = [];
  const drawingParseFailures: PreparedComposerFiles['drawingParseFailures'] = [];
  const imageReadFailures: PreparedComposerFiles['imageReadFailures'] = [];
  const videoReadFailures: PreparedComposerFiles['videoReadFailures'] = [];

  for (const file of files) {
    if (isPotentialExcalidrawFile(file)) {
      try {
        const drawing = await buildDrawing(file);
        drawingAttachments.push(drawing);
        continue;
      } catch (error) {
        if (file.name.trim().toLowerCase().endsWith('.excalidraw')) {
          drawingParseFailures.push({
            fileName: file.name,
            message: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }
    }

    if (file.type.startsWith('image/')) {
      try {
        imageAttachments.push(await buildImage(file));
      } catch (error) {
        imageReadFailures.push({
          fileName: file.name || 'Unnamed file',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    if (isPromptVideoFile(file)) {
      try {
        videoAttachments.push(buildVideo(file));
      } catch (error) {
        videoReadFailures.push({
          fileName: file.name || 'Unnamed file',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    rejectedFileNames.push(file.name || 'Unnamed file');
  }

  return {
    imageAttachments,
    videoAttachments,
    drawingAttachments,
    rejectedFileNames,
    drawingParseFailures,
    imageReadFailures,
    videoReadFailures,
  };
}

export function buildComposerFilePreparationNotices(
  prepared: Partial<
    Pick<
      PreparedComposerFiles,
      'drawingAttachments' | 'drawingParseFailures' | 'imageReadFailures' | 'videoAttachments' | 'videoReadFailures' | 'rejectedFileNames'
    >
  >,
): ComposerFilePreparationNotice[] {
  const notices: ComposerFilePreparationNotice[] = [];
  const drawingAttachments = prepared.drawingAttachments ?? [];
  const videoAttachments = prepared.videoAttachments ?? [];
  const drawingParseFailures = prepared.drawingParseFailures ?? [];
  const imageReadFailures = prepared.imageReadFailures ?? [];
  const videoReadFailures = prepared.videoReadFailures ?? [];
  const rejectedFileNames = prepared.rejectedFileNames ?? [];

  if (drawingAttachments.length > 0) {
    notices.push({
      tone: 'accent',
      text: `Attached ${drawingAttachments.length} drawing${drawingAttachments.length === 1 ? '' : 's'}.`,
    });
  }

  if (videoAttachments.length > 0) {
    notices.push({
      tone: 'accent',
      text: `Attached ${videoAttachments.length} video${videoAttachments.length === 1 ? '' : 's'}.`,
    });
  }

  for (const failure of drawingParseFailures) {
    notices.push({
      tone: 'danger',
      text: `Failed to parse ${failure.fileName}: ${failure.message}`,
      durationMs: 4000,
    });
  }

  for (const failure of imageReadFailures) {
    notices.push({
      tone: 'danger',
      text: failure.message.includes(failure.fileName) ? failure.message : `Could not read ${failure.fileName}: ${failure.message}`,
      durationMs: 4000,
    });
  }

  for (const failure of videoReadFailures) {
    notices.push({
      tone: 'danger',
      text: failure.message.includes(failure.fileName) ? failure.message : `Could not attach ${failure.fileName}: ${failure.message}`,
      durationMs: 4000,
    });
  }

  if (rejectedFileNames.length > 0) {
    const preview = rejectedFileNames.slice(0, 3).join(', ');
    const suffix = rejectedFileNames.length > 3 ? `, +${rejectedFileNames.length - 3} more` : '';
    notices.push({
      tone: 'danger',
      text: `Unsupported file type: ${preview}${suffix}`,
      durationMs: 4000,
    });
  }

  return notices;
}

export function removeComposerImageFileAtIndex(attachments: ComposerImageAttachment[], indexToRemove: number): ComposerImageAttachment[] {
  return attachments.filter((_, index) => index !== indexToRemove);
}

export function removeComposerVideoFileAtIndex(attachments: ComposerVideoAttachment[], indexToRemove: number): ComposerVideoAttachment[] {
  return attachments.filter((_, index) => index !== indexToRemove);
}

export function removeComposerDrawingAttachmentByLocalId(
  attachments: ComposerDrawingAttachment[],
  localId: string,
): ComposerDrawingAttachment[] {
  return attachments.filter((attachment) => attachment.localId !== localId);
}

function createComposerImageLocalId(): string {
  return `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createComposerVideoLocalId(): string {
  return `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createComposerDrawingLocalId(): string {
  return `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isPotentialExcalidrawFile(file: File): boolean {
  const lowerName = file.name.trim().toLowerCase();
  if (lowerName.endsWith('.excalidraw')) {
    return true;
  }

  if (lowerName.endsWith('.png')) {
    return true;
  }

  return file.type === 'application/json' || file.type === 'application/vnd.excalidraw+json';
}

export function drawingAttachmentToPromptImage(attachment: ComposerDrawingAttachment): PromptImageInput {
  return {
    name: `${attachment.title}.png`,
    mimeType: attachment.previewMimeType,
    data: attachment.previewData,
    previewUrl: attachment.previewUrl,
  };
}

export function drawingAttachmentToPromptRef(attachment: ComposerDrawingAttachment): PromptAttachmentRefInput | null {
  const attachmentId = attachment.attachmentId?.trim();
  if (!attachmentId) {
    return null;
  }

  const revision =
    typeof attachment.revision === 'number'
      ? attachment.revision
      : typeof attachment.revision === 'string' && /^\d+$/.test(attachment.revision.trim())
        ? Number.parseInt(attachment.revision.trim(), 10)
        : undefined;

  return {
    attachmentId,
    ...(Number.isSafeInteger(revision) && Number(revision) > 0 && Number(revision) <= MAX_COMPOSER_DRAWING_REVISION
      ? { revision: Number(revision) }
      : {}),
  };
}

async function buildComposerDrawingFromFile(file: File): Promise<ComposerDrawingAttachment> {
  const scene = await loadExcalidrawSceneFromBlob(file);
  const serialized = await serializeExcalidrawScene(scene);
  const title = inferDrawingTitleFromFileName(file.name);
  const fileNames = buildDrawingFileNames(title);

  return {
    localId: createComposerDrawingLocalId(),
    title,
    sourceData: serialized.sourceData,
    sourceMimeType: serialized.sourceMimeType,
    sourceName: fileNames.sourceName,
    previewData: serialized.previewData,
    previewMimeType: serialized.previewMimeType,
    previewName: fileNames.previewName,
    previewUrl: serialized.previewUrl,
    scene,
    dirty: true,
  };
}
