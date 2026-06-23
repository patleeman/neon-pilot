import { type NativeExtensionClient } from '@neon-pilot/extensions';
import {
  cx,
  Field,
  IconButton,
  LoadingState,
  Notice,
  Select,
  SettingsRow,
  Spinner,
  TextInput,
  ToolbarButton,
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
          return <span key={index} className="w-[2px] shrink-0 rounded-full bg-current" style={{ height: `${height}px`, opacity }} />;
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
    composerDisabled: boolean;
    insertText: (text: string) => void;
    appendText?: (text: string) => void;
    renderMode?: 'inline' | 'menu';
  };
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [samples, setSamples] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const captureRef = useRef<ComposerDictationCapture | null>(null);
  const pendingStartRef = useRef<Promise<void> | null>(null);
  const pointerRef = useRef<{ pointerId: number; startedAt: number; startedExistingRecording: boolean } | null>(null);
  const mountedRef = useRef(true);
  const toggleAvailable = !controlContext.composerDisabled && state !== 'transcribing';

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
    if (controlContext.composerDisabled || captureRef.current || pendingStartRef.current || state === 'transcribing') return;
    const pendingStart = (async () => {
      try {
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
  }, [controlContext.composerDisabled, pa, state]);

  useEffect(() => {
    const handleDictationToggleCommand = () => {
      if (captureRef.current || pendingStartRef.current) void stop();
      else void start();
    };

    window.addEventListener('neon-pilot:dictation-toggle', handleDictationToggleCommand);
    return () => window.removeEventListener('neon-pilot:dictation-toggle', handleDictationToggleCommand);
  }, [start, stop]);

  return (
    <>
      {state === 'recording' ? <DictationWaveform samples={samples} startedAt={startedAt} /> : null}
      <IconButton
        shape="circle"
        onPointerDown={(event) => {
          if (event.button !== 0 || controlContext.composerDisabled || state === 'transcribing') return;
          event.preventDefault();
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
        disabled={controlContext.composerDisabled || state === 'transcribing'}
        className={cx(
          'touch-none transition-colors disabled:cursor-default disabled:opacity-40',
          state === 'recording'
            ? 'bg-danger/15 text-danger hover:bg-danger/25'
            : state === 'transcribing'
              ? 'bg-elevated text-accent'
              : 'text-secondary hover:bg-elevated/60 hover:text-primary',
        )}
        title={
          state === 'recording'
            ? 'Recording dictation — release after a hold to stop, or click again to toggle off'
            : state === 'transcribing'
              ? 'Transcribing…'
              : 'Dictate. Hold to record while held, or click to toggle.'
        }
        aria-label={state === 'recording' ? 'Stop dictation' : 'Start dictation'}
      >
        {state === 'transcribing' ? <Spinner /> : state === 'recording' ? <StopIcon /> : <MicIcon />}
      </IconButton>
    </>
  );
}

export function DictationSettingsPanel({ pa }: { pa: NativeExtensionClient; settingsContext?: { extensionId?: string } }) {
  const [settings, setSettings] = useState<DictationSettings | null>(null);
  const [model, setModel] = useState('base.en');
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [status, setStatus] = useState<DictationModelStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const state = (await pa.extension.invoke('readSettings')) as DictationSettingsState;
    setSettings(state.settings);
    setModel(state.settings.model);
    setCustomModelUrl(TRANSCRIPTION_MODEL_IDS.has(state.settings.model) ? '' : state.settings.model);
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
        if (!cancelled) setStatus(value as DictationModelStatus);
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

  const statusLabel = model.trim()
    ? status?.installed
      ? `Installed locally${status.sizeBytes ? ` · ${formatBytes(status.sizeBytes)}` : ''}`
      : 'Not installed yet'
    : 'Pick a model to check install status.';

  return (
    <div className="space-y-3">
      {!settings ? <LoadingState label="Loading dictation settings..." /> : null}
      {settings ? (
        <div className="space-y-3">
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
                disabled={Boolean(busy) || !model.trim()}
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
