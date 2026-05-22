import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bytesToBase64, resampleFloat32ToPcm16, startComposerDictationCapture } from './capture.js';

describe('dictation capture helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes large byte arrays to base64 in chunks', () => {
    const bytes = new Uint8Array(70_000);
    bytes.fill(65);

    expect(bytesToBase64(bytes)).toBe(btoa('A'.repeat(70_000)));
  });

  it('converts float samples to little-endian PCM16 with clamping', () => {
    expect(Array.from(resampleFloat32ToPcm16(new Float32Array([-2, -1, 0, 0.5, 1, 2]), 16_000))).toEqual([
      -32768, -32768, 0, 16383, 32767, 32767,
    ]);
  });

  it('resamples by averaging source ranges', () => {
    const output = resampleFloat32ToPcm16(new Float32Array([0.5, 0.5, -0.5, -0.5]), 32_000, 16_000);

    expect(Array.from(output)).toEqual([16383, -16384]);
  });

  it('returns empty PCM for invalid sample rates or empty input', () => {
    expect(resampleFloat32ToPcm16(new Float32Array(), 16_000)).toHaveLength(0);
    expect(resampleFloat32ToPcm16(new Float32Array([1]), 0)).toHaveLength(0);
    expect(resampleFloat32ToPcm16(new Float32Array([1]), 16_000, 0)).toHaveLength(0);
  });

  it('rejects capture when browser APIs are unavailable', async () => {
    vi.stubGlobal('navigator', {});

    await expect(startComposerDictationCapture()).rejects.toThrow('Microphone capture is not available');

    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    await expect(startComposerDictationCapture()).rejects.toThrow('Audio capture is not available');
  });

  it('captures audio chunks, reports levels, and stops tracks/context', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const processor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: undefined as ((event: unknown) => void) | undefined };
    const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    const close = vi.fn().mockResolvedValue(undefined);
    class FakeAudioContext {
      sampleRate = 16_000;
      destination = {};
      createMediaStreamSource = vi.fn(() => source);
      createScriptProcessor = vi.fn(() => processor);
      createGain = vi.fn(() => gain);
      close = close;
    }
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(145);
    const onLevel = vi.fn();

    const capture = await startComposerDictationCapture({ onLevel });
    processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array([0.5, -0.5]) } });
    const stopped = await capture.stop();
    const stoppedAgain = await capture.stop();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    expect(onLevel).toHaveBeenCalledWith(1);
    expect(Array.from(stopped.audio)).toEqual([255, 63, 0, 192]);
    expect(stopped).toMatchObject({ durationMs: 45, mimeType: 'audio/pcm;rate=16000;channels=1', fileName: 'dictation.pcm' });
    expect(stoppedAgain.audio).toHaveLength(0);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
