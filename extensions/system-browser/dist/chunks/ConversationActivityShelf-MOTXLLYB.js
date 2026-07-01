import {
  describeDeferredResumeStatus,
  formatDeferredResumeWhen
} from "./chunk-RUG6BXWL.js";
import {
  timeAgo
} from "./chunk-DP4YXAPY.js";
import {
  setExtensionCommandContext
} from "./chunk-2N3GWURJ.js";
import {
  MetaLabel,
  RowButton,
  ShelfHeader,
  ShelfSection,
  Spinner,
  TextButton,
  cx
} from "./chunk-GBCNBHDJ.js";
import "./chunk-P4G4CXIQ.js";
import {
  Fragment2 as Fragment,
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  useEffect
} from "./chunk-TTFLGCWD.js";
import "./chunk-MZHE4QUL.js";

// packages/desktop/ui/src/components/conversation/ConversationActivityShelf.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/conversation/conversationActivityCommands.ts
var CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT = "neon-pilot-conversation-continue-deferred-resumes-command";
var CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT = "neon-pilot-conversation-toggle-background-run-details-command";
var CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT = "neon-pilot-conversation-toggle-deferred-resume-details-command";
var CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT = "neon-pilot-conversation-toggle-scheduled-task-details-command";
var CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT = "neon-pilot-conversation-open-latest-background-run-command";
var CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT = "neon-pilot-conversation-cancel-latest-background-run-command";
var CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT = "neon-pilot-conversation-run-first-scheduled-task-command";
var CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT = "neon-pilot-conversation-open-first-scheduled-task-command";
var CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT = "neon-pilot-conversation-fire-first-deferred-resume-command";
var CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT = "neon-pilot-conversation-cancel-first-deferred-resume-command";

// packages/desktop/ui/src/components/conversation/ConversationActivityShelf.tsx
function formatScheduledTaskSchedule(task) {
  if (task.scheduleType === "cron" && task.cron) return task.cron;
  if (task.at) return `at ${task.at}`;
  return task.scheduleType;
}
function formatScheduledTaskStatus(task) {
  if (task.running) return "running";
  if (!task.enabled) return "disabled";
  if (task.lastStatus === "failed") return "failed";
  return "enabled";
}
function formatExecutionStatusLabel(status) {
  if (status === "queued") return "queued";
  if (status === "waiting") return "waiting";
  if (status === "recovering") return "recovering";
  return status ?? "running";
}
function isExecutionCommand(execution) {
  return execution.kind === "background-command";
}
function formatDeferredResumeDeliveryLabel(resume) {
  if (resume.delivery?.requireAck || resume.delivery?.mode === "isolated") return "Isolated attention";
  if (resume.delivery?.mode === "sequential" || resume.behavior === "followUp") return "Sequential follow-up";
  if (resume.kind === "task-callback") return "Task callback";
  return "Batchable wakeup";
}
function ConversationActivityShelf({
  backgroundExecutions,
  backgroundExecutionIndicatorText,
  showBackgroundRunDetails,
  cancellingBackgroundRunIds,
  onToggleBackgroundRunDetails,
  onCancelBackgroundRun,
  onOpenBackgroundRun,
  deferredResumes,
  deferredResumeIndicatorText,
  deferredResumeNowMs,
  hasReadyDeferredResumes,
  deferredResumesBusy,
  showDeferredResumeDetails,
  onContinueDeferredResumesNow,
  onToggleDeferredResumeDetails,
  onFireDeferredResumeNow,
  onCancelDeferredResume,
  scheduledTasks = [],
  scheduledTaskIndicatorText = "No automations",
  showScheduledTaskDetails,
  onToggleScheduledTaskDetails,
  onRunScheduledTaskNow,
  onOpenScheduledTask
}) {
  const canContinueDeferredResumes = hasReadyDeferredResumes && !deferredResumesBusy;
  const canToggleBackgroundRunDetails = backgroundExecutions.length > 0;
  const canToggleDeferredResumeDetails = deferredResumes.length > 0;
  const canToggleScheduledTaskDetails = scheduledTasks.length > 0 && Boolean(onToggleScheduledTaskDetails);
  const latestBackgroundRun = backgroundExecutions[0] ?? null;
  const latestCancellableBackgroundRun = backgroundExecutions.find(
    (execution) => execution.capabilities.canCancel && !(cancellingBackgroundRunIds?.has(execution.id) ?? false)
  ) ?? null;
  const firstRunnableScheduledTask = scheduledTasks.find((task) => task.enabled && !task.running) ?? null;
  const firstOpenableScheduledTask = scheduledTasks[0] ?? null;
  const firstFireableDeferredResume = deferredResumes.find((resume) => resume.status === "scheduled") ?? null;
  const firstCancellableDeferredResume = deferredResumes[0] ?? null;
  const canOpenLatestBackgroundRun = Boolean(latestBackgroundRun && onOpenBackgroundRun);
  const canCancelLatestBackgroundRun = Boolean(latestCancellableBackgroundRun && onCancelBackgroundRun);
  const canRunFirstScheduledTask = Boolean(firstRunnableScheduledTask && onRunScheduledTaskNow);
  const canOpenFirstScheduledTask = Boolean(firstOpenableScheduledTask && onOpenScheduledTask);
  const canFireFirstDeferredResume = Boolean(firstFireableDeferredResume && !deferredResumesBusy);
  const canCancelFirstDeferredResume = Boolean(firstCancellableDeferredResume && !deferredResumesBusy);
  useEffect(() => {
    setExtensionCommandContext("conversation.canContinueDeferredResumes", canContinueDeferredResumes);
    setExtensionCommandContext("conversation.hasBackgroundRuns", canToggleBackgroundRunDetails);
    setExtensionCommandContext("conversation.hasDeferredResumes", canToggleDeferredResumeDetails);
    setExtensionCommandContext("conversation.hasScheduledTasks", canToggleScheduledTaskDetails);
    setExtensionCommandContext("conversation.canOpenLatestBackgroundRun", canOpenLatestBackgroundRun);
    setExtensionCommandContext("conversation.canCancelLatestBackgroundRun", canCancelLatestBackgroundRun);
    setExtensionCommandContext("conversation.canRunFirstScheduledTask", canRunFirstScheduledTask);
    setExtensionCommandContext("conversation.canOpenFirstScheduledTask", canOpenFirstScheduledTask);
    setExtensionCommandContext("conversation.canFireFirstDeferredResume", canFireFirstDeferredResume);
    setExtensionCommandContext("conversation.canCancelFirstDeferredResume", canCancelFirstDeferredResume);
    return () => {
      setExtensionCommandContext("conversation.canContinueDeferredResumes", null);
      setExtensionCommandContext("conversation.hasBackgroundRuns", null);
      setExtensionCommandContext("conversation.hasDeferredResumes", null);
      setExtensionCommandContext("conversation.hasScheduledTasks", null);
      setExtensionCommandContext("conversation.canOpenLatestBackgroundRun", null);
      setExtensionCommandContext("conversation.canCancelLatestBackgroundRun", null);
      setExtensionCommandContext("conversation.canRunFirstScheduledTask", null);
      setExtensionCommandContext("conversation.canOpenFirstScheduledTask", null);
      setExtensionCommandContext("conversation.canFireFirstDeferredResume", null);
      setExtensionCommandContext("conversation.canCancelFirstDeferredResume", null);
    };
  }, [
    canCancelLatestBackgroundRun,
    canCancelFirstDeferredResume,
    canContinueDeferredResumes,
    canFireFirstDeferredResume,
    canOpenLatestBackgroundRun,
    canOpenFirstScheduledTask,
    canRunFirstScheduledTask,
    canToggleBackgroundRunDetails,
    canToggleDeferredResumeDetails,
    canToggleScheduledTaskDetails
  ]);
  useEffect(() => {
    if (!canContinueDeferredResumes) return;
    function handleContinueDeferredResumesCommand() {
      onContinueDeferredResumesNow();
    }
    window.addEventListener(CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT, handleContinueDeferredResumesCommand);
    return () => window.removeEventListener(CONVERSATION_CONTINUE_DEFERRED_RESUMES_COMMAND_EVENT, handleContinueDeferredResumesCommand);
  }, [canContinueDeferredResumes, onContinueDeferredResumesNow]);
  useEffect(() => {
    if (!canToggleBackgroundRunDetails) return;
    window.addEventListener(CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT, onToggleBackgroundRunDetails);
    return () => window.removeEventListener(CONVERSATION_TOGGLE_BACKGROUND_RUN_DETAILS_COMMAND_EVENT, onToggleBackgroundRunDetails);
  }, [canToggleBackgroundRunDetails, onToggleBackgroundRunDetails]);
  useEffect(() => {
    if (!canToggleDeferredResumeDetails) return;
    window.addEventListener(CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT, onToggleDeferredResumeDetails);
    return () => window.removeEventListener(CONVERSATION_TOGGLE_DEFERRED_RESUME_DETAILS_COMMAND_EVENT, onToggleDeferredResumeDetails);
  }, [canToggleDeferredResumeDetails, onToggleDeferredResumeDetails]);
  useEffect(() => {
    if (!canToggleScheduledTaskDetails || !onToggleScheduledTaskDetails) return;
    window.addEventListener(CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT, onToggleScheduledTaskDetails);
    return () => window.removeEventListener(CONVERSATION_TOGGLE_SCHEDULED_TASK_DETAILS_COMMAND_EVENT, onToggleScheduledTaskDetails);
  }, [canToggleScheduledTaskDetails, onToggleScheduledTaskDetails]);
  useEffect(() => {
    if (!latestBackgroundRun || !onOpenBackgroundRun) return;
    function handleOpenLatestBackgroundRunCommand() {
      onOpenBackgroundRun?.(latestBackgroundRun.id);
    }
    window.addEventListener(CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleOpenLatestBackgroundRunCommand);
    return () => window.removeEventListener(CONVERSATION_OPEN_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleOpenLatestBackgroundRunCommand);
  }, [latestBackgroundRun, onOpenBackgroundRun]);
  useEffect(() => {
    if (!latestCancellableBackgroundRun || !onCancelBackgroundRun) return;
    function handleCancelLatestBackgroundRunCommand() {
      onCancelBackgroundRun?.(latestCancellableBackgroundRun.id);
    }
    window.addEventListener(CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleCancelLatestBackgroundRunCommand);
    return () => window.removeEventListener(CONVERSATION_CANCEL_LATEST_BACKGROUND_RUN_COMMAND_EVENT, handleCancelLatestBackgroundRunCommand);
  }, [latestCancellableBackgroundRun, onCancelBackgroundRun]);
  useEffect(() => {
    if (!firstRunnableScheduledTask || !onRunScheduledTaskNow) return;
    function handleRunFirstScheduledTaskCommand() {
      onRunScheduledTaskNow?.(firstRunnableScheduledTask.id);
    }
    window.addEventListener(CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleRunFirstScheduledTaskCommand);
    return () => window.removeEventListener(CONVERSATION_RUN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleRunFirstScheduledTaskCommand);
  }, [firstRunnableScheduledTask, onRunScheduledTaskNow]);
  useEffect(() => {
    if (!firstOpenableScheduledTask || !onOpenScheduledTask) return;
    function handleOpenFirstScheduledTaskCommand() {
      onOpenScheduledTask?.(firstOpenableScheduledTask.id);
    }
    window.addEventListener(CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleOpenFirstScheduledTaskCommand);
    return () => window.removeEventListener(CONVERSATION_OPEN_FIRST_SCHEDULED_TASK_COMMAND_EVENT, handleOpenFirstScheduledTaskCommand);
  }, [firstOpenableScheduledTask, onOpenScheduledTask]);
  useEffect(() => {
    if (!firstFireableDeferredResume || deferredResumesBusy) return;
    function handleFireFirstDeferredResumeCommand() {
      onFireDeferredResumeNow(firstFireableDeferredResume.id);
    }
    window.addEventListener(CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleFireFirstDeferredResumeCommand);
    return () => window.removeEventListener(CONVERSATION_FIRE_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleFireFirstDeferredResumeCommand);
  }, [deferredResumesBusy, firstFireableDeferredResume, onFireDeferredResumeNow]);
  useEffect(() => {
    if (!firstCancellableDeferredResume || deferredResumesBusy) return;
    function handleCancelFirstDeferredResumeCommand() {
      onCancelDeferredResume(firstCancellableDeferredResume.id);
    }
    window.addEventListener(CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleCancelFirstDeferredResumeCommand);
    return () => window.removeEventListener(CONVERSATION_CANCEL_FIRST_DEFERRED_RESUME_COMMAND_EVENT, handleCancelFirstDeferredResumeCommand);
  }, [deferredResumesBusy, firstCancellableDeferredResume, onCancelDeferredResume]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    scheduledTasks.length > 0 && /* @__PURE__ */ jsx(
      ShelfSection,
      {
        header: /* @__PURE__ */ jsx(
          ShelfHeader,
          {
            leading: /* @__PURE__ */ jsx("span", { className: "text-accent", children: "\u21BB" }),
            title: "Automations",
            detail: scheduledTaskIndicatorText,
            actions: onToggleScheduledTaskDetails ? /* @__PURE__ */ jsx(TextButton, { type: "button", onClick: onToggleScheduledTaskDetails, children: showScheduledTaskDetails ? "hide" : "details" }) : null
          }
        ),
        children: showScheduledTaskDetails ? /* @__PURE__ */ jsx(Fragment, { children: scheduledTasks.map((task) => {
          const status = formatScheduledTaskStatus(task);
          return /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 text-[12px]", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: cx(
                      "shrink-0 font-medium",
                      status === "failed" ? "text-danger" : task.running ? "text-accent" : "text-secondary"
                    ),
                    children: status
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "truncate text-primary", children: task.title || task.id })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-0.5 text-[11px] text-dim", children: [
                formatScheduledTaskSchedule(task),
                task.lastRunAt ? ` \xB7 last run ${timeAgo(task.lastRunAt)}` : "",
                task.lastStatus ? ` \xB7 ${task.lastStatus}` : ""
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-3", children: [
              onRunScheduledTaskNow && task.enabled && !task.running && /* @__PURE__ */ jsx(TextButton, { type: "button", onClick: () => onRunScheduledTaskNow(task.id), tone: "accent", className: "text-[11px]", children: "run now" }),
              onOpenScheduledTask && /* @__PURE__ */ jsx(TextButton, { type: "button", onClick: () => onOpenScheduledTask(task.id), className: "text-[11px]", children: "open" })
            ] })
          ] }, task.id);
        }) }) : null
      }
    ),
    backgroundExecutions.length > 0 && /* @__PURE__ */ jsx(
      ShelfSection,
      {
        header: /* @__PURE__ */ jsx(
          ShelfHeader,
          {
            leading: /* @__PURE__ */ jsx("span", { className: "inline-flex h-3 w-3 items-center justify-center text-accent", "aria-hidden": "true", children: /* @__PURE__ */ jsx(Spinner, { size: "xs" }) }),
            title: "Background Work",
            detail: backgroundExecutionIndicatorText,
            actions: /* @__PURE__ */ jsx(TextButton, { type: "button", onClick: onToggleBackgroundRunDetails, children: showBackgroundRunDetails ? "hide" : "details" })
          }
        ),
        children: showBackgroundRunDetails ? /* @__PURE__ */ jsx(Fragment, { children: backgroundExecutions.map((execution) => {
          const statusLabel = formatExecutionStatusLabel(execution.status);
          const statusClass = execution.status === "recovering" ? "text-warning" : execution.status === "queued" || execution.status === "waiting" ? "text-dim" : "text-accent";
          const cancelling = cancellingBackgroundRunIds?.has(execution.id) ?? false;
          const command = isExecutionCommand(execution);
          const summary = execution.command ?? execution.prompt ?? `Execution ${execution.id}`;
          return /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2 text-[12px]", children: [
            /* @__PURE__ */ jsx("span", { className: cx("mt-1 shrink-0 font-mono text-[10px]", command ? "text-accent/60" : "text-accent"), children: command ? "$" : "\u2726" }),
            /* @__PURE__ */ jsxs(
              RowButton,
              {
                compact: true,
                onClick: () => {
                  onOpenBackgroundRun?.(execution.id);
                },
                className: "min-w-0 flex-1 text-left transition-colors hover:text-primary disabled:pointer-events-none",
                disabled: !onOpenBackgroundRun,
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [
                    /* @__PURE__ */ jsx("span", { className: cx("shrink-0 font-medium", statusClass), children: statusLabel }),
                    /* @__PURE__ */ jsx("span", { className: "truncate text-primary", children: execution.title }),
                    /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: command ? "Bash" : "Agent" })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "mt-0.5 truncate text-[11px] text-dim", children: summary })
                ]
              }
            ),
            onOpenBackgroundRun && /* @__PURE__ */ jsx(
              TextButton,
              {
                type: "button",
                onClick: () => {
                  onOpenBackgroundRun(execution.id);
                },
                tone: "accent",
                className: "shrink-0 text-[11px]",
                children: "open"
              }
            ),
            onCancelBackgroundRun && execution.capabilities.canCancel && /* @__PURE__ */ jsx(
              TextButton,
              {
                type: "button",
                onClick: () => {
                  onCancelBackgroundRun(execution.id);
                },
                className: "shrink-0 text-[11px] text-dim hover:text-danger disabled:opacity-40",
                disabled: cancelling,
                children: cancelling ? "cancelling\u2026" : "cancel"
              }
            )
          ] }, execution.id);
        }) }) : null
      }
    ),
    deferredResumes.length > 0 && /* @__PURE__ */ jsx(
      ShelfSection,
      {
        header: /* @__PURE__ */ jsx(
          ShelfHeader,
          {
            leading: /* @__PURE__ */ jsx("span", { className: cx(hasReadyDeferredResumes ? "text-warning" : "text-dim"), children: "\u23F0" }),
            title: "Attention",
            detail: deferredResumeIndicatorText,
            actions: /* @__PURE__ */ jsxs(Fragment, { children: [
              canContinueDeferredResumes && /* @__PURE__ */ jsx(TextButton, { type: "button", onClick: onContinueDeferredResumesNow, tone: "accent", children: "continue now" }),
              deferredResumesBusy && /* @__PURE__ */ jsx("span", { className: "text-dim", children: "updating\u2026" }),
              /* @__PURE__ */ jsx(TextButton, { type: "button", onClick: onToggleDeferredResumeDetails, children: showDeferredResumeDetails ? "hide" : "details" })
            ] })
          }
        ),
        children: showDeferredResumeDetails ? /* @__PURE__ */ jsx(Fragment, { children: deferredResumes.map((resume) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 text-[12px]", children: [
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: cx("shrink-0 font-medium", resume.status === "ready" ? "text-warning" : "text-secondary"), children: describeDeferredResumeStatus(resume, deferredResumeNowMs) }),
              /* @__PURE__ */ jsx("span", { className: "truncate text-primary", children: resume.title ?? resume.prompt })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-0.5 text-[11px] text-dim", children: [
              formatDeferredResumeDeliveryLabel(resume),
              " \xB7 ",
              resume.status === "ready" ? "Ready" : "Due",
              " ",
              formatDeferredResumeWhen(resume),
              resume.attempts > 0 ? ` \xB7 retries ${resume.attempts}` : ""
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-3", children: [
            resume.status === "scheduled" && /* @__PURE__ */ jsx(
              TextButton,
              {
                type: "button",
                onClick: () => {
                  onFireDeferredResumeNow(resume.id);
                },
                tone: "accent",
                className: "text-[11px] disabled:opacity-40",
                disabled: deferredResumesBusy,
                children: "fire now"
              }
            ),
            /* @__PURE__ */ jsx(
              TextButton,
              {
                type: "button",
                onClick: () => {
                  onCancelDeferredResume(resume.id);
                },
                className: "text-[11px] text-dim hover:text-danger disabled:opacity-40",
                disabled: deferredResumesBusy,
                children: "cancel"
              }
            )
          ] })
        ] }, resume.id)) }) : null
      }
    )
  ] });
}
export {
  ConversationActivityShelf
};
