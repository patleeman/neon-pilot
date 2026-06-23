import { useMemo, useRef } from 'react';

import { formatComposerActionLabel } from '../../conversation/conversationComposerPresentation';
import { ComposerButtonHost } from '../../extensions/ComposerButtonHost';
import { createNativeExtensionClient } from '../../extensions/nativePaClient';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import { ComposerActionButton, IconButton } from '../ui';
import { ComposerActionIcon } from './ConversationComposerChrome';

export type ConversationComposerSubmitLabel = 'Send' | 'Steer' | 'Follow up';

export function ConversationComposerActions({
  composerDisabled,
  streamIsStreaming,
  conversationNeedsTakeover,
  composerHasContent,
  composerShowsQuestionSubmit,
  composerQuestionCanSubmit,
  composerQuestionRemainingCount,
  composerQuestionSubmitting,
  composerSubmitLabel,
  composerAltHeld,
  onInsertComposerText,
  onAppendComposerText,
  onSubmitComposerQuestion,
  onSubmitComposerActionForModifiers,
  onAbortStream,
}: {
  composerDisabled: boolean;
  streamIsStreaming: boolean;
  conversationNeedsTakeover: boolean;
  composerHasContent: boolean;
  composerShowsQuestionSubmit: boolean;
  composerQuestionCanSubmit: boolean;
  composerQuestionRemainingCount: number;
  composerQuestionSubmitting: boolean;
  composerSubmitLabel: ConversationComposerSubmitLabel;
  composerAltHeld: boolean;
  onInsertComposerText: (text: string) => void;
  onAppendComposerText: (text: string) => void;
  onSubmitComposerQuestion: () => void;
  onSubmitComposerActionForModifiers: (altKeyHeld: boolean) => void;
  onAbortStream: () => void;
}) {
  const { composerControls, toolbarActions } = useExtensionRegistry();
  const visibleToolbarActions = useMemo(
    () =>
      toolbarActions.filter((action) => {
        const expr = action.when;
        if (!expr) return true;
        const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
        for (const clause of clauses) {
          const trimmed = clause.trim();
          if (trimmed === 'composerHasContent' && !composerHasContent) return false;
          if (trimmed === 'streamIsStreaming' && !streamIsStreaming) return false;
          if (trimmed === '!streamIsStreaming' && streamIsStreaming) return false;
        }
        return true;
      }),
    [toolbarActions, composerHasContent, streamIsStreaming],
  );

  const visibleComposerButtons = useMemo(
    () =>
      composerControls.filter((button) => {
        if (button.slot !== 'actions') return false;
        const expr = button.when;
        if (!expr) return true;
        const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
        for (const clause of clauses) {
          const trimmed = clause.trim();
          if (trimmed === 'composerHasContent' && !composerHasContent) return false;
          if (trimmed === 'streamIsStreaming' && !streamIsStreaming) return false;
          if (trimmed === '!streamIsStreaming' && streamIsStreaming) return false;
        }
        return true;
      }),
    [composerControls, composerHasContent, streamIsStreaming],
  );

  const streamingSubmitLabel: Exclude<ConversationComposerSubmitLabel, 'Send'> =
    composerSubmitLabel === 'Follow up' ? composerSubmitLabel : 'Steer';

  const paClientByExtension = useRef<Map<string, ReturnType<typeof createNativeExtensionClient>>>(new Map());
  function getPaClient(extensionId: string) {
    let client = paClientByExtension.current.get(extensionId);
    if (!client) {
      client = createNativeExtensionClient(extensionId);
      paClientByExtension.current.set(extensionId, client);
    }
    return client;
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {visibleToolbarActions.length > 0 && (
        <div className="flex items-center gap-0.5 mr-1">
          {visibleToolbarActions.map((action) => (
            <IconButton
              key={action.id}
              size="sm"
              onClick={() => {
                void getPaClient(action.extensionId).extension.invoke(action.action, {});
              }}
              disabled={composerDisabled}
              className="disabled:opacity-40"
              title={action.title}
              aria-label={action.title}
            >
              <ToolbarActionIcon icon={action.icon} />
            </IconButton>
          ))}
        </div>
      )}
      {visibleComposerButtons.map((button) => (
        <ComposerButtonHost
          key={`${button.extensionId}:${button.id}`}
          registration={button}
          controlContext={{
            composerDisabled,
            streamIsStreaming,
            composerHasContent,
            renderMode: 'inline',
            openFilePicker: () => {},
            addFiles: () => {},
            insertText: onInsertComposerText,
            appendText: onAppendComposerText,
            models: [],
            currentModel: '',
            currentThinkingLevel: '',
            savingPreference: null,
            selectModel: () => {},
            selectThinkingLevel: () => {},
          }}
        />
      ))}
      {streamIsStreaming ? (
        <>
          {composerHasContent ? (
            <ComposerActionButton
              type="button"
              onClick={(event) => {
                onSubmitComposerActionForModifiers(streamingSubmitLabel === 'Follow up' || composerAltHeld || event.altKey);
              }}
              disabled={composerDisabled}
              size="compactLabel"
              tone={streamingSubmitLabel === 'Follow up' ? 'neutral' : 'warning'}
              title={streamingSubmitLabel}
              aria-label={streamingSubmitLabel}
            >
              <ComposerActionIcon label={streamingSubmitLabel} className="shrink-0" />
              <span>{formatComposerActionLabel(streamingSubmitLabel)}</span>
            </ComposerActionButton>
          ) : null}
          <ComposerActionButton
            type="button"
            onClick={onAbortStream}
            disabled={conversationNeedsTakeover}
            tone="danger"
            title={conversationNeedsTakeover ? 'Take over this conversation before stopping' : 'Stop'}
            aria-label="Stop"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3.25" y="3.25" width="9.5" height="9.5" rx="1.2" />
            </svg>
          </ComposerActionButton>
        </>
      ) : composerShowsQuestionSubmit ? (
        <ComposerActionButton
          type="button"
          onClick={onSubmitComposerQuestion}
          disabled={composerDisabled || !composerQuestionCanSubmit || composerQuestionSubmitting}
          size="label"
          tone={composerQuestionCanSubmit && !composerQuestionSubmitting ? 'accent' : 'disabled'}
          title={
            composerQuestionCanSubmit
              ? 'Submit answers'
              : `Answer ${composerQuestionRemainingCount} more ${composerQuestionRemainingCount === 1 ? 'question' : 'questions'} to submit`
          }
          aria-label="Submit answers"
        >
          <span aria-hidden="true">✓</span>
          <span>
            {composerQuestionSubmitting ? 'Submitting…' : composerQuestionCanSubmit ? 'Submit' : `${composerQuestionRemainingCount} left`}
          </span>
        </ComposerActionButton>
      ) : composerHasContent ? (
        <ComposerActionButton
          type="button"
          onClick={(event) => {
            onSubmitComposerActionForModifiers(composerSubmitLabel === 'Follow up' || composerAltHeld || event.altKey);
          }}
          disabled={composerDisabled}
          size={composerSubmitLabel === 'Send' ? 'icon' : 'label'}
          tone={composerSubmitLabel === 'Send' ? 'accent' : composerSubmitLabel === 'Steer' ? 'warning' : 'neutral'}
          title={composerSubmitLabel}
          aria-label={composerSubmitLabel}
        >
          {composerSubmitLabel === 'Send' ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          ) : (
            <>
              <ComposerActionIcon label={composerSubmitLabel} className="shrink-0" />
              <span>{formatComposerActionLabel(composerSubmitLabel)}</span>
            </>
          )}
        </ComposerActionButton>
      ) : (
        <ComposerActionButton type="button" disabled={true} tone="disabled" title="Send" aria-label="Send">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </ComposerActionButton>
      )}
    </div>
  );
}

function ToolbarActionIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'app':
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
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
        </svg>
      );
    case 'automation':
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
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case 'browser':
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
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'database':
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
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case 'diff':
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
          <path d="M8 6h8" />
          <path d="M8 12h6" />
          <path d="M8 18h4" />
        </svg>
      );
    case 'file':
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
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'gear':
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'graph':
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
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <path d="M6 9v3a3 3 0 0 0 3 3h3" />
          <path d="M18 9v3a3 3 0 0 1-3 3h-3" />
        </svg>
      );
    case 'kanban':
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
          <rect x="3" y="3" width="4" height="18" rx="1" />
          <rect x="10" y="3" width="4" height="12" rx="1" />
          <rect x="17" y="3" width="4" height="8" rx="1" />
        </svg>
      );
    case 'play':
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
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      );
    case 'sparkle':
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
          <path d="M12 3c.5 2.5 2.5 4.5 5 5-2.5.5-4.5 2.5-5 5-.5-2.5-2.5-4.5-5-5 2.5-.5 4.5-2.5 5-5z" />
          <path d="M19 17c-.7 1.2-2 2-3.5 2 1.5.7 2.5 2 2.5 3.5.7-1.5 2-2.5 3.5-2.5-1.5-.7-2.5-2-2.5-3.5z" />
        </svg>
      );
    case 'terminal':
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
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    default:
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
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
        </svg>
      );
  }
}
