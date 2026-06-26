import { beforeEach, describe, expect, it, vi } from 'vitest';

const { extractVideoFrameMock, sampleVideoFramesMock, transcribeVideoMock } = vi.hoisted(() => ({
  extractVideoFrameMock: vi.fn(),
  sampleVideoFramesMock: vi.fn(),
  transcribeVideoMock: vi.fn(),
}));

vi.mock('@neon-pilot/extensions/backend/videos', () => ({
  extractVideoFrame: extractVideoFrameMock,
  sampleVideoFrames: sampleVideoFramesMock,
  transcribeVideo: transcribeVideoMock,
}));

import { extractVideoFrameAction, sampleVideoFramesAction, transcribeVideoAction } from './backend.js';

describe('system-video-probe backend', () => {
  beforeEach(() => {
    extractVideoFrameMock
      .mockReset()
      .mockResolvedValue({ text: 'frame', content: [], details: { videoId: 'vid_aaaaaaaaaaaa', frames: [] } });
    sampleVideoFramesMock
      .mockReset()
      .mockResolvedValue({ text: 'frames', content: [], details: { videoId: 'vid_aaaaaaaaaaaa', frames: [] } });
    transcribeVideoMock.mockReset().mockResolvedValue({
      text: 'hello',
      content: [{ type: 'text', text: 'hello' }],
      details: { videoId: 'vid_aaaaaaaaaaaa', startMs: 0, segments: [] },
    });
  });

  it('extracts one frame through the host video API', async () => {
    await expect(extractVideoFrameAction({ videoId: 'vid_aaaaaaaaaaaa', timeSec: 2.5 }, {} as never)).resolves.toMatchObject({
      text: 'frame',
    });

    expect(extractVideoFrameMock).toHaveBeenCalledWith({ videoId: 'vid_aaaaaaaaaaaa', timeSec: 2.5 });
  });

  it('samples frames with a bounded count', async () => {
    await expect(
      sampleVideoFramesAction({ videoId: 'vid_aaaaaaaaaaaa', startSec: 0, endSec: 5, count: 3 }, {} as never),
    ).resolves.toMatchObject({ text: 'frames' });

    expect(sampleVideoFramesMock).toHaveBeenCalledWith({ videoId: 'vid_aaaaaaaaaaaa', startSec: 0, endSec: 5, count: 3 });
    await expect(sampleVideoFramesAction({ videoId: 'vid_aaaaaaaaaaaa', startSec: 0, endSec: 5, count: 13 }, {} as never)).rejects.toThrow(
      /count/,
    );
  });

  it('transcribes a timestamp range', async () => {
    await expect(
      transcribeVideoAction({ videoId: 'vid_aaaaaaaaaaaa', startSec: 1, endSec: 4, language: 'en' }, {} as never),
    ).resolves.toMatchObject({ text: 'hello' });

    expect(transcribeVideoMock).toHaveBeenCalledWith({ videoId: 'vid_aaaaaaaaaaaa', startSec: 1, endSec: 4, language: 'en' });
  });
});
