// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startComposerDictationCapture } from './capture';
import { DictationButton, DictationSettingsPanel } from './frontend';

vi.mock('./capture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./capture')>();
  return {
    ...actual,
    startComposerDictationCapture: vi.fn(),
  };
});

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });

const roots: Root[] = [];
const startCaptureMock = vi.mocked(startComposerDictationCapture);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function dispatchPointerDown(button: HTMLButtonElement) {
  Object.defineProperty(button, 'setPointerCapture', { configurable: true, value: vi.fn() });
  const event = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: 1 },
  });
  button.dispatchEvent(event);
}

function dispatchPointerUp(button: HTMLButtonElement) {
  const event = new Event('pointerup', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  button.dispatchEvent(event);
}

function renderDictationButton(input: {
  composerDisabled: boolean;
  composerId?: string;
  composerActive?: boolean;
  activateComposer?: ReturnType<typeof vi.fn>;
  setContext: ReturnType<typeof vi.fn>;
  invoke?: ReturnType<typeof vi.fn>;
  appendText?: ReturnType<typeof vi.fn>;
  insertText?: ReturnType<typeof vi.fn>;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    const invoke =
      input.invoke ??
      vi.fn(async (action: string) =>
        action === 'runtimeStatus'
          ? { available: true, provider: 'local-whisper', dependencies: [] }
          : { installed: true, model: 'base.en' },
      );
    root.render(
      <DictationButton
        pa={
          {
            commands: { setContext: input.setContext },
            extension: { invoke },
            ui: { toast: vi.fn() },
          } as never
        }
        controlContext={{
          composerId: input.composerId,
          composerActive: input.composerActive,
          composerDisabled: input.composerDisabled,
          activateComposer: input.activateComposer,
          insertText: input.insertText ?? vi.fn(),
          appendText: input.appendText,
        }}
      />,
    );
  });

  return { container, root };
}

function renderDictationSettingsPanel(input: { invoke: ReturnType<typeof vi.fn> }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(
      <DictationSettingsPanel
        pa={
          {
            extension: { invoke: input.invoke },
          } as never
        }
      />,
    );
  });

  return { container, root };
}

describe('DictationButton', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('publishes command availability while mounted', () => {
    const setContext = vi.fn();
    const { root } = renderDictationButton({ composerDisabled: false, setContext });

    expect(setContext).toHaveBeenLastCalledWith('toggleAvailable', true);

    act(() => {
      root.render(
        <DictationButton
          pa={
            {
              commands: { setContext },
              extension: { invoke: vi.fn() },
              ui: { toast: vi.fn() },
            } as never
          }
          controlContext={{
            composerDisabled: true,
            insertText: vi.fn(),
          }}
        />,
      );
    });

    expect(setContext).toHaveBeenLastCalledWith('toggleAvailable', false);

    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);

    expect(setContext).toHaveBeenLastCalledWith('toggleAvailable', null);
  });

  it('stops a recording capture when unmounted', async () => {
    const setContext = vi.fn();
    const stop = vi.fn(async () => ({ audio: new Uint8Array(), durationMs: 0, mimeType: 'audio/pcm', fileName: 'dictation.pcm' }));
    startCaptureMock.mockResolvedValueOnce({ stop });
    const { container, root } = renderDictationButton({ composerDisabled: false, setContext });

    await act(async () => {
      dispatchPointerDown(container.querySelector('button')!);
    });
    expect(startCaptureMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    roots.splice(roots.indexOf(root), 1);

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops a late capture when startup finishes after unmount', async () => {
    const setContext = vi.fn();
    const stop = vi.fn(async () => ({ audio: new Uint8Array(), durationMs: 0, mimeType: 'audio/pcm', fileName: 'dictation.pcm' }));
    const deferred = createDeferred<{ stop: typeof stop }>();
    startCaptureMock.mockReturnValueOnce(deferred.promise);
    const { container, root } = renderDictationButton({ composerDisabled: false, setContext });

    act(() => {
      dispatchPointerDown(container.querySelector('button')!);
    });
    act(() => root.unmount());
    roots.splice(roots.indexOf(root), 1);

    await act(async () => {
      deferred.resolve({ stop });
      await deferred.promise;
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('shows a stop control while recording', async () => {
    const setContext = vi.fn();
    startCaptureMock.mockResolvedValueOnce({
      stop: vi.fn(async () => ({ audio: new Uint8Array(), durationMs: 0, mimeType: 'audio/pcm', fileName: 'dictation.pcm' })),
    });
    const { container } = renderDictationButton({ composerDisabled: false, setContext });

    await act(async () => {
      dispatchPointerDown(container.querySelector('button')!);
    });

    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Stop dictation');
    expect(container.querySelector('rect')).not.toBeNull();
  });

  it('does not start recording when the native runtime is unavailable', async () => {
    const setContext = vi.fn();
    const toast = vi.fn();
    const invoke = vi.fn(async (action: string) =>
      action === 'runtimeStatus'
        ? { available: false, provider: 'local-whisper', error: 'Native runtime missing.', dependencies: [] }
        : { installed: true, model: 'base.en' },
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(
        <DictationButton
          pa={
            {
              commands: { setContext },
              extension: { invoke },
              ui: { toast },
            } as never
          }
          controlContext={{
            composerDisabled: false,
            insertText: vi.fn(),
          }}
        />,
      );
    });

    await act(async () => {
      dispatchPointerDown(container.querySelector('button')!);
      await flushMicrotasks();
    });

    expect(startCaptureMock).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Native runtime missing.');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Start dictation');
  });

  it('inserts transcribed text through the composer append API', async () => {
    const setContext = vi.fn();
    const appendText = vi.fn();
    const invoke = vi.fn(async (action: string) =>
      action === 'runtimeStatus'
        ? { available: true, provider: 'local-whisper', dependencies: [] }
        : action === 'modelStatus'
          ? { installed: true, model: 'base.en' }
          : { text: ' hello world ' },
    );
    const stop = vi.fn(async () => ({
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 500,
      mimeType: 'audio/pcm',
      fileName: 'dictation.pcm',
    }));
    startCaptureMock.mockResolvedValueOnce({ stop });
    const { container } = renderDictationButton({ composerDisabled: false, setContext, invoke, appendText });
    const button = container.querySelector('button')!;

    await act(async () => {
      dispatchPointerDown(button);
    });
    await act(async () => {
      dispatchPointerDown(button);
      dispatchPointerUp(button);
    });

    expect(stop).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('transcribeFile', expect.objectContaining({ mimeType: 'audio/pcm', fileName: 'dictation.pcm' }));
    expect(appendText).toHaveBeenCalledWith('hello world');
  });

  it('routes global toggle commands only to the active composer instance', async () => {
    const setContext = vi.fn();
    const inactiveAppendText = vi.fn();
    const activeAppendText = vi.fn();
    const activeActivateComposer = vi.fn();
    const inactiveInvoke = vi.fn(async () => ({ installed: true, model: 'base.en' }));
    const activeInvoke = vi.fn(async (action: string) =>
      action === 'runtimeStatus'
        ? { available: true, provider: 'local-whisper', dependencies: [] }
        : action === 'modelStatus'
          ? { installed: true, model: 'base.en' }
          : { text: ' active transcript ' },
    );
    const activeStop = vi.fn(async () => ({
      audio: new Uint8Array([4, 5, 6]),
      durationMs: 500,
      mimeType: 'audio/pcm',
      fileName: 'dictation.pcm',
    }));
    startCaptureMock.mockResolvedValueOnce({ stop: activeStop });

    renderDictationButton({
      composerDisabled: false,
      composerId: 'inactive-composer',
      composerActive: false,
      setContext,
      invoke: inactiveInvoke,
      appendText: inactiveAppendText,
    });
    renderDictationButton({
      composerDisabled: false,
      composerId: 'active-composer',
      composerActive: true,
      activateComposer: activeActivateComposer,
      setContext,
      invoke: activeInvoke,
      appendText: activeAppendText,
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('neon-pilot:dictation-toggle'));
      await flushMicrotasks();
    });

    expect(startCaptureMock).toHaveBeenCalledTimes(1);
    expect(activeActivateComposer).toHaveBeenCalledTimes(1);
    expect(inactiveInvoke).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('neon-pilot:dictation-toggle'));
      await flushMicrotasks();
    });

    expect(activeStop).toHaveBeenCalledTimes(1);
    expect(activeAppendText).toHaveBeenCalledWith('active transcript');
    expect(inactiveAppendText).not.toHaveBeenCalled();
  });

  it('flushes active dictation for composer submit before resolving the host wait', async () => {
    const setContext = vi.fn();
    const appendText = vi.fn();
    const activeActivateComposer = vi.fn();
    const invoke = vi.fn(async (action: string) =>
      action === 'runtimeStatus'
        ? { available: true, provider: 'local-whisper', dependencies: [] }
        : action === 'modelStatus'
          ? { installed: true, model: 'base.en' }
          : { text: ' send this transcript ' },
    );
    const stop = vi.fn(async () => ({
      audio: new Uint8Array([7, 8, 9]),
      durationMs: 500,
      mimeType: 'audio/pcm',
      fileName: 'dictation.pcm',
    }));
    startCaptureMock.mockResolvedValueOnce({ stop });

    renderDictationButton({
      composerDisabled: false,
      composerId: 'active-composer',
      composerActive: true,
      activateComposer: activeActivateComposer,
      setContext,
      invoke,
      appendText,
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('neon-pilot:dictation-toggle'));
      await flushMicrotasks();
    });

    const pendingFlushes: Promise<unknown>[] = [];
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('neon-pilot:dictation-flush-active', {
          detail: {
            waitUntil: (promise: Promise<unknown>) => pendingFlushes.push(promise),
          },
        }),
      );
      expect(pendingFlushes).toHaveLength(1);
      await pendingFlushes[0];
      await flushMicrotasks();
    });

    expect(activeActivateComposer).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(appendText).toHaveBeenCalledWith('send this transcript');
  });

  it('installs the selected model while recording and waits before first transcription', async () => {
    const setContext = vi.fn();
    const appendText = vi.fn();
    const installDeferred = createDeferred<{ model: string; cacheDir: string }>();
    const invoke = vi.fn(async (action: string) => {
      if (action === 'runtimeStatus') return { available: true, provider: 'local-whisper', dependencies: [] };
      if (action === 'modelStatus') return { installed: false, model: 'base.en' };
      if (action === 'installModel') return installDeferred.promise;
      return { text: ' first run works ' };
    });
    const stop = vi.fn(async () => ({
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 500,
      mimeType: 'audio/pcm',
      fileName: 'dictation.pcm',
    }));
    startCaptureMock.mockResolvedValueOnce({ stop });
    const { container } = renderDictationButton({ composerDisabled: false, setContext, invoke, appendText });
    const button = container.querySelector('button')!;

    await act(async () => {
      dispatchPointerDown(button);
      await flushMicrotasks();
    });

    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Stop dictation');
    expect(invoke).toHaveBeenCalledWith('modelStatus');
    expect(invoke).toHaveBeenCalledWith('installModel', { model: 'base.en' });
    expect(invoke).not.toHaveBeenCalledWith('transcribeFile', expect.any(Object));

    await act(async () => {
      dispatchPointerDown(button);
      dispatchPointerUp(button);
      await flushMicrotasks();
    });

    expect(invoke).not.toHaveBeenCalledWith('transcribeFile', expect.any(Object));

    await act(async () => {
      installDeferred.resolve({ model: 'base.en', cacheDir: '/runtime/transcription-models' });
      await installDeferred.promise;
      await flushMicrotasks();
    });

    expect(invoke).toHaveBeenCalledWith('transcribeFile', expect.any(Object));
    expect(appendText).toHaveBeenCalledWith('first run works');
  });
});

describe('DictationSettingsPanel', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders the canonical windowed settings surface', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'readSettings') return { settings: { model: 'base.en' } };
      if (action === 'runtimeStatus') {
        return {
          provider: 'local-whisper',
          available: true,
          dependencies: [{ id: 'whisper', label: 'Whisper runtime', available: true }],
        };
      }
      if (action === 'modelStatus') return { model: 'base.en', installed: true, sizeBytes: 147_000_000 };
      return {};
    });

    const { container } = renderDictationSettingsPanel({ invoke });
    await act(async () => {
      await flushMicrotasks();
    });

    expect(container.querySelector('.wos-page-section')).not.toBeNull();
    expect(container.querySelector('.wos-page-shell')).toBeNull();
    expect(container.querySelector('.local-dictation-page-windowed')).not.toBeNull();
    expect(container.textContent).not.toContain('Local Dictation');
    expect(container.querySelector('.wos-field')).not.toBeNull();
    expect(container.querySelector('.wos-key-value-grid')).not.toBeNull();
    expect(container.textContent).toContain('Model');
    expect(container.textContent).toContain('Installed locally');
    expect(container.textContent).toContain('Runtime');
    expect(container.querySelector('.settings-row')).toBeNull();
  });

  it('uses windowed loading chrome while dictation settings load', async () => {
    const readSettings = createDeferred<{ settings: { model: string } }>();
    const invoke = vi.fn(async (action: string) => {
      if (action === 'readSettings') return readSettings.promise;
      if (action === 'runtimeStatus') return { provider: 'local-whisper', available: true, dependencies: [] };
      if (action === 'modelStatus') return { model: 'base.en', installed: true };
      return {};
    });

    const { container } = renderDictationSettingsPanel({ invoke });

    expect(container.querySelector('.local-dictation-page-windowed')).not.toBeNull();
    expect(container.querySelector('.wos-loading-state')?.textContent).toContain('Loading dictation settings');
    expect(container.querySelector('.settings-row')).toBeNull();

    await act(async () => {
      readSettings.resolve({ settings: { model: 'base.en' } });
      await flushMicrotasks();
    });

    expect(container.querySelector('.wos-loading-state')).toBeNull();
    expect(container.textContent).toContain('Runtime');
  });

  it('uses windowed loading chrome while autosaving dictation settings', async () => {
    const updateSettings = createDeferred<{ settings: { model: string } }>();
    const invoke = vi.fn(async (action: string, input?: { model?: string }) => {
      if (action === 'readSettings') return { settings: { model: 'base.en' } };
      if (action === 'runtimeStatus') return { provider: 'local-whisper', available: true, dependencies: [] };
      if (action === 'modelStatus') return { model: input?.model ?? 'base.en', installed: true };
      if (action === 'updateSettings') return updateSettings.promise;
      return {};
    });

    const { container } = renderDictationSettingsPanel({ invoke });
    await act(async () => {
      await flushMicrotasks();
    });

    const select = container.querySelector<HTMLSelectElement>('#settings-dictation-model');
    expect(select).not.toBeNull();

    await act(async () => {
      select!.value = 'small.en';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();
    });

    expect(invoke).toHaveBeenCalledWith('updateSettings', { model: 'small.en' });
    expect(container.querySelector('.wos-loading-state')?.textContent).toContain('Saving dictation settings');
    expect(container.querySelector('.settings-row')).toBeNull();

    await act(async () => {
      updateSettings.resolve({ settings: { model: 'small.en' } });
      await flushMicrotasks();
    });

    expect(container.querySelector('.wos-loading-state')).toBeNull();
    expect(container.textContent).toContain('Saved.');
  });
});
