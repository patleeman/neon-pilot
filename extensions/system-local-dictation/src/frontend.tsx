import { type NativeExtensionClient } from '@neon-pilot/extensions';
import {
  cx,
  Field,
  IconButton,
  LoadingState,
  Notice,
  QuietLoadingState,
  Select,
  SettingsRow,
  Spinner,
  TextInput,
  ToolbarButton,
  WindowedField,
  WindowedKeyValueGrid,
  WindowedPageButton,
  WindowedPageSection,
  WindowedSelect,
  WindowedStateBlock,
  WindowedTextInput,
} from '@neon-pilot/extensions/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { bytesToBase64, type ComposerDictationCapture, startComposerDictationCapture } from './capture.js';

const CUSTOM_MODEL_VALUE = '__custom__';
const TRANSCRIPTION_MODEL_OPTIONS = [
  { id: 'tiny.en', label: 'Tiny English · fastest' },
  { id: 'base.en', label: 'Base English · default' },
  { id: 'small.en', label: 'Small English · recommended' },
  { id: 'medium.en', label: 'Medium English · most accurate' },
  { id: 'tiny', label: 'Tiny multilingual' },
  { id: 'base', label: 'Base multilingual' },
  { id: 'small', label: 'Small multilingual' },
  { id: 'medium', label: 'Medium multilingual' },
];
const TRANSCRIPTION_MODEL_IDS = new Set(TRANSCRIPTION_MODEL_OPTIONS.map((option) => option.id));

interface DictationSettings {
  model: string;
}
interface DictationSettingsState {
  settings: DictationSettings;
}
interface DictationModelStatus {
  model: string;
  installed: boolean;
  sizeBytes?: number;
  runtime?: DictationRuntimeStatus;
}
interface DictationRuntimeStatus {
  provider: string;
  available: boolean;
  error?: string;
  dependencies: Array<{ id: string; label: string; available: boolean; error?: string }>;
}

interface DictationComposerEventDetail {
  composerId?: unknown;
  waitUntil?: unknown;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function formatElapsed(startedAt: number | null, now: number): string {
  if (!startedAt) return '0:00';
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function DictationWaveform({ samples, startedAt }: { samples: number[]; startedAt: number | null }) {
  const [now, setNow] = useState(() => performance.now());
  const visibleSamples = samples.length > 0 ? samples : Array.from({ length: 28 }, () => 0.04);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden text-secondary" aria-label="Recording dictation">
      <div
        className="hidden min-w-0 max-w-[9rem] flex-1 items-center justify-end gap-[2px] overflow-hidden min-[520px]:flex"
        aria-hidden="true"
      >
        {visibleSamples.slice(-32).map((sample, index) => {
          const height = Math.max(2, Math.round(3 + sample * 22));
          const opacity = 0.28 + Math.min(0.72, sample * 1.4);
          return <span key={index} className="ui-waveform-bar" style={{ height: `${height}px`, opacity }} />;
        })}
      </div>
      <span className="shrink-0 font-mono text-[12px] text-secondary">{formatElapsed(startedAt, now)}</span>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function DictationButton({
  pa,
  controlContext,
}: {
  pa: NativeExtensionClient;
  controlContext: {
    composerId?: string;
    composerActive?: boolean;
    composerDisabled: boolean;
    activateComposer?: () => void;
    insertText: (text: string) => void;
    appendText?: (text: string) => void;
    renderMode?: 'inline' | 'menu';
  };
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'preparing' | 'transcribing'>('idle');
  const [samples, setSamples] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const captureRef = useRef<ComposerDictationCapture | null>(null);
  const pendingStartRef = useRef<Promise<void> | null>(null);
  const pendingModelInstallRef = useRef<Promise<void> | null>(null);
  const pointerRef = useRef<{ pointerId: number; startedAt: number; startedExistingRecording: boolean } | null>(null);
  const mountedRef = useRef(true);
  const busy = state === 'preparing' || state === 'transcribing';
  const toggleAvailable = !controlContext.composerDisabled && !busy;

  const ensureRuntimeAvailable = useCallback(async () => {
    const status = (await pa.extension.invoke('runtimeStatus')) as DictationRuntimeStatus;
    if (!status.available) {
      throw new Error(status.error ?? 'Local dictation is missing its native transcription runtime.');
    }
  }, [pa]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      pointerRef.current = null;
      const capture = captureRef.current;
      captureRef.current = null;
      if (capture) {
        void capture.stop().catch(() => {});
      }
    };
  }, []);

  const ensureModelInstalled = useCallback(async () => {
    if (!pendingModelInstallRef.current) {
      pendingModelInstallRef.current = (async () => {
        const status = (await pa.extension.invoke('modelStatus')) as DictationModelStatus;
        if (status.runtime && !status.runtime.available) {
          throw new Error(status.runtime.error ?? 'Local dictation is missing its native transcription runtime.');
        }
        if (!status.installed) {
          if (mountedRef.current) {
            pa.ui.toast('Installing dictation model while you speak…');
          }
          await pa.extension.invoke('installModel', { model: status.model });
          if (mountedRef.current) {
            pa.ui.toast('Dictation model installed.');
          }
        }
      })().finally(() => {
        pendingModelInstallRef.current = null;
      });
      void pendingModelInstallRef.current.catch(() => {});
    }
    await pendingModelInstallRef.current;
  }, [pa]);

  useEffect(() => {
    pa.commands.setContext('toggleAvailable', toggleAvailable);
    return () => pa.commands.setContext('toggleAvailable', null);
  }, [pa, toggleAvailable]);

  const stop = useCallback(async () => {
    if (pendingStartRef.current) {
      await pendingStartRef.current.catch(() => {});
    }
    const capture = captureRef.current;
    if (!capture) return;
    captureRef.current = null;
    if (mountedRef.current) {
      setStartedAt(null);
      setState('transcribing');
    }
    try {
      const { audio, durationMs, mimeType, fileName } = await capture.stop();
      if (!mountedRef.current) return;
      if (audio.byteLength === 0 || durationMs < 150) return;
      const waitedForModelInstall = pendingModelInstallRef.current !== null;
      if (waitedForModelInstall) {
        setState('preparing');
      }
      await ensureModelInstalled();
      if (waitedForModelInstall) {
        if (!mountedRef.current) return;
        setState('transcribing');
      }
      const result = (await pa.extension.invoke('transcribeFile', { dataBase64: bytesToBase64(audio), mimeType, fileName })) as {
        text?: string;
      };
      if (!mountedRef.current) return;
      const text = result.text?.trim();
      if (!text) {
        pa.ui.toast('Dictation did not detect any speech.');
        return;
      }
      const appendText = controlContext.appendText ?? controlContext.insertText;
      appendText(text);
      pa.ui.toast('Dictation inserted.');
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      pa.ui.toast(message.toLowerCase().includes('empty transcript') ? 'Dictation did not detect any speech.' : message);
    } finally {
      if (mountedRef.current) {
        setState('idle');
      }
    }
  }, [controlContext.appendText, controlContext.insertText, pa]);

  const start = useCallback(async () => {
    if (controlContext.composerDisabled || captureRef.current || pendingStartRef.current || busy) return;
    const pendingStart = (async () => {
      try {
        await ensureRuntimeAvailable();
        setSamples([]);
        setStartedAt(performance.now());
        setState('recording');
        const capture = await startComposerDictationCapture({
          onLevel: (level) => {
            if (mountedRef.current) {
              setSamples((current) => [...current.slice(-71), level]);
            }
          },
        });
        if (!mountedRef.current) {
          await capture.stop().catch(() => {});
          return;
        }
        captureRef.current = capture;
        void ensureModelInstalled().catch(() => {});
      } catch (error) {
        if (mountedRef.current) {
          setStartedAt(null);
          setState('idle');
          pa.ui.toast(error instanceof Error ? error.message : String(error));
        }
      } finally {
        pendingStartRef.current = null;
      }
    })();
    pendingStartRef.current = pendingStart;
    await pendingStart;
  }, [busy, controlContext.composerDisabled, ensureModelInstalled, ensureRuntimeAvailable, pa]);

  useEffect(() => {
    const handleDictationToggleCommand = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object' ? event.detail : {};
      const targetComposerId = (detail as { composerId?: unknown }).composerId;
      if (typeof targetComposerId === 'string') {
        if (controlContext.composerId !== targetComposerId) return;
      } else if (controlContext.composerActive === false) {
        return;
      }
      controlContext.activateComposer?.();
      if (captureRef.current || pendingStartRef.current) void stop();
      else void start();
    };

    window.addEventListener('neon-pilot:dictation-toggle', handleDictationToggleCommand);
    return () => window.removeEventListener('neon-pilot:dictation-toggle', handleDictationToggleCommand);
  }, [controlContext, start, stop]);

  useEffect(() => {
    const handleDictationFlushCommand = (event: Event) => {
      const detail: DictationComposerEventDetail =
        event instanceof CustomEvent && event.detail && typeof event.detail === 'object' ? event.detail : {};
      const targetComposerId = detail.composerId;
      if (typeof targetComposerId === 'string') {
        if (controlContext.composerId !== targetComposerId) return;
      } else if (controlContext.composerActive === false) {
        return;
      }
      if (!captureRef.current && !pendingStartRef.current) return;
      controlContext.activateComposer?.();
      if (typeof detail.waitUntil === 'function') {
        detail.waitUntil(stop());
      } else {
        void stop();
      }
    };

    window.addEventListener('neon-pilot:dictation-flush-active', handleDictationFlushCommand);
    return () => window.removeEventListener('neon-pilot:dictation-flush-active', handleDictationFlushCommand);
  }, [controlContext, stop]);

  return (
    <>
      {state === 'recording' ? <DictationWaveform samples={samples} startedAt={startedAt} /> : null}
      <IconButton
        shape="circle"
        onPointerDown={(event) => {
          if (event.button !== 0 || controlContext.composerDisabled || busy) return;
          event.preventDefault();
          controlContext.activateComposer?.();
          event.currentTarget.setPointerCapture(event.pointerId);
          const startedExistingRecording = captureRef.current !== null;
          pointerRef.current = { pointerId: event.pointerId, startedAt: performance.now(), startedExistingRecording };
          if (!startedExistingRecording) void start();
        }}
        onPointerUp={(event) => {
          const pointer = pointerRef.current;
          if (!pointer || pointer.pointerId !== event.pointerId) return;
          event.preventDefault();
          pointerRef.current = null;
          if (pointer.startedExistingRecording || performance.now() - pointer.startedAt >= 300) void stop();
        }}
        onPointerCancel={(event) => {
          const pointer = pointerRef.current;
          if (!pointer || pointer.pointerId !== event.pointerId) return;
          pointerRef.current = null;
          if (!pointer.startedExistingRecording) void stop();
        }}
        disabled={controlContext.composerDisabled || busy}
        className={cx(
          'touch-none transition-colors disabled:cursor-default disabled:opacity-40',
          state === 'recording'
            ? 'ui-button-danger-soft'
            : busy
              ? 'bg-elevated text-accent'
              : 'text-secondary hover:bg-elevated/60 hover:text-primary',
        )}
        title={
          state === 'recording'
            ? 'Recording dictation — release after a hold to stop, or click again to toggle off'
            : state === 'preparing'
              ? 'Installing dictation model…'
              : state === 'transcribing'
                ? 'Transcribing…'
                : 'Dictate. Hold to record while held, or click to toggle.'
        }
        aria-label={state === 'recording' ? 'Stop dictation' : state === 'preparing' ? 'Installing dictation model' : 'Start dictation'}
      >
        {busy ? <Spinner /> : state === 'recording' ? <StopIcon /> : <MicIcon />}
      </IconButton>
    </>
  );
}

export function DictationSettingsPanel({
  pa,
  settingsContext,
}: {
  pa: NativeExtensionClient;
  settingsContext?: { extensionId?: string; shellPresentation?: 'stable' | 'windowed' };
}) {
  const [settings, setSettings] = useState<DictationSettings | null>(null);
  const [model, setModel] = useState('base.en');
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [status, setStatus] = useState<DictationModelStatus | null>(null);
  const [runtime, setRuntime] = useState<DictationRuntimeStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const state = (await pa.extension.invoke('readSettings')) as DictationSettingsState;
    setSettings(state.settings);
    setModel(state.settings.model);
    setCustomModelUrl(TRANSCRIPTION_MODEL_IDS.has(state.settings.model) ? '' : state.settings.model);
    setRuntime((await pa.extension.invoke('runtimeStatus')) as DictationRuntimeStatus);
  }, [pa]);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [load]);

  useEffect(() => {
    if (!model.trim()) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    void pa.extension
      .invoke('modelStatus', { model: model.trim() })
      .then((value) => {
        if (!cancelled) {
          const nextStatus = value as DictationModelStatus;
          setStatus(nextStatus);
          if (nextStatus.runtime) setRuntime(nextStatus.runtime);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [model, pa]);

  async function saveFields(nextModel = model) {
    setBusy('Saving…');
    setMessage(null);
    try {
      const saved = (await pa.extension.invoke('updateSettings', {
        model: nextModel.trim(),
      })) as DictationSettingsState;
      setSettings(saved.settings);
      setMessage('Saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function install() {
    if (!model.trim()) return;
    setBusy('Installing…');
    setMessage(null);
    try {
      const installed = (await pa.extension.invoke('installModel', { model: model.trim() })) as {
        model: string;
        cacheDir: string;
      };
      setMessage(`Installed ${installed.model} in ${installed.cacheDir}.`);
      setStatus((await pa.extension.invoke('modelStatus', { model: model.trim() })) as DictationModelStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function checkRuntime() {
    setBusy('Checking…');
    setMessage(null);
    try {
      const nextRuntime = (await pa.extension.invoke('runtimeStatus')) as DictationRuntimeStatus;
      setRuntime(nextRuntime);
      setMessage(nextRuntime.available ? 'Dictation runtime is ready.' : (nextRuntime.error ?? 'Dictation runtime is unavailable.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const runtimeAvailable = runtime?.available !== false;
  const statusLabel = model.trim()
    ? status?.installed
      ? `Installed locally${status.sizeBytes ? ` · ${formatBytes(status.sizeBytes)}` : ''}`
      : 'Not installed yet'
    : 'Pick a model to check install status.';

  if (settingsContext?.shellPresentation === 'windowed') {
    const runtimeItems =
      runtime?.dependencies.map((dependency) => ({
        label: dependency.label,
        value: dependency.available ? 'Ready' : (dependency.error ?? 'Unavailable'),
      })) ?? [];

    return (
      <div className="flex min-h-0 flex-col gap-3">
        {!settings ? <QuietLoadingState label="Loading dictation settings" className="min-h-12" /> : null}
        {settings ? (
          <>
            {runtime && !runtime.available ? (
              <WindowedStateBlock
                tone="danger"
                title="Runtime unavailable"
                action={
                  <WindowedPageButton type="button" disabled={Boolean(busy)} onClick={() => void checkRuntime()}>
                    {busy === 'Checking…' ? 'Checking…' : 'Check again'}
                  </WindowedPageButton>
                }
              >
                {runtime.error ?? 'Local dictation is missing its native transcription runtime.'}
              </WindowedStateBlock>
            ) : null}
            <WindowedPageSection title="Model" meta={statusLabel}>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <WindowedField label="Selected model">
                  <WindowedSelect
                    id="settings-dictation-model"
                    value={TRANSCRIPTION_MODEL_IDS.has(model) ? model : CUSTOM_MODEL_VALUE}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === CUSTOM_MODEL_VALUE) {
                        const custom = customModelUrl.trim();
                        setModel(custom);
                        setCustomModelUrl(custom);
                        return;
                      }
                      setModel(next);
                      void saveFields(next);
                    }}
                  >
                    {TRANSCRIPTION_MODEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                    <option value={CUSTOM_MODEL_VALUE}>Custom Hugging Face URL…</option>
                  </WindowedSelect>
                </WindowedField>
                <WindowedPageButton
                  type="button"
                  tone="accent"
                  disabled={Boolean(busy) || !model.trim() || !runtimeAvailable}
                  onClick={() => void install()}
                >
                  {busy === 'Installing…' ? 'Installing…' : status?.installed ? 'Reinstall model' : 'Install model'}
                </WindowedPageButton>
              </div>
              {!TRANSCRIPTION_MODEL_IDS.has(model) ? (
                <WindowedField
                  label="Custom model URL"
                  hint={
                    <>
                      Direct Hugging Face <span className="font-mono">/resolve/</span> URL to a Whisper.cpp-compatible{' '}
                      <span className="font-mono">ggml-*.bin</span> file.
                    </>
                  }
                >
                  <WindowedTextInput
                    id="settings-dictation-custom-model"
                    value={customModelUrl}
                    onChange={(event) => {
                      setCustomModelUrl(event.target.value);
                      setModel(event.target.value);
                    }}
                    onBlur={() => void saveFields(customModelUrl)}
                    className="font-mono"
                    placeholder="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </WindowedField>
              ) : null}
            </WindowedPageSection>
            <WindowedPageSection title="Runtime" meta={runtime?.available === false ? 'Unavailable' : 'Ready'}>
              <WindowedKeyValueGrid
                items={[
                  { label: 'Provider', value: runtime?.provider ?? 'local-whisper' },
                  { label: 'Native runtime', value: runtime?.available === false ? 'Unavailable' : 'Ready' },
                  { label: 'Model cache', value: status?.installed ? 'Installed' : 'Missing' },
                  ...runtimeItems,
                ]}
              />
              {runtime?.available ? (
                <WindowedPageButton type="button" disabled={Boolean(busy)} onClick={() => void checkRuntime()}>
                  {busy === 'Checking…' ? 'Checking…' : 'Check runtime'}
                </WindowedPageButton>
              ) : null}
            </WindowedPageSection>
            {busy === 'Saving…' ? <QuietLoadingState label="Saving dictation settings" className="min-h-10" /> : null}
            {message ? (
              <WindowedStateBlock
                tone={message === 'Saved.' || message.includes('ready') || message.startsWith('Installed') ? 'positive' : 'neutral'}
              >
                {message}
              </WindowedStateBlock>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!settings ? <QuietLoadingState label="Loading dictation settings" className="min-h-12" /> : null}
      {settings ? (
        <div className="space-y-3">
          {runtime && !runtime.available ? (
            <Notice>
              <div className="space-y-2">
                <p>{runtime.error ?? 'Local dictation is missing its native transcription runtime.'}</p>
                <ToolbarButton type="button" disabled={Boolean(busy)} onClick={() => void checkRuntime()}>
                  {busy === 'Checking…' ? 'Checking…' : 'Check again'}
                </ToolbarButton>
              </div>
            </Notice>
          ) : null}
          <SettingsRow title="Model" description={statusLabel} actionsClassName="min-w-0 max-w-none">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                id="settings-dictation-model"
                className="min-w-0 sm:w-80"
                value={TRANSCRIPTION_MODEL_IDS.has(model) ? model : CUSTOM_MODEL_VALUE}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === CUSTOM_MODEL_VALUE) {
                    const custom = customModelUrl.trim();
                    setModel(custom);
                    setCustomModelUrl(custom);
                    return;
                  }
                  setModel(next);
                  void saveFields(next);
                }}
              >
                {TRANSCRIPTION_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
                <option value={CUSTOM_MODEL_VALUE}>Custom Hugging Face URL…</option>
              </Select>
              <ToolbarButton
                type="button"
                className="whitespace-nowrap"
                disabled={Boolean(busy) || !model.trim() || !runtimeAvailable}
                onClick={() => void install()}
              >
                {busy === 'Installing…' ? 'Installing…' : status?.installed ? 'Reinstall local model' : 'Install local model'}
              </ToolbarButton>
            </div>
          </SettingsRow>
          {!TRANSCRIPTION_MODEL_IDS.has(model) ? (
            <Field
              label="Custom model URL"
              hint={
                <>
                  Use a direct Hugging Face <span className="font-mono">/resolve/</span> URL to a Whisper.cpp-compatible{' '}
                  <span className="font-mono">ggml-*.bin</span> file.
                </>
              }
            >
              <TextInput
                id="settings-dictation-custom-model"
                value={customModelUrl}
                onChange={(event) => {
                  setCustomModelUrl(event.target.value);
                  setModel(event.target.value);
                }}
                onBlur={() => void saveFields(customModelUrl)}
                className="font-mono text-[13px]"
                placeholder="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          ) : null}
          {busy === 'Saving…' ? <LoadingState label="Saving..." /> : null}
          {message ? <Notice>{message}</Notice> : null}
        </div>
      ) : null}
    </div>
  );
}
