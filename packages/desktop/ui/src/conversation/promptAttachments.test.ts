import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  base64ToFile,
  buildComposerFilePreparationNotices,
  buildPromptAudios,
  buildPromptDocuments,
  type ComposerDrawingAttachment,
  type ComposerImageAttachment,
  type ComposerVideoAttachment,
  constrainPromptImageDimensions,
  drawingAttachmentToPromptImage,
  drawingAttachmentToPromptRef,
  fileExtensionForMimeType,
  hasComposerTransferFiles,
  isPotentialExcalidrawFile,
  prepareComposerFiles,
  readComposerTransferFiles,
  removeComposerAudioFileAtIndex,
  removeComposerDocumentFileAtIndex,
  removeComposerDrawingAttachmentByLocalId,
  removeComposerImageFileAtIndex,
  removeComposerVideoFileAtIndex,
  restoreComposerImageFiles,
  restoreQueuedImageFiles,
  screenshotCaptureImageToFile,
} from './promptAttachments.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (typeof window !== 'undefined') {
    Reflect.deleteProperty(window, 'neonPilotDesktop');
  }
});

describe('promptAttachments', () => {
  it('constrains prompt images to the provider long-side limit', () => {
    expect(constrainPromptImageDimensions(1600, 900)).toEqual({ width: 1600, height: 900 });
    expect(constrainPromptImageDimensions(4000, 1000)).toEqual({ width: 2000, height: 500 });
    expect(constrainPromptImageDimensions(1200, 3600)).toEqual({ width: 667, height: 2000 });
    expect(constrainPromptImageDimensions(Number.MAX_SAFE_INTEGER + 1, 900)).toEqual({ width: 1, height: 900 });
    expect(constrainPromptImageDimensions(4000, 1000, Number.NaN)).toEqual({ width: 2000, height: 500 });
    expect(constrainPromptImageDimensions(4000, 1000, Number.MAX_SAFE_INTEGER)).toEqual({ width: 2000, height: 500 });
  });

  it('does not round fractional prompt image dimensions', () => {
    expect(constrainPromptImageDimensions(1600.5, 900)).toEqual({ width: 1, height: 900 });
    expect(constrainPromptImageDimensions(1600, 900.5)).toEqual({ width: 1600, height: 1 });
  });

  it('restores queued and composer images with stable fallback names', async () => {
    const restoredQueued = restoreQueuedImageFiles(
      [{ data: globalThis.btoa('hello'), mimeType: 'image/jpeg', previewUrl: 'data:image/jpeg;base64,aGVsbG8=' }],
      'followUp',
      1,
    );
    const restoredComposer = restoreComposerImageFiles(
      [{ data: globalThis.btoa('hello'), mimeType: 'image/png', previewUrl: 'data:image/png;base64,aGVsbG8=' }],
      'draft-image',
    );

    expect(restoredQueued[0]?.name).toBe('queued-followUp-2-1.jpg');
    expect(restoredQueued[0]?.mimeType).toBe('image/jpeg');
    expect(restoredQueued[0]?.data).toBe(globalThis.btoa('hello'));
    expect(restoredComposer[0]?.name).toBe('draft-image-1.png');
  });

  it('skips malformed restored image payloads instead of throwing', async () => {
    expect(
      restoreQueuedImageFiles(
        [
          { data: '%%%', mimeType: 'image/png' },
          { data: globalThis.btoa('hello'), mimeType: 'text/plain' },
          { data: globalThis.btoa('hello'), mimeType: 'image/png' },
        ],
        'steer',
        0,
      ),
    ).toHaveLength(1);

    expect(
      restoreComposerImageFiles(
        [
          { data: '   ', mimeType: 'image/png' },
          { data: globalThis.btoa('hello'), mimeType: 'text/plain' },
          { data: globalThis.btoa('hello'), mimeType: 'image/png' },
        ],
        'draft-image',
      ),
    ).toHaveLength(1);
  });

  it('detects Excalidraw-compatible files before parsing them', () => {
    expect(isPotentialExcalidrawFile(new File(['{}'], 'scene.excalidraw', { type: '' }))).toBe(true);
    expect(isPotentialExcalidrawFile(new File(['{}'], 'scene.png', { type: 'image/png' }))).toBe(true);
    expect(isPotentialExcalidrawFile(new File(['{}'], 'scene.json', { type: 'application/json' }))).toBe(true);
    expect(isPotentialExcalidrawFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('prepares mixed composer files into images, drawings, parse failures, and rejects', async () => {
    const drawing = {
      localId: 'drawing-1',
      title: 'Sketch',
      sourceData: '{}',
      sourceMimeType: 'application/vnd.excalidraw+json',
      sourceName: 'Sketch.excalidraw',
      previewData: 'abc',
      previewMimeType: 'image/png',
      previewName: 'Sketch.png',
      previewUrl: 'data:image/png;base64,abc',
      dirty: true,
    } as ComposerDrawingAttachment;
    const image = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    const imageAttachment = {
      localId: 'image-1',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      data: globalThis.btoa('image'),
      previewUrl: 'data:image/jpeg;base64,aW1hZ2U=',
      size: 5,
    } satisfies ComposerImageAttachment;
    const parsedDrawing = new File(['{}'], 'sketch.excalidraw', { type: '' });
    const brokenDrawing = new File(['bad'], 'broken.excalidraw', { type: '' });
    const video = new File(['video'], 'screen.mp4', { type: 'video/mp4' });
    const videoAttachment = {
      localId: 'video-1',
      name: 'screen.mp4',
      mimeType: 'video/mp4',
      path: '/tmp/screen.mp4',
      size: 5,
      sizeBytes: 5,
    } satisfies ComposerVideoAttachment;
    const rejected = new File(['archive'], 'archive.zip', { type: 'application/zip' });

    const result = await prepareComposerFiles(
      [image, video, parsedDrawing, brokenDrawing, rejected],
      async (file) => {
        if (file.name === 'broken.excalidraw') {
          throw new Error('Invalid scene');
        }
        return drawing;
      },
      async () => imageAttachment,
      () => videoAttachment,
    );

    expect(result.imageAttachments).toEqual([imageAttachment]);
    expect(result.videoAttachments).toEqual([videoAttachment]);
    expect(result.drawingAttachments).toEqual([drawing]);
    expect(result.drawingParseFailures).toEqual([{ fileName: 'broken.excalidraw', message: 'Invalid scene' }]);
    expect(result.rejectedFileNames).toEqual(['archive.zip']);
    expect(result.imageReadFailures).toEqual([]);
  });

  it('uses the desktop bridge to resolve local video file paths', async () => {
    const getPathForFile = vi.fn(() => '/tmp/from-bridge.mp4');
    vi.stubGlobal('window', { neonPilotDesktop: { getPathForFile } });
    const video = new File(['video'], 'screen.mp4', { type: 'video/mp4' });

    const result = await prepareComposerFiles([video]);

    expect(getPathForFile).toHaveBeenCalledWith(video);
    expect(result.videoAttachments).toEqual([
      expect.objectContaining({
        name: 'screen.mp4',
        mimeType: 'video/mp4',
        path: '/tmp/from-bridge.mp4',
        size: 5,
        sizeBytes: 5,
      }),
    ]);
    expect(result.videoReadFailures).toEqual([]);
  });

  it('falls back to legacy file.path for local video file paths', async () => {
    const video = new File(['video'], 'clip.mov', { type: '' });
    Object.defineProperty(video, 'path', { value: '/tmp/legacy.mov' });

    const result = await prepareComposerFiles([video]);

    expect(result.videoAttachments).toEqual([
      expect.objectContaining({
        name: 'clip.mov',
        mimeType: 'video/*',
        path: '/tmp/legacy.mov',
        size: 5,
        sizeBytes: 5,
      }),
    ]);
    expect(result.videoReadFailures).toEqual([]);
  });

  it('prepares fixture-like audio and document files into prompt attachments', async () => {
    const audio = new File([new Uint8Array([0xff, 0xf3, 0x18, 0xc4])], 'voice-note.mp3', { type: 'audio/mpeg' });
    const pdf = new File(['%PDF-1.7\nfixture pdf\n%%EOF'], 'brief.pdf', { type: 'application/pdf' });
    const markdown = new File(['# Fixture\n\nHello probe.'], 'notes.md', { type: '' });
    Object.defineProperty(audio, 'path', { value: '/tmp/fixtures/voice-note.mp3' });
    Object.defineProperty(pdf, 'path', { value: '/tmp/fixtures/brief.pdf' });
    Object.defineProperty(markdown, 'path', { value: '/tmp/fixtures/notes.md' });

    const result = await prepareComposerFiles([audio, pdf, markdown]);

    expect(result.audioReadFailures).toEqual([]);
    expect(result.documentReadFailures).toEqual([]);
    expect(result.rejectedFileNames).toEqual([]);
    expect(result.audioAttachments).toEqual([
      expect.objectContaining({
        name: 'voice-note.mp3',
        mimeType: 'audio/mpeg',
        path: '/tmp/fixtures/voice-note.mp3',
        size: 4,
        sizeBytes: 4,
      }),
    ]);
    expect(result.documentAttachments).toEqual([
      expect.objectContaining({
        name: 'brief.pdf',
        mimeType: 'application/pdf',
        path: '/tmp/fixtures/brief.pdf',
        sizeBytes: pdf.size,
      }),
      expect.objectContaining({
        name: 'notes.md',
        mimeType: 'text/markdown',
        path: '/tmp/fixtures/notes.md',
        sizeBytes: markdown.size,
      }),
    ]);
    expect(buildPromptAudios(result.audioAttachments)).toEqual([
      {
        name: 'voice-note.mp3',
        mimeType: 'audio/mpeg',
        path: '/tmp/fixtures/voice-note.mp3',
        sizeBytes: 4,
      },
    ]);
    expect(buildPromptDocuments(result.documentAttachments)).toEqual([
      {
        name: 'brief.pdf',
        mimeType: 'application/pdf',
        path: '/tmp/fixtures/brief.pdf',
        sizeBytes: pdf.size,
      },
      {
        name: 'notes.md',
        mimeType: 'text/markdown',
        path: '/tmp/fixtures/notes.md',
        sizeBytes: markdown.size,
      },
    ]);
  });

  it('detects extension-only audio and office document fixtures', async () => {
    const audio = new File(['opus audio bytes'], 'meeting.opus', { type: '' });
    const docx = new File(['PK\x03\x04docx fixture'], 'proposal.docx', { type: '' });
    Object.defineProperty(audio, 'path', { value: '/tmp/fixtures/meeting.opus' });
    Object.defineProperty(docx, 'path', { value: '/tmp/fixtures/proposal.docx' });

    const result = await prepareComposerFiles([audio, docx]);

    expect(result.audioAttachments).toEqual([
      expect.objectContaining({
        name: 'meeting.opus',
        mimeType: 'audio/*',
        path: '/tmp/fixtures/meeting.opus',
      }),
    ]);
    expect(result.documentAttachments).toEqual([
      expect.objectContaining({
        name: 'proposal.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        path: '/tmp/fixtures/proposal.docx',
      }),
    ]);
  });

  it('reports audio and document path failures separately', async () => {
    const audio = new File(['audio'], 'voice-note.wav', { type: 'audio/wav' });
    const pdf = new File(['pdf'], 'brief.pdf', { type: 'application/pdf' });

    const result = await prepareComposerFiles([audio, pdf]);

    expect(result.audioAttachments).toEqual([]);
    expect(result.documentAttachments).toEqual([]);
    expect(result.audioReadFailures).toEqual([
      {
        fileName: 'voice-note.wav',
        message:
          'Audio attachment "voice-note.wav" needs a local file path. Attach a file from the desktop picker so Neon Pilot can probe it locally.',
      },
    ]);
    expect(result.documentReadFailures).toEqual([
      {
        fileName: 'brief.pdf',
        message:
          'Document attachment "brief.pdf" needs a local file path. Attach a file from the desktop picker so Neon Pilot can probe it locally.',
      },
    ]);
  });

  it('reports video path resolution failures as attachment read failures', async () => {
    const video = new File(['video'], 'screen.mp4', { type: 'video/mp4' });

    const result = await prepareComposerFiles([video]);

    expect(result.videoAttachments).toEqual([]);
    expect(result.videoReadFailures).toEqual([
      {
        fileName: 'screen.mp4',
        message:
          'Video attachment "screen.mp4" needs a local file path. Attach a file from the desktop picker so Neon Pilot can probe it locally.',
      },
    ]);
  });

  it('resizes large image attachments instead of attaching original bytes', async () => {
    const originalUrl = 'blob:huge-original';
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => originalUrl),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 4000;
        naturalHeight = 2000;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          this.onload?.();
        }
      },
    );
    vi.stubGlobal(
      'FileReader',
      class {
        result: string | ArrayBuffer | null = null;
        error: Error | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        readAsDataURL(blob: Blob) {
          void blob.text().then((text) => {
            this.result = `data:${blob.type};base64,${globalThis.btoa(text)}`;
            this.onload?.();
          });
        }
      },
    );

    const drawImage = vi.fn();
    vi.stubGlobal('document', {
      createElement: vi.fn((tagName: string) => {
        if (tagName !== 'canvas') {
          throw new Error(`Unexpected element: ${tagName}`);
        }

        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'low',
            drawImage,
          })),
          toBlob: vi.fn((callback: BlobCallback, type?: string) => {
            callback(new Blob(['resized-image'], { type: type || 'image/png' }));
          }),
        } as unknown as HTMLCanvasElement;
      }),
    });

    const result = await prepareComposerFiles([new File([new Uint8Array(9 * 1024 * 1024)], 'huge.png', { type: 'image/png' })]);

    expect(result.imageReadFailures).toEqual([]);
    expect(result.imageAttachments[0]).toMatchObject({
      name: 'huge.png',
      mimeType: 'image/png',
      data: globalThis.btoa('resized-image'),
      size: 'resized-image'.length,
    });
    expect(result.imageAttachments[0]?.data).not.toHaveLength(12 * 1024 * 1024);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1000);
  });

  it('keeps the normalized mime type when a resized canvas blob is untyped', async () => {
    const originalImage = globalThis.Image;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 4000;
        naturalHeight = 2000;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:large'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      'FileReader',
      class {
        result: string | ArrayBuffer | null = null;
        error: DOMException | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        readAsDataURL(blob: Blob) {
          void blob.arrayBuffer().then((buffer) => {
            this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;
            this.onload?.();
          });
        }
      },
    );
    vi.stubGlobal('document', {
      createElement: vi.fn((tagName: string) => {
        if (tagName !== 'canvas') {
          throw new Error(`Unexpected element: ${tagName}`);
        }

        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'low',
            drawImage: vi.fn(),
          })),
          toBlob: vi.fn((callback: BlobCallback) => {
            callback(new Blob(['resized-image']));
          }),
        } as unknown as HTMLCanvasElement;
      }),
    });

    const result = await prepareComposerFiles([new File([new Uint8Array(9 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' })]);

    expect(result.imageReadFailures).toEqual([]);
    expect(result.imageAttachments[0]).toMatchObject({
      name: 'huge.jpg',
      mimeType: 'image/jpeg',
      data: globalThis.btoa('resized-image'),
    });

    vi.stubGlobal('Image', originalImage);
  });

  it('reads files from paste/drop transfer file lists', () => {
    const first = new File(['one'], 'one.png', { type: 'image/png' });
    const second = new File(['two'], 'two.png', { type: 'image/png' });
    const fileListLike = { 0: first, 1: second, length: 2 };

    expect(readComposerTransferFiles(fileListLike)).toEqual([first, second]);
    expect(readComposerTransferFiles(null)).toEqual([]);
    expect(hasComposerTransferFiles(fileListLike)).toBe(true);
    expect(hasComposerTransferFiles({ length: 0 })).toBe(false);
  });

  it('falls back to image attachment when png drawing parsing fails', async () => {
    const image = new File(['image'], 'maybe-drawing.png', { type: 'image/png' });

    const imageAttachment = {
      localId: 'image-1',
      name: 'maybe-drawing.png',
      mimeType: 'image/png',
      data: globalThis.btoa('image'),
      previewUrl: 'data:image/png;base64,aW1hZ2U=',
      size: 5,
    } satisfies ComposerImageAttachment;

    const result = await prepareComposerFiles(
      [image],
      async () => {
        throw new Error('No embedded scene');
      },
      async () => imageAttachment,
    );

    expect(result.imageAttachments).toEqual([imageAttachment]);
    expect(result.drawingAttachments).toEqual([]);
    expect(result.drawingParseFailures).toEqual([]);
    expect(result.rejectedFileNames).toEqual([]);
  });

  it('removes composer image and drawing attachments by stable identity', () => {
    const firstImage = { localId: 'image-1', name: 'one.png', mimeType: 'image/png', data: 'one', previewUrl: 'one', size: 3 };
    const secondImage = { localId: 'image-2', name: 'two.png', mimeType: 'image/png', data: 'two', previewUrl: 'two', size: 3 };
    const firstDrawing = { localId: 'drawing-1', title: 'One' } as ComposerDrawingAttachment;
    const secondDrawing = { localId: 'drawing-2', title: 'Two' } as ComposerDrawingAttachment;

    expect(removeComposerImageFileAtIndex([firstImage, secondImage], 0)).toEqual([secondImage]);
    expect(removeComposerImageFileAtIndex([firstImage, secondImage], 9)).toEqual([firstImage, secondImage]);
    expect(removeComposerVideoFileAtIndex([{ localId: 'video-1', mimeType: 'video/mp4', path: '/tmp/a.mp4', size: 1 }], 0)).toEqual([]);
    expect(removeComposerAudioFileAtIndex([{ localId: 'audio-1', mimeType: 'audio/mpeg', path: '/tmp/a.mp3', size: 1 }], 0)).toEqual([]);
    expect(
      removeComposerDocumentFileAtIndex([{ localId: 'document-1', mimeType: 'application/pdf', path: '/tmp/a.pdf', size: 1 }], 0),
    ).toEqual([]);
    expect(removeComposerDrawingAttachmentByLocalId([firstDrawing, secondDrawing], 'drawing-2')).toEqual([firstDrawing]);
    expect(removeComposerDrawingAttachmentByLocalId([firstDrawing], 'missing')).toEqual([firstDrawing]);
  });

  it('builds composer file preparation notices from preparation results', () => {
    expect(
      buildComposerFilePreparationNotices({
        drawingAttachments: [{ localId: 'drawing-1', title: 'One' } as ComposerDrawingAttachment],
        drawingParseFailures: [{ fileName: 'broken.excalidraw', message: 'Invalid scene' }],
        imageReadFailures: [{ fileName: 'gone.png', message: 'Could not read image attachment "gone.png": missing' }],
        videoAttachments: [{ localId: 'video-1', name: 'screen.mp4', mimeType: 'video/mp4', path: '/tmp/screen.mp4', size: 5 }],
        videoReadFailures: [],
        audioAttachments: [{ localId: 'audio-1', name: 'voice.mp3', mimeType: 'audio/mpeg', path: '/tmp/voice.mp3', size: 5 }],
        documentAttachments: [{ localId: 'document-1', name: 'brief.pdf', mimeType: 'application/pdf', path: '/tmp/brief.pdf', size: 5 }],
        rejectedFileNames: ['a.txt', 'b.mov', 'c.zip', 'd.bin'],
      }),
    ).toEqual([
      { tone: 'accent', text: 'Attached 1 drawing.' },
      { tone: 'accent', text: 'Attached 1 video.' },
      { tone: 'accent', text: 'Attached 1 audio file.' },
      { tone: 'accent', text: 'Attached 1 document.' },
      { tone: 'danger', text: 'Failed to parse broken.excalidraw: Invalid scene', durationMs: 4000 },
      { tone: 'danger', text: 'Could not read image attachment "gone.png": missing', durationMs: 4000 },
      { tone: 'danger', text: 'Unsupported file type: a.txt, b.mov, c.zip, +1 more', durationMs: 4000 },
    ]);

    expect(
      buildComposerFilePreparationNotices({
        drawingAttachments: [
          { localId: 'drawing-1', title: 'One' } as ComposerDrawingAttachment,
          { localId: 'drawing-2', title: 'Two' } as ComposerDrawingAttachment,
        ],
        drawingParseFailures: [],
        imageReadFailures: [],
        rejectedFileNames: [],
      }),
    ).toEqual([{ tone: 'accent', text: 'Attached 2 drawings.' }]);
  });

  it('converts drawing attachments to prompt image and attachment references', () => {
    const drawing = {
      localId: 'drawing-1',
      title: 'Sketch',
      sourceData: '{}',
      sourceMimeType: 'application/vnd.excalidraw+json',
      sourceName: 'Sketch.excalidraw',
      previewData: 'abc',
      previewMimeType: 'image/png',
      previewName: 'Sketch.png',
      previewUrl: 'data:image/png;base64,abc',
      attachmentId: 'attachment-1',
      revision: '2',
      dirty: false,
    } as ComposerDrawingAttachment;

    expect(drawingAttachmentToPromptImage(drawing)).toEqual({
      name: 'Sketch.png',
      mimeType: 'image/png',
      data: 'abc',
      previewUrl: 'data:image/png;base64,abc',
    });
    expect(drawingAttachmentToPromptRef(drawing)).toEqual({ attachmentId: 'attachment-1', revision: 2 });
    expect(drawingAttachmentToPromptRef({ ...drawing, attachmentId: undefined })).toBeNull();
    expect(drawingAttachmentToPromptRef({ ...drawing, revision: 'not-a-number' } as ComposerDrawingAttachment)).toEqual({
      attachmentId: 'attachment-1',
    });
    expect(drawingAttachmentToPromptRef({ ...drawing, revision: '2abc' } as ComposerDrawingAttachment)).toEqual({
      attachmentId: 'attachment-1',
    });
    expect(
      drawingAttachmentToPromptRef({ ...drawing, revision: String(Number.MAX_SAFE_INTEGER + 1) } as ComposerDrawingAttachment),
    ).toEqual({ attachmentId: 'attachment-1' });
    expect(drawingAttachmentToPromptRef({ ...drawing, revision: String(Number.MAX_SAFE_INTEGER) } as ComposerDrawingAttachment)).toEqual({
      attachmentId: 'attachment-1',
    });
  });

  it('keeps small binary helpers boring and predictable', async () => {
    const file = base64ToFile(globalThis.btoa('hello'), 'image/webp', 'image.webp');

    expect(file.name).toBe('image.webp');
    expect(file.type).toBe('image/webp');
    expect(await file.text()).toBe('hello');
    expect(fileExtensionForMimeType('image/jpeg')).toBe('jpg');
    expect(fileExtensionForMimeType('image/webp')).toBe('webp');
  });

  it('converts screenshot captures to composer files with a stable fallback name', async () => {
    const named = screenshotCaptureImageToFile({
      data: globalThis.btoa('screenshot'),
      mimeType: 'image/png',
      name: '  Capture.png  ',
    });
    const fallback = screenshotCaptureImageToFile({
      data: globalThis.btoa('fallback'),
      mimeType: 'image/png',
      name: '   ',
    });

    expect(named.name).toBe('Capture.png');
    expect(await named.text()).toBe('screenshot');
    expect(fallback.name).toBe('Screenshot.png');
    expect(await fallback.text()).toBe('fallback');
  });
});
