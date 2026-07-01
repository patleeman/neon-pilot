import { describe, expect, it, vi } from 'vitest';

const {
  runAgentTaskMock,
  getImageProbeAttachmentsMock,
  getImageProbeAttachmentsByIdMock,
  getImageProbeAttachmentsByIdFromAnySessionMock,
  getAudioProbeAttachmentsMock,
  getAudioProbeAttachmentsByIdMock,
  getAudioProbeAttachmentsByIdFromAnySessionMock,
  transcribeAudioAttachmentMock,
  extractDocumentTextMock,
  getDocumentProbeAttachmentsMock,
  getDocumentProbeAttachmentsByIdMock,
  getDocumentProbeAttachmentsByIdFromAnySessionMock,
  getVideoProbeAttachmentsMock,
  getVideoProbeAttachmentsByIdMock,
  getVideoProbeAttachmentsByIdFromAnySessionMock,
  sampleVideoFramesMock,
  transcribeVideoMock,
} = vi.hoisted(() => ({
  runAgentTaskMock: vi.fn(),
  getImageProbeAttachmentsMock: vi.fn(),
  getImageProbeAttachmentsByIdMock: vi.fn(),
  getImageProbeAttachmentsByIdFromAnySessionMock: vi.fn(),
  getAudioProbeAttachmentsMock: vi.fn(() => []),
  getAudioProbeAttachmentsByIdMock: vi.fn(() => []),
  getAudioProbeAttachmentsByIdFromAnySessionMock: vi.fn(() => []),
  transcribeAudioAttachmentMock: vi.fn(),
  extractDocumentTextMock: vi.fn(),
  getDocumentProbeAttachmentsMock: vi.fn(() => []),
  getDocumentProbeAttachmentsByIdMock: vi.fn(() => []),
  getDocumentProbeAttachmentsByIdFromAnySessionMock: vi.fn(() => []),
  getVideoProbeAttachmentsMock: vi.fn(),
  getVideoProbeAttachmentsByIdMock: vi.fn(),
  getVideoProbeAttachmentsByIdFromAnySessionMock: vi.fn(),
  sampleVideoFramesMock: vi.fn(),
  transcribeVideoMock: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/agent', () => ({ runAgentTask: runAgentTaskMock }));
vi.mock('@neon-pilot/extensions/backend/images', () => ({
  getImageProbeAttachments: getImageProbeAttachmentsMock,
  getImageProbeAttachmentsById: getImageProbeAttachmentsByIdMock,
  getImageProbeAttachmentsByIdFromAnySession: getImageProbeAttachmentsByIdFromAnySessionMock,
}));
vi.mock('@neon-pilot/extensions/backend/audio', () => ({
  getAudioProbeAttachments: getAudioProbeAttachmentsMock,
  getAudioProbeAttachmentsById: getAudioProbeAttachmentsByIdMock,
  getAudioProbeAttachmentsByIdFromAnySession: getAudioProbeAttachmentsByIdFromAnySessionMock,
  transcribeAudioAttachment: transcribeAudioAttachmentMock,
}));
vi.mock('@neon-pilot/extensions/backend/documents', () => ({
  extractDocumentText: extractDocumentTextMock,
  getDocumentProbeAttachments: getDocumentProbeAttachmentsMock,
  getDocumentProbeAttachmentsById: getDocumentProbeAttachmentsByIdMock,
  getDocumentProbeAttachmentsByIdFromAnySession: getDocumentProbeAttachmentsByIdFromAnySessionMock,
}));
vi.mock('@neon-pilot/extensions/backend/videos', () => ({
  getVideoProbeAttachments: getVideoProbeAttachmentsMock,
  getVideoProbeAttachmentsById: getVideoProbeAttachmentsByIdMock,
  getVideoProbeAttachmentsByIdFromAnySession: getVideoProbeAttachmentsByIdFromAnySessionMock,
  sampleVideoFrames: sampleVideoFramesMock,
  transcribeVideo: transcribeVideoMock,
}));

import { probeImage, probeMedia } from './backend.js';

const attachment = {
  id: 'img_a1b2c3d4e5f6',
  type: 'image',
  data: 'abc123',
  mimeType: 'image/png',
  name: 'screenshot.png',
  path: '/tmp/screenshot.png',
  sizeBytes: 3,
};

const video = {
  id: 'vid_a1b2c3d4e5f6',
  path: '/tmp/video.mp4',
  mimeType: 'video/mp4',
  name: 'video.mp4',
  sizeBytes: 10,
  durationMs: 5000,
  hasAudio: true,
};

function createCtx(overrides?: Record<string, unknown>) {
  return {
    toolContext: { preferredVisionModel: 'provider/gpt-4-vision', sessionId: 'session-1', cwd: '/tmp' },
    ...overrides,
  } as never;
}

describe('system-image-probe backend', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs a host-owned agent task for selected image attachments', async () => {
    getImageProbeAttachmentsMock.mockReturnValue([attachment]);
    getImageProbeAttachmentsByIdMock.mockReturnValue([attachment]);
    runAgentTaskMock.mockResolvedValue({ text: 'The image shows a dashboard', model: 'gpt-4-vision', provider: 'provider' });

    const result = await probeImage({ imageIds: ['img_a1b2c3d4e5f6'], question: 'What is in this image?' }, createCtx());

    expect(result.text).toBe('The image shows a dashboard');
    expect(runAgentTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/tmp',
        modelRef: 'provider/gpt-4-vision',
        tools: 'none',
        images: [{ type: 'image', data: 'abc123', mimeType: 'image/png' }],
      }),
      expect.anything(),
    );
  });

  it('returns classified errors from the host agent task', async () => {
    getImageProbeAttachmentsMock.mockReturnValue([attachment]);
    getImageProbeAttachmentsByIdMock.mockReturnValue([attachment]);
    runAgentTaskMock.mockRejectedValue(new Error('model does not accept images'));

    const result = await probeImage({ imageIds: ['img_a1b2c3d4e5f6'], question: 'Describe' }, createCtx());

    expect(result.isError).toBe(true);
    expect(result.text).toContain('does not appear to support this image request');
  });

  it('throws when preferredVisionModel is missing', async () => {
    await expect(
      probeImage({ imageIds: ['img_a1b2c3d4e5f6'], question: '?' }, createCtx({ toolContext: { sessionId: 'session-1' } })),
    ).rejects.toThrow('Probe image requires a configured preferred vision model');
  });

  it('throws for duplicate image ids before probing attachments', async () => {
    await expect(probeImage({ imageIds: ['img_a1b2c3d4e5f6', 'img_a1b2c3d4e5f6'], question: '?' }, createCtx())).rejects.toThrow(
      'Duplicate image ID: img_a1b2c3d4e5f6',
    );
    expect(getImageProbeAttachmentsMock).not.toHaveBeenCalled();
    expect(getImageProbeAttachmentsByIdMock).not.toHaveBeenCalled();
  });

  it('throws for unknown image ids', async () => {
    getImageProbeAttachmentsMock.mockReturnValue([attachment]);
    getImageProbeAttachmentsByIdMock.mockReturnValue([]);
    getImageProbeAttachmentsByIdFromAnySessionMock.mockReturnValue([]);

    await expect(probeImage({ imageIds: ['img_a1b2c3d4e5f6'], question: '?' }, createCtx())).rejects.toThrow(
      'None of the requested image IDs are available',
    );
  });

  it('probes video attachments by passing sampled frames to the vision task', async () => {
    getImageProbeAttachmentsMock.mockReturnValue([]);
    getImageProbeAttachmentsByIdMock.mockReturnValue([]);
    getVideoProbeAttachmentsMock.mockReturnValue([video]);
    getVideoProbeAttachmentsByIdMock.mockReturnValue([video]);
    sampleVideoFramesMock.mockResolvedValue({
      text: 'sampled frames',
      content: [
        { type: 'text', text: 'sampled frames' },
        { type: 'image', data: 'frame-1', mimeType: 'image/png' },
        { type: 'image', data: 'frame-2', mimeType: 'image/png' },
      ],
      details: {
        videoId: 'vid_a1b2c3d4e5f6',
        frames: [
          { timestampMs: 0, mimeType: 'image/png', sizeBytes: 7 },
          { timestampMs: 5000, mimeType: 'image/png', sizeBytes: 7 },
        ],
      },
    });
    transcribeVideoMock.mockResolvedValue({
      text: 'music and footsteps',
      content: [{ type: 'text', text: 'music and footsteps' }],
      details: { videoId: 'vid_a1b2c3d4e5f6', startMs: 0, segments: [] },
    });
    runAgentTaskMock.mockResolvedValue({ text: 'The video shows people dancing.', model: 'gpt-4-vision', provider: 'provider' });

    const result = await probeMedia(
      {
        videoIds: ['vid_a1b2c3d4e5f6'],
        question: 'What is going on?',
        startSec: 0,
        endSec: 5,
        frameCount: 2,
      },
      createCtx(),
    );

    expect(result.text).toBe('The video shows people dancing.');
    expect(sampleVideoFramesMock).toHaveBeenCalledWith({ videoId: 'vid_a1b2c3d4e5f6', startSec: 0, endSec: 5, count: 2 });
    expect(transcribeVideoMock).toHaveBeenCalledWith({ videoId: 'vid_a1b2c3d4e5f6', startSec: 0, endSec: 5 });
    expect(runAgentTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          { type: 'image', data: 'frame-1', mimeType: 'image/png' },
          { type: 'image', data: 'frame-2', mimeType: 'image/png' },
        ],
        prompt: expect.stringContaining('frame at 0.000s'),
      }),
      expect.anything(),
    );
  });

  it('rejects video frame labels as image ids and points callers at probe_media', async () => {
    await expect(probeMedia({ imageIds: ['img_0.000s'], question: 'Describe the frame' }, createCtx())).rejects.toThrow(
      'Invalid image ID: img_0.000s',
    );
    expect(sampleVideoFramesMock).not.toHaveBeenCalled();
    expect(runAgentTaskMock).not.toHaveBeenCalled();
  });
});
