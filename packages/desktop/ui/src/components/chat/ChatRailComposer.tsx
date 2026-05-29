import { useCallback, useEffect, useRef, useState } from 'react';

import type { ModelInfo } from '../../shared/types.js';
import { cx } from '../ui.js';

/**
 * Composer for the right-panel ChatRail.
 *
 * Provides a text input, model picker (inline), send/steer controls,
 * and an abort button during streaming.
 */
function readForkPromptDraft(conversationId: string): string | null {
  try {
    const raw = sessionStorage.getItem(`pa:reload:conversation:${conversationId}:composer`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function clearForkPromptDraft(conversationId: string): void {
  try {
    sessionStorage.removeItem(`pa:reload:conversation:${conversationId}:composer`);
  } catch {
    // Ignore.
  }
}

export function ChatRailComposer({
  conversationId,
  isStreaming,
  models,
  currentModel,
  onSubmit,
  onAbortStream,
  onSelectModel,
}: {
  conversationId: string | null;
  isStreaming: boolean;
  models: ModelInfo[];
  currentModel: string;
  onSubmit: (text: string, behavior?: 'steer' | 'followUp') => void;
  onAbortStream: () => void;
  onSelectModel: (modelId: string) => void;
}) {
  const [input, setInput] = useState(() => (conversationId ? (readForkPromptDraft(conversationId) ?? '') : ''));

  // Clear fork prompt draft on first render so it doesn't re-fill on remount.
  useEffect(() => {
    if (conversationId) {
      clearForkPromptDraft(conversationId);
    }
  }, [conversationId]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // Focus on mount.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (input.trim() && !isStreaming) {
          onSubmit(input.trim());
          setInput('');
        }
      }
    },
    [input, isStreaming, onSubmit],
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    onSubmit(input.trim());
    setInput('');
  }, [input, isStreaming, onSubmit]);

  const hasContent = input.trim().length > 0;
  const hasModels = models.length > 0;
  return (
    <div className="px-2 py-2">
      {/* Input row */}
      <div
        className={cx(
          'flex items-end gap-1 rounded-lg border bg-surface px-2 py-1 transition',
          isStreaming ? 'border-accent/40' : 'border-border-subtle',
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'Waiting for response…' : 'Message...'}
          disabled={isStreaming}
          rows={1}
          className="min-h-[24px] max-h-[160px] flex-1 resize-none bg-transparent text-[13px] text-primary placeholder:text-dim outline-none py-0.5 leading-5"
          aria-label="Message input"
        />
      </div>

      {/* Action bar */}
      <div className="mt-1.5 flex items-center gap-1">
        {/* Send */}

        <button
          type="button"
          onClick={handleSend}
          disabled={!hasContent || isStreaming}
          className={cx(
            'flex h-7 items-center gap-1 rounded px-2.5 text-[12px] font-medium transition',
            hasContent && !isStreaming ? 'bg-accent text-white hover:bg-accent/90' : 'bg-surface text-dim cursor-not-allowed',
          )}
          title="Send"
        >
          Send
        </button>

        {/* Abort */}
        {isStreaming && (
          <button
            type="button"
            onClick={onAbortStream}
            className="flex h-7 items-center gap-1 rounded bg-danger/15 px-2.5 text-[12px] font-medium text-danger transition hover:bg-danger/25"
          >
            Stop
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Model picker */}
        {hasModels && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelPickerOpen((o) => !o)}
              className={cx(
                'flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium transition',
                'text-dim hover:bg-surface hover:text-secondary',
              )}
            >
              <ModelChip modelId={currentModel || models[0]?.id} />
            </button>
            {modelPickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModelPickerOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-border-subtle bg-panel py-1 shadow-lg">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-dim">Model</div>
                  {models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(model.id);
                        setModelPickerOpen(false);
                      }}
                      className={cx(
                        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition',
                        model.id === currentModel
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-secondary hover:bg-surface hover:text-primary',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{model.label || model.id}</span>
                      {model.id === currentModel && <span className="shrink-0 text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelChip({ modelId }: { modelId: string }) {
  // Show a short version of the model name (e.g. "claude-sonnet-4" → "sonnet")
  const short = modelId
    .replace(/^(claude|gpt|gemini)-/, '')
    .split('-')
    .slice(0, 2)
    .join('-');
  return (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-accent/60" aria-hidden="true" />
      <span className="truncate max-w-[80px]">{short || modelId}</span>
    </>
  );
}
