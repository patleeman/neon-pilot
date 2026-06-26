import {
  DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT,
  DRAWING_PICKER_CLOSE_COMMAND_EVENT,
  DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT
} from "./chunk-WY4PXDOC.js";
import {
  timeAgo
} from "./chunk-DP4YXAPY.js";
import {
  setExtensionCommandContext
} from "./chunk-T3OH4ARN.js";
import {
  CardMeta,
  CardTitle,
  PanelMessage,
  Pill,
  ResourcePickerDialog,
  ResourcePickerList,
  ResourcePickerToolbar,
  SearchInput,
  SurfacePanel,
  TextButton,
  ToolbarButton,
  cx
} from "./chunk-5W2EFD7M.js";
import "./chunk-P4G4CXIQ.js";
import {
  init_neon_pilot_shared_react,
  jsx,
  jsxs,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "./chunk-TTFLGCWD.js";
import "./chunk-MZHE4QUL.js";

// packages/desktop/ui/src/components/ConversationDrawingsPickerModal.tsx
init_neon_pilot_shared_react();
function ConversationDrawingsPickerModal({ attachments, onLoadAttachment, onAttach, onClose }) {
  const [query, setQuery] = useState("");
  const [expandedAttachmentId, setExpandedAttachmentId] = useState(null);
  const [recordsById, setRecordsById] = useState({});
  const [loadingAttachmentId, setLoadingAttachmentId] = useState(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return attachments;
    }
    return attachments.filter((attachment) => {
      const haystack = [attachment.id, attachment.title, attachment.kind].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [attachments, query]);
  const firstVisibleAttachment = filtered[0] ?? null;
  const toggleHistory = useCallback(
    async (attachment) => {
      const isExpanded = expandedAttachmentId === attachment.id;
      if (isExpanded) {
        setExpandedAttachmentId(null);
        return;
      }
      if (!recordsById[attachment.id]) {
        setLoadingAttachmentId(attachment.id);
        try {
          const record = await onLoadAttachment(attachment.id);
          setRecordsById((current) => ({ ...current, [attachment.id]: record }));
        } finally {
          setLoadingAttachmentId(null);
        }
      }
      setExpandedAttachmentId(attachment.id);
    },
    [expandedAttachmentId, onLoadAttachment, recordsById]
  );
  useEffect(() => {
    setExtensionCommandContext("drawingPicker.open", true);
    setExtensionCommandContext("drawingPicker.hasVisibleDrawing", Boolean(firstVisibleAttachment));
    return () => {
      setExtensionCommandContext("drawingPicker.open", null);
      setExtensionCommandContext("drawingPicker.hasVisibleDrawing", null);
    };
  }, [firstVisibleAttachment]);
  useEffect(() => {
    function handleCloseCommand() {
      onClose();
    }
    function handleAttachFirstCommand() {
      if (firstVisibleAttachment) {
        onAttach({ attachment: firstVisibleAttachment, revision: firstVisibleAttachment.currentRevision });
      }
    }
    function handleToggleFirstHistoryCommand() {
      if (firstVisibleAttachment) {
        void toggleHistory(firstVisibleAttachment);
      }
    }
    window.addEventListener(DRAWING_PICKER_CLOSE_COMMAND_EVENT, handleCloseCommand);
    window.addEventListener(DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT, handleAttachFirstCommand);
    window.addEventListener(DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT, handleToggleFirstHistoryCommand);
    return () => {
      window.removeEventListener(DRAWING_PICKER_CLOSE_COMMAND_EVENT, handleCloseCommand);
      window.removeEventListener(DRAWING_PICKER_ATTACH_FIRST_COMMAND_EVENT, handleAttachFirstCommand);
      window.removeEventListener(DRAWING_PICKER_TOGGLE_FIRST_HISTORY_COMMAND_EVENT, handleToggleFirstHistoryCommand);
    };
  }, [firstVisibleAttachment, onAttach, onClose, toggleHistory]);
  return /* @__PURE__ */ jsxs(
    ResourcePickerDialog,
    {
      title: "Conversation drawings",
      description: "Attach a saved drawing (latest or a specific revision) to your next prompt.",
      actions: /* @__PURE__ */ jsx(ToolbarButton, { onClick: onClose, children: "Close" }),
      onClose,
      backdropStyle: { background: "rgb(0 0 0 / 0.55)", backdropFilter: "blur(2px)" },
      style: { maxWidth: "840px", maxHeight: "calc(100vh - 5rem)" },
      children: [
        /* @__PURE__ */ jsx(
          ResourcePickerToolbar,
          {
            search: /* @__PURE__ */ jsx(
              SearchInput,
              {
                value: query,
                onChange: (event) => setQuery(event.target.value),
                className: "bg-elevated text-[13px]",
                placeholder: "Filter drawings by id or title..."
              }
            ),
            actions: /* @__PURE__ */ jsx(Pill, { tone: "muted", mono: true, className: "tabular-nums", children: filtered.length })
          }
        ),
        /* @__PURE__ */ jsxs(ResourcePickerList, { className: "space-y-2", children: [
          filtered.length === 0 && /* @__PURE__ */ jsx(PanelMessage, { align: "center", className: "py-8", children: "No drawings match this filter." }),
          filtered.map((attachment) => {
            const isExpanded = expandedAttachmentId === attachment.id;
            const isLoading = loadingAttachmentId === attachment.id;
            const record = recordsById[attachment.id];
            return /* @__PURE__ */ jsxs(SurfacePanel, { className: "px-3 py-2.5", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                  /* @__PURE__ */ jsx(CardTitle, { className: "truncate", children: attachment.title }),
                  /* @__PURE__ */ jsxs(CardMeta, { className: "mt-1 font-mono", children: [
                    attachment.id,
                    " \xB7 rev ",
                    attachment.currentRevision,
                    " \xB7 updated ",
                    timeAgo(attachment.updatedAt)
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx(ToolbarButton, { onClick: () => onAttach({ attachment, revision: attachment.currentRevision }), children: "Attach latest" }),
                  /* @__PURE__ */ jsx(
                    ToolbarButton,
                    {
                      onClick: () => {
                        void toggleHistory(attachment);
                      },
                      className: cx(isExpanded && "text-accent"),
                      children: isExpanded ? "Hide history" : "History"
                    }
                  )
                ] })
              ] }),
              isExpanded && /* @__PURE__ */ jsxs("div", { className: "mt-2.5 border-t border-border-subtle pt-2 space-y-1.5", children: [
                isLoading && /* @__PURE__ */ jsx(PanelMessage, { className: "px-0 py-0", children: "Loading revisions\u2026" }),
                !isLoading && record && record.revisions.length > 0 && record.revisions.slice().sort((left, right) => right.revision - left.revision).map((revision) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 text-[11px]", children: [
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 text-dim", children: [
                    /* @__PURE__ */ jsxs("span", { className: "font-mono text-secondary", children: [
                      "rev ",
                      revision.revision
                    ] }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      "\xB7 ",
                      timeAgo(revision.createdAt)
                    ] }),
                    revision.note && /* @__PURE__ */ jsxs("span", { className: "truncate", children: [
                      "\xB7 ",
                      revision.note
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx(
                    TextButton,
                    {
                      className: "text-[11px] text-accent hover:text-accent/80",
                      tone: "accent",
                      onClick: () => onAttach({ attachment, revision: revision.revision }),
                      children: "Attach"
                    }
                  )
                ] }, revision.revision)),
                !isLoading && record && record.revisions.length === 0 && /* @__PURE__ */ jsx(PanelMessage, { className: "px-0 py-0", children: "No saved revisions." })
              ] })
            ] }, attachment.id);
          })
        ] })
      ]
    }
  );
}
export {
  ConversationDrawingsPickerModal
};
