// packages/desktop/ui/src/conversation/conversationComposerPresentation.ts
var COMPOSER_SHELF_TEXT_MAX_CHARS = 640;
var COMPOSER_SHELF_TEXT_MAX_LINES = 8;
function truncateConversationShelfText(text, options = {}) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const maxChars = typeof options.maxChars === "number" && Number.isSafeInteger(options.maxChars) && options.maxChars > 0 ? Math.min(COMPOSER_SHELF_TEXT_MAX_CHARS, options.maxChars) : COMPOSER_SHELF_TEXT_MAX_CHARS;
  const maxLines = typeof options.maxLines === "number" && Number.isSafeInteger(options.maxLines) && options.maxLines > 0 ? Math.min(COMPOSER_SHELF_TEXT_MAX_LINES, options.maxLines) : COMPOSER_SHELF_TEXT_MAX_LINES;
  const lines = normalized.split("\n");
  const truncatedByLines = lines.length > maxLines;
  const lineLimited = truncatedByLines ? lines.slice(0, maxLines).join("\n") : normalized;
  const truncatedByChars = lineLimited.length > maxChars;
  const charLimited = truncatedByChars ? `${lineLimited.slice(0, maxChars).trimEnd()}\u2026` : lineLimited;
  if (!truncatedByLines) {
    return charLimited;
  }
  return charLimited.endsWith("\u2026") ? charLimited : `${charLimited.trimEnd()}\u2026`;
}
function formatQueuedPromptShelfText(text, imageCount) {
  if (text.trim().length > 0) {
    return text;
  }
  if (imageCount > 0) {
    return "(image only)";
  }
  return "(empty queued prompt)";
}
function formatQueuedPromptImageSummary(imageCount) {
  if (!Number.isSafeInteger(imageCount) || imageCount <= 0) {
    return null;
  }
  return `${imageCount} image${imageCount === 1 ? "" : "s"} attached`;
}
function readKeyValueLine(lines, key) {
  const prefix = `${key}=`;
  const value = lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim();
  return value ? value : void 0;
}
function formatBackgroundRunStatus(status) {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "interrupted":
      return "interrupted";
    default:
      return "finished";
  }
}
function summarizeQueuedRunCallbackPrompt(text) {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const runId = normalized.match(/^\s*(?:Durable run|Background task)\s+(\S+)\s+has finished\./)?.[1];
  if (!runId || !/\nRecent log tail:\n/.test(normalized)) {
    return null;
  }
  const lines = normalized.split("\n");
  const taskSlug = readKeyValueLine(lines, "taskSlug");
  const status = readKeyValueLine(lines, "status");
  const logPath = readKeyValueLine(lines, "log");
  if (!taskSlug || !status || !logPath) {
    return null;
  }
  const logTailStart = lines.findIndex((line) => line.trim() === "Recent log tail:");
  const rawLogTail = logTailStart >= 0 ? lines.slice(logTailStart + 1).join("\n") : "";
  const logTail = rawLogTail.replace(/\n\s*Use run get\/logs if you need more detail\. Then continue from this point\.\s*$/s, "").trim();
  const command = readKeyValueLine(lines, "command");
  return {
    runId,
    taskSlug,
    status,
    title: `${taskSlug} ${formatBackgroundRunStatus(status)}`,
    ...command ? { command } : {},
    ...logTail ? { logTail } : {}
  };
}
function formatComposerActionLabel(label) {
  return label === "Follow up" ? "followup" : label.toLowerCase();
}

// packages/desktop/ui/src/components/conversation/conversationQueueCommands.ts
var CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT = "neon-pilot-conversation-restore-first-queued-prompt-command";

export {
  truncateConversationShelfText,
  formatQueuedPromptShelfText,
  formatQueuedPromptImageSummary,
  summarizeQueuedRunCallbackPrompt,
  formatComposerActionLabel,
  CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT
};
