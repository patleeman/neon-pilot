import { type ReactNode, useEffect, useRef, useState } from 'react';

import { writeClipboardText } from '../../desktop/clipboard';
import { createNativeExtensionClient } from '../../extensions/nativePaClient';
import type { ExtensionMessageActionRegistration } from '../../extensions/useExtensionRegistry';
import { useExtensionRegistry } from '../../extensions/useExtensionRegistry';
import { notifyDesktopConversationStateRefresh } from '../../hooks/useDesktopConversationState';
import { addNotification } from '../notifications/notificationStore';
import { MessageActionButton, Tooltip } from '../ui';
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

const iconButtonClassName = 'ui-message-action-button-icon';

function MessageActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="ui-tooltip-host relative inline-flex">
      {children}
      <Tooltip position="top-right">{label}</Tooltip>
    </span>
  );
}

function extensionActionIcon(action: ExtensionMessageActionRegistration): string {
  const title = action.title.trim().toLowerCase();
  if (title.includes('compare') || title.includes('model')) return '⇄';
  if (title.includes('copy')) return '⎘';
  if (title.includes('fork')) return '⑂';
  if (title.includes('rewind')) return '↩';
  if (title.includes('edit')) return '✎';
  return action.title.trim().charAt(0).toUpperCase() || '•';
}

function extensionActionSource(action: ExtensionMessageActionRegistration): string {
  const id = action.extensionId.replace(/^system-/, '').trim();
  if (!id) return action.title;
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cleanExtensionActionErrorMessage(action: ExtensionMessageActionRegistration, error: unknown): string {
  let message = readErrorMessage(error).trim();
  const wrappers = [
    new RegExp(`^${escapeRegExp(action.title)} failed:\\s*`, 'i'),
    /^Extension\s+"[^"]+"\s+action\s+"[^"]+"\s+failed:\s*/i,
    /^Extension backend action failed:\s*/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const wrapper of wrappers) {
      const next = message.replace(wrapper, '').trim();
      if (next !== message) {
        message = next;
        changed = true;
      }
    }
  }
  return message || `${action.title} failed.`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readRefreshConversationId(result: unknown): string {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return '';
  }
  const value = (result as { refreshConversationId?: unknown }).refreshConversationId;
  return typeof value === 'string' ? value.trim() : '';
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
  const [actionStatuses, setActionStatuses] = useState<Map<string, string>>(new Map());
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyResetTimeoutRef = useRef<number | null>(null);
  const actionStatusResetTimeoutsRef = useRef<Map<string, number>>(new Map());
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
      for (const timeoutId of actionStatusResetTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      actionStatusResetTimeoutsRef.current.clear();
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
        <MessageActionTooltip label={copyState === 'failed' ? 'Copy to clipboard failed' : copyTitle}>
          <MessageActionButton
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            tone={copyState === 'copied' ? 'accent' : copyState === 'failed' ? 'danger' : 'default'}
            aria-label={copyState === 'failed' ? 'Copy to clipboard failed' : copyTitle}
            className={iconButtonClassName}
          >
            {copyState === 'copied' ? '✓' : copyState === 'failed' ? '!' : '⎘'}
          </MessageActionButton>
        </MessageActionTooltip>
      )}
      {onEdit && (
        <MessageActionTooltip label="Edit this prompt and rerun the conversation from here">
          <MessageActionButton
            type="button"
            onClick={onEdit}
            aria-label="Edit this prompt and rerun the conversation from here"
            className={iconButtonClassName}
          >
            ✎
          </MessageActionButton>
        </MessageActionTooltip>
      )}
      {onRewind && (
        <MessageActionTooltip
          label={
            isUser ? 'Rewind into a new conversation from this prompt' : 'Rewind into a new conversation from the prompt that led here'
          }
        >
          <MessageActionButton
            type="button"
            onClick={() => {
              void handleRewind();
            }}
            tone={isRewinding ? 'accent' : 'default'}
            aria-label={
              isUser ? 'Rewind into a new conversation from this prompt' : 'Rewind into a new conversation from the prompt that led here'
            }
            disabled={isRewinding}
            className={iconButtonClassName}
          >
            {isRewinding ? '…' : '↩'}
          </MessageActionButton>
        </MessageActionTooltip>
      )}
      {onFork && (
        <MessageActionTooltip
          label={isUser ? 'Fork into a new conversation with this prompt in the input' : 'Fork into a new conversation from here'}
        >
          <MessageActionButton
            type="button"
            onClick={() => {
              void handleFork();
            }}
            tone={isForking ? 'accent' : 'default'}
            aria-label={isUser ? 'Fork into a new conversation with this prompt in the input' : 'Fork into a new conversation from here'}
            disabled={isForking}
            className={iconButtonClassName}
          >
            {isForking ? '…' : '⑂'}
          </MessageActionButton>
        </MessageActionTooltip>
      )}
      {messageActions.map((action) => {
        if (!matchMessageActionWhen(action, isUser, blockText)) return null;
        const busy = busyActionIds.has(action.id);
        const actionError = actionErrors.get(action.id);
        const actionStatus = actionStatuses.get(action.id);
        const title = actionError
          ? `${action.title} failed. See notification.`
          : actionStatus
            ? `${action.title}: ${actionStatus}`
            : action.title;
        return (
          <MessageActionTooltip key={action.id} label={title}>
            <MessageActionButton
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
                    const result = await getPaClient(action.extensionId).extension.invoke(action.action, {
                      messageText: blockText ?? '',
                      messageRole: isUser ? 'user' : 'assistant',
                      blockId: blockId ?? '',
                      conversationId: conversationId ?? '',
                    });
                    const refreshConversationId = readRefreshConversationId(result);
                    if (refreshConversationId) {
                      notifyDesktopConversationStateRefresh(refreshConversationId);
                    }
                    const statusText =
                      result && typeof result === 'object' && 'text' in result && typeof result.text === 'string' ? result.text.trim() : '';
                    if (statusText) {
                      const existingTimeoutId = actionStatusResetTimeoutsRef.current.get(action.id);
                      if (existingTimeoutId !== undefined) window.clearTimeout(existingTimeoutId);
                      setActionStatuses((prev) => {
                        const next = new Map(prev);
                        next.set(action.id, statusText);
                        return next;
                      });
                      const timeoutId = window.setTimeout(() => {
                        actionStatusResetTimeoutsRef.current.delete(action.id);
                        setActionStatuses((prev) => {
                          const next = new Map(prev);
                          next.delete(action.id);
                          return next;
                        });
                      }, 6000);
                      actionStatusResetTimeoutsRef.current.set(action.id, timeoutId);
                    }
                  } catch (error) {
                    const cleanedMessage = cleanExtensionActionErrorMessage(action, error);
                    const existingTimeoutId = actionStatusResetTimeoutsRef.current.get(action.id);
                    if (existingTimeoutId !== undefined) {
                      window.clearTimeout(existingTimeoutId);
                      actionStatusResetTimeoutsRef.current.delete(action.id);
                    }
                    setActionStatuses((prev) => {
                      const next = new Map(prev);
                      next.delete(action.id);
                      return next;
                    });
                    setActionErrors((prev) => {
                      const next = new Map(prev);
                      next.set(action.id, cleanedMessage);
                      return next;
                    });
                    addNotification({
                      type: 'error',
                      message: `${action.title} failed.`,
                      details: cleanedMessage,
                      source: extensionActionSource(action),
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
              tone={actionError ? 'danger' : busy || actionStatus ? 'accent' : 'default'}
              aria-label={title}
              disabled={busy}
              className={iconButtonClassName}
            >
              {actionError ? '!' : busy ? '…' : extensionActionIcon(action)}
            </MessageActionButton>
          </MessageActionTooltip>
        );
      })}
    </div>
  );
}
