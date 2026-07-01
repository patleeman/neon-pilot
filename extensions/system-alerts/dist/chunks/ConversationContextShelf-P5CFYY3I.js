import {
  IconButton,
  MetaLabel,
  Pill,
  SectionLabel,
  TextButton
} from "./chunk-T4PTJAS4.js";
import "./chunk-P4G4CXIQ.js";
import {
  Fragment2 as Fragment,
  jsx,
  jsxs
} from "./chunk-TTFLGCWD.js";
import "./chunk-MZHE4QUL.js";

// packages/desktop/ui/src/components/conversation/ConversationContextShelf.tsx
function ConversationContextShelf({
  attachedContextDocs,
  draftMentionItems,
  unattachedDraftMentionItems,
  contextDocsBusy,
  onRemoveAttachedContextDoc,
  onAttachMentionedDocs
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    attachedContextDocs.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 pt-3 pb-2.5", children: [
      /* @__PURE__ */ jsx(SectionLabel, { children: "Attached context" }),
      attachedContextDocs.map((doc) => /* @__PURE__ */ jsxs(Pill, { className: "gap-1.5", title: doc.summary ? `${doc.path}

${doc.summary}` : doc.path, children: [
        /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: doc.kind }),
        /* @__PURE__ */ jsx("span", { className: "max-w-[18rem] truncate text-secondary", children: doc.title }),
        /* @__PURE__ */ jsx(
          IconButton,
          {
            compact: true,
            type: "button",
            onClick: () => {
              onRemoveAttachedContextDoc(doc.path);
            },
            disabled: contextDocsBusy,
            className: "ml-0.5 shrink-0 leading-none disabled:opacity-50",
            title: `Remove ${doc.title} from attached context`,
            children: "\xD7"
          }
        )
      ] }, doc.path))
    ] }),
    draftMentionItems.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 pt-3 pb-2.5", children: [
      /* @__PURE__ */ jsx(SectionLabel, { children: "Prompt references" }),
      unattachedDraftMentionItems.length > 0 && /* @__PURE__ */ jsx(
        TextButton,
        {
          type: "button",
          onClick: () => {
            onAttachMentionedDocs(unattachedDraftMentionItems);
          },
          disabled: contextDocsBusy,
          tone: "accent",
          className: "disabled:cursor-default disabled:opacity-50",
          children: contextDocsBusy ? "attaching\u2026" : `attach ${unattachedDraftMentionItems.length}`
        }
      ),
      draftMentionItems.map((item) => /* @__PURE__ */ jsxs(Pill, { className: "gap-1.5", title: item.summary || item.title || item.id, children: [
        /* @__PURE__ */ jsx(MetaLabel, { tone: "muted", children: item.kind }),
        /* @__PURE__ */ jsx("span", { className: "font-mono text-accent", children: item.id })
      ] }, `${item.kind}:${item.id}`))
    ] })
  ] });
}
export {
  ConversationContextShelf
};
