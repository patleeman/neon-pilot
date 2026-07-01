import {
  formatComposerActionLabel
} from "./chunks/chunk-TZQXEC6P.js";
import {
  ContextMenu,
  createNativeExtensionClient,
  ensureExtensionFrontendReactGlobals,
  getExtensionRegistryRevision,
  systemExtensionModules,
  useExtensionRegistry
} from "./chunks/chunk-MUBCIET7.js";
import "./chunks/chunk-4YPGCSK5.js";
import "./chunks/chunk-24DU7J3C.js";
import {
  buildApiPath,
  recordActivityTreeRowRender
} from "./chunks/chunk-U66IAJ7L.js";
import "./chunks/chunk-WY4PXDOC.js";
import "./chunks/chunk-RUG6BXWL.js";
import {
  timeAgoCompact
} from "./chunks/chunk-DP4YXAPY.js";
import {
  setExtensionCommandContext
} from "./chunks/chunk-CZB4N5KA.js";
import {
  ComposerActionButton,
  ErrorState,
  IconButton,
  Notice,
  QuietLoadingState,
  Select,
  SettingsRow,
  Spinner,
  StatusDot,
  Switch,
  Textarea,
  ToolbarButton,
  cx
} from "./chunks/chunk-T4PTJAS4.js";
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
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
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
  currentServiceTier,
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
          currentServiceTier,
          savingPreference: null,
          selectModel: () => {
          },
          selectThinkingLevel: () => {
          },
          selectServiceTier: () => {
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
var activeComposerControlId = null;
var activeComposerControlListeners = /* @__PURE__ */ new Set();
function composerRegistrationKey(registration) {
  return `${registration.extensionId}:${registration.id}`;
}
function subscribeActiveComposerControl(listener) {
  activeComposerControlListeners.add(listener);
  return () => activeComposerControlListeners.delete(listener);
}
function readActiveComposerControlId() {
  return activeComposerControlId;
}
function setActiveComposerControlId(id) {
  if (activeComposerControlId === id) return;
  activeComposerControlId = id;
  for (const listener of activeComposerControlListeners) listener();
}
function setComposerFocusedCommandContext(focused) {
  setExtensionCommandContext("composer.focused", focused);
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
function CoreModelPreferenceFallback({ disabled, onInsertCommand }) {
  const insertModelCommand = useCallback(() => {
    if (disabled) return;
    onInsertCommand("/model ");
  }, [disabled, onInsertCommand]);
  useEffect(() => {
    const settingsAvailable = !disabled;
    setExtensionCommandContext("composer.settingsAvailable", settingsAvailable);
    return () => setExtensionCommandContext("composer.settingsAvailable", null);
  }, [disabled]);
  useEffect(() => {
    function handleOpenSettings() {
      insertModelCommand();
    }
    window.addEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettings);
    return () => window.removeEventListener(COMPOSER_OPEN_SETTINGS_COMMAND_EVENT, handleOpenSettings);
  }, [insertModelCommand]);
  return /* @__PURE__ */ jsx(
    ToolbarButton,
    {
      type: "button",
      className: "h-8 min-w-0 px-2 font-mono text-xs text-secondary",
      title: "Use /model, /thinking_level, or /service_tier",
      "aria-label": "Use model preference slash commands",
      disabled,
      onPointerDown: (event) => {
        event.preventDefault();
        if (event.pointerType && event.pointerType !== "mouse" || event.button === 0) insertModelCommand();
      },
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          insertModelCommand();
        }
      },
      children: "/model"
    }
  );
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
  const composerControlId = useId();
  const activeComposerId = useSyncExternalStore(subscribeActiveComposerControl, readActiveComposerControlId, readActiveComposerControlId);
  const composerActive = activeComposerId === composerControlId;
  const activateComposer = useCallback(() => {
    setActiveComposerControlId(composerControlId);
  }, [composerControlId]);
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
    return () => {
      if (activeComposerControlId === composerControlId) {
        setActiveComposerControlId(null);
      }
    };
  }, [composerControlId]);
  useEffect(() => {
    if (activeComposerId === null) {
      setActiveComposerControlId(composerControlId);
    }
  }, [activeComposerId, composerControlId]);
  const syncLocalInputFromHostInsertion = () => {
    const nextInput = textareaRef.current?.value;
    if (typeof nextInput === "string" && nextInput !== localInputRef.current) {
      setLocalInput(nextInput);
    }
  };
  const insertComposerTextFromExtension = (text) => {
    activateComposer();
    onInsertComposerText(text);
    syncLocalInputFromHostInsertion();
  };
  const appendComposerTextFromExtension = (text) => {
    activateComposer();
    onAppendComposerText(text);
    syncLocalInputFromHostInsertion();
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
    composerId: composerControlId,
    composerActive,
    composerDisabled,
    streamIsStreaming,
    composerHasContent,
    openFilePicker: onOpenFilePicker,
    addFiles: onFilesSelected,
    activateComposer,
    insertText: insertComposerTextFromExtension,
    appendText: appendComposerTextFromExtension,
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
        accept: "image/*,video/*,audio/*,.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.yaml,.yml,.xml,.html,.htm,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.log,.excalidraw,application/json,application/pdf",
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
            activateComposer();
            setLocalInput(nextValue);
            requestAnimationFrame(() => onRememberComposerSelection(target));
            onInputChange(nextValue, target);
          },
          onSelect: (event) => {
            activateComposer();
            onRememberComposerSelection(event.currentTarget);
          },
          onClick: (event) => {
            activateComposer();
            onRememberComposerSelection(event.currentTarget);
          },
          onKeyUp: (event) => {
            activateComposer();
            onRememberComposerSelection(event.currentTarget);
          },
          onFocus: (event) => {
            activateComposer();
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
              shouldRenderCoreModelPreferences ? /* @__PURE__ */ jsx(CoreModelPreferenceFallback, { disabled: composerDisabled, onInsertCommand: insertComposerTextFromExtension }) : null,
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
                currentServiceTier,
                onInsertComposerText: insertComposerTextFromExtension,
                onAppendComposerText: appendComposerTextFromExtension,
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
  () => import("./chunks/ConversationArtifactModal-P533AAXM.js").then((module) => ({ default: module.ConversationArtifactModal }))
);
var ConversationDrawingsPickerModal = lazy(
  () => import("./chunks/ConversationDrawingsPickerModal-5H7TEJQ4.js").then((module) => ({ default: module.ConversationDrawingsPickerModal }))
);
var loadChatView = () => import("./chunks/ChatView-GRWMZN4N.js").then((module) => ({ default: module.ChatView }));
var ChatView = lazy(loadChatView);
var ConversationActivityShelf = lazy(
  () => import("./chunks/ConversationActivityShelf-3MRZPRJS.js").then((module) => ({ default: module.ConversationActivityShelf }))
);
var ConversationContextShelf = lazy(
  () => import("./chunks/ConversationContextShelf-P5CFYY3I.js").then((module) => ({ default: module.ConversationContextShelf }))
);
var ConversationQuestionShelf = lazy(
  () => import("./chunks/ConversationQuestionShelf-YUDQWKLX.js").then((module) => ({ default: module.ConversationQuestionShelf }))
);
var ConversationQueueShelf = lazy(
  () => import("./chunks/ConversationQueueShelf-6XP5IICH.js").then((module) => ({ default: module.ConversationQueueShelf }))
);
var ConversationSavedHeader = lazy(
  () => import("./chunks/ConversationSavedHeader-63CYOAMH.js").then((module) => ({ default: module.ConversationSavedHeader }))
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

// extensions/system-alerts/src/frontend.tsx
init_neon_pilot_shared_react();
var SOUND_OPTIONS = [
  { id: "ping", label: "Ping" },
  { id: "glass", label: "Glass" },
  { id: "pop", label: "Pop" },
  { id: "submarine", label: "Submarine" }
];
function statusText(settings, systemNotificationsAvailable) {
  if (!settings.enabled) return "Paused";
  const channels = [
    settings.nativeNotifications ? systemNotificationsAvailable ? "macOS notifications" : "macOS notifications unavailable" : null,
    settings.soundEnabled ? "sound" : null
  ].filter(Boolean);
  return channels.length > 0 ? channels.join(" and ") : "No delivery channel selected";
}
function AlertsSettingsPanel({ pa }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const load = useCallback(async () => {
    const next = await pa.extension.invoke("readSettings");
    setState(next);
  }, [pa]);
  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [load]);
  async function save(update) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await pa.extension.invoke("updateSettings", update);
      setState(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  async function testAlert() {
    setBusy(true);
    setMessage(null);
    try {
      await pa.extension.invoke("sendTestAlert");
      setMessage("Test alert sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  if (!state) {
    return /* @__PURE__ */ jsx(QuietLoadingState, { label: "Loading alert settings", className: "min-h-12" });
  }
  const settings = state.settings;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    !state.systemNotificationsAvailable && settings.nativeNotifications ? /* @__PURE__ */ jsx(Notice, { tone: "warning", children: "macOS notifications are not available until the desktop app notification bridge is ready." }) : null,
    /* @__PURE__ */ jsx(SettingsRow, { title: "Attention alerts", description: statusText(settings, state.systemNotificationsAvailable), children: /* @__PURE__ */ jsx(
      Switch,
      {
        checked: settings.enabled,
        disabled: busy,
        "aria-label": settings.enabled ? "Disable attention alerts" : "Enable attention alerts",
        label: settings.enabled ? "On" : "Off",
        onClick: () => void save({ enabled: !settings.enabled })
      }
    ) }),
    /* @__PURE__ */ jsx(SettingsRow, { title: "Native notification", description: "Show a macOS notification when an active alert is raised.", children: /* @__PURE__ */ jsx(
      Switch,
      {
        checked: settings.nativeNotifications,
        disabled: busy || !settings.enabled,
        "aria-label": settings.nativeNotifications ? "Disable native notifications" : "Enable native notifications",
        label: settings.nativeNotifications ? "On" : "Off",
        onClick: () => void save({ nativeNotifications: !settings.nativeNotifications })
      }
    ) }),
    /* @__PURE__ */ jsx(SettingsRow, { title: "Sound", description: "Play a short macOS system sound with each delivered alert.", children: /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [
      /* @__PURE__ */ jsx(
        Select,
        {
          "aria-label": "Alert sound",
          value: settings.sound,
          disabled: busy || !settings.enabled || !settings.soundEnabled,
          onChange: (event) => void save({ sound: event.target.value }),
          children: SOUND_OPTIONS.map((option) => /* @__PURE__ */ jsx("option", { value: option.id, children: option.label }, option.id))
        }
      ),
      /* @__PURE__ */ jsx(
        Switch,
        {
          checked: settings.soundEnabled,
          disabled: busy || !settings.enabled,
          "aria-label": settings.soundEnabled ? "Disable alert sound" : "Enable alert sound",
          label: settings.soundEnabled ? "On" : "Off",
          onClick: () => void save({ soundEnabled: !settings.soundEnabled })
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(SettingsRow, { title: "Notify for", description: "Choose whether passive alerts should also use native delivery.", children: /* @__PURE__ */ jsxs(
      Select,
      {
        "aria-label": "Alert severity",
        value: settings.severity,
        disabled: busy || !settings.enabled,
        onChange: (event) => void save({ severity: event.target.value }),
        children: [
          /* @__PURE__ */ jsx("option", { value: "disruptive", children: "Disruptive alerts" }),
          /* @__PURE__ */ jsx("option", { value: "all", children: "All active alerts" })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(SettingsRow, { title: "Test alert", description: message ?? "Send a notification and play the selected sound.", children: /* @__PURE__ */ jsx(ToolbarButton, { type: "button", disabled: busy, onClick: () => void testAlert(), children: busy ? "Working..." : "Send test" }) })
  ] });
}
export {
  AlertsSettingsPanel
};
