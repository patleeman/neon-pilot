import {
  TitleButton
} from "./chunk-T4PTJAS4.js";
import "./chunk-P4G4CXIQ.js";
import {
  jsx
} from "./chunk-TTFLGCWD.js";
import "./chunk-MZHE4QUL.js";

// packages/desktop/ui/src/components/ConversationSavedHeader.tsx
var CONVERSATION_TITLE_CLASS = "ui-conversation-title-clamp max-w-full break-words text-[32px] font-semibold leading-[1.08] tracking-[-0.018em] text-primary sm:text-[36px]";
function ConversationSavedHeader({ title, onTitleClick }) {
  return /* @__PURE__ */ jsx("div", { className: "space-y-3", children: /* @__PURE__ */ jsx("div", { className: "min-w-0 overflow-hidden", children: onTitleClick ? /* @__PURE__ */ jsx("h1", { className: CONVERSATION_TITLE_CLASS, children: /* @__PURE__ */ jsx(
    TitleButton,
    {
      onClick: onTitleClick,
      title: "Rename conversation",
      "aria-label": `Rename conversation: ${title}`,
      className: "ui-conversation-title-clamp max-w-full break-words",
      children: title
    }
  ) }) : /* @__PURE__ */ jsx("h1", { className: CONVERSATION_TITLE_CLASS, children: title }) }) });
}
export {
  CONVERSATION_TITLE_CLASS,
  ConversationSavedHeader
};
