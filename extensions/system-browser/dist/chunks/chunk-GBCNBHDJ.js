import {
  createPortal
} from "./chunk-P4G4CXIQ.js";
import {
  forwardRef,
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  useEffect,
  useRef
} from "./chunk-TTFLGCWD.js";

// packages/ui/src/primitives.tsx
init_neon_pilot_shared_react();
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
var PILL_TONE_CLASSES = {
  muted: "ui-pill-muted",
  accent: "ui-pill-accent",
  success: "ui-pill-success",
  warning: "ui-pill-warning",
  danger: "ui-pill-danger",
  steel: "ui-pill-steel",
  teal: "ui-pill-teal",
  solidAccent: "ui-pill-solid-accent"
};
function pillToneClass(tone) {
  return PILL_TONE_CLASSES[tone];
}
function buttonToneClass(tone) {
  if (tone === "accent") return "text-accent";
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  if (tone === "success") return "text-success";
  return null;
}
var Button = forwardRef(function Button2({ className, children, type = "button", variant = "toolbar", tone = "default", ...props }, ref) {
  const baseClass = variant === "action" ? "ui-action-button" : variant === "ghost" ? "ui-ghost-button" : "ui-toolbar-button";
  return /* @__PURE__ */ jsx("button", { ref, type, className: cx(baseClass, buttonToneClass(tone), className), ...props, children });
});
var ButtonLink = forwardRef(function ButtonLink2({ className, children, variant = "toolbar", tone = "default", ...props }, ref) {
  const baseClass = variant === "action" ? "ui-action-button" : variant === "ghost" ? "ui-ghost-button" : "ui-toolbar-button";
  return /* @__PURE__ */ jsx("a", { ref, className: cx(baseClass, buttonToneClass(tone), className), ...props, children });
});
var TextLink = forwardRef(function TextLink2({ className, children, tone = "accent", ...props }, ref) {
  return /* @__PURE__ */ jsx("a", { ref, className: cx("ui-text-link", buttonToneClass(tone), className), ...props, children });
});
var ToolbarButton = forwardRef(function ToolbarButton2({ className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-toolbar-button", className), ...props, children });
});
var EditorToolbarButton = forwardRef(function EditorToolbarButton2({
  active = false,
  children,
  className,
  icon = false,
  onMouseDown,
  onPress,
  preventMouseDownDefault = true,
  statusTone,
  type = "button",
  ...props
}, ref) {
  const handleMouseDown = (event) => {
    if (preventMouseDownDefault) event.preventDefault();
    onMouseDown?.(event);
    if (!event.defaultPrevented || preventMouseDownDefault) onPress?.();
  };
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      type,
      className: cx(
        "ui-editor-toolbar-button",
        icon && "ui-editor-toolbar-button-icon",
        active && "ui-editor-toolbar-button-active",
        statusTone && `ui-editor-toolbar-button-${statusTone}`,
        className
      ),
      "aria-pressed": active || void 0,
      onMouseDown: handleMouseDown,
      ...props,
      children
    }
  );
});
var TextButton = forwardRef(
  function TextButton2({ className, children, type = "button", tone = "default", ...props }, ref) {
    return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-text-button", buttonToneClass(tone), className), ...props, children });
  }
);
var TitleButton = forwardRef(function TitleButton2({ className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-title-button", className), ...props, children });
});
var SidebarNavButton = forwardRef(function SidebarNavButton2({ active = false, className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      type,
      "aria-current": props["aria-current"] ?? (active ? "page" : void 0),
      className: cx("ui-sidebar-nav-item", active && "ui-sidebar-nav-item-active", className),
      ...props,
      children
    }
  );
});
var SidebarRow = forwardRef(function SidebarRow2({ title, meta, leading, trailing, selected = false, className, titleClassName, metaClassName, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      ref,
      type,
      "aria-current": props["aria-current"] ?? (selected ? "page" : void 0),
      className: cx("ui-sidebar-row", selected && "ui-sidebar-row-selected", className),
      ...props,
      children: [
        leading ? /* @__PURE__ */ jsx("span", { className: "ui-sidebar-row-leading", children: leading }) : null,
        /* @__PURE__ */ jsxs("span", { className: "ui-sidebar-row-main", children: [
          /* @__PURE__ */ jsx("span", { className: cx("ui-sidebar-row-title", titleClassName), children: title }),
          meta ? /* @__PURE__ */ jsx("span", { className: cx("ui-sidebar-row-meta", metaClassName), children: meta }) : null
        ] }),
        trailing ? /* @__PURE__ */ jsx("span", { className: "ui-sidebar-row-trailing", children: trailing }) : null
      ]
    }
  );
});
var TreeItemButton = forwardRef(function TreeItemButton2({ selected = false, expanded, className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      type,
      role: props.role ?? "treeitem",
      "aria-selected": props["aria-selected"] ?? (selected ? "true" : "false"),
      "aria-expanded": props["aria-expanded"] ?? expanded,
      className: cx("ui-tree-item-button", className),
      ...props,
      children
    }
  );
});
var MessageActionButton = forwardRef(
  function MessageActionButton2({ className, children, type = "button", tone = "default", ...props }, ref) {
    return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-message-action-button", buttonToneClass(tone), className), ...props, children });
  }
);
var MediaPreviewButton = forwardRef(function MediaPreviewButton2({ className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-media-preview-button", className), ...props, children });
});
function composerActionButtonToneClass(tone) {
  if (tone === "accent") return "ui-composer-action-button-accent";
  if (tone === "warning") return "ui-composer-action-button-warning";
  if (tone === "danger") return "ui-composer-action-button-danger";
  if (tone === "disabled") return "ui-composer-action-button-disabled";
  return "ui-composer-action-button-neutral";
}
function composerActionButtonSizeClass(size) {
  if (size === "label") return "ui-composer-action-button-label";
  if (size === "compactLabel") return "ui-composer-action-button-compact-label";
  return "ui-composer-action-button-icon";
}
var ComposerActionButton = forwardRef(function ComposerActionButton2({ className, children, type = "button", tone = "neutral", size = "icon", ...props }, ref) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      type,
      className: cx("ui-composer-action-button", composerActionButtonToneClass(tone), composerActionButtonSizeClass(size), className),
      ...props,
      children
    }
  );
});
function MessageCard({
  role = "assistant",
  children,
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx("div", { className: cx(role === "user" ? "ui-message-card-user" : "ui-message-card-assistant", className), ...props, children });
}
function MessageMeta({ children, className, ...props }) {
  return /* @__PURE__ */ jsx("p", { className: cx("ui-message-meta", className), ...props, children });
}
var IconButton = forwardRef(function IconButton2({ className, children, compact = false, shape = "square", size = "md", type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      type,
      className: cx(
        "ui-icon-button",
        compact && "ui-icon-button-compact",
        size === "sm" && "ui-icon-button-sm",
        shape === "circle" && "ui-icon-button-circle",
        className
      ),
      ...props,
      children
    }
  );
});
var IconLink = forwardRef(function IconLink2({ className, children, compact = false, ...props }, ref) {
  return /* @__PURE__ */ jsx("a", { ref, className: cx("ui-icon-button", compact && "ui-icon-button-compact", className), ...props, children });
});
var CheckButton = forwardRef(
  function CheckButton2({ checked, className, children = "\u2713", type = "button", ...props }, ref) {
    return /* @__PURE__ */ jsx(
      "button",
      {
        ref,
        type,
        "aria-pressed": checked,
        className: cx("ui-check-button", checked && "ui-check-button-checked", className),
        ...props,
        children
      }
    );
  }
);
function Pill({
  tone = "muted",
  mono = false,
  children,
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx("span", { className: cx("ui-pill", pillToneClass(tone), mono && "font-mono", className), ...props, children });
}
var STATUS_DOT_TONE_CLASSES = {
  muted: "ui-status-dot-muted",
  accent: "ui-status-dot-accent",
  success: "ui-status-dot-success",
  warning: "ui-status-dot-warning",
  danger: "ui-status-dot-danger",
  steel: "ui-status-dot-steel",
  current: "ui-status-dot-current"
};
function StatusDot({
  tone = "muted",
  size = "sm",
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      "aria-hidden": "true",
      className: cx("ui-status-dot", `ui-status-dot-${size}`, STATUS_DOT_TONE_CLASSES[tone], className),
      ...props
    }
  );
}
function Spinner({
  size = "sm",
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx("span", { "aria-hidden": "true", className: cx("ui-spinner", `ui-spinner-${size}`, className), ...props });
}
function Tooltip({
  children,
  className,
  position = "top-right",
  mono = false,
  ...props
}) {
  return /* @__PURE__ */ jsx("span", { className: cx("ui-tooltip", `ui-tooltip-${position}`, mono && "font-mono", className), ...props, children });
}
var TerminalBlock = forwardRef(function TerminalBlock2({ children, compact = false, className }, ref) {
  return /* @__PURE__ */ jsx(
    "pre",
    {
      ref,
      className: cx(
        "overflow-auto whitespace-pre-wrap rounded-lg border border-border-subtle/80 bg-surface/55 p-4 text-xs leading-relaxed text-secondary",
        compact ? "min-h-28" : "min-h-44",
        className
      ),
      children
    }
  );
});
function SectionLabel({
  children,
  className,
  tone = "default",
  ...props
}) {
  return /* @__PURE__ */ jsx("span", { className: cx("ui-section-label", `ui-section-label-${tone}`, className), ...props, children });
}
function MetaLabel({ children, className, tone = "muted", ...props }) {
  return /* @__PURE__ */ jsx("span", { className: cx("ui-meta-label", `ui-meta-label-${tone}`, className), ...props, children });
}
function InlineMeta({ children, className, ...props }) {
  return /* @__PURE__ */ jsx("span", { className: cx("ui-inline-meta", className), ...props, children });
}
function CardTitle({ as: Component = "p", children, className, ...props }) {
  return /* @__PURE__ */ jsx(Component, { className: cx("ui-card-title", className), ...props, children });
}
function CardBody({ as: Component = "p", children, className, ...props }) {
  return /* @__PURE__ */ jsx(Component, { className: cx("ui-card-body", className), ...props, children });
}
function CardMeta({ as: Component = "p", children, className, ...props }) {
  return /* @__PURE__ */ jsx(Component, { className: cx("ui-card-meta", className), ...props, children });
}
function ToolResultCard({
  leading,
  title,
  badges,
  meta,
  body,
  actions,
  children,
  tone = "neutral",
  className,
  headerClassName,
  bodyClassName,
  actionsClassName
}) {
  return /* @__PURE__ */ jsx(SurfacePanel, { muted: true, className: cx("ui-tool-result-card", `ui-tool-result-card-${tone}`, className), children: /* @__PURE__ */ jsxs("div", { className: "ui-tool-result-card-layout", children: [
    leading ? /* @__PURE__ */ jsx("div", { className: "ui-tool-result-card-leading", children: leading }) : null,
    /* @__PURE__ */ jsxs("div", { className: "ui-tool-result-card-main", children: [
      /* @__PURE__ */ jsxs("div", { className: cx("ui-tool-result-card-header", headerClassName), children: [
        /* @__PURE__ */ jsx(CardTitle, { as: "span", className: "min-w-0 truncate", children: title }),
        badges
      ] }),
      meta ? /* @__PURE__ */ jsx(CardMeta, { className: "ui-tool-result-card-meta", children: meta }) : null,
      body ? /* @__PURE__ */ jsx(CardBody, { className: cx("ui-tool-result-card-body", bodyClassName), children: body }) : null,
      children,
      actions ? /* @__PURE__ */ jsx("div", { className: cx("ui-tool-result-card-actions", actionsClassName), children: actions }) : null
    ] })
  ] }) });
}
var ActionTile = forwardRef(function ActionTile2({ className, icon, label, description, meta, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsxs("button", { ref, type, className: cx("ui-action-tile", className), ...props, children: [
    icon ? /* @__PURE__ */ jsx("span", { className: "ui-action-tile-icon", "aria-hidden": "true", children: icon }) : null,
    /* @__PURE__ */ jsxs("span", { className: "ui-action-tile-main", children: [
      /* @__PURE__ */ jsx("span", { className: "ui-action-tile-label", children: label }),
      description ? /* @__PURE__ */ jsx("span", { className: "ui-action-tile-description", children: description }) : null,
      children
    ] }),
    meta ? /* @__PURE__ */ jsx("span", { className: "ui-action-tile-meta", children: meta }) : null
  ] });
});
function FilterToolbar({
  filters,
  search,
  actions,
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxs("div", { className: cx("ui-filter-toolbar", className), ...props, children: [
    filters ? /* @__PURE__ */ jsx("div", { className: "ui-filter-toolbar-filters", children: filters }) : null,
    search ? /* @__PURE__ */ jsx("div", { className: "ui-filter-toolbar-search", children: search }) : null,
    actions ? /* @__PURE__ */ jsx("div", { className: "ui-filter-toolbar-actions", children: actions }) : null
  ] });
}
function ResourcePickerDialog({
  title,
  description,
  actions,
  children,
  footer,
  onClose,
  className,
  bodyClassName,
  backdropStyle,
  style,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    Dialog,
    {
      "aria-label": typeof title === "string" ? title : void 0,
      onClose,
      className,
      backdropStyle,
      style: {
        width: "min(840px, calc(100vw - 2rem))",
        maxHeight: "calc(100vh - 5rem)",
        ...style
      },
      ...props,
      children: [
        /* @__PURE__ */ jsx(DialogHeader, { title, description, actions }),
        /* @__PURE__ */ jsx(DialogBody, { className: cx("ui-resource-picker-body", bodyClassName), children }),
        footer ? /* @__PURE__ */ jsx("div", { className: "ui-resource-picker-footer", children: footer }) : null
      ]
    }
  );
}
function ResourcePickerToolbar({
  filters,
  search,
  actions,
  className
}) {
  return /* @__PURE__ */ jsx("div", { className: cx("ui-resource-picker-toolbar", className), children: /* @__PURE__ */ jsx(FilterToolbar, { filters, search, actions }) });
}
function ResourcePickerList({
  children,
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx("div", { className: cx("ui-resource-picker-list", className), ...props, children });
}
function ResourceListItem({
  label,
  meta,
  detail,
  leading,
  selected = false,
  className,
  children,
  type = "button",
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type,
      className: cx(
        "ui-resource-list-item",
        leading != null && "ui-resource-list-item-with-leading",
        selected && "ui-resource-list-item-selected",
        className
      ),
      ...props,
      children: [
        leading ? /* @__PURE__ */ jsx("span", { className: "ui-resource-list-item-leading", "aria-hidden": "true", children: leading }) : null,
        /* @__PURE__ */ jsxs("span", { className: "ui-resource-list-item-main", children: [
          /* @__PURE__ */ jsx("span", { className: "ui-resource-list-item-title", children: label }),
          meta ? /* @__PURE__ */ jsx("span", { className: "ui-resource-list-item-meta", children: meta }) : null,
          detail ? /* @__PURE__ */ jsx("span", { className: "ui-resource-list-item-detail", children: detail }) : null,
          children ? /* @__PURE__ */ jsx("div", { className: "ui-resource-list-item-extra", children }) : null
        ] })
      ]
    }
  );
}
var RowButton = forwardRef(function RowButton2({ className, children, selected = false, compact = false, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      type,
      className: cx("ui-row-button", compact && "ui-row-button-compact", selected && "ui-row-button-selected", className),
      ...props,
      children
    }
  );
});
var WorkbenchTab = forwardRef(function WorkbenchTab2({ active = false, className, children, ...props }, ref) {
  return /* @__PURE__ */ jsx("div", { ref, className: cx("ui-workbench-tab", active && "ui-workbench-tab-active", className), ...props, children });
});
var WorkbenchTabButton = forwardRef(function WorkbenchTabButton2({ className, icon, label, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsxs("button", { ref, type, className: cx("ui-workbench-tab-button", className), ...props, children: [
    icon ? /* @__PURE__ */ jsx("span", { className: "ui-workbench-tab-icon", "aria-hidden": "true", children: icon }) : null,
    /* @__PURE__ */ jsx("span", { className: "ui-workbench-tab-label", children: label })
  ] });
});
var WorkbenchTabCloseButton = forwardRef(
  function WorkbenchTabCloseButton2({ className, children = "\xD7", type = "button", ...props }, ref) {
    return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-workbench-tab-close-button", className), ...props, children });
  }
);
var WorkbenchTabActionButton = forwardRef(
  function WorkbenchTabActionButton2({ className, children, type = "button", ...props }, ref) {
    return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-workbench-tab-action-button", className), ...props, children });
  }
);
var SwatchOption = forwardRef(function SwatchOption2({ checked = false, className, label, swatch, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      ref,
      type,
      role: props.role ?? "radio",
      "aria-checked": props["aria-checked"] ?? checked,
      className: cx("ui-swatch-option", checked && "ui-swatch-option-checked", className),
      ...props,
      children: [
        /* @__PURE__ */ jsx("span", { className: "ui-swatch-option-swatch", "aria-hidden": "true", children: swatch }),
        /* @__PURE__ */ jsx("span", { className: "ui-swatch-option-label", children: label })
      ]
    }
  );
});
var ChoiceRow = forwardRef(function ChoiceRow2({ checked = false, prefix, indicator, label, details, className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsxs("button", { ref, type, className: cx("ui-choice-row", checked && "ui-choice-row-checked", className), ...props, children: [
    prefix != null ? /* @__PURE__ */ jsx("span", { className: "ui-choice-row-prefix", "aria-hidden": "true", children: prefix }) : null,
    indicator != null ? /* @__PURE__ */ jsx("span", { className: cx("ui-choice-row-indicator", checked && "ui-choice-row-indicator-checked"), "aria-hidden": "true", children: indicator }) : null,
    /* @__PURE__ */ jsxs("span", { className: "ui-choice-row-main", children: [
      /* @__PURE__ */ jsx("span", { className: "ui-choice-row-label", children: label }),
      details ? /* @__PURE__ */ jsx("span", { className: "ui-choice-row-details", children: details }) : null,
      children
    ] })
  ] });
});
var AttachmentChipButton = forwardRef(function AttachmentChipButton2({ className, children, type = "button", ...props }, ref) {
  return /* @__PURE__ */ jsx("button", { ref, type, className: cx("ui-attachment-chip-button", className), ...props, children });
});
function CodeBlock({
  children,
  className,
  compact = false,
  wrap = true,
  ...props
}) {
  return /* @__PURE__ */ jsx("pre", { className: cx("ui-code-block", compact && "ui-code-block-compact", wrap && "ui-code-block-wrap", className), ...props, children });
}
function InlineCode({ children, className, wrap = true, ...props }) {
  return /* @__PURE__ */ jsx("code", { className: cx("ui-inline-code", wrap && "ui-inline-code-wrap", className), ...props, children });
}
function InlineCodeButton({
  children,
  className,
  type = "button",
  wrap = true,
  ...props
}) {
  return /* @__PURE__ */ jsx("button", { type, className: cx("ui-inline-code-button", wrap && "ui-inline-code-wrap", className), ...props, children });
}
function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  bodyClassName,
  ...props
}) {
  return /* @__PURE__ */ jsxs("details", { className: cx("ui-disclosure", className), ...props, children: [
    /* @__PURE__ */ jsx("summary", { className: cx("ui-disclosure-summary", summaryClassName), children: summary }),
    /* @__PURE__ */ jsx("div", { className: cx("ui-disclosure-body", bodyClassName), children })
  ] });
}
function SurfacePanel({ className, muted = false, children, ...props }) {
  return /* @__PURE__ */ jsx("div", { className: cx(muted ? "ui-panel-muted" : "ui-panel", className), ...props, children });
}
function RailSection({
  title,
  actions,
  children,
  className,
  bodyClassName,
  headerClassName,
  ...props
}) {
  return /* @__PURE__ */ jsxs("section", { className: cx("ui-rail-section", className), ...props, children: [
    /* @__PURE__ */ jsxs("div", { className: cx("ui-rail-section-header", headerClassName), children: [
      /* @__PURE__ */ jsx(SectionLabel, { children: title }),
      actions ? /* @__PURE__ */ jsx("div", { className: "ui-rail-section-actions", children: actions }) : null
    ] }),
    /* @__PURE__ */ jsx("div", { className: cx("ui-rail-section-body", bodyClassName), children })
  ] });
}
function ShelfSection({
  header,
  children,
  className,
  bodyClassName,
  ...props
}) {
  return /* @__PURE__ */ jsxs("section", { className: cx("ui-shelf-section", className), ...props, children: [
    header,
    children ? /* @__PURE__ */ jsx("div", { className: cx("ui-shelf-section-body", bodyClassName), children }) : null
  ] });
}
function ShelfStatusRow({
  label,
  children,
  leading,
  status,
  actions,
  className,
  labelTone = "accent",
  ...props
}) {
  return /* @__PURE__ */ jsxs("div", { className: cx("ui-shelf-status-row", Boolean(leading) && "ui-shelf-status-row-with-leading", className), ...props, children: [
    leading ? /* @__PURE__ */ jsx("span", { className: "ui-shelf-status-row-leading", children: leading }) : null,
    /* @__PURE__ */ jsx(MetaLabel, { tone: labelTone, className: "ui-shelf-status-row-label", children: label }),
    /* @__PURE__ */ jsx("div", { className: "ui-shelf-status-row-content", children }),
    status ? /* @__PURE__ */ jsx("div", { className: "ui-shelf-status-row-status", children: status }) : null,
    actions ? /* @__PURE__ */ jsx("div", { className: "ui-shelf-status-row-actions", children: actions }) : null
  ] });
}
function ShelfHeader({
  title,
  detail,
  leading,
  actions,
  className,
  titleClassName,
  detailClassName,
  ...props
}) {
  return /* @__PURE__ */ jsxs("div", { className: cx("ui-shelf-header", className), ...props, children: [
    /* @__PURE__ */ jsxs("div", { className: "ui-shelf-header-main", children: [
      leading ? /* @__PURE__ */ jsx("span", { className: "ui-shelf-header-leading", children: leading }) : null,
      /* @__PURE__ */ jsx("span", { className: cx("ui-shelf-header-title", titleClassName), children: title }),
      detail ? /* @__PURE__ */ jsx("span", { className: cx("ui-shelf-header-detail", detailClassName), children: detail }) : null
    ] }),
    actions ? /* @__PURE__ */ jsx("div", { className: "ui-shelf-header-actions", children: actions }) : null
  ] });
}
var DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
function getDialogFocusable(root) {
  return Array.from(root.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}
function Dialog({
  children,
  className,
  backdropClassName,
  backdropStyle,
  onClose,
  closeOnBackdrop = true,
  labelledBy,
  portal = false,
  onKeyDown,
  tabIndex,
  ...props
}) {
  const shellRef = useRef(null);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && shell.contains(active)) return;
    const preferred = shell.querySelector("[autofocus], [data-autofocus]");
    const target2 = preferred ?? getDialogFocusable(shell)[0] ?? shell;
    target2.focus({ preventScroll: true });
  }, []);
  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== "Tab") return;
    const shell = shellRef.current;
    if (!shell) return;
    const focusable = getDialogFocusable(shell);
    if (focusable.length === 0) {
      event.preventDefault();
      shell.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  const dialog = /* @__PURE__ */ jsx(
    "div",
    {
      className: cx("ui-overlay-backdrop", backdropClassName),
      style: backdropStyle,
      onClick: (event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      },
      children: /* @__PURE__ */ jsx(
        "div",
        {
          ref: shellRef,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": labelledBy,
          tabIndex: tabIndex ?? -1,
          className: cx("ui-dialog-shell", className),
          onKeyDown: handleKeyDown,
          onClick: (event) => event.stopPropagation(),
          ...props,
          children
        }
      )
    }
  );
  if (!portal || typeof document === "undefined") {
    return dialog;
  }
  const target = portal === true ? document.body : portal;
  return target ? createPortal(dialog, target) : dialog;
}
function DialogHeader({
  title,
  description,
  actions,
  titleId,
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cx("ui-dialog-header", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "ui-dialog-header-copy", children: [
      /* @__PURE__ */ jsx("h2", { id: titleId, className: "ui-dialog-title", children: title }),
      description ? /* @__PURE__ */ jsx("p", { className: "ui-dialog-description", children: description }) : null
    ] }),
    actions ? /* @__PURE__ */ jsx("div", { className: "ui-dialog-actions", children: actions }) : null
  ] });
}
function DialogBody({ children, className, ...props }) {
  return /* @__PURE__ */ jsx("div", { className: cx("ui-dialog-body", className), ...props, children });
}
var MenuShell = forwardRef(
  function MenuShell2({ children, className, role = "menu", ...props }, ref) {
    return /* @__PURE__ */ jsx("div", { ref, className: cx("ui-menu-shell ui-context-menu-shell", className), role, ...props, children });
  }
);
var PositionedMenu = forwardRef(function PositionedMenu2({ children, className, placement = "fixed", position, style, role = "menu", ...props }, ref) {
  return /* @__PURE__ */ jsx(
    MenuShell,
    {
      ref,
      role,
      className: cx("ui-positioned-menu", `ui-positioned-menu-${placement}`, className),
      style: { ...position, ...style },
      ...props,
      children
    }
  );
});
function MenuGroupLabel({ children, className, ...props }) {
  return /* @__PURE__ */ jsx("div", { className: cx("ui-menu-group-label", className), ...props, children });
}
function MenuSeparator({ className, ...props }) {
  return /* @__PURE__ */ jsx("div", { className: cx("ui-menu-separator", className), role: "separator", ...props });
}
function MenuItem({
  children,
  className,
  tone = "default",
  checked,
  closeOnPointerDown = true,
  type = "button",
  role,
  onPointerDown,
  onMouseDown,
  ...props
}) {
  function stopPointerEvent(event) {
    if (!closeOnPointerDown) return;
    event.preventDefault();
    event.stopPropagation();
  }
  const itemRole = role ?? (typeof checked === "boolean" ? "menuitemradio" : "menuitem");
  return /* @__PURE__ */ jsx(
    "button",
    {
      type,
      role: itemRole,
      "aria-checked": typeof checked === "boolean" ? checked : void 0,
      className: cx("ui-context-menu-item", tone === "danger" && "ui-context-menu-item-danger", className),
      onPointerDown: (event) => {
        stopPointerEvent(event);
        onPointerDown?.(event);
      },
      onMouseDown: (event) => {
        stopPointerEvent(event);
        onMouseDown?.(event);
      },
      ...props,
      children
    }
  );
}
function TabButton({
  active = false,
  children,
  className,
  type = "button",
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type,
      role: "tab",
      "aria-selected": active,
      className: cx("ui-tab-button", active && "ui-tab-button-active", className),
      ...props,
      children
    }
  );
}
function LoadingState({ label, className }) {
  return /* @__PURE__ */ jsx("div", { className: cx("ui-loading-state", className), role: "status", "aria-live": "polite", children: /* @__PURE__ */ jsx("span", { children: label }) });
}
function PanelMessage({
  children,
  tone = "muted",
  align = "left",
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cx("ui-panel-message", `ui-panel-message-${tone}`, align === "center" && "ui-panel-message-center", className),
      ...props,
      children
    }
  );
}
function ErrorState({
  title,
  message,
  body,
  className
}) {
  const resolvedBody = body ?? message;
  return /* @__PURE__ */ jsxs("div", { className: cx("ui-error-state", className), role: "alert", children: [
    title ? /* @__PURE__ */ jsx("div", { className: "ui-error-title", children: title }) : null,
    resolvedBody ? /* @__PURE__ */ jsx("div", { className: "ui-error-body", children: resolvedBody }) : null
  ] });
}
function noticeToneClass(tone) {
  if (tone === "danger") return "ui-notice-danger";
  if (tone === "success") return "ui-notice-success";
  if (tone === "warning") return "ui-notice-warning";
  return "ui-notice-info";
}
function Notice({
  tone = "info",
  title,
  children,
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxs("div", { className: cx("ui-notice", noticeToneClass(tone), className), role: tone === "danger" ? "alert" : "status", ...props, children: [
    title ? /* @__PURE__ */ jsx("div", { className: "ui-notice-title", children: title }) : null,
    children ? /* @__PURE__ */ jsx("div", { className: "ui-notice-body", children }) : null
  ] });
}
var TextInput = forwardRef(function TextInput2({ className, ...props }, ref) {
  return /* @__PURE__ */ jsx("input", { ref, className: cx("ui-text-input", className), ...props });
});
var SearchInput = forwardRef(function SearchInput2({ className, type = "search", ...props }, ref) {
  return /* @__PURE__ */ jsx("input", { ref, type, className: cx("ui-search-input", className), ...props });
});
var Textarea = forwardRef(function Textarea2({ className, ...props }, ref) {
  return /* @__PURE__ */ jsx("textarea", { ref, className: cx("ui-textarea", className), ...props });
});
var Select = forwardRef(function Select2({ className, children, ...props }, ref) {
  return /* @__PURE__ */ jsx("select", { ref, className: cx("ui-select", className), ...props, children });
});
var InlineTextInput = forwardRef(function InlineTextInput2({ className, ...props }, ref) {
  return /* @__PURE__ */ jsx("input", { ref, className: cx("ui-inline-input", className), ...props });
});
var InlineSelect = forwardRef(function InlineSelect2({ className, children, ...props }, ref) {
  return /* @__PURE__ */ jsxs("label", { className: "ui-inline-select-shell", children: [
    /* @__PURE__ */ jsx("select", { ref, className: cx("ui-inline-select", className), ...props, children }),
    /* @__PURE__ */ jsx(
      "svg",
      {
        "aria-hidden": "true",
        width: "11",
        height: "11",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.8",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className: "ui-inline-select-icon",
        children: /* @__PURE__ */ jsx("path", { d: "m6 9 6 6 6-6" })
      }
    )
  ] });
});
var Checkbox = forwardRef(function Checkbox2({ className, type = "checkbox", ...props }, ref) {
  return /* @__PURE__ */ jsx("input", { ref, type, className: cx("ui-checkbox", className), ...props });
});

export {
  cx,
  Button,
  ToolbarButton,
  TextButton,
  TitleButton,
  MessageActionButton,
  MediaPreviewButton,
  ComposerActionButton,
  MessageCard,
  MessageMeta,
  IconButton,
  Pill,
  StatusDot,
  Spinner,
  Tooltip,
  SectionLabel,
  MetaLabel,
  InlineMeta,
  CardTitle,
  CardMeta,
  ToolResultCard,
  ResourcePickerDialog,
  ResourcePickerToolbar,
  ResourcePickerList,
  ResourceListItem,
  RowButton,
  ChoiceRow,
  CodeBlock,
  InlineCode,
  InlineCodeButton,
  Disclosure,
  SurfacePanel,
  RailSection,
  ShelfSection,
  ShelfStatusRow,
  ShelfHeader,
  MenuShell,
  MenuGroupLabel,
  MenuSeparator,
  MenuItem,
  TabButton,
  LoadingState,
  PanelMessage,
  ErrorState,
  Notice,
  TextInput,
  SearchInput,
  Textarea,
  Checkbox
};
