import {
  getConversationArtifactIdFromSearch,
  setConversationArtifactIdInSearch
} from "./chunk-24DU7J3C.js";
import {
  addNotification,
  api,
  useApi,
  useAppEvents,
  writeClipboardText
} from "./chunk-U66IAJ7L.js";
import {
  formatDate
} from "./chunk-DP4YXAPY.js";
import {
  setExtensionCommandContext,
  useLocation,
  useNavigate
} from "./chunk-CZB4N5KA.js";
import {
  CodeBlock,
  ErrorState,
  IconButton,
  LoadingState,
  MetaLabel,
  RowButton,
  SectionLabel,
  TabButton
} from "./chunk-T4PTJAS4.js";
import "./chunk-P4G4CXIQ.js";
import {
  Fragment2 as Fragment,
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "./chunk-TTFLGCWD.js";
import "./chunk-MZHE4QUL.js";

// packages/desktop/ui/src/components/ConversationArtifactModal.tsx
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/artifactLabels.ts
var ARTIFACT_TYPE_LABELS = {
  architecture: "Architecture explainer",
  "data-table": "Data table",
  "diff-review": "Diff review",
  "fact-check": "Fact check",
  "plan-review": "Plan review",
  "project-recap": "Project recap",
  report: "Report",
  slides: "Slide deck",
  "visual-explainer": "Visual explainer",
  "visual-plan": "Visual plan"
};
var STYLE_PRESET_LABELS = {
  "architecture-map": "Architecture map",
  "review-matrix": "Review matrix",
  "slide-deck": "Slide deck",
  "technical-report": "Technical report",
  "visual-explainer": "Visual explainer"
};
function labelFromSlug(value) {
  return value.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function artifactTypeLabel(input) {
  const type = input.metadata?.type;
  return type ? ARTIFACT_TYPE_LABELS[type] ?? labelFromSlug(type) : input.kind;
}
function artifactDetailLabel(input) {
  const preset = input.metadata?.stylePreset;
  const presetLabel = preset ? STYLE_PRESET_LABELS[preset] ?? labelFromSlug(preset) : null;
  return [presetLabel, input.kind].filter(Boolean).join(" \xB7 ");
}

// packages/desktop/ui/src/components/artifactModalCommands.ts
var ARTIFACT_MODAL_COMMAND_EVENT = "neon-pilot-artifact-modal-command";

// packages/desktop/ui/src/components/ConversationArtifactViewer.tsx
init_neon_pilot_shared_react();
function buildArtifactDocument(content) {
  const trimmed = content.trim();
  const looksLikeHtmlDocument = /^<!doctype\s+html|<html[\s>]/i.test(trimmed);
  if (looksLikeHtmlDocument) {
    return trimmed;
  }
  return [
    "<!doctype html>",
    "<html>",
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "    <style>",
    "      :root { color-scheme: light dark; }",
    '      body { margin: 0; padding: 24px; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    "    </style>",
    "  </head>",
    "  <body>",
    content,
    "  </body>",
    "</html>"
  ].join("\n");
}
function HtmlArtifactViewer({ artifact }) {
  const srcDoc = useMemo(() => buildArtifactDocument(artifact.content), [artifact.content]);
  return /* @__PURE__ */ jsx(
    "iframe",
    {
      title: artifact.title,
      sandbox: "allow-scripts",
      referrerPolicy: "no-referrer",
      srcDoc,
      className: "h-full w-full border-0 bg-white"
    }
  );
}
function SourceArtifactViewer({ artifact, label }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex h-full min-h-0 flex-col overflow-auto px-5 py-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-3 min-w-0", children: [
      /* @__PURE__ */ jsx(SectionLabel, { children: label }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-[12px] leading-relaxed text-secondary", children: "The system-artifacts extension owns rendered artifact previews. Core fallback shows source." })
    ] }),
    /* @__PURE__ */ jsx(CodeBlock, { children: artifact.content })
  ] });
}
function ConversationArtifactViewer({ artifact }) {
  switch (artifact.kind) {
    case "html":
      return /* @__PURE__ */ jsx(HtmlArtifactViewer, { artifact });
    case "mermaid":
      return /* @__PURE__ */ jsx(SourceArtifactViewer, { artifact, label: "Mermaid source" });
    case "latex":
      return /* @__PURE__ */ jsx(SourceArtifactViewer, { artifact, label: "LaTeX source" });
    default:
      return /* @__PURE__ */ jsx(ErrorState, { message: `Unsupported artifact kind: ${artifact.kind}`, className: "px-4 py-4" });
  }
}

// packages/desktop/ui/src/components/ConversationArtifactModal.tsx
function formatArtifactLoadError(error) {
  if (!error) {
    return null;
  }
  return /Artifact not found/i.test(error) ? "Artifact not found." : error;
}
var ICON_PATHS = {
  check: "M20 6 9 17l-5-5",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  copy: "M8 8h10v12H8zM6 16H4V4h12v2",
  eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a17.9 17.9 0 0 1-3.1 4.4M6.6 6.6C3.7 8.5 2 12 2 12s3.5 8 10 8c1.4 0 2.7-.4 3.8-1",
  maximize: "M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5",
  minimize: "M8 3v5H3M16 3v5h5M21 16h-5v5M3 16h5v5",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7",
  x: "M6 6l12 12M18 6 6 18"
};
function ToolbarIcon({ name }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      "aria-hidden": "true",
      viewBox: "0 0 24 24",
      className: "h-3.5 w-3.5",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("path", { d: ICON_PATHS[name] })
    }
  );
}
function ConversationArtifactModal({ conversationId, artifactId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { versions } = useAppEvents();
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const copyResetTimeoutRef = useRef(null);
  const clearCopyResetTimeout = useCallback(() => {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }
  }, []);
  useEffect(() => clearCopyResetTimeout, [clearCopyResetTimeout]);
  useEffect(() => {
    clearCopyResetTimeout();
    setCopied(false);
    setDeleting(false);
  }, [artifactId, clearCopyResetTimeout]);
  const artifactFetcher = useCallback(() => api.conversationArtifact(conversationId, artifactId), [artifactId, conversationId]);
  const listFetcher = useCallback(() => api.conversationArtifacts(conversationId), [conversationId]);
  const {
    data: artifactData,
    loading,
    error,
    refetch
  } = useApi(artifactFetcher, `${conversationId}:${artifactId}`, { notifyOnError: false });
  const { data: artifactListData, refetch: refetchList } = useApi(listFetcher, `${conversationId}:artifacts`);
  useEffect(() => {
    setShowSource(false);
    setCopied(false);
  }, [artifactId]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const closeArtifact = useCallback(() => {
    navigate({
      pathname: location.pathname,
      search: setConversationArtifactIdInSearch(location.search, null)
    });
  }, [location.pathname, location.search, navigate]);
  const openArtifact = useCallback(
    (nextArtifactId) => {
      navigate({
        pathname: location.pathname,
        search: setConversationArtifactIdInSearch(location.search, nextArtifactId)
      });
    },
    [location.pathname, location.search, navigate]
  );
  const closeArtifactRef = useRef(closeArtifact);
  closeArtifactRef.current = closeArtifact;
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeArtifactRef.current();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  useEffect(() => {
    void refetch({ resetLoading: false });
    void refetchList({ resetLoading: false });
  }, [refetch, refetchList, versions.artifacts]);
  const artifact = artifactData?.artifact ?? null;
  const artifacts = artifactListData?.artifacts ?? [];
  const artifactError = formatArtifactLoadError(error);
  const copySource = useCallback(async () => {
    if (!artifact) {
      return;
    }
    try {
      await writeClipboardText(artifact.content);
    } catch (error2) {
      addNotification({
        type: "error",
        title: "Copy failed",
        message: error2 instanceof Error ? error2.message : String(error2)
      });
      return;
    }
    setCopied(true);
    clearCopyResetTimeout();
    copyResetTimeoutRef.current = window.setTimeout(() => {
      copyResetTimeoutRef.current = null;
      setCopied(false);
    }, 1200);
  }, [artifact, clearCopyResetTimeout]);
  const deleteArtifact = useCallback(async () => {
    if (!artifact || deleting) {
      return;
    }
    const confirmed = window.confirm(`Delete artifact "${artifact.title}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteConversationArtifact(conversationId, artifact.id);
      addNotification({ type: "success", message: "Artifact deleted." });
      closeArtifact();
    } catch (error2) {
      addNotification({
        type: "error",
        title: "Delete failed",
        message: "Could not delete artifact.",
        details: error2 instanceof Error ? error2.message : void 0
      });
    } finally {
      setDeleting(false);
    }
  }, [artifact, closeArtifact, conversationId, deleting]);
  useEffect(() => {
    setExtensionCommandContext("artifact.active", Boolean(artifact));
    setExtensionCommandContext("artifact.canShowSource", Boolean(artifact && artifact.kind !== "latex"));
    return () => {
      setExtensionCommandContext("artifact.active", null);
      setExtensionCommandContext("artifact.canShowSource", null);
    };
  }, [artifact]);
  useEffect(() => {
    function handleArtifactCommand(event) {
      const command = event.detail?.command;
      if (command === "copySource") {
        void copySource();
        return;
      }
      if (command === "toggleSource" && artifact?.kind !== "latex") {
        setShowSource((current) => !current);
        return;
      }
      if (command === "toggleFullscreen") {
        setExpanded((current) => !current);
        return;
      }
      if (command === "close") {
        closeArtifact();
      }
    }
    window.addEventListener(ARTIFACT_MODAL_COMMAND_EVENT, handleArtifactCommand);
    return () => window.removeEventListener(ARTIFACT_MODAL_COMMAND_EVENT, handleArtifactCommand);
  }, [artifact?.kind, closeArtifact, copySource]);
  const selectedArtifactId = getConversationArtifactIdFromSearch(location.search);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "ui-overlay-backdrop",
      style: { background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(2px)" },
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) {
          closeArtifact();
        }
      },
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Conversation artifact",
          className: "ui-dialog-shell",
          style: expanded ? { width: "calc(100vw - 1rem)", height: "calc(100vh - 1rem)", maxHeight: "calc(100vh - 1rem)" } : { width: "min(1600px, calc(100vw - 2rem))", height: "min(92vh, 1100px)", maxHeight: "calc(100vh - 2rem)" },
          children: [
            /* @__PURE__ */ jsx("div", { className: "border-b border-border-subtle px-4 py-2.5", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex flex-1 items-center gap-2.5", children: [
                /* @__PURE__ */ jsx(MetaLabel, { children: artifact ? artifactTypeLabel(artifact) : "artifact" }),
                /* @__PURE__ */ jsx(
                  "h2",
                  {
                    className: "min-w-0 truncate text-[14px] font-medium text-primary",
                    title: artifact ? `${artifact.title} \xB7 ${artifact.id} \xB7 rev ${artifact.revision} \xB7 updated ${formatDate(artifact.updatedAt)}` : artifactId,
                    children: artifact?.title ?? artifactId
                  }
                ),
                artifact ? /* @__PURE__ */ jsxs("span", { className: "hidden shrink-0 text-[11px] text-dim sm:inline", children: [
                  artifactDetailLabel(artifact),
                  " \xB7 rev ",
                  artifact.revision
                ] }) : null
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center gap-1.5", children: [
                artifact ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(
                    IconButton,
                    {
                      compact: true,
                      onClick: () => {
                        void copySource();
                      },
                      "aria-label": copied ? "Copied" : artifact.kind === "latex" ? "Copy LaTeX" : "Copy source",
                      title: copied ? "Copied" : artifact.kind === "latex" ? "Copy LaTeX" : "Copy source",
                      children: /* @__PURE__ */ jsx(ToolbarIcon, { name: copied ? "check" : "copy" })
                    }
                  ),
                  artifact.kind !== "latex" ? /* @__PURE__ */ jsx(
                    IconButton,
                    {
                      compact: true,
                      onClick: () => setShowSource((current) => !current),
                      "aria-label": showSource ? "Hide source" : "Show source",
                      title: showSource ? "Hide source" : "Show source",
                      children: /* @__PURE__ */ jsx(ToolbarIcon, { name: showSource ? "eyeOff" : "code" })
                    }
                  ) : null,
                  /* @__PURE__ */ jsx(
                    IconButton,
                    {
                      compact: true,
                      disabled: deleting,
                      onClick: () => {
                        void deleteArtifact();
                      },
                      "aria-label": deleting ? "Deleting artifact" : "Delete artifact",
                      title: deleting ? "Deleting artifact" : "Delete artifact",
                      children: /* @__PURE__ */ jsx(ToolbarIcon, { name: "trash" })
                    }
                  )
                ] }) : null,
                /* @__PURE__ */ jsx(
                  IconButton,
                  {
                    compact: true,
                    onClick: () => setExpanded((current) => !current),
                    "aria-label": expanded ? "Restore" : "Fullscreen",
                    title: expanded ? "Restore" : "Fullscreen",
                    children: /* @__PURE__ */ jsx(ToolbarIcon, { name: expanded ? "minimize" : "maximize" })
                  }
                ),
                /* @__PURE__ */ jsx(IconButton, { compact: true, onClick: closeArtifact, "aria-label": "Close", title: "Close", children: /* @__PURE__ */ jsx(ToolbarIcon, { name: "x" }) })
              ] })
            ] }) }),
            /* @__PURE__ */ jsxs("div", { className: "min-h-0 flex flex-1 overflow-hidden", children: [
              artifacts.length > 1 ? /* @__PURE__ */ jsxs("div", { className: "hidden w-72 shrink-0 border-r border-border-subtle bg-base/40 lg:flex lg:flex-col", children: [
                /* @__PURE__ */ jsx("div", { className: "border-b border-border-subtle px-4 py-3", children: /* @__PURE__ */ jsx(SectionLabel, { children: "Artifacts" }) }),
                /* @__PURE__ */ jsx("div", { className: "min-h-0 flex-1 overflow-y-auto px-2 py-2", children: /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-1.5", children: artifacts.map((item) => {
                  const selected = item.id === selectedArtifactId;
                  return /* @__PURE__ */ jsxs(RowButton, { onClick: () => openArtifact(item.id), selected, className: "px-3 py-2.5", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ jsx("span", { className: "truncate text-[12px] font-medium", children: item.title }),
                      /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: artifactTypeLabel(item) })
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "mt-0.5 text-[10px] text-dim font-mono", children: item.id })
                  ] }, item.id);
                }) }) })
              ] }) : null,
              /* @__PURE__ */ jsxs("div", { className: "min-h-0 flex flex-1 flex-col overflow-hidden bg-base", children: [
                artifacts.length > 1 ? /* @__PURE__ */ jsx("div", { className: "border-b border-border-subtle px-4 py-2.5 lg:hidden", children: /* @__PURE__ */ jsx("div", { className: "flex gap-2 overflow-x-auto pb-1", children: artifacts.map((item) => {
                  const selected = item.id === selectedArtifactId;
                  return /* @__PURE__ */ jsx(TabButton, { onClick: () => openArtifact(item.id), active: selected, className: "shrink-0", children: item.title }, item.id);
                }) }) }) : null,
                /* @__PURE__ */ jsx("div", { className: "min-h-0 flex-1 overflow-hidden", children: loading && !artifact ? /* @__PURE__ */ jsx(LoadingState, { label: "Loading artifact\u2026", className: "justify-center h-full" }) : artifactError || !artifact ? /* @__PURE__ */ jsx(ErrorState, { message: artifactError || "Artifact not found.", className: "px-4 py-4" }) : /* @__PURE__ */ jsx(ConversationArtifactViewer, { artifact }) }),
                showSource && artifact && artifact.kind !== "latex" ? /* @__PURE__ */ jsxs("div", { className: "max-h-[38%] overflow-auto border-t border-border-subtle px-4 py-3", children: [
                  /* @__PURE__ */ jsx(SectionLabel, { children: "Source" }),
                  /* @__PURE__ */ jsx(CodeBlock, { compact: true, className: "mt-2 border-0 bg-transparent p-0 text-secondary", children: artifact.content })
                ] }) : null
              ] })
            ] })
          ]
        }
      )
    }
  );
}
export {
  ConversationArtifactModal
};
