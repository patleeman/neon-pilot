import {
  CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT,
  formatQueuedPromptImageSummary,
  formatQueuedPromptShelfText,
  summarizeQueuedRunCallbackPrompt,
  truncateConversationShelfText
} from "./chunk-TZQXEC6P.js";
import {
  setExtensionCommandContext
} from "./chunk-CZB4N5KA.js";
import {
  ShelfSection,
  ShelfStatusRow,
  TextButton
} from "./chunk-T4PTJAS4.js";
import "./chunk-P4G4CXIQ.js";
import {
  Fragment2 as Fragment,
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  useEffect
} from "./chunk-TTFLGCWD.js";
import "./chunk-MZHE4QUL.js";

// packages/desktop/ui/src/components/conversation/ConversationQueueShelf.tsx
init_neon_pilot_shared_react();
function ConversationQueueShelf({
  pendingQueue,
  conversationNeedsTakeover,
  onRestoreQueuedPrompt
}) {
  const firstRestorablePrompt = pendingQueue.find((message) => message.restorable !== false) ?? null;
  const canRestoreFirstQueuedPrompt = Boolean(firstRestorablePrompt && !conversationNeedsTakeover);
  useEffect(() => {
    setExtensionCommandContext("conversation.canRestoreFirstQueuedPrompt", canRestoreFirstQueuedPrompt);
    return () => setExtensionCommandContext("conversation.canRestoreFirstQueuedPrompt", null);
  }, [canRestoreFirstQueuedPrompt]);
  useEffect(() => {
    if (!firstRestorablePrompt || conversationNeedsTakeover) return;
    function handleRestoreFirstQueuedPromptCommand() {
      onRestoreQueuedPrompt(firstRestorablePrompt.type, firstRestorablePrompt.queueIndex, firstRestorablePrompt.id);
    }
    window.addEventListener(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT, handleRestoreFirstQueuedPromptCommand);
    return () => window.removeEventListener(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT, handleRestoreFirstQueuedPromptCommand);
  }, [conversationNeedsTakeover, firstRestorablePrompt, onRestoreQueuedPrompt]);
  return /* @__PURE__ */ jsx(Fragment, { children: pendingQueue.length > 0 && /* @__PURE__ */ jsx(ShelfSection, { bodyClassName: "gap-1.5 px-4 py-2.5", children: pendingQueue.map((message) => {
    const runCallbackSummary = summarizeQueuedRunCallbackPrompt(message.text);
    const imageSummary = formatQueuedPromptImageSummary(message.imageCount);
    const label = message.type === "steer" ? "Queued" : "Follow up";
    return /* @__PURE__ */ jsxs(
      ShelfStatusRow,
      {
        label,
        actions: message.restorable !== false ? /* @__PURE__ */ jsx(
          TextButton,
          {
            type: "button",
            onClick: () => {
              onRestoreQueuedPrompt(message.type, message.queueIndex, message.id);
            },
            disabled: conversationNeedsTakeover,
            className: "pt-0.5 text-[11px]",
            title: conversationNeedsTakeover ? "Take over this conversation before restoring queued prompts" : "Restore this queued prompt to the composer",
            "aria-label": "Restore queued prompt to the composer",
            children: "restore"
          }
        ) : /* @__PURE__ */ jsx("span", { className: "pt-0.5 text-[11px] text-dim/70", children: "remote" }),
        children: [
          runCallbackSummary ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("p", { className: "break-words text-[11px] font-medium leading-relaxed text-secondary", children: [
              "Background task ",
              runCallbackSummary.title
            ] }),
            runCallbackSummary.command ? /* @__PURE__ */ jsxs("p", { className: "mt-0.5 truncate font-mono text-[11px] text-dim", children: [
              "$ ",
              runCallbackSummary.command
            ] }) : null,
            runCallbackSummary.logTail ? /* @__PURE__ */ jsx("p", { className: "mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-dim", children: truncateConversationShelfText(runCallbackSummary.logTail, { maxChars: 180, maxLines: 2 }) }) : null
          ] }) : /* @__PURE__ */ jsx("p", { className: "whitespace-pre-wrap break-words text-[11px] leading-relaxed text-secondary", children: truncateConversationShelfText(formatQueuedPromptShelfText(message.text, message.imageCount)) }),
          imageSummary ? /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-dim", children: imageSummary }) : null
        ]
      },
      message.id
    );
  }) }) });
}
export {
  ConversationQueueShelf
};
