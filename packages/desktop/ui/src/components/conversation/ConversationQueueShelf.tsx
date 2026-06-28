import { useEffect } from 'react';

import {
  formatQueuedPromptImageSummary,
  formatQueuedPromptShelfText,
  summarizeQueuedRunCallbackPrompt,
  truncateConversationShelfText,
} from '../../conversation/conversationComposerPresentation';
import { setExtensionCommandContext } from '../../extensions/commands';
import { ShelfSection, ShelfStatusRow, TextButton } from '../ui';
import { CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT } from './conversationQueueCommands';

export interface ConversationPendingQueueItem {
  id: string;
  text: string;
  imageCount: number;
  restorable: boolean;
  type: 'steer' | 'followUp';
  queueIndex: number;
}

export function ConversationQueueShelf({
  pendingQueue,
  conversationNeedsTakeover,
  onRestoreQueuedPrompt,
}: {
  pendingQueue: ConversationPendingQueueItem[];
  conversationNeedsTakeover: boolean;
  onRestoreQueuedPrompt: (behavior: 'steer' | 'followUp', queueIndex: number, previewId?: string) => void;
}) {
  const firstRestorablePrompt = pendingQueue.find((message) => message.restorable !== false) ?? null;
  const canRestoreFirstQueuedPrompt = Boolean(firstRestorablePrompt && !conversationNeedsTakeover);

  useEffect(() => {
    setExtensionCommandContext('conversation.canRestoreFirstQueuedPrompt', canRestoreFirstQueuedPrompt);
    return () => setExtensionCommandContext('conversation.canRestoreFirstQueuedPrompt', null);
  }, [canRestoreFirstQueuedPrompt]);

  useEffect(() => {
    if (!firstRestorablePrompt || conversationNeedsTakeover) return;
    function handleRestoreFirstQueuedPromptCommand() {
      onRestoreQueuedPrompt(firstRestorablePrompt!.type, firstRestorablePrompt!.queueIndex, firstRestorablePrompt!.id);
    }
    window.addEventListener(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT, handleRestoreFirstQueuedPromptCommand);
    return () => window.removeEventListener(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT, handleRestoreFirstQueuedPromptCommand);
  }, [conversationNeedsTakeover, firstRestorablePrompt, onRestoreQueuedPrompt]);

  return (
    <>
      {pendingQueue.length > 0 && (
        <ShelfSection bodyClassName="gap-1.5 px-4 py-2.5">
          {pendingQueue.map((message) => {
            const runCallbackSummary = summarizeQueuedRunCallbackPrompt(message.text);
            const imageSummary = formatQueuedPromptImageSummary(message.imageCount);
            const label = message.type === 'steer' ? 'Queued' : 'Follow up';

            return (
              <ShelfStatusRow
                key={message.id}
                label={label}
                actions={
                  message.restorable !== false ? (
                    <TextButton
                      type="button"
                      onClick={() => {
                        onRestoreQueuedPrompt(message.type, message.queueIndex, message.id);
                      }}
                      disabled={conversationNeedsTakeover}
                      className="pt-0.5 text-[11px]"
                      title={
                        conversationNeedsTakeover
                          ? 'Take over this conversation before restoring queued prompts'
                          : 'Restore this queued prompt to the composer'
                      }
                      aria-label="Restore queued prompt to the composer"
                    >
                      restore
                    </TextButton>
                  ) : (
                    <span className="pt-0.5 text-[11px] text-dim/70">remote</span>
                  )
                }
              >
                {runCallbackSummary ? (
                  <>
                    <p className="break-words text-[11px] font-medium leading-relaxed text-secondary">
                      Background task {runCallbackSummary.title}
                    </p>
                    {runCallbackSummary.command ? (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-dim">$ {runCallbackSummary.command}</p>
                    ) : null}
                    {runCallbackSummary.logTail ? (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-dim">
                        {truncateConversationShelfText(runCallbackSummary.logTail, { maxChars: 180, maxLines: 2 })}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-secondary">
                    {truncateConversationShelfText(formatQueuedPromptShelfText(message.text, message.imageCount))}
                  </p>
                )}
                {imageSummary ? <p className="mt-0.5 text-[11px] text-dim">{imageSummary}</p> : null}
              </ShelfStatusRow>
            );
          })}
        </ShelfSection>
      )}
    </>
  );
}
