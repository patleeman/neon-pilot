import {
  formatComposerActionLabel
} from "./chunks/chunk-37M3566B.js";
import {
  ContextMenu,
  createNativeExtensionClient,
  ensureExtensionFrontendReactGlobals,
  getExtensionRegistryRevision,
  systemExtensionModules,
  useExtensionRegistry
} from "./chunks/chunk-YWOALOZN.js";
import "./chunks/chunk-4YPGCSK5.js";
import "./chunks/chunk-24DU7J3C.js";
import {
  buildApiPath,
  recordActivityTreeRowRender
} from "./chunks/chunk-FFNJHG7W.js";
import "./chunks/chunk-WY4PXDOC.js";
import "./chunks/chunk-RUG6BXWL.js";
import {
  timeAgoCompact
} from "./chunks/chunk-DP4YXAPY.js";
import {
  setExtensionCommandContext
} from "./chunks/chunk-T3OH4ARN.js";
import {
  AppPageIntro,
  AppPageLayout,
  Button,
  CenteredLoadingState,
  ComposerActionButton,
  ErrorState,
  IconButton,
  Notice,
  Select,
  Spinner,
  StatusDot,
  TextInput,
  Textarea,
  ToolbarButton,
  cx
} from "./chunks/chunk-5W2EFD7M.js";
import "./chunks/chunk-P4G4CXIQ.js";
import {
  Fragment2 as Fragment,
  Suspense,
  forwardRef,
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  lazy,
  memo,
  neon_pilot_shared_react_default,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "./chunks/chunk-TTFLGCWD.js";
import "./chunks/chunk-MZHE4QUL.js";

// packages/desktop/ui/src/activity/ActivityTreeView.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/activity/ActivityTreeRow.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/session/sessionIndicators.ts
function sessionNeedsAttention(session) {
  return Boolean(session.needsAttention) && !session.isRunning;
}

// packages/desktop/ui/src/components/ConversationStatusText.tsx
function BackgroundWorkIcon({ kind }) {
  if (kind === "subagent") return /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u2726" });
  if (kind === "command") {
    return /* @__PURE__ */ jsx("span", { "aria-hidden": "true", className: "font-mono text-[10px] leading-none tracking-[-0.08em]", children: "\u203A_" });
  }
  return /* @__PURE__ */ jsx(StatusDot, { tone: "current" });
}
function ConversationStatusText({
  isRunning,
  needsAttention,
  hasPendingRuns,
  backgroundWorkKind,
  className
}) {
  if (isRunning) {
    return /* @__PURE__ */ jsx(
      "span",
      {
        role: "img",
        "aria-label": "Running conversation",
        className: cx("flex h-3 w-3 items-center justify-center text-accent", className),
        title: "Agent is still running",
        children: /* @__PURE__ */ jsx(Spinner, { size: "xs" })
      }
    );
  }
  if (hasPendingRuns) {
    return /* @__PURE__ */ jsx(
      "span",
      {
        role: "img",
        "aria-label": "Background work running",
        className: cx("flex h-3 w-3 items-center justify-center text-accent/80", className),
        title: "Background work is running",
        children: /* @__PURE__ */ jsx(BackgroundWorkIcon, { kind: backgroundWorkKind })
      }
    );
  }
  if (!sessionNeedsAttention({ isRunning, needsAttention })) {
    return null;
  }
  return /* @__PURE__ */ jsx(
    "span",
    {
      role: "img",
      "aria-label": "Conversation needs review",
      className,
      title: "Stopped with new output or linked updates you have not viewed yet",
      children: /* @__PURE__ */ jsx(StatusDot, { tone: "warning" })
    }
  );
}

// packages/desktop/ui/src/activity/ActivityTreeRowChrome.tsx
function ActivityTreeDropMarker({ position }) {
  if (!position) return null;
  return /* @__PURE__ */ jsx(
    "span",
    {
      "aria-hidden": "true",
      className: [
        "pointer-events-none absolute left-2 right-2 z-10 h-0.5 rounded-sm bg-accent opacity-80",
        position === "before" ? "top-0" : "bottom-0"
      ].join(" ")
    }
  );
}
function ActivityTreeLeadingSlot({
  expanded,
  groupIsExpandable,
  item,
  rowModel,
  onToggleBranch,
  onToggleGroup
}) {
  if (item.kind === "group") {
    if (!groupIsExpandable) {
      return /* @__PURE__ */ jsx("span", { className: "h-4 w-4 shrink-0", "aria-hidden": "true" });
    }
    return /* @__PURE__ */ jsx(
      ExpanderButton,
      {
        label: `${expanded ? "Collapse" : "Expand"} ${item.title}`,
        expanded,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleGroup(item);
        }
      }
    );
  }
  if (rowModel.showExpander) {
    return /* @__PURE__ */ jsx(
      ExpanderButton,
      {
        label: expanded ? `Collapse ${item.title}` : `Expand ${item.title}`,
        title: getExpanderTitle(rowModel.conversationChildCount, expanded),
        expanded,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleBranch(item.id);
        }
      }
    );
  }
  if (rowModel.showConversationStatus) {
    return /* @__PURE__ */ jsx(ConversationStatusSlot, { rowModel });
  }
  return /* @__PURE__ */ jsx("span", { className: "h-4 w-4 shrink-0", "aria-hidden": "true" });
}
function ActivityTreeTrailingStatus({
  expanded,
  item,
  rowModel
}) {
  if (item.kind === "conversation" && !expanded && rowModel.conversationChildCount > 0) {
    return /* @__PURE__ */ jsx(
      "span",
      {
        className: "ui-sidebar-session-meta shrink-0 whitespace-nowrap",
        title: `${rowModel.conversationChildCount} child branch${rowModel.conversationChildCount === 1 ? "" : "es"}`,
        children: rowModel.conversationChildCount
      }
    );
  }
  if (item.kind === "conversation" && item.updatedAt) {
    return /* @__PURE__ */ jsx("span", { className: "ui-sidebar-session-meta ui-sidebar-session-time shrink-0 whitespace-nowrap", children: timeAgoCompact(item.updatedAt) });
  }
  if (item.status !== "idle" && item.kind !== "conversation") {
    return /* @__PURE__ */ jsx("span", { className: "ui-card-meta shrink-0", children: formatActivityTreeStatus(item.status) });
  }
  return null;
}
function ActivityTreeRowActions({
  inlineActions,
  item,
  renderContextMenu,
  rowModel,
  onArchiveItem,
  onCreateChildItem,
  onInlineAction,
  onOpenContextMenu
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    item.kind === "group" && renderContextMenu ? /* @__PURE__ */ jsx(
      IconButton,
      {
        tabIndex: -1,
        compact: true,
        className: "h-5 w-5 shrink-0",
        "aria-label": `Workspace actions for ${item.title}`,
        title: `Workspace actions for ${item.title}`,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenContextMenu?.(item, rect.left, rect.bottom + 4);
        },
        children: /* @__PURE__ */ jsx(MoreActionsIcon, {})
      }
    ) : null,
    rowModel.canCreateChild ? /* @__PURE__ */ jsx(
      IconButton,
      {
        tabIndex: -1,
        compact: true,
        className: "h-5 w-5 shrink-0",
        "aria-label": `New conversation in ${item.title}`,
        title: `New conversation in ${item.title}`,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          onCreateChildItem?.(item);
        },
        children: /* @__PURE__ */ jsx(PlusIcon, {})
      }
    ) : null,
    inlineActions.map((action) => /* @__PURE__ */ jsx(
      IconButton,
      {
        tabIndex: -1,
        compact: true,
        className: "h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        "aria-label": action.title,
        title: action.title,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          onInlineAction?.(action.id, item);
        },
        children: action.icon ?? "\u2022"
      },
      action.id
    )),
    rowModel.canArchive ? /* @__PURE__ */ jsx(
      IconButton,
      {
        tabIndex: -1,
        compact: true,
        className: "h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        "aria-label": "Archive conversation",
        title: "Archive conversation",
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          onArchiveItem?.(item);
        },
        children: /* @__PURE__ */ jsx(CloseIcon, {})
      }
    ) : null
  ] });
}
function MoreActionsIcon() {
  return /* @__PURE__ */ jsxs("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "2", cy: "6", r: "1.15" }),
    /* @__PURE__ */ jsx("circle", { cx: "6", cy: "6", r: "1.15" }),
    /* @__PURE__ */ jsx("circle", { cx: "10", cy: "6", r: "1.15" })
  ] });
}
function PlusIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" })
    }
  );
}
function CloseIcon() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M18 6 6 18" }),
        /* @__PURE__ */ jsx("path", { d: "m6 6 12 12" })
      ]
    }
  );
}
function ActivityTreePinnedIcon({ pinned }) {
  if (!pinned) return null;
  return /* @__PURE__ */ jsx("span", { className: "ui-sidebar-pinned-icon shrink-0", title: "Pinned chat", "aria-label": "Pinned chat", children: /* @__PURE__ */ jsx(
    "svg",
    {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "m15.75 3.75 4.5 4.5-3 3v3l-2.25 2.25-7.5-7.5L9.75 6.75h3l3-3ZM9.75 14.25 4.5 19.5" })
    }
  ) });
}
function ActivityTreeLockIcon({ locked }) {
  if (!locked) return null;
  return /* @__PURE__ */ jsx("span", { className: "shrink-0 text-dim", title: "Locked conversation", "aria-label": "Locked conversation", children: /* @__PURE__ */ jsx(
    "svg",
    {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.7",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M7.5 10.5V8.25a4.5 4.5 0 0 1 9 0v2.25M6.75 10.5h10.5A1.5 1.5 0 0 1 18.75 12v6A1.5 1.5 0 0 1 17.25 19.5H6.75A1.5 1.5 0 0 1 5.25 18v-6a1.5 1.5 0 0 1 1.5-1.5Z" })
    }
  ) });
}
function ConversationStatusSlot({ rowModel }) {
  return /* @__PURE__ */ jsx("span", { className: "flex h-4 w-4 shrink-0 items-center justify-center", "aria-hidden": "true", children: /* @__PURE__ */ jsx(
    ConversationStatusText,
    {
      isRunning: rowModel.conversationIsRunning,
      hasPendingRuns: rowModel.conversationHasPendingRuns,
      backgroundWorkKind: rowModel.conversationBackgroundWorkKind,
      needsAttention: rowModel.conversationNeedsAttention
    }
  ) });
}
function ExpanderButton({
  expanded,
  label,
  title,
  onClick
}) {
  return /* @__PURE__ */ jsx(
    IconButton,
    {
      tabIndex: -1,
      compact: true,
      className: "-ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-0 bg-transparent !p-0 text-dim hover:text-primary",
      "aria-label": label,
      "aria-expanded": expanded,
      title,
      onClick,
      children: expanded ? "\u25BE" : "\u25B8"
    }
  );
}
function getExpanderTitle(conversationChildCount, expanded) {
  if (conversationChildCount > 0) {
    return expanded ? "Collapse branches" : "Expand branches";
  }
  return expanded ? "Collapse children" : "Expand children";
}
function formatActivityTreeStatus(status) {
  switch (status) {
    case "running":
      return "run";
    case "queued":
      return "wait";
    case "failed":
      return "fail";
    case "done":
      return "done";
    case "idle":
    default:
      return "idle";
  }
}

// packages/desktop/ui/src/activity/activityTreeRowModel.ts
var ACTIVITY_TREE_ROOT_INDENT_REM = 0.25;
var ACTIVITY_TREE_CHILD_INDENT_REM = 0.375;
function getActivityTreeRowPaddingLeftRem(item, depth) {
  if (item.kind === "group") {
    return ACTIVITY_TREE_ROOT_INDENT_REM;
  }
  return ACTIVITY_TREE_ROOT_INDENT_REM + Math.max(0, depth) * ACTIVITY_TREE_CHILD_INDENT_REM;
}
function buildActivityTreeRowModel({
  childCount,
  conversationChildCount,
  depth,
  hasArchiveAction,
  hasCreateChildAction,
  item
}) {
  const conversationIsRunning = item.kind === "conversation" && item.metadata?.isRunning === true;
  const conversationNeedsAttention = item.kind === "conversation" && item.metadata?.needsAttention === true;
  const conversationHasPendingRuns = item.kind === "conversation" && item.metadata?.hasPendingRuns === true;
  const conversationBackgroundWorkKind = item.kind === "conversation" && typeof item.metadata?.backgroundWorkKind === "string" ? item.metadata.backgroundWorkKind : null;
  const conversationIsPinned = item.kind === "conversation" && item.metadata?.isPinned === true;
  const conversationIsLocked = item.kind === "conversation" && item.metadata?.isLocked === true;
  return {
    canArchive: item.kind === "conversation" && hasArchiveAction && item.metadata?.canArchive !== false && !conversationIsLocked,
    canCreateChild: item.kind === "group" && hasCreateChildAction,
    conversationBackgroundWorkKind,
    conversationChildCount,
    conversationHasPendingRuns,
    conversationIsLocked,
    conversationIsPinned,
    conversationIsRunning,
    conversationNeedsAttention,
    dataSidebarGroupKey: typeof item.metadata?.groupKey === "string" ? item.metadata.groupKey : void 0,
    dataSidebarSessionId: typeof item.metadata?.conversationId === "string" ? item.metadata.conversationId : void 0,
    rowPaddingLeftRem: getActivityTreeRowPaddingLeftRem(item, depth),
    showConversationStatus: conversationIsRunning || conversationHasPendingRuns || conversationNeedsAttention,
    showExpander: childCount > 0 && item.kind !== "group",
    title: typeof item.metadata?.tooltip === "string" ? item.metadata.tooltip : item.subtitle
  };
}

// packages/desktop/ui/src/activity/cssColors.ts
function sanitizeCssColor(value) {
  const color = value?.trim();
  if (!color) return null;
  if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F])?$|^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(color)) return color;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)) return color;
  if (/^color-mix\(in srgb, #[0-9a-fA-F]{3,8} \d{1,3}%, transparent\)$/.test(color)) return color;
  return null;
}

// packages/desktop/ui/src/activity/ActivityTreeRow.tsx
function focusAdjacentActivityTreeRow(currentRow, key) {
  const tree = currentRow.closest('[role="tree"]');
  if (!tree) {
    return false;
  }
  const rows = currentRow.hasAttribute("data-sidebar-session-id") ? Array.from(tree.querySelectorAll('[role="treeitem"][data-sidebar-session-id]')) : Array.from(tree.querySelectorAll('[role="treeitem"]'));
  const currentIndex = rows.indexOf(currentRow);
  if (currentIndex === -1) {
    return false;
  }
  let nextIndex = currentIndex;
  switch (key) {
    case "ArrowDown":
      nextIndex = Math.min(rows.length - 1, currentIndex + 1);
      break;
    case "ArrowUp":
      nextIndex = Math.max(0, currentIndex - 1);
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = rows.length - 1;
      break;
    default:
      return false;
  }
  rows[nextIndex]?.focus();
  return true;
}
function ActivityTreeRowComponent({
  active,
  canArchive,
  canCreateChild,
  canDrag,
  childCount,
  conversationChildCount,
  depth,
  dragged,
  expanded,
  inlineActions,
  item,
  onArchiveItem,
  onCreateChildItem,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onInlineAction,
  onOpenContextMenu,
  onOpenItem,
  onToggleBranch,
  onToggleGroup,
  renderContextMenu,
  rowDropPosition
}) {
  recordActivityTreeRowRender(item.id);
  const rowModel = useMemo(
    () => buildActivityTreeRowModel({
      childCount,
      conversationChildCount,
      depth,
      hasArchiveAction: canArchive,
      hasCreateChildAction: canCreateChild,
      item
    }),
    [canArchive, canCreateChild, childCount, conversationChildCount, depth, item]
  );
  const rowStyle = useMemo(() => {
    const accentColor = sanitizeCssColor(item.accentColor);
    const backgroundColor = sanitizeCssColor(item.backgroundColor);
    return {
      paddingLeft: `${rowModel.rowPaddingLeftRem}rem`,
      ...backgroundColor ? { backgroundColor } : {},
      ...accentColor ? { boxShadow: `inset 2px 0 0 ${accentColor}` } : {}
    };
  }, [item.accentColor, item.backgroundColor, rowModel.rowPaddingLeftRem]);
  const groupIsExpandable = item.kind === "group" && childCount > 0;
  const openOrToggleItem = () => {
    if (item.kind === "group") {
      if (groupIsExpandable) {
        onToggleGroup(item);
      }
      return;
    }
    onOpenItem?.(item);
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      role: "treeitem",
      tabIndex: 0,
      "aria-selected": active ? "true" : "false",
      "aria-expanded": groupIsExpandable ? expanded : void 0,
      draggable: canDrag,
      onDragStart: canDrag ? (event) => onDragStart(item, event) : void 0,
      onDragOver: (event) => onDragOver(item, event),
      onDrop: (event) => onDrop(item, event),
      onDragEnd,
      className: [
        "ui-sidebar-session-row group relative flex w-full items-center gap-1 select-none text-left focus:outline-none focus-within:ring-1 focus-within:ring-accent/25",
        item.kind === "group" && "font-semibold",
        active && "ui-sidebar-session-row-active",
        canDrag && (dragged ? "cursor-grabbing opacity-60" : "cursor-grab")
      ].filter(Boolean).join(" "),
      style: rowStyle,
      "data-sidebar-session-id": rowModel.dataSidebarSessionId,
      "data-sidebar-group-key": rowModel.dataSidebarGroupKey,
      title: canDrag ? "Drag to reorder conversations" : rowModel.title,
      onClick: openOrToggleItem,
      onKeyDown: (event) => {
        if (focusAdjacentActivityTreeRow(event.currentTarget, event.key)) {
          event.preventDefault();
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openOrToggleItem();
      },
      onContextMenu: (event) => {
        if (!renderContextMenu) return;
        event.preventDefault();
        event.stopPropagation();
        onOpenContextMenu?.(item, event.clientX, event.clientY);
      },
      children: [
        /* @__PURE__ */ jsx(ActivityTreeDropMarker, { position: rowDropPosition }),
        /* @__PURE__ */ jsx(
          ActivityTreeLeadingSlot,
          {
            expanded,
            groupIsExpandable,
            item,
            rowModel,
            onToggleBranch,
            onToggleGroup
          }
        ),
        rowModel.showConversationStatus && rowModel.showExpander ? /* @__PURE__ */ jsx(ConversationStatusSlot, { rowModel }) : null,
        /* @__PURE__ */ jsx(ActivityTreePinnedIcon, { pinned: rowModel.conversationIsPinned }),
        /* @__PURE__ */ jsx(ActivityTreeLockIcon, { locked: rowModel.conversationIsLocked }),
        /* @__PURE__ */ jsx("span", { className: "min-w-0 flex-1 truncate text-[12px] leading-[1.15] text-primary", children: item.title }),
        /* @__PURE__ */ jsx(ActivityTreeTrailingStatus, { expanded, item, rowModel }),
        /* @__PURE__ */ jsx(
          ActivityTreeRowActions,
          {
            inlineActions,
            item,
            renderContextMenu,
            rowModel,
            onArchiveItem,
            onCreateChildItem,
            onInlineAction,
            onOpenContextMenu
          }
        )
      ]
    }
  );
}
var ActivityTreeRow = memo(ActivityTreeRowComponent, (prev, next) => {
  return prev.active === next.active && prev.canArchive === next.canArchive && prev.canCreateChild === next.canCreateChild && prev.canDrag === next.canDrag && prev.childCount === next.childCount && prev.conversationChildCount === next.conversationChildCount && prev.depth === next.depth && prev.dragged === next.dragged && prev.expanded === next.expanded && prev.item === next.item && prev.renderContextMenu === next.renderContextMenu && prev.rowDropPosition === next.rowDropPosition && prev.inlineActions === next.inlineActions;
});

// packages/desktop/ui/src/components/chat/ChatRailComposer.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/promptAttachments.ts
var MAX_PROMPT_IMAGE_BYTES = 8 * 1024 * 1024;

// packages/desktop/ui/src/conversation/useComposerController.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/useConversationComposerMenus.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/model/modelPreferences.ts
function normalizeModelId(value) {
  return typeof value === "string" ? value.trim() : "";
}
var THINKING_LEVEL_OPTIONS = [
  { value: "", label: "Unset" },
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" }
];
var SERVICE_TIER_OPTIONS = [
  { value: "", label: "Unset" },
  { value: "auto", label: "Automatic" },
  { value: "default", label: "Default" },
  { value: "flex", label: "Flex" },
  { value: "priority", label: "Priority" },
  { value: "scale", label: "Scale" }
];
var MODEL_PROVIDER_DISPLAY_NAMES = {
  "azure-openai-responses": "Azure OpenAI Responses",
  "github-copilot": "GitHub Copilot",
  google: "Google Gemini",
  huggingface: "Hugging Face",
  "kimi-coding": "Kimi Coding",
  minimax: "MiniMax",
  "minimax-cn": "MiniMax China",
  openai: "OpenAI",
  "openai-codex": "OpenAI Codex",
  opencode: "OpenCode",
  "opencode-go": "OpenCode Gateway",
  openrouter: "OpenRouter",
  "vercel-ai-gateway": "Vercel AI Gateway",
  xai: "xAI",
  zai: "ZAI"
};
function formatServiceTierLabel(value) {
  const option = SERVICE_TIER_OPTIONS.find((candidate) => candidate.value === value);
  if (option) {
    return option.label;
  }
  return value.split(/[-_]+/).filter(Boolean).map((part) => part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}
function formatModelProviderLabel(providerId) {
  const normalized = providerId.trim();
  if (!normalized) {
    return "Provider";
  }
  return MODEL_PROVIDER_DISPLAY_NAMES[normalized] ?? normalized.split(/[-_]+/).filter(Boolean).map((part) => part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}
function formatModelProviderGroupLabel(providerId, providerIds) {
  const label = formatModelProviderLabel(providerId);
  const duplicateLabel = providerIds.some(
    (candidate) => candidate !== providerId && formatModelProviderLabel(candidate).toLocaleLowerCase() === label.toLocaleLowerCase()
  );
  return duplicateLabel ? `${label} (${providerId})` : label;
}
function groupModelsByProvider(models) {
  const groups = /* @__PURE__ */ new Map();
  for (const model of models) {
    const current = groups.get(model.provider) ?? [];
    current.push(model);
    groups.set(model.provider, current);
  }
  return [...groups.entries()];
}
function modelIdHasMultipleProviders(models, modelId) {
  return models.filter((model) => model.id === modelId).length > 1;
}
function getModelSelectionValue(model, models) {
  if (model.provider && modelIdHasMultipleProviders(models, model.id)) {
    return `${model.provider}/${model.id}`;
  }
  return model.id;
}
function resolveSelectableModel(models, modelId) {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) {
    return null;
  }
  const exactMatch = models.find((model) => model.id === normalizedModelId);
  if (exactMatch) {
    return exactMatch;
  }
  const slashIndex = normalizedModelId.indexOf("/");
  if (slashIndex > 0 && slashIndex < normalizedModelId.length - 1) {
    const provider = normalizedModelId.slice(0, slashIndex);
    const id = normalizedModelId.slice(slashIndex + 1);
    return models.find((model) => model.provider === provider && model.id === id) ?? null;
  }
  return null;
}

// packages/desktop/ui/src/conversation/useConversationKeyboardState.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/conversation/ConversationComposerContainer.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/conversation/ConversationComposerChrome.tsx
init_neon_pilot_shared_react();
function ComposerActionIcon({ label, className }) {
  if (label === "Follow up") {
    return /* @__PURE__ */ jsxs(
      "svg",
      {
        className,
        width: "13",
        height: "13",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
        children: [
          /* @__PURE__ */ jsx("path", { d: "M9 14 4 9l5-5" }),
          /* @__PURE__ */ jsx("path", { d: "M20 20c0-6-4-11-11-11H4" })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 12h11" }),
        /* @__PURE__ */ jsx("path", { d: "m11 5 7 7-7 7" })
      ]
    }
  );
}
function resolveConversationComposerShellStateClassName({
  dragOver,
  hasInteractiveOverlay,
  streamIsStreaming,
  autoModeEnabled,
  runMode
}) {
  if (dragOver) {
    return "ui-composer-state-focus";
  }
  if (hasInteractiveOverlay) {
    return "ui-composer-state-drag";
  }
  if (streamIsStreaming) {
    return "ui-composer-state-streaming ui-input-shell-streaming";
  }
  if (autoModeEnabled) {
    return cx(
      "ui-composer-state-auto ui-input-shell-auto-mode",
      runMode === "mission" && "ui-input-shell-mission",
      runMode === "loop" && "ui-input-shell-loop"
    );
  }
  return "border-border-subtle";
}
var ConversationComposerShell = forwardRef(function ConversationComposerShell2({ children, className, ...state }, ref) {
  return /* @__PURE__ */ jsx("div", { ref, className: cx("ui-input-shell", resolveConversationComposerShellStateClassName(state), className), children });
});

// packages/desktop/ui/src/components/conversation/ConversationComposerContainer.tsx
var ConversationComposerContainer = forwardRef(
  function ConversationComposerContainer2({
    layout = "main",
    className,
    shellClassName,
    dragOverlay,
    shelves,
    inputControls,
    dragOver,
    hasInteractiveOverlay,
    streamIsStreaming,
    autoModeEnabled,
    runMode,
    ...containerProps
  }, ref) {
    return /* @__PURE__ */ jsx("div", { className: cx("min-w-0", layout === "rail" && "w-full max-w-full overflow-hidden px-1.5 py-3", className), ...containerProps, children: /* @__PURE__ */ jsxs(
      ConversationComposerShell,
      {
        ref,
        className: cx("min-w-0 max-w-full", shellClassName),
        dragOver,
        hasInteractiveOverlay,
        streamIsStreaming,
        autoModeEnabled,
        runMode,
        children: [
          shelves,
          dragOverlay,
          inputControls
        ]
      }
    ) });
  }
);

// packages/desktop/ui/src/components/conversation/ConversationComposerInputControls.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/ComposerButtonHost.tsx
init_neon_pilot_shared_react();
function loadButtonModule(registration, revision) {
  ensureExtensionFrontendReactGlobals();
  const systemLoader = systemExtensionModules.get(registration.extensionId);
  if (systemLoader) return systemLoader();
  const entry = registration.frontendEntry;
  if (!entry) throw new Error(`Extension ${registration.extensionId} has no frontend entry.`);
  const source = buildApiPath(
    `/extensions/${encodeURIComponent(registration.extensionId)}/files/${entry.split("/").map(encodeURIComponent).join("/")}?v=${revision}`
  );
  return import(
    /* @vite-ignore */
    source
  );
}
function ComposerButtonHost({
  registration,
  controlContext
}) {
  const moduleKey = `${registration.extensionId}:${registration.frontendEntry ?? ""}:${getExtensionRegistryRevision()}`;
  const pa = useMemo(() => createNativeExtensionClient(registration.extensionId), [registration.extensionId]);
  const Component = useMemo(
    () => lazy(async () => {
      const module = await loadButtonModule(registration, getExtensionRegistryRevision());
      const component = module[registration.component];
      if (typeof component !== "function") {
        return { default: () => null };
      }
      return { default: component };
    }),
    [moduleKey]
  );
  return /* @__PURE__ */ jsx(Suspense, { fallback: null, children: /* @__PURE__ */ jsx(Component, { pa, controlContext }) });
}

// packages/desktop/ui/src/extensions/ComposerInputToolHost.tsx
init_neon_pilot_shared_react();
function loadInputToolModule(registration, revision) {
  ensureExtensionFrontendReactGlobals();
  const systemLoader = systemExtensionModules.get(registration.extensionId);
  if (systemLoader) return systemLoader();
  const entry = registration.frontendEntry;
  if (!entry) throw new Error(`Extension ${registration.extensionId} has no frontend entry.`);
  const source = buildApiPath(
    `/extensions/${encodeURIComponent(registration.extensionId)}/files/${entry.split("/").map(encodeURIComponent).join("/")}?v=${revision}`
  );
  return import(
    /* @vite-ignore */
    source
  );
}
function ComposerInputToolHost({
  registration,
  toolContext
}) {
  const moduleKey = `${registration.extensionId}:${registration.frontendEntry ?? ""}:${getExtensionRegistryRevision()}`;
  const pa = useMemo(() => createNativeExtensionClient(registration.extensionId), [registration.extensionId]);
  const Component = useMemo(
    () => lazy(async () => {
      const module = await loadInputToolModule(registration, getExtensionRegistryRevision());
      const component = module[registration.component];
      if (typeof component !== "function") {
        return { default: () => null };
      }
      return { default: component };
    }),
    [moduleKey]
  );
  return /* @__PURE__ */ jsx(Suspense, { fallback: null, children: /* @__PURE__ */ jsx(Component, { pa, toolContext }) });
}

// packages/desktop/ui/src/components/conversation/composerInputCommands.ts
var COMPOSER_CREATE_DRAWING_COMMAND_EVENT = "neon-pilot-composer-create-drawing-command";

// packages/desktop/ui/src/components/conversation/composerSettingsCommands.ts
var COMPOSER_OPEN_SETTINGS_COMMAND_EVENT = "neon-pilot-composer-open-settings-command";
var COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT = "neon-pilot-composer-close-settings-command";

// packages/desktop/ui/src/components/conversation/ConversationComposerActions.tsx
init_neon_pilot_shared_react();
function ConversationComposerActions({
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
  onAbortStream
}) {
  const { composerControls, toolbarActions } = useExtensionRegistry();
  const visibleToolbarActions = useMemo(
    () => toolbarActions.filter((action) => {
      const expr = action.when;
      if (!expr) return true;
      const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
      for (const clause of clauses) {
        const trimmed = clause.trim();
        if (trimmed === "composerHasContent" && !composerHasContent) return false;
        if (trimmed === "streamIsStreaming" && !streamIsStreaming) return false;
        if (trimmed === "!streamIsStreaming" && streamIsStreaming) return false;
      }
      return true;
    }),
    [toolbarActions, composerHasContent, streamIsStreaming]
  );
  const visibleComposerButtons = useMemo(
    () => composerControls.filter((button) => {
      if (button.slot !== "actions") return false;
      const expr = button.when;
      if (!expr) return true;
      const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
      for (const clause of clauses) {
        const trimmed = clause.trim();
        if (trimmed === "composerHasContent" && !composerHasContent) return false;
        if (trimmed === "streamIsStreaming" && !streamIsStreaming) return false;
        if (trimmed === "!streamIsStreaming" && streamIsStreaming) return false;
      }
      return true;
    }),
    [composerControls, composerHasContent, streamIsStreaming]
  );
  const streamingSubmitLabel = composerSubmitLabel === "Follow up" ? composerSubmitLabel : "Steer";
  const paClientByExtension = useRef(/* @__PURE__ */ new Map());
  function getPaClient(extensionId) {
    let client = paClientByExtension.current.get(extensionId);
    if (!client) {
      client = createNativeExtensionClient(extensionId);
      paClientByExtension.current.set(extensionId, client);
    }
    return client;
  }
  return /* @__PURE__ */ jsxs("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
    visibleToolbarActions.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-0.5 mr-1", children: visibleToolbarActions.map((action) => /* @__PURE__ */ jsx(
      IconButton,
      {
        size: "sm",
        onClick: () => {
          void getPaClient(action.extensionId).extension.invoke(action.action, {});
        },
        disabled: composerDisabled,
        className: "disabled:opacity-40",
        title: action.title,
        "aria-label": action.title,
        children: /* @__PURE__ */ jsx(ToolbarActionIcon, { icon: action.icon })
      },
      action.id
    )) }),
    visibleComposerButtons.map((button) => /* @__PURE__ */ jsx(
      ComposerButtonHost,
      {
        registration: button,
        controlContext: {
          composerDisabled,
          streamIsStreaming,
          composerHasContent,
          renderMode: "inline",
          openFilePicker: () => {
          },
          addFiles: () => {
          },
          insertText: onInsertComposerText,
          appendText: onAppendComposerText,
          models: [],
          currentModel: "",
          currentThinkingLevel: "",
          savingPreference: null,
          selectModel: () => {
          },
          selectThinkingLevel: () => {
          }
        }
      },
      `${button.extensionId}:${button.id}`
    )),
    streamIsStreaming ? /* @__PURE__ */ jsxs(Fragment, { children: [
      composerHasContent ? /* @__PURE__ */ jsxs(
        ComposerActionButton,
        {
          type: "button",
          onClick: (event) => {
            onSubmitComposerActionForModifiers(streamingSubmitLabel === "Follow up" || composerAltHeld || event.altKey);
          },
          disabled: composerDisabled,
          size: "compactLabel",
          tone: streamingSubmitLabel === "Follow up" ? "neutral" : "warning",
          title: streamingSubmitLabel,
          "aria-label": streamingSubmitLabel,
          children: [
            /* @__PURE__ */ jsx(ComposerActionIcon, { label: streamingSubmitLabel, className: "shrink-0" }),
            /* @__PURE__ */ jsx("span", { children: formatComposerActionLabel(streamingSubmitLabel) })
          ]
        }
      ) : null,
      /* @__PURE__ */ jsx(
        ComposerActionButton,
        {
          type: "button",
          onClick: onAbortStream,
          disabled: conversationNeedsTakeover,
          tone: "danger",
          title: conversationNeedsTakeover ? "Take over this conversation before stopping" : "Stop",
          "aria-label": "Stop",
          children: /* @__PURE__ */ jsx("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("rect", { x: "3.25", y: "3.25", width: "9.5", height: "9.5", rx: "1.2" }) })
        }
      )
    ] }) : composerShowsQuestionSubmit ? /* @__PURE__ */ jsxs(
      ComposerActionButton,
      {
        type: "button",
        onClick: onSubmitComposerQuestion,
        disabled: composerDisabled || !composerQuestionCanSubmit || composerQuestionSubmitting,
        size: "label",
        tone: composerQuestionCanSubmit && !composerQuestionSubmitting ? "accent" : "disabled",
        title: composerQuestionCanSubmit ? "Submit answers" : `Answer ${composerQuestionRemainingCount} more ${composerQuestionRemainingCount === 1 ? "question" : "questions"} to submit`,
        "aria-label": "Submit answers",
        children: [
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\u2713" }),
          /* @__PURE__ */ jsx("span", { children: composerQuestionSubmitting ? "Submitting\u2026" : composerQuestionCanSubmit ? "Submit" : `${composerQuestionRemainingCount} left` })
        ]
      }
    ) : composerHasContent ? /* @__PURE__ */ jsx(
      ComposerActionButton,
      {
        type: "button",
        onClick: (event) => {
          onSubmitComposerActionForModifiers(composerSubmitLabel === "Follow up" || composerAltHeld || event.altKey);
        },
        disabled: composerDisabled,
        size: composerSubmitLabel === "Send" ? "icon" : "label",
        tone: composerSubmitLabel === "Send" ? "accent" : composerSubmitLabel === "Steer" ? "warning" : "neutral",
        title: composerDisabled && composerSubmitLabel === "Send" ? "Configure a model provider before sending" : composerSubmitLabel,
        "aria-label": composerDisabled && composerSubmitLabel === "Send" ? "Configure a model provider before sending" : composerSubmitLabel,
        children: composerSubmitLabel === "Send" ? /* @__PURE__ */ jsx(
          "svg",
          {
            width: "14",
            height: "14",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2.5",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: /* @__PURE__ */ jsx("path", { d: "m18 15-6-6-6 6" })
          }
        ) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(ComposerActionIcon, { label: composerSubmitLabel, className: "shrink-0" }),
          /* @__PURE__ */ jsx("span", { children: formatComposerActionLabel(composerSubmitLabel) })
        ] })
      }
    ) : /* @__PURE__ */ jsx(ComposerActionButton, { type: "button", disabled: true, tone: "disabled", title: "Send", "aria-label": "Send", children: /* @__PURE__ */ jsx(
      "svg",
      {
        width: "14",
        height: "14",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        children: /* @__PURE__ */ jsx("path", { d: "m18 15-6-6-6 6" })
      }
    ) })
  ] });
}
function ToolbarActionIcon({ icon }) {
  switch (icon) {
    case "app":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
            /* @__PURE__ */ jsx("path", { d: "M3 9h18" })
          ]
        }
      );
    case "automation":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("path", { d: "M12 2L2 7l10 5 10-5-10-5z" }),
            /* @__PURE__ */ jsx("path", { d: "M2 17l10 5 10-5" }),
            /* @__PURE__ */ jsx("path", { d: "M2 12l10 5 10-5" })
          ]
        }
      );
    case "browser":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
            /* @__PURE__ */ jsx("path", { d: "M2 12h20" }),
            /* @__PURE__ */ jsx("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" })
          ]
        }
      );
    case "database":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" }),
            /* @__PURE__ */ jsx("path", { d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" })
          ]
        }
      );
    case "diff":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("path", { d: "M8 6h8" }),
            /* @__PURE__ */ jsx("path", { d: "M8 12h6" }),
            /* @__PURE__ */ jsx("path", { d: "M8 18h4" })
          ]
        }
      );
    case "file":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("path", { d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" }),
            /* @__PURE__ */ jsx("polyline", { points: "14 2 14 8 20 8" })
          ]
        }
      );
    case "gear":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })
          ]
        }
      );
    case "graph":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("circle", { cx: "6", cy: "6", r: "3" }),
            /* @__PURE__ */ jsx("circle", { cx: "18", cy: "6", r: "3" }),
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "18", r: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M6 9v3a3 3 0 0 0 3 3h3" }),
            /* @__PURE__ */ jsx("path", { d: "M18 9v3a3 3 0 0 1-3 3h-3" })
          ]
        }
      );
    case "kanban":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "4", height: "18", rx: "1" }),
            /* @__PURE__ */ jsx("rect", { x: "10", y: "3", width: "4", height: "12", rx: "1" }),
            /* @__PURE__ */ jsx("rect", { x: "17", y: "3", width: "4", height: "8", rx: "1" })
          ]
        }
      );
    case "play":
      return /* @__PURE__ */ jsx(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: /* @__PURE__ */ jsx("polygon", { points: "5 3 19 12 5 21 5 3" })
        }
      );
    case "sparkle":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("path", { d: "M12 3c.5 2.5 2.5 4.5 5 5-2.5.5-4.5 2.5-5 5-.5-2.5-2.5-4.5-5-5 2.5-.5 4.5-2.5 5-5z" }),
            /* @__PURE__ */ jsx("path", { d: "M19 17c-.7 1.2-2 2-3.5 2 1.5.7 2.5 2 2.5 3.5.7-1.5 2-2.5 3.5-2.5-1.5-.7-2.5-2-2.5-3.5z" })
          ]
        }
      );
    case "terminal":
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("polyline", { points: "4 17 10 11 4 5" }),
            /* @__PURE__ */ jsx("line", { x1: "12", y1: "19", x2: "20", y2: "19" })
          ]
        }
      );
    default:
      return /* @__PURE__ */ jsxs(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.8",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
            /* @__PURE__ */ jsx("path", { d: "M3 9h18" })
          ]
        }
      );
  }
}

// packages/desktop/ui/src/components/conversation/ConversationPreferencesRow.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/conversation/composerPreferenceCommands.ts
var COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT = "neon-pilot-composer-open-preferences-command";
var COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT = "neon-pilot-composer-close-preferences-command";
var COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT = "neon-pilot-composer-toggle-preferences-command";

// packages/desktop/ui/src/components/conversation/ConversationPreferencesRow.tsx
function MoreHorizontalIcon({ className }) {
  return /* @__PURE__ */ jsxs("svg", { className, width: "14", height: "14", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "5", cy: "12", r: "1.8" }),
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "1.8" }),
    /* @__PURE__ */ jsx("circle", { cx: "19", cy: "12", r: "1.8" })
  ] });
}
var COMPOSER_PREFERENCES_MENU_WIDTH = 208;
function ConversationPreferencesRow({
  composerControls = [],
  composerControlContext,
  inlineLimit,
  respondToSettingsCommands = false
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const buttonRef = useRef(null);
  const inlineCount = Math.max(0, inlineLimit);
  const inlineControls = composerControls.slice(0, inlineCount);
  const menuControls = composerControls.slice(inlineCount);
  const hasMenuItems = menuControls.length > 0;
  const estimatedMenuHeight = Math.max(56, menuControls.length * 40 + 20);
  const openMenu = useCallback(() => {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) {
      setMenuPosition({ x: 12, y: 12 });
      setMenuOpen(true);
      return;
    }
    setMenuPosition({
      x: bounds.left + bounds.width / 2 - COMPOSER_PREFERENCES_MENU_WIDTH / 2,
      y: bounds.top - estimatedMenuHeight - 8
    });
    setMenuOpen(true);
  }, [estimatedMenuHeight]);
  useEffect(() => {
    setExtensionCommandContext("composer.preferencesAvailable", hasMenuItems);
    return () => setExtensionCommandContext("composer.preferencesAvailable", null);
  }, [hasMenuItems]);
  useEffect(() => {
    if (!respondToSettingsCommands) return;
    setExtensionCommandContext("composer.settingsAvailable", hasMenuItems);
    return () => setExtensionCommandContext("composer.settingsAvailable", null);
  }, [hasMenuItems, respondToSettingsCommands]);
  useEffect(() => {
    setExtensionCommandContext("composer.preferencesOpen", menuOpen);
    return () => setExtensionCommandContext("composer.preferencesOpen", null);
  }, [menuOpen]);
  useEffect(() => {
    if (!respondToSettingsCommands) return;
    setExtensionCommandContext("composer.settingsOpen", menuOpen);
    return () => setExtensionCommandContext("composer.settingsOpen", null);
  }, [menuOpen, respondToSettingsCommands]);
  useEffect(() => {
    function handleOpenPreferencesCommand() {
      if (hasMenuItems) openMenu();
    }
    window.addEventListener(COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT, handleOpenPreferencesCommand);
    return () => window.removeEventListener(COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT, handleOpenPreferencesCommand);
  }, [hasMenuItems, openMenu]);
  useEffect(() => {
    if (!respondToSettingsCommands) return;
    function handleOpenSettingsCommand() {
      if (hasMenuItems) openMenu();
    }
    window.addEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettingsCommand);
    return () => window.removeEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettingsCommand);
  }, [hasMenuItems, openMenu, respondToSettingsCommands]);
  useEffect(() => {
    function handleTogglePreferencesCommand() {
      if (!hasMenuItems) return;
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      openMenu();
    }
    window.addEventListener(COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT, handleTogglePreferencesCommand);
    return () => window.removeEventListener(COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT, handleTogglePreferencesCommand);
  }, [hasMenuItems, menuOpen, openMenu]);
  useEffect(() => {
    if (!menuOpen) return;
    function handleClosePreferencesCommand() {
      setMenuOpen(false);
    }
    window.addEventListener(COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT, handleClosePreferencesCommand);
    return () => window.removeEventListener(COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT, handleClosePreferencesCommand);
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen || !respondToSettingsCommands) return;
    function handleCloseSettingsCommand() {
      setMenuOpen(false);
    }
    window.addEventListener(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, handleCloseSettingsCommand);
    return () => window.removeEventListener(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, handleCloseSettingsCommand);
  }, [menuOpen, respondToSettingsCommands]);
  return /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-nowrap items-center gap-2", children: [
    inlineControls.map((control) => /* @__PURE__ */ jsx(
      ComposerButtonHost,
      {
        registration: control,
        controlContext: { ...composerControlContext, renderMode: "inline" }
      },
      `${control.extensionId}:${control.id}`
    )),
    hasMenuItems && /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx(
        IconButton,
        {
          ref: buttonRef,
          type: "button",
          onClick: () => {
            if (menuOpen) {
              setMenuOpen(false);
              return;
            }
            openMenu();
          },
          className: cx(
            "h-8 w-8 rounded-md border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/25 focus-visible:ring-offset-1 focus-visible:ring-offset-base",
            menuOpen && "bg-surface/55 text-primary"
          ),
          "aria-label": "More composer settings",
          "aria-expanded": menuOpen,
          "aria-haspopup": "dialog",
          title: "More composer settings",
          onKeyDown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (menuOpen) {
              setMenuOpen(false);
              return;
            }
            openMenu();
          },
          children: /* @__PURE__ */ jsx(MoreHorizontalIcon, {})
        }
      ),
      menuOpen && menuPosition ? /* @__PURE__ */ jsx(
        ContextMenu,
        {
          "aria-label": "Composer settings",
          className: "z-50 grid gap-2 p-2.5",
          estimatedHeight: estimatedMenuHeight,
          ignoreRefs: [buttonRef],
          minWidth: COMPOSER_PREFERENCES_MENU_WIDTH,
          onClose: () => setMenuOpen(false),
          position: menuPosition,
          role: "dialog",
          style: { width: `min(${COMPOSER_PREFERENCES_MENU_WIDTH / 16}rem, calc(100vw - 1rem))` },
          children: /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2", children: menuControls.map((control) => /* @__PURE__ */ jsx(
            ComposerButtonHost,
            {
              registration: control,
              controlContext: { ...composerControlContext, renderMode: "menu" }
            },
            `${control.extensionId}:${control.id}`
          )) })
        }
      ) : null
    ] })
  ] });
}

// packages/desktop/ui/src/components/conversation/ConversationComposerInputControls.tsx
function getComposerPreferenceInlineLimit(composerShellWidth) {
  const width = composerShellWidth ?? Number.POSITIVE_INFINITY;
  if (width >= 860) return Number.POSITIVE_INFINITY;
  if (width >= 760) return 4;
  if (width >= 660) return 3;
  if (width >= 560) return 2;
  if (width >= 460) return 1;
  return 0;
}
var MODEL_PREFERENCES_CONTROL_KEY = "system-model-picker:model-preferences";
var CORE_COMPOSER_CONTROL_KEYS = /* @__PURE__ */ new Set(["system-composer-attachments:attach-files"]);
var CORE_COMPOSER_INPUT_TOOL_KEYS = /* @__PURE__ */ new Set(["system-excalidraw-input:excalidraw"]);
var CORE_MODEL_PREFERENCE_MENU_WIDTH = 256;
var CORE_MODEL_PREFERENCE_MENU_ESTIMATED_HEIGHT = 64;
function composerRegistrationKey(registration) {
  return `${registration.extensionId}:${registration.id}`;
}
function setComposerFocusedCommandContext(focused) {
  setExtensionCommandContext("composer.focused", focused);
}
function modelOptionLabel(model) {
  return model.label ?? model.name ?? model.id;
}
function CoreComposerIcon({ path }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: path })
    }
  );
}
function CoreComposerDotsIcon() {
  return /* @__PURE__ */ jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "5", cy: "12", r: "1.7" }),
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "1.7" }),
    /* @__PURE__ */ jsx("circle", { cx: "19", cy: "12", r: "1.7" })
  ] });
}
function CoreAttachControl({ disabled, onOpenFilePicker }) {
  return /* @__PURE__ */ jsx(
    IconButton,
    {
      shape: "circle",
      type: "button",
      onPointerDown: (event) => {
        event.preventDefault();
        if (event.pointerType && event.pointerType !== "mouse" || event.button === 0) onOpenFilePicker();
      },
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenFilePicker();
        }
      },
      disabled,
      title: "Attach file",
      "aria-label": "Attach file",
      children: /* @__PURE__ */ jsx(CoreComposerIcon, { path: "M12 5v14M5 12h14" })
    }
  );
}
function CoreDrawingControl({
  conversationId,
  disabled,
  onUpsertDrawingAttachment
}) {
  const openDrawingModal = useCallback(async () => {
    if (disabled) return;
    const result = await new Promise((resolve, reject) => {
      window.dispatchEvent(
        new CustomEvent("neon-pilot-extension-modal", {
          detail: {
            extensionId: "system-excalidraw-input",
            component: "ExcalidrawEditorModal",
            props: { conversationId, saveLabel: "Attach to chat" },
            size: "fullscreen",
            resolve,
            reject
          }
        })
      );
    });
    if (result && typeof result === "object") {
      onUpsertDrawingAttachment(result);
    }
  }, [conversationId, disabled, onUpsertDrawingAttachment]);
  useEffect(() => {
    const handleCreateDrawingCommand = () => {
      void openDrawingModal();
    };
    window.addEventListener(COMPOSER_CREATE_DRAWING_COMMAND_EVENT, handleCreateDrawingCommand);
    return () => window.removeEventListener(COMPOSER_CREATE_DRAWING_COMMAND_EVENT, handleCreateDrawingCommand);
  }, [openDrawingModal]);
  return /* @__PURE__ */ jsx(
    IconButton,
    {
      shape: "circle",
      type: "button",
      onPointerDown: (event) => {
        event.preventDefault();
        if (event.pointerType && event.pointerType !== "mouse" || event.button === 0) void openDrawingModal();
      },
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void openDrawingModal();
        }
      },
      disabled,
      title: "Create drawing",
      "aria-label": "Create drawing",
      children: /* @__PURE__ */ jsx(CoreComposerIcon, { path: "M12 3.75l1.07 3.43a1.5 1.5 0 0 0 .93.94l3.43 1.07-3.43 1.07a1.5 1.5 0 0 0-.93.93L12 15.62l-1.07-3.43a1.5 1.5 0 0 0-.93-.93L6.57 10.19 10 9.12a1.5 1.5 0 0 0 .93-.94L12 3.75Zm6 10.5.54 1.71a.75.75 0 0 0 .47.47l1.71.54-1.71.54a.75.75 0 0 0-.47.47L18 20.69l-.54-1.71a.75.75 0 0 0-.47-.47l-1.71-.54 1.71-.54a.75.75 0 0 0 .47-.47L18 14.25Z" })
    }
  );
}
function CoreModelPreferenceControls({
  disabled,
  models,
  currentModel,
  currentThinkingLevel,
  currentServiceTier,
  compact,
  onSelectModel,
  onSelectThinkingLevel,
  onSelectServiceTier
}) {
  const selectedModel = resolveSelectableModel(models, currentModel);
  const modelGroups = groupModelsByProvider(models);
  const modelProviderIds = modelGroups.map(([provider]) => provider);
  const serviceTierOptions = selectedModel?.supportedServiceTiers ?? [];
  const selectBaseClassName = "h-8 min-w-0 truncate border-transparent bg-transparent px-2 text-xs font-medium text-secondary disabled:opacity-50";
  const modelSelectClassName = cx(selectBaseClassName, compact ? "max-w-[8.25rem]" : "max-w-[10rem]");
  const thinkingSelectClassName = cx(selectBaseClassName, compact ? "max-w-[5.75rem]" : "max-w-[7rem]");
  const serviceTierSelectClassName = cx(selectBaseClassName, compact ? "max-w-[5.75rem]" : "max-w-[7rem]");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      Select,
      {
        "aria-label": "Conversation model",
        title: "Conversation model",
        className: modelSelectClassName,
        disabled: disabled || models.length === 0,
        value: selectedModel ? getModelSelectionValue(selectedModel, models) : currentModel,
        onChange: (event) => onSelectModel(event.target.value),
        children: [
          models.length === 0 ? /* @__PURE__ */ jsx("option", { value: "", children: "Select model" }) : null,
          modelGroups.map(([provider, providerModels]) => /* @__PURE__ */ jsx("optgroup", { label: formatModelProviderGroupLabel(provider, modelProviderIds), children: providerModels.map((model) => /* @__PURE__ */ jsx("option", { value: getModelSelectionValue(model, models), children: modelOptionLabel(model) }, `${model.provider}:${model.id}`)) }, provider))
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      Select,
      {
        "aria-label": "Thinking level",
        title: "Thinking level",
        className: thinkingSelectClassName,
        disabled,
        value: currentThinkingLevel,
        onChange: (event) => onSelectThinkingLevel(event.target.value),
        children: THINKING_LEVEL_OPTIONS.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
      }
    ),
    serviceTierOptions.length > 0 ? /* @__PURE__ */ jsxs(
      Select,
      {
        "aria-label": "Service tier",
        title: "Service tier",
        className: serviceTierSelectClassName,
        disabled,
        value: currentServiceTier,
        onChange: (event) => onSelectServiceTier(event.target.value),
        children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Use model default" }),
          serviceTierOptions.map((tier) => /* @__PURE__ */ jsx("option", { value: tier, children: formatServiceTierLabel(tier) }, tier))
        ]
      }
    ) : null
  ] });
}
function CoreModelPreferenceOverflow({
  disabled,
  models,
  currentModel,
  currentThinkingLevel,
  currentServiceTier,
  onSelectModel,
  onSelectThinkingLevel,
  onSelectServiceTier
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const buttonRef = useRef(null);
  const settingsAvailable = !(disabled && models.length === 0);
  const openMenu = useCallback(() => {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) {
      setMenuPosition({ x: 12, y: 12 });
      setOpen(true);
      return;
    }
    setMenuPosition({
      x: bounds.left + bounds.width / 2 - CORE_MODEL_PREFERENCE_MENU_WIDTH / 2,
      y: bounds.top - CORE_MODEL_PREFERENCE_MENU_ESTIMATED_HEIGHT - 8
    });
    setOpen(true);
  }, []);
  useEffect(() => {
    setExtensionCommandContext("composer.settingsAvailable", settingsAvailable);
    return () => setExtensionCommandContext("composer.settingsAvailable", null);
  }, [settingsAvailable]);
  useEffect(() => {
    if (!open) {
      return;
    }
    setExtensionCommandContext("composer.settingsOpen", true);
    return () => setExtensionCommandContext("composer.settingsOpen", null);
  }, [open]);
  useEffect(() => {
    function handleOpenSettings() {
      if (settingsAvailable) openMenu();
    }
    window.addEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettings);
    return () => window.removeEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettings);
  }, [settingsAvailable]);
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleCloseSettings() {
      setOpen(false);
    }
    window.addEventListener(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, handleCloseSettings);
    return () => window.removeEventListener(COMPOSER_CLOSE_SETTINGS_COMMAND_EVENT, handleCloseSettings);
  }, [open]);
  return /* @__PURE__ */ jsxs("div", { className: "relative shrink-0", children: [
    /* @__PURE__ */ jsx(
      IconButton,
      {
        ref: buttonRef,
        shape: "circle",
        type: "button",
        title: "More composer settings",
        "aria-label": "More composer settings",
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        disabled: !settingsAvailable,
        onPointerDown: (event) => {
          event.preventDefault();
          if (!(event.pointerType && event.pointerType !== "mouse" || event.button === 0)) return;
          if (open) {
            setOpen(false);
            return;
          }
          openMenu();
        },
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) {
              setOpen(false);
              return;
            }
            openMenu();
          }
        },
        children: /* @__PURE__ */ jsx(CoreComposerDotsIcon, {})
      }
    ),
    open && menuPosition ? /* @__PURE__ */ jsx(
      ContextMenu,
      {
        "aria-label": "Composer settings",
        className: "z-50 grid gap-2 p-2.5",
        estimatedHeight: CORE_MODEL_PREFERENCE_MENU_ESTIMATED_HEIGHT,
        ignoreRefs: [buttonRef],
        minWidth: CORE_MODEL_PREFERENCE_MENU_WIDTH,
        onClose: () => setOpen(false),
        position: menuPosition,
        role: "dialog",
        style: { width: `min(${CORE_MODEL_PREFERENCE_MENU_WIDTH / 16}rem, calc(100vw - 1rem))` },
        children: /* @__PURE__ */ jsx(
          CoreModelPreferenceControls,
          {
            disabled,
            models,
            currentModel,
            currentThinkingLevel,
            currentServiceTier,
            compact: false,
            onSelectModel,
            onSelectThinkingLevel,
            onSelectServiceTier
          }
        )
      }
    ) : null
  ] });
}
function inputControlsPropsAreEqual(prev, next) {
  return prev.input === next.input && prev.pendingAskUserQuestion === next.pendingAskUserQuestion && prev.composerDisabled === next.composerDisabled && prev.composerShellWidth === next.composerShellWidth && prev.streamIsStreaming === next.streamIsStreaming && prev.models === next.models && prev.currentModel === next.currentModel && prev.currentThinkingLevel === next.currentThinkingLevel && prev.currentServiceTier === next.currentServiceTier && prev.savingPreference === next.savingPreference && prev.conversationNeedsTakeover === next.conversationNeedsTakeover && prev.composerHasContent === next.composerHasContent && prev.composerShowsQuestionSubmit === next.composerShowsQuestionSubmit && prev.composerQuestionCanSubmit === next.composerQuestionCanSubmit && prev.composerQuestionRemainingCount === next.composerQuestionRemainingCount && prev.composerQuestionSubmitting === next.composerQuestionSubmitting && prev.composerSubmitLabel === next.composerSubmitLabel && prev.composerAltHeld === next.composerAltHeld && prev.composerPlaceholder === next.composerPlaceholder && prev.onFilesSelected === next.onFilesSelected && prev.onInputChange === next.onInputChange && prev.onRememberComposerSelection === next.onRememberComposerSelection && prev.onKeyDown === next.onKeyDown && prev.onPaste === next.onPaste && prev.onOpenFilePicker === next.onOpenFilePicker && prev.onUpsertDrawingAttachment === next.onUpsertDrawingAttachment && prev.onSelectModel === next.onSelectModel && prev.onSelectThinkingLevel === next.onSelectThinkingLevel && prev.onSelectServiceTier === next.onSelectServiceTier && prev.onInsertComposerText === next.onInsertComposerText && prev.onAppendComposerText === next.onAppendComposerText && prev.onSubmitComposerQuestion === next.onSubmitComposerQuestion && prev.onSubmitComposerActionForModifiers === next.onSubmitComposerActionForModifiers && prev.onAbortStream === next.onAbortStream && prev.conversationId === next.conversationId;
}
var ConversationComposerInputControls = memo(function ConversationComposerInputControls2({
  fileInputRef,
  textareaRef,
  input,
  pendingAskUserQuestion,
  composerDisabled,
  composerShellWidth,
  streamIsStreaming,
  models,
  currentModel,
  currentThinkingLevel,
  currentServiceTier,
  savingPreference,
  conversationNeedsTakeover,
  composerHasContent,
  composerShowsQuestionSubmit,
  composerQuestionCanSubmit,
  composerQuestionRemainingCount,
  composerQuestionSubmitting,
  composerSubmitLabel,
  composerAltHeld,
  composerPlaceholder,
  onFilesSelected,
  onInputChange,
  onRememberComposerSelection,
  onKeyDown,
  onPaste,
  onOpenFilePicker,
  onUpsertDrawingAttachment,
  onSelectModel,
  onSelectThinkingLevel,
  onSelectServiceTier,
  onInsertComposerText,
  onAppendComposerText,
  onSubmitComposerQuestion,
  onSubmitComposerActionForModifiers,
  onAbortStream,
  conversationId
}) {
  const { composerControls = [], composerInputTools = [] } = useExtensionRegistry();
  const extensionComposerControls = useMemo(
    () => composerControls.filter((control) => !CORE_COMPOSER_CONTROL_KEYS.has(composerRegistrationKey(control))),
    [composerControls]
  );
  const extensionComposerInputTools = useMemo(
    () => composerInputTools.filter((tool) => !CORE_COMPOSER_INPUT_TOOL_KEYS.has(composerRegistrationKey(tool))),
    [composerInputTools]
  );
  const [localInput, setLocalInputState] = useState(input);
  const previousInputPropRef = useRef(input);
  const localInputRef = useRef(input);
  const setLocalInput = (nextInput) => {
    localInputRef.current = nextInput;
    setLocalInputState(nextInput);
  };
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const previousScrollTop = textarea.scrollTop;
    const selectionEnd = textarea.selectionEnd ?? textarea.value.length;
    const shouldKeepCaretVisible = document.activeElement === textarea && selectionEnd >= textarea.value.length;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > nextHeight ? "auto" : "hidden";
    textarea.scrollTop = shouldKeepCaretVisible ? textarea.scrollHeight : previousScrollTop;
  }, [localInput, textareaRef]);
  useEffect(() => {
    if (previousInputPropRef.current === input) {
      return;
    }
    previousInputPropRef.current = input;
    const currentLocalInput = localInputRef.current;
    const focused = textareaRef.current && document.activeElement === textareaRef.current;
    if (focused && input.length > 0 && currentLocalInput.length > input.length && currentLocalInput.startsWith(input)) {
      return;
    }
    setLocalInput(input);
  }, [input, textareaRef]);
  useEffect(() => () => setComposerFocusedCommandContext(null), []);
  useEffect(() => {
    setExtensionCommandContext("composer.canCreateDrawing", !composerDisabled);
    return () => setExtensionCommandContext("composer.canCreateDrawing", null);
  }, [composerDisabled]);
  const visibleComposerInputTools = useMemo(
    () => extensionComposerInputTools.filter((tool) => {
      const expr = tool.when;
      if (!expr) return true;
      const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
      for (const clause of clauses) {
        const trimmed = clause.trim();
        if (trimmed === "composerHasContent" && !composerHasContent) return false;
        if (trimmed === "streamIsStreaming" && !streamIsStreaming) return false;
        if (trimmed === "!streamIsStreaming" && streamIsStreaming) return false;
      }
      return true;
    }),
    [composerHasContent, extensionComposerInputTools, streamIsStreaming]
  );
  const visibleComposerControls = useMemo(
    () => extensionComposerControls.filter((button) => {
      const expr = button.when;
      if (!expr) return true;
      const clauses = expr.split(/\s*&&\s*/).filter(Boolean);
      for (const clause of clauses) {
        const trimmed = clause.trim();
        if (trimmed === "composerHasContent" && !composerHasContent) return false;
        if (trimmed === "streamIsStreaming" && !streamIsStreaming) return false;
        if (trimmed === "!streamIsStreaming" && streamIsStreaming) return false;
      }
      return true;
    }),
    [extensionComposerControls, composerHasContent, streamIsStreaming]
  );
  const composerControlContext = {
    composerDisabled,
    streamIsStreaming,
    composerHasContent,
    openFilePicker: onOpenFilePicker,
    addFiles: onFilesSelected,
    insertText: onInsertComposerText,
    appendText: onAppendComposerText,
    models,
    currentModel,
    currentThinkingLevel,
    currentServiceTier,
    savingPreference,
    selectModel: onSelectModel,
    selectThinkingLevel: onSelectThinkingLevel,
    selectServiceTier: onSelectServiceTier
  };
  const visibleLeadingControls = visibleComposerControls.filter((control) => control.slot === "leading");
  const visiblePreferenceControls = visibleComposerControls.filter((control) => control.slot === "preferences");
  const hasExtensionModelPreferencesControl = visiblePreferenceControls.some(
    (control) => composerRegistrationKey(control) === MODEL_PREFERENCES_CONTROL_KEY
  );
  const shouldKeepControlRowInline = composerShellWidth === null || composerShellWidth >= 420;
  const shouldCollapseCorePreferences = !shouldKeepControlRowInline;
  const shouldRenderCoreModelPreferences = !hasExtensionModelPreferencesControl;
  return /* @__PURE__ */ jsxs("div", { className: "px-3 pt-2.5 pb-2.5", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: fileInputRef,
        type: "file",
        accept: "image/*,video/*,.excalidraw,application/json",
        multiple: true,
        className: "hidden",
        onChange: (event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            onFilesSelected(files);
          }
          event.target.value = "";
        }
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-0", children: [
      /* @__PURE__ */ jsx("div", { className: "px-1 pt-1", children: /* @__PURE__ */ jsx(
        Textarea,
        {
          ref: textareaRef,
          value: localInput,
          onChange: (event) => {
            const nextValue = event.target.value;
            const target = event.target;
            setLocalInput(nextValue);
            requestAnimationFrame(() => onRememberComposerSelection(target));
            onInputChange(nextValue, target);
          },
          onSelect: (event) => {
            onRememberComposerSelection(event.currentTarget);
          },
          onClick: (event) => {
            onRememberComposerSelection(event.currentTarget);
          },
          onKeyUp: (event) => {
            onRememberComposerSelection(event.currentTarget);
          },
          onFocus: (event) => {
            setComposerFocusedCommandContext(true);
            onRememberComposerSelection(event.currentTarget);
          },
          onBlur: () => {
            setComposerFocusedCommandContext(false);
          },
          onKeyDown,
          onPaste,
          rows: 1,
          disabled: composerDisabled,
          className: "w-full resize-none overscroll-contain !border-0 !bg-transparent !p-0 text-sm leading-relaxed text-primary outline-none placeholder:text-dim hover:!bg-transparent focus:!border-0 focus:!bg-transparent disabled:cursor-default disabled:text-dim",
          placeholder: pendingAskUserQuestion ? "Answer 1-9, or type to skip\u2026" : composerPlaceholder ?? "Message Neon Pilot\u2026   /  commands \xB7 \u21E7\u21B5 newline",
          title: pendingAskUserQuestion ? "1-9 selects the current answer. Tab/Shift+Tab or \u2190/\u2192 moves between questions. Enter selects or submits. Ctrl+C clears the composer." : "Ctrl+C clears the composer. Alt+Enter queues a follow up while the conversation is busy. \u2191/\u2193 recalls recent prompts.",
          style: { minHeight: "44px", maxHeight: "160px", WebkitOverflowScrolling: "touch" }
        }
      ) }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: cx(
            "flex min-w-0 flex-wrap items-center gap-1.5 border-t border-dashed border-border-subtle px-1 py-2 pb-0",
            shouldKeepControlRowInline && "flex-nowrap"
          ),
          children: [
            /* @__PURE__ */ jsxs("div", { className: cx("flex min-w-0 flex-1 flex-wrap items-center gap-1.5", shouldKeepControlRowInline && "flex-nowrap"), children: [
              /* @__PURE__ */ jsx(CoreAttachControl, { disabled: composerDisabled, onOpenFilePicker }),
              visibleLeadingControls.map((control) => /* @__PURE__ */ jsx(
                ComposerButtonHost,
                {
                  registration: control,
                  controlContext: { ...composerControlContext, renderMode: "inline" }
                },
                `${control.extensionId}:${control.id}`
              )),
              /* @__PURE__ */ jsx(
                CoreDrawingControl,
                {
                  conversationId,
                  disabled: composerDisabled,
                  onUpsertDrawingAttachment
                }
              ),
              visibleComposerInputTools.map((tool) => /* @__PURE__ */ jsx(
                ComposerInputToolHost,
                {
                  registration: tool,
                  toolContext: {
                    conversationId,
                    composerDisabled,
                    streamIsStreaming,
                    composerHasContent,
                    addFiles: onFilesSelected,
                    upsertDrawingAttachment: onUpsertDrawingAttachment
                  }
                },
                `${tool.extensionId}:${tool.id}`
              )),
              shouldRenderCoreModelPreferences ? shouldCollapseCorePreferences ? /* @__PURE__ */ jsx(
                CoreModelPreferenceOverflow,
                {
                  disabled: composerDisabled,
                  models,
                  currentModel,
                  currentThinkingLevel,
                  currentServiceTier,
                  onSelectModel,
                  onSelectThinkingLevel,
                  onSelectServiceTier
                }
              ) : /* @__PURE__ */ jsx(
                CoreModelPreferenceControls,
                {
                  disabled: composerDisabled,
                  models,
                  currentModel,
                  currentThinkingLevel,
                  currentServiceTier,
                  compact: false,
                  onSelectModel,
                  onSelectThinkingLevel,
                  onSelectServiceTier
                }
              ) : null,
              /* @__PURE__ */ jsx(
                ConversationPreferencesRow,
                {
                  composerControls: visiblePreferenceControls,
                  composerControlContext,
                  inlineLimit: getComposerPreferenceInlineLimit(composerShellWidth),
                  respondToSettingsCommands: hasExtensionModelPreferencesControl && shouldCollapseCorePreferences
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "ml-auto shrink-0", children: /* @__PURE__ */ jsx(
              ConversationComposerActions,
              {
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
                onAbortStream
              }
            ) })
          ]
        }
      )
    ] })
  ] });
}, inputControlsPropsAreEqual);

// packages/desktop/ui/src/components/conversation/ConversationComposerMenus.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/chat/ComposerAttachmentShelf.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/chat/CheckpointInlineDiff.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/checkpoints/CheckpointDiffView.tsx
init_neon_pilot_shared_react();
var PatchDiff = lazy(() => import("./chunks/react-7EMEGVFJ.js").then((module) => ({ default: module.PatchDiff })));

// packages/desktop/ui/src/components/shared/ContextMenuWrapper.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/shared/useFileTreeModel.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/hooks/useInvalidateOnTopics.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/navigation/lazyRouteRecovery.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/pages/ConversationPage.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/conversation/ConversationComposerMeta.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/StatusBarItemHost.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/conversation/ConversationDraftEmptyAction.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/components/conversation/ConversationGoalPanel.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/local/reloadState.ts
init_neon_pilot_shared_react();
var useReloadStateLayoutEffect = typeof window === "undefined" || /\b(jsdom|happy-dom)\b/i.test(window.navigator?.userAgent ?? "") ? useEffect : useLayoutEffect;

// packages/desktop/ui/src/hooks/useDesktopConversationState.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/hooks/sessionStream.ts
function createEmptyLiveSessionPresenceState() {
  return {
    surfaces: [],
    controllerSurfaceId: null,
    controllerSurfaceType: null,
    controllerAcquiredAt: null
  };
}
var INITIAL_STREAM_STATE = {
  blocks: [],
  blockOffset: 0,
  totalBlocks: 0,
  hasSnapshot: false,
  isStreaming: false,
  isCompacting: false,
  error: null,
  title: null,
  tokens: null,
  cost: null,
  contextUsage: null,
  pendingQueue: { steering: [], followUp: [] },
  presence: createEmptyLiveSessionPresenceState(),
  goalState: null,
  systemPrompt: null,
  toolDefinitions: [],
  cwdChange: null
};

// packages/desktop/ui/src/hooks/useSessions.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/relatedConversationCandidates.ts
var DAY_MS = 24 * 60 * 60 * 1e3;

// packages/desktop/ui/src/conversation/useConversationModels.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/useDesktopConversationShortcuts.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/useEscapeAbortStream.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/useInitialDraftAttachmentHydration.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/useRelatedThreadHotkeys.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/useWorkspaceComposerEvents.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/ComposerShelfHost.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/ConversationHeaderHost.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/ConversationLifecycleHost.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/NewConversationPanelHost.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/extensions/useExtensionBackendConfirmations.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/hooks/useConversationScroll.ts
init_neon_pilot_shared_react();
var useConversationScrollLayoutEffect = typeof window === "undefined" || /\b(jsdom|happy-dom)\b/i.test(window.navigator?.userAgent ?? "") ? useEffect : useLayoutEffect;

// packages/desktop/ui/src/pages/ConversationPage.tsx
var ConversationArtifactModal = lazy(
  () => import("./chunks/ConversationArtifactModal-TJFC7LDJ.js").then((module) => ({ default: module.ConversationArtifactModal }))
);
var ConversationDrawingsPickerModal = lazy(
  () => import("./chunks/ConversationDrawingsPickerModal-O2ZQLINY.js").then((module) => ({ default: module.ConversationDrawingsPickerModal }))
);
var loadChatView = () => import("./chunks/ChatView-MJAN44FH.js").then((module) => ({ default: module.ChatView }));
var ChatView = lazy(loadChatView);
var ConversationActivityShelf = lazy(
  () => import("./chunks/ConversationActivityShelf-5ERBADU4.js").then((module) => ({ default: module.ConversationActivityShelf }))
);
var ConversationContextShelf = lazy(
  () => import("./chunks/ConversationContextShelf-CDYVGGEW.js").then((module) => ({ default: module.ConversationContextShelf }))
);
var ConversationQuestionShelf = lazy(
  () => import("./chunks/ConversationQuestionShelf-F5G37ISZ.js").then((module) => ({ default: module.ConversationQuestionShelf }))
);
var ConversationQueueShelf = lazy(
  () => import("./chunks/ConversationQueueShelf-4FSVKJXM.js").then((module) => ({ default: module.ConversationQueueShelf }))
);
var ConversationSavedHeader = lazy(
  () => import("./chunks/ConversationSavedHeader-HTJ7II7M.js").then((module) => ({ default: module.ConversationSavedHeader }))
);

// packages/desktop/ui/src/extensions/SettingsPanelHost.tsx
init_neon_pilot_shared_react();
var SettingsPanelErrorBoundary = class extends neon_pilot_shared_react_default.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error(`Extension settings failed to render: ${this.props.extensionId}:${this.props.componentId}`, error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return /* @__PURE__ */ jsx(ErrorState, { title: "Extension settings failed to render.", body: this.props.errorBody, className: "p-4" });
  }
};

// extensions/system-gateways/src/frontend.tsx
init_neon_pilot_shared_react();
var TELEGRAM_PROVIDER_ID = "telegram";
function GatewaysPage() {
  const [pageState, setPageState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [operation, setOperation] = useState(null);
  const [notice, setNotice] = useState(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newChatId, setNewChatId] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setOperation((current) => current ?? "refresh");
    setError(null);
    try {
      const [gateway, token, access] = await Promise.all([
        apiRequest("/api/gateways"),
        apiRequest("/api/gateways/telegram/token"),
        apiRequest("/api/gateways/telegram/access")
      ]);
      setPageState({ gateway, token, access });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setOperation((current) => current === "refresh" ? null : current);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const telegramProvider = useMemo(
    () => pageState?.gateway.providers.find((provider) => provider.id === TELEGRAM_PROVIDER_ID) ?? null,
    [pageState]
  );
  const telegramConnection = useMemo(
    () => pageState?.gateway.connections.find((connection) => connection.provider === TELEGRAM_PROVIDER_ID) ?? null,
    [pageState]
  );
  const telegramEvents = useMemo(
    () => pageState?.gateway.events.filter((event) => event.provider === TELEGRAM_PROVIDER_ID).slice(0, 5) ?? [],
    [pageState]
  );
  const runMutation = useCallback(
    async (nextOperation, task) => {
      setOperation(nextOperation);
      setError(null);
      setNotice(null);
      try {
        const message = await task();
        await load();
        setNotice(message);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setOperation(null);
      }
    },
    [load]
  );
  const saveToken = useCallback(() => {
    const token = tokenDraft.trim();
    if (!token) {
      setError("Paste a Telegram bot token before saving.");
      return;
    }
    void runMutation("saveToken", async () => {
      await apiRequest("/api/gateways/telegram/token", {
        method: "POST",
        body: { token }
      });
      setTokenDraft("");
      return "Telegram token saved and the gateway is enabled.";
    });
  }, [runMutation, tokenDraft]);
  const removeToken = useCallback(() => {
    void runMutation("removeToken", async () => {
      await apiRequest("/api/gateways/telegram/token", { method: "DELETE" });
      return "Telegram token removed.";
    });
  }, [runMutation]);
  const testToken = useCallback(() => {
    void runMutation("test", async () => {
      const result = await apiRequest("/api/gateways/telegram/test", { method: "POST" });
      const botName = result.bot?.username ? `@${result.bot.username}` : result.bot?.first_name;
      return botName ? `Telegram responded as ${botName}.` : "Telegram responded successfully.";
    });
  }, [runMutation]);
  const createConnection = useCallback(() => {
    void runMutation("create", async () => {
      await apiRequest("/api/gateways/connections", {
        method: "POST",
        body: { provider: TELEGRAM_PROVIDER_ID }
      });
      return "Telegram gateway connection created.";
    });
  }, [runMutation]);
  const setConnectionEnabled = useCallback(
    (enabled) => {
      void runMutation(enabled ? "enable" : "pause", async () => {
        await apiRequest(`/api/gateways/connections/${TELEGRAM_PROVIDER_ID}`, {
          method: "PATCH",
          body: {
            status: enabled ? "active" : "paused",
            enabled,
            statusMessage: enabled ? "Telegram gateway enabled" : "Telegram gateway paused"
          }
        });
        return enabled ? "Telegram gateway enabled." : "Telegram gateway paused.";
      });
    },
    [runMutation]
  );
  const updateAccess = useCallback(
    (access, message) => {
      void runMutation("access", async () => {
        await apiRequest("/api/gateways/telegram/access", {
          method: "PATCH",
          body: access
        });
        return message;
      });
    },
    [runMutation]
  );
  if (loading && !pageState) {
    return /* @__PURE__ */ jsx(CenteredLoadingState, { label: "Loading gateways..." });
  }
  if (!pageState) {
    return /* @__PURE__ */ jsx("div", { className: "flex h-full items-center justify-center px-6", children: /* @__PURE__ */ jsxs("div", { className: "space-y-3 text-center", children: [
      /* @__PURE__ */ jsx(ErrorState, { message: error ?? "Gateways could not be loaded." }),
      /* @__PURE__ */ jsx(Button, { variant: "action", onClick: () => void load(), children: "Try again" })
    ] }) });
  }
  const tokenConfigured = pageState.token.configured;
  const connectionStatus = telegramConnection?.status ?? "needs_config";
  const statusTone = statusDotTone(connectionStatus, tokenConfigured, Boolean(telegramConnection?.enabled));
  const busy = operation !== null;
  return /* @__PURE__ */ jsx("div", { className: "h-full overflow-y-auto", children: /* @__PURE__ */ jsxs(AppPageLayout, { contentClassName: "space-y-6", children: [
    /* @__PURE__ */ jsx(
      AppPageIntro,
      {
        title: "Gateways",
        subtitle: "Connect Neon Pilot to external chats.",
        actions: /* @__PURE__ */ jsx(ToolbarButton, { type: "button", disabled: busy, onClick: () => void load(), children: "Refresh" })
      }
    ),
    error ? /* @__PURE__ */ jsx(Notice, { tone: "danger", children: error }) : null,
    notice ? /* @__PURE__ */ jsx(Notice, { tone: "success", children: notice }) : null,
    /* @__PURE__ */ jsxs("section", { className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "border border-border bg-surface px-5 py-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 space-y-1", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx(StatusDot, { tone: statusTone, size: "sm" }),
                /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-primary", children: telegramProvider?.label ?? "Telegram" })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "max-w-2xl text-sm text-secondary", children: telegramProvider?.description ?? "Run Neon Pilot from Telegram DMs, groups, and topics." })
            ] }),
            /* @__PURE__ */ jsx(ConnectionStatusLabel, { status: connectionStatus, enabled: Boolean(telegramConnection?.enabled) })
          ] }),
          /* @__PURE__ */ jsxs("dl", { className: "mt-5 grid gap-3 text-sm sm:grid-cols-3", children: [
            /* @__PURE__ */ jsx(StatusMetric, { label: "Token", value: tokenConfigured ? "Configured" : "Missing" }),
            /* @__PURE__ */ jsx(StatusMetric, { label: "Connection", value: telegramConnection ? "Created" : "Not created" }),
            /* @__PURE__ */ jsx(StatusMetric, { label: "Runtime", value: telegramConnection?.enabled ? "Enabled" : "Paused" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap gap-2", children: [
            !telegramConnection ? /* @__PURE__ */ jsx(Button, { variant: "action", disabled: busy, onClick: createConnection, children: "Create connection" }) : telegramConnection.enabled ? /* @__PURE__ */ jsx(Button, { variant: "ghost", disabled: busy, onClick: () => setConnectionEnabled(false), children: "Pause gateway" }) : /* @__PURE__ */ jsx(Button, { variant: "action", disabled: busy || !tokenConfigured, onClick: () => setConnectionEnabled(true), children: "Enable gateway" }),
            /* @__PURE__ */ jsx(Button, { variant: "toolbar", disabled: busy || !tokenConfigured, onClick: testToken, children: "Test bot" })
          ] }),
          telegramConnection?.statusMessage ? /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs text-secondary", children: telegramConnection.statusMessage }) : null
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "border border-border bg-surface px-5 py-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-primary", children: "Bot token" }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-secondary", children: "Paste a BotFather token. Neon Pilot stores it in the host secret store." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-col gap-2 sm:flex-row", children: [
            /* @__PURE__ */ jsx(
              TextInput,
              {
                "aria-label": "Telegram bot token",
                autoComplete: "off",
                placeholder: tokenConfigured ? "Token is already saved" : "123456789:AA...",
                type: "password",
                value: tokenDraft,
                onChange: (event) => setTokenDraft(event.target.value)
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsx(Button, { variant: "action", disabled: busy || !tokenDraft.trim(), onClick: saveToken, children: "Save token" }),
              /* @__PURE__ */ jsx(Button, { variant: "ghost", tone: "danger", disabled: busy || !tokenConfigured, onClick: removeToken, children: "Remove" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          AccessEditor,
          {
            access: pageState.access,
            busy,
            newUserId,
            newChatId,
            onNewUserIdChange: setNewUserId,
            onNewChatIdChange: setNewChatId,
            onAddUser: () => {
              const value = newUserId.trim();
              if (!value || pageState.access.approvedUserIds.includes(value)) return;
              setNewUserId("");
              updateAccess(
                { ...pageState.access, approvedUserIds: [...pageState.access.approvedUserIds, value] },
                "Telegram user allowlist updated."
              );
            },
            onAddChat: () => {
              const value = newChatId.trim();
              if (!value || pageState.access.approvedChatIds.includes(value)) return;
              setNewChatId("");
              updateAccess(
                { ...pageState.access, approvedChatIds: [...pageState.access.approvedChatIds, value] },
                "Telegram chat allowlist updated."
              );
            },
            onRemoveUser: (value) => updateAccess(
              { ...pageState.access, approvedUserIds: pageState.access.approvedUserIds.filter((id) => id !== value) },
              "Telegram user allowlist updated."
            ),
            onRemoveChat: (value) => updateAccess(
              { ...pageState.access, approvedChatIds: pageState.access.approvedChatIds.filter((id) => id !== value) },
              "Telegram chat allowlist updated."
            )
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("aside", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "border border-border bg-surface px-5 py-4", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-primary", children: "Provider details" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-3 text-sm", children: [
            /* @__PURE__ */ jsx(DetailRow, { label: "Setup", value: telegramProvider?.setupRoute ?? "/gateways" }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Configuration", value: formatConfigurationLocation(telegramProvider?.configurationLocation) }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Docs", value: telegramProvider?.docsUrl ?? "Telegram Bot API" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "border border-border bg-surface px-5 py-4", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-primary", children: "Recent activity" }),
          telegramEvents.length > 0 ? /* @__PURE__ */ jsx("ol", { className: "mt-4 space-y-3", children: telegramEvents.map((event) => /* @__PURE__ */ jsxs("li", { className: "border-l border-border pl-3", children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm text-primary", children: event.message }),
            /* @__PURE__ */ jsxs("div", { className: "mt-1 text-xs text-secondary", children: [
              formatEventKind(event.kind),
              " \xB7 ",
              formatDate(event.createdAt)
            ] })
          ] }, event.id)) }) : /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-secondary", children: "No Telegram gateway events yet." })
        ] })
      ] })
    ] })
  ] }) });
}
function GatewaysSidebar() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([apiRequest("/api/gateways"), apiRequest("/api/gateways/telegram/token")]).then(([gateway, token]) => {
      if (!cancelled) setState({ gateway, token });
    }).catch((err) => {
      if (!cancelled) setError(errorMessage(err));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const telegram = state?.gateway.connections.find((connection) => connection.provider === TELEGRAM_PROVIDER_ID) ?? null;
  const events = state?.gateway.events.filter((event) => event.provider === TELEGRAM_PROVIDER_ID).slice(0, 3) ?? [];
  return /* @__PURE__ */ jsx("div", { className: "h-full overflow-y-auto px-3 py-4", children: /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h2", { className: "text-sm font-semibold text-primary", children: "Gateways" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-secondary", children: "External chat connections." })
    ] }),
    error ? /* @__PURE__ */ jsx("p", { className: "text-xs text-danger", children: error }) : null,
    !state && !error ? /* @__PURE__ */ jsx("p", { className: "text-xs text-secondary", children: "Loading gateway status..." }) : null,
    state ? /* @__PURE__ */ jsxs("div", { className: "border border-border bg-surface px-3 py-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(
          StatusDot,
          {
            tone: statusDotTone(telegram?.status ?? "needs_config", state.token.configured, Boolean(telegram?.enabled)),
            size: "xs"
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-primary", children: "Telegram" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-secondary", children: state.token.configured ? formatGatewayStatus(telegram?.status ?? "needs_config") : "Token needed" })
    ] }) : null,
    events.length > 0 ? /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h3", { className: "text-xs font-medium uppercase text-secondary", children: "Recent" }),
      /* @__PURE__ */ jsx("ol", { className: "mt-2 space-y-2", children: events.map((event) => /* @__PURE__ */ jsx("li", { className: "text-xs text-secondary", children: event.message }, event.id)) })
    ] }) : null
  ] }) });
}
function AccessEditor({
  access,
  busy,
  newUserId,
  newChatId,
  onNewUserIdChange,
  onNewChatIdChange,
  onAddUser,
  onAddChat,
  onRemoveUser,
  onRemoveChat
}) {
  return /* @__PURE__ */ jsxs("div", { className: "border border-border bg-surface px-5 py-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-primary", children: "Telegram access" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-secondary", children: "Only approved users and chats can send work to Neon Pilot." })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-4 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsx(
        AllowlistEditor,
        {
          title: "Approved users",
          emptyLabel: "No approved users yet.",
          inputLabel: "Telegram user ID",
          placeholder: "1191448898",
          values: access.approvedUserIds,
          value: newUserId,
          busy,
          onValueChange: onNewUserIdChange,
          onAdd: onAddUser,
          onRemove: onRemoveUser
        }
      ),
      /* @__PURE__ */ jsx(
        AllowlistEditor,
        {
          title: "Approved chats",
          emptyLabel: "No approved chats yet.",
          inputLabel: "Telegram chat ID",
          placeholder: "-1001192755030",
          values: access.approvedChatIds,
          value: newChatId,
          busy,
          onValueChange: onNewChatIdChange,
          onAdd: onAddChat,
          onRemove: onRemoveChat
        }
      )
    ] })
  ] });
}
function AllowlistEditor({
  title,
  emptyLabel,
  inputLabel,
  placeholder,
  values,
  value,
  busy,
  onValueChange,
  onAdd,
  onRemove
}) {
  return /* @__PURE__ */ jsxs("div", { className: "min-w-0 space-y-3", children: [
    /* @__PURE__ */ jsx("h3", { className: "text-sm font-medium text-primary", children: title }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsx(
        TextInput,
        {
          "aria-label": inputLabel,
          inputMode: "text",
          placeholder,
          value,
          onChange: (event) => onValueChange(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }
        }
      ),
      /* @__PURE__ */ jsx(ToolbarButton, { type: "button", disabled: busy || !value.trim(), onClick: onAdd, children: "Add" })
    ] }),
    values.length > 0 ? /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: values.map((entry) => /* @__PURE__ */ jsxs("li", { className: "flex min-w-0 items-center justify-between gap-2 border border-border px-3 py-2", children: [
      /* @__PURE__ */ jsx("span", { className: "truncate font-mono text-xs text-primary", children: entry }),
      /* @__PURE__ */ jsx(ToolbarButton, { type: "button", disabled: busy, onClick: () => onRemove(entry), children: "Remove" })
    ] }, entry)) }) : /* @__PURE__ */ jsx("p", { className: "text-sm text-secondary", children: emptyLabel })
  ] });
}
function StatusMetric({ label, value }) {
  return /* @__PURE__ */ jsxs("div", { className: "border border-border px-3 py-2", children: [
    /* @__PURE__ */ jsx("dt", { className: "text-xs text-secondary", children: label }),
    /* @__PURE__ */ jsx("dd", { className: "mt-1 font-medium text-primary", children: value })
  ] });
}
function DetailRow({ label, value }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 justify-between gap-3", children: [
    /* @__PURE__ */ jsx("span", { className: "text-secondary", children: label }),
    /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate text-right text-primary", children: value })
  ] });
}
function ConnectionStatusLabel({ status, enabled }) {
  return /* @__PURE__ */ jsx("div", { className: "border border-border px-3 py-1.5 text-xs font-medium text-secondary", children: enabled ? formatGatewayStatus(status) : "Paused" });
}
async function apiRequest(path, init = {}) {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body === void 0 ? void 0 : { "Content-Type": "application/json" },
    body: init.body === void 0 ? void 0 : JSON.stringify(init.body)
  });
  const payload = await response.json().catch(async () => ({ error: await response.text().catch(() => "") }));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function statusDotTone(status, tokenConfigured, enabled) {
  if (!tokenConfigured || status === "needs_config") return "warning";
  if (status === "needs_attention") return "danger";
  if (!enabled || status === "paused") return "muted";
  return "success";
}
function formatGatewayStatus(status) {
  if (status === "needs_config") return "Needs setup";
  if (status === "needs_attention") return "Needs attention";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
function formatConfigurationLocation(value) {
  if (value === "gateways") return "Gateways page";
  if (value === "settings") return "Settings";
  if (value === "external") return "External setup";
  return "Extension page";
}
function formatEventKind(kind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
export {
  GatewaysPage,
  GatewaysSidebar
};
