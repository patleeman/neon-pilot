// packages/desktop/ui/src/commands/slashCommandSchema.ts
var THINKING_LEVEL_VALUES = ["minimal", "low", "medium", "high", "xhigh"];
var SERVICE_TIER_VALUES = ["auto", "priority"];
var AUTO_MODE_VALUES = ["manual", "nudge", "mission", "loop"];
var STRUCTURED_SLASH_COMMANDS = [
  { name: "status", owner: "core", description: "Show current thread state.", executionClass: "ephemeral" },
  { name: "heartbeat", owner: "core", description: "Show a lightweight thread health heartbeat.", executionClass: "ephemeral" },
  {
    name: "stop",
    owner: "core",
    description: "Stop the current foreground agent turn.",
    executionClass: "action",
    requiresConversation: true
  },
  {
    name: "continue",
    owner: "core",
    description: "Continue or resume this conversation.",
    executionClass: "action",
    requiresConversation: true
  },
  {
    name: "compact",
    owner: "core",
    description: "Compact current conversation context.",
    executionClass: "action",
    requiresConversation: true,
    argument: { kind: "freeform", name: "guidance", placeholder: "optional guidance" }
  },
  {
    name: "summarize",
    owner: "core",
    description: "Ask the agent to summarize this conversation.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "focus", placeholder: "optional focus" }
  },
  {
    name: "rename",
    owner: "core",
    description: "Rename this conversation.",
    executionClass: "action",
    requiresConversation: true,
    argument: { kind: "freeform", name: "title", required: true, placeholder: "title" }
  },
  {
    name: "export",
    owner: "core",
    description: "Export this conversation.",
    executionClass: "action",
    requiresConversation: true,
    argument: { kind: "freeform", name: "path", placeholder: "optional path" }
  },
  { name: "copy", owner: "core", description: "Copy the last assistant response.", executionClass: "action" },
  {
    name: "queue",
    owner: "core",
    description: "Show queued follow-ups.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "clear", description: "Clear queued follow-ups.", executionClass: "action", requiresConversation: true },
      {
        name: "restore",
        description: "Restore a queued follow-up into the composer.",
        executionClass: "action",
        requiresConversation: true
      }
    ]
  },
  {
    name: "deferred_resume",
    owner: "core",
    description: "Manage scheduled continuations for this conversation.",
    executionClass: "ephemeral",
    requiresConversation: true,
    subcommands: [
      {
        name: "add",
        description: "Schedule a deferred resume.",
        executionClass: "action",
        requiresConversation: true,
        argument: { kind: "freeform", name: "delay and prompt", required: true, placeholder: "10m check the build" }
      },
      {
        name: "fire",
        description: "Fire a deferred resume now.",
        executionClass: "action",
        requiresConversation: true,
        argument: { kind: "dynamic", name: "id", source: "deferredResumes", required: true, placeholder: "id or first" }
      },
      {
        name: "cancel",
        description: "Cancel deferred resume work.",
        executionClass: "action",
        requiresConversation: true,
        argument: { kind: "dynamic", name: "id", source: "deferredResumes", required: true, placeholder: "id, first, or all" }
      }
    ]
  },
  {
    name: "cwd",
    owner: "core",
    description: "Show or change this thread working directory.",
    executionClass: "ephemeral",
    subcommands: [
      {
        name: "set",
        description: "Set this thread working directory.",
        executionClass: "action",
        requiresConversation: true,
        argument: { kind: "freeform", name: "path", required: true, placeholder: "path" }
      },
      { name: "clear", description: "Clear the explicit working directory.", executionClass: "action", requiresConversation: true }
    ]
  },
  {
    name: "tools",
    owner: "core",
    description: "Show active tools for this thread.",
    executionClass: "ephemeral"
  },
  {
    name: "context",
    owner: "core",
    description: "Show attached context for this thread.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "list", description: "List attached context." },
      { name: "add", description: "Attach context.", argument: { kind: "freeform", name: "path or reference", required: true } },
      { name: "remove", description: "Remove attached context.", argument: { kind: "freeform", name: "id", required: true } },
      { name: "clear", description: "Clear attached context." }
    ]
  },
  { name: "context_usage", owner: "core", description: "Show context usage for this thread.", executionClass: "ephemeral" },
  { name: "fork", owner: "core", description: "Fork this thread.", executionClass: "action", requiresConversation: true },
  { name: "duplicate", owner: "core", description: "Duplicate this thread.", executionClass: "action", requiresConversation: true },
  { name: "pin", owner: "core", description: "Pin or unpin this thread.", executionClass: "action", requiresConversation: true },
  { name: "lock", owner: "core", description: "Lock or unlock this thread.", executionClass: "action", requiresConversation: true },
  { name: "archive", owner: "core", description: "Archive this thread.", executionClass: "action", requiresConversation: true },
  {
    name: "model",
    owner: "system-model-picker",
    description: "Show or change this thread model.",
    executionClass: "ephemeral",
    subcommands: [
      {
        name: "set",
        description: "Set thread model.",
        executionClass: "action",
        argument: { kind: "dynamic", name: "model", source: "models", required: true }
      },
      { name: "clear", description: "Use the default model.", executionClass: "action" }
    ]
  },
  {
    name: "thinking_level",
    owner: "system-model-picker",
    description: "Show or change thinking level.",
    executionClass: "ephemeral",
    subcommands: [
      {
        name: "set",
        description: "Set thinking level.",
        executionClass: "action",
        argument: { kind: "enum", name: "level", values: THINKING_LEVEL_VALUES, required: true }
      },
      { name: "clear", description: "Use the default thinking level.", executionClass: "action" }
    ]
  },
  {
    name: "service_tier",
    owner: "system-model-picker",
    description: "Show or change service tier.",
    executionClass: "ephemeral",
    subcommands: [
      {
        name: "set",
        description: "Set service tier.",
        executionClass: "action",
        argument: { kind: "enum", name: "tier", values: SERVICE_TIER_VALUES, required: true }
      },
      { name: "clear", description: "Use the default service tier.", executionClass: "action" }
    ]
  },
  {
    name: "goal",
    owner: "system-auto-mode",
    description: "Show or manage this conversation goal.",
    executionClass: "ephemeral",
    subcommands: [
      {
        name: "set",
        description: "Set the current goal.",
        executionClass: "action",
        argument: { kind: "freeform", name: "objective", required: true }
      },
      { name: "pause", description: "Pause the current goal.", executionClass: "action" },
      { name: "resume", description: "Resume the current goal.", executionClass: "action" },
      { name: "clear", description: "Clear the current goal.", executionClass: "action" }
    ]
  },
  {
    name: "auto_mode",
    owner: "system-auto-mode",
    description: "Show or change automatic continuation mode.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "set", description: "Set auto mode.", argument: { kind: "enum", name: "mode", values: AUTO_MODE_VALUES, required: true } },
      { name: "clear", description: "Return to manual mode." }
    ]
  },
  {
    name: "mission",
    owner: "system-auto-mode",
    description: "Manage mission mode.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "start", description: "Start mission mode.", argument: { kind: "freeform", name: "goal", required: true } },
      { name: "stop", description: "Stop mission mode." }
    ]
  },
  {
    name: "loop",
    owner: "system-auto-mode",
    description: "Manage loop mode.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "start", description: "Start loop mode.", argument: { kind: "freeform", name: "count and prompt", required: true } },
      { name: "stop", description: "Stop loop mode." }
    ]
  },
  {
    name: "scheduled_task",
    owner: "system-automations",
    description: "Manage scheduled tasks owned by this thread.",
    executionClass: "ephemeral",
    subcommands: ["list", "add", "run", "pause", "resume", "delete"].map((name) => ({
      name,
      description: `${name.charAt(0).toUpperCase()}${name.slice(1)} a scheduled task.`,
      argument: name === "list" ? void 0 : { kind: "dynamic", name: "task", source: "scheduledTasks", required: name !== "add" }
    }))
  },
  {
    name: "background_command",
    owner: "system-runs",
    description: "Manage thread background commands.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "list", description: "List background commands." },
      {
        name: "start",
        description: "Start a durable background shell command.",
        executionClass: "prompt",
        argument: { kind: "freeform", name: "shell command", required: true }
      },
      {
        name: "cancel",
        description: "Cancel a background command.",
        argument: { kind: "dynamic", name: "id", source: "backgroundCommands", required: true }
      },
      {
        name: "rerun",
        description: "Rerun a background command.",
        argument: { kind: "dynamic", name: "id", source: "backgroundCommands", required: true }
      },
      {
        name: "logs",
        description: "Show background command logs.",
        argument: { kind: "dynamic", name: "id", source: "backgroundCommands", required: true }
      }
    ]
  },
  {
    name: "subagent",
    owner: "system-runs",
    description: "Manage thread-linked subagents.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "list", description: "List subagents." },
      {
        name: "start",
        description: "Start a subagent.",
        executionClass: "prompt",
        argument: { kind: "freeform", name: "objective", required: true }
      },
      { name: "cancel", description: "Cancel a subagent.", argument: { kind: "dynamic", name: "id", source: "subagents", required: true } },
      {
        name: "follow_up",
        description: "Send a follow-up to a subagent.",
        argument: { kind: "dynamic", name: "id", source: "subagents", required: true }
      },
      { name: "logs", description: "Show subagent logs.", argument: { kind: "dynamic", name: "id", source: "subagents", required: true } }
    ]
  },
  {
    name: "todo",
    owner: "system-todo",
    description: "Manage conversation todos.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "add", description: "Add a todo.", argument: { kind: "freeform", name: "item", required: true } },
      { name: "done", description: "Mark a todo done.", argument: { kind: "freeform", name: "id or number", required: true } },
      { name: "update", description: "Update a todo.", argument: { kind: "freeform", name: "id and text", required: true } },
      { name: "delete", description: "Delete a todo.", argument: { kind: "freeform", name: "id or number", required: true } },
      { name: "clear", description: "Clear todos." }
    ]
  },
  {
    name: "artifact",
    owner: "system-artifacts",
    description: "Show or open artifacts in this thread.",
    executionClass: "ephemeral",
    subcommands: [
      { name: "list", description: "List artifacts." },
      { name: "open", description: "Open an artifact.", argument: { kind: "dynamic", name: "id", source: "artifacts", required: true } },
      { name: "close", description: "Close the active artifact." }
    ]
  },
  {
    name: "visualize",
    owner: "system-artifacts",
    description: "Create a visual explainer artifact.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "topic", required: true }
  },
  {
    name: "diff_review",
    owner: "system-artifacts",
    description: "Create a visual diff review artifact.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "scope" }
  },
  {
    name: "plan_review",
    owner: "system-artifacts",
    description: "Create a visual plan review artifact.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "plan or scope", required: true }
  },
  {
    name: "project_recap",
    owner: "system-artifacts",
    description: "Create a visual project recap artifact.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "scope" }
  },
  {
    name: "slides",
    owner: "system-artifacts",
    description: "Create a slide deck artifact.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "topic or source", required: true }
  },
  {
    name: "checkpoint",
    owner: "system-diffs",
    description: "Manage code checkpoints for this thread.",
    executionClass: "ephemeral",
    subcommands: [
      {
        name: "save",
        description: "Save a checkpoint.",
        executionClass: "prompt",
        argument: { kind: "freeform", name: "message", required: true }
      },
      { name: "list", description: "List checkpoints." },
      { name: "open", description: "Open a checkpoint.", argument: { kind: "dynamic", name: "id", source: "checkpoints", required: true } }
    ]
  },
  { name: "diff_summary", owner: "system-diffs", description: "Summarize current workspace diff.", executionClass: "prompt" },
  { name: "attach", owner: "system-composer-attachments", description: "Open the attachment picker.", executionClass: "action" },
  { name: "drawing", owner: "system-composer-attachments", description: "Open the drawing tool.", executionClass: "action" },
  { name: "dictation", owner: "system-composer-attachments", description: "Toggle dictation into the composer.", executionClass: "action" },
  {
    name: "probe_image",
    owner: "system-image-probe",
    description: "Ask about attached images.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "question", required: true }
  },
  {
    name: "video",
    owner: "system-video-probe",
    description: "Inspect attached video.",
    executionClass: "ephemeral",
    subcommands: [
      {
        name: "sample",
        description: "Sample frames from a video.",
        executionClass: "prompt",
        argument: { kind: "dynamic", name: "video id", source: "videos" }
      },
      {
        name: "transcribe",
        description: "Transcribe a video.",
        executionClass: "prompt",
        argument: { kind: "dynamic", name: "video id", source: "videos" }
      }
    ]
  },
  {
    name: "mcp_tools",
    owner: "system-mcp",
    description: "Show MCP tools available to this thread.",
    executionClass: "ephemeral",
    subcommands: [{ name: "refresh", description: "Refresh MCP tool config." }]
  },
  {
    name: "skill_search",
    owner: "system-skill-search",
    description: "Search available skills.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "query", required: true }
  },
  {
    name: "skill",
    owner: "system-skill-search",
    description: "Use a skill.",
    executionClass: "prompt",
    subcommands: [
      { name: "use", description: "Use a skill.", argument: { kind: "dynamic", name: "name", source: "skills", required: true } }
    ]
  },
  {
    name: "prompt_context",
    owner: "system-prompt-assembly",
    description: "Show assembled prompt context.",
    executionClass: "ephemeral",
    subcommands: [{ name: "refresh", description: "Refresh prompt context." }]
  },
  {
    name: "search",
    owner: "system-web-tools",
    description: "Search the web.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "query", required: true }
  },
  {
    name: "fetch",
    owner: "system-web-tools",
    description: "Fetch and read a URL.",
    executionClass: "prompt",
    argument: { kind: "freeform", name: "url", required: true }
  }
];
var COMMAND_BY_NAME = new Map(STRUCTURED_SLASH_COMMANDS.map((command) => [command.name, command]));

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
