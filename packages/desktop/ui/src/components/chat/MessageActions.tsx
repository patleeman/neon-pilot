import { useEffect, useRef, useState } from 'react';

import { writeClipboardText } from '../../desktop/clipboard';
import { createNativeExtensionClient } from '../../extensions/nativePaClient';
import type { ExtensionMessageActionRegistration } from '../../extensions/useExtensionRegistry';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import { MessageActionButton } from '../ui';
import { MESSAGE_ACTION_COMMAND_EVENT, type MessageActionCommandDetail, registerMessageActionCapability } from './messageActionCommands';

/**
 * Simple `when` expression evaluator for message actions.
 * Supports predicates like "role:assistant && hasText".
 * If `when` is undefined or empty, the action always matches.
 */
function matchMessageActionWhen(
  action: ExtensionMessageActionRegistration,
  isUser: boolean | undefined,
  blockText: string | undefined,
): boolean {
  const expr = action.when;
  if (!expr) return true;

  const role = isUser ? 'user' : 'assistant';
  const hasText = typeof blockText === 'string' && blockText.length > 0;

  // Tokenize on && and evaluate each clause
  const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (trimmed === 'hasText') {
      if (!hasText) return false;
    } else if (trimmed.startsWith('role:')) {
      const expectedRole = trimmed.slice(5);
      if (role !== expectedRole) return false;
    } else {
      // Unknown predicate — skip (fail open for forward compat)
    }
  }

  return true;
}

export function MessageActions({
  isUser,
  blockText,
  blockId,
  conversationId,
  copyText,
  onFork,
  onRewind,
  onEdit,
}: {
  isUser?: boolean;
  blockText?: string;
  blockId?: string;
  conversationId?: string;
  copyText?: string;
  onFork?: () => Promise<void> | void;
  onRewind?: () => Promise<void> | void;
  onEdit?: () => void;
}) {
  const [isForking, setIsForking] = useState(false);
  const [isRewinding, setIsRewinding] = useState(false);
  const [busyActionIds, setBusyActionIds] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<Map<string, string>>(new Map());
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyResetTimeoutRef = useRef<number | null>(null);
  const canCopy = typeof copyText === 'string' && copyText.length > 0;
  const copyTitle = isUser ? 'Copy this prompt to the clipboard' : 'Copy this assistant message to the clipboard';
  const { messageActions } = useExtensionRegistry();

  const extensionActionInvocations = useRef<Map<string, ReturnType<typeof createNativeExtensionClient>>>(new Map());
  function getPaClient(extensionId: string) {
    let client = extensionActionInvocations.current.get(extensionId);
    if (!client) {
      client = createNativeExtensionClient(extensionId);
      extensionActionInvocations.current.set(extensionId, client);
    }
    return client;
  }

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!canCopy) return undefined;
    return registerMessageActionCapability('copy');
  }, [canCopy]);

  useEffect(() => {
    if (!onEdit) return undefined;
    return registerMessageActionCapability('edit');
  }, [onEdit]);

  useEffect(() => {
    if (!onRewind) return undefined;
    return registerMessageActionCapability('rewind');
  }, [onRewind]);

  useEffect(() => {
    if (!onFork) return undefined;
    return registerMessageActionCapability('fork');
  }, [onFork]);

  useEffect(() => {
    function handleMessageActionCommand(event: Event) {
      const detail = (event as CustomEvent<MessageActionCommandDetail>).detail;
      if (!detail || detail.handled) return;

      if (detail.command === 'copyFirst' && canCopy) {
        detail.handled = true;
        void handleCopy();
      } else if (detail.command === 'editFirst' && onEdit) {
        detail.handled = true;
        onEdit();
      } else if (detail.command === 'rewindFirst' && onRewind && !isRewinding) {
        detail.handled = true;
        void handleRewind();
      } else if (detail.command === 'forkFirst' && onFork && !isForking) {
        detail.handled = true;
        void handleFork();
      }
    }

    window.addEventListener(MESSAGE_ACTION_COMMAND_EVENT, handleMessageActionCommand);
    return () => window.removeEventListener(MESSAGE_ACTION_COMMAND_EVENT, handleMessageActionCommand);
  }, [canCopy, isForking, isRewinding, onEdit, onFork, onRewind, copyText]);

  function setTransientCopyState(nextState: 'copied' | 'failed') {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }

    setCopyState(nextState);
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopyState('idle');
      copyResetTimeoutRef.current = null;
    }, 1200);
  }

  async function handleFork() {
    if (!onFork || isForking) {
      return;
    }

    try {
      setIsForking(true);
      await onFork();
    } finally {
      setIsForking(false);
    }
  }

  async function handleRewind() {
    if (!onRewind || isRewinding) {
      return;
    }

    try {
      setIsRewinding(true);
      await onRewind();
    } finally {
      setIsRewinding(false);
    }
  }

  async function handleCopy() {
    if (!canCopy) {
      return;
    }

    try {
      await writeClipboardText(copyText);
      setTransientCopyState('copied');
    } catch {
      setTransientCopyState('failed');
    }
  }

  return (
    <div
      className={`flex items-center gap-0 opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100 ${
        isUser ? 'justify-start' : 'justify-end'
      }`}
    >
      {canCopy && (
        <MessageActionButton
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          tone={copyState === 'copied' ? 'accent' : copyState === 'failed' ? 'danger' : 'default'}
          title={copyState === 'failed' ? 'Copy to clipboard failed' : copyTitle}
        >
          {copyState === 'copied' ? '⎘ copied' : copyState === 'failed' ? '⎘ copy failed' : '⎘ copy'}
        </MessageActionButton>
      )}
      {onEdit && (
        <MessageActionButton type="button" onClick={onEdit} title="Edit this prompt and rerun the conversation from here">
          ✎ edit
        </MessageActionButton>
      )}
      {onRewind && (
        <MessageActionButton
          type="button"
          onClick={() => {
            void handleRewind();
          }}
          tone={isRewinding ? 'accent' : 'default'}
          title={
            isUser ? 'Rewind into a new conversation from this prompt' : 'Rewind into a new conversation from the prompt that led here'
          }
          disabled={isRewinding}
        >
          {isRewinding ? '↩ rewinding…' : '↩ rewind'}
        </MessageActionButton>
      )}
      {onFork && (
        <MessageActionButton
          type="button"
          onClick={() => {
            void handleFork();
          }}
          tone={isForking ? 'accent' : 'default'}
          title={isUser ? 'Fork into a new conversation with this prompt in the input' : 'Fork into a new conversation from here'}
          disabled={isForking}
        >
          {isForking ? '⑂ forking…' : '⑂ fork'}
        </MessageActionButton>
      )}
      {messageActions.map((action) => {
        if (!matchMessageActionWhen(action, isUser, blockText)) return null;
        const busy = busyActionIds.has(action.id);
        const actionError = actionErrors.get(action.id);
        return (
          <MessageActionButton
            key={action.id}
            type="button"
            onClick={() => {
              void (async () => {
                setBusyActionIds((prev) => new Set(prev).add(action.id));
                try {
                  setActionErrors((prev) => {
                    const next = new Map(prev);
                    next.delete(action.id);
                    return next;
                  });
                  await getPaClient(action.extensionId).extension.invoke(action.action, {
                    messageText: blockText ?? '',
                    messageRole: isUser ? 'user' : 'assistant',
                    blockId: blockId ?? '',
                    conversationId: conversationId ?? '',
                  });
                } catch (error) {
                  setActionErrors((prev) => {
                    const next = new Map(prev);
                    next.set(action.id, error instanceof Error ? error.message : String(error));
                    return next;
                  });
                } finally {
                  setBusyActionIds((prev) => {
                    const next = new Set(prev);
                    next.delete(action.id);
                    return next;
                  });
                }
              })();
            }}
            tone={actionError ? 'danger' : busy ? 'accent' : 'default'}
            title={actionError ? `${action.title} failed: ${actionError}` : action.title}
            disabled={busy}
          >
            {actionError ? `${action.title} failed` : action.title}
          </MessageActionButton>
        );
      })}
    </div>
  );
}
