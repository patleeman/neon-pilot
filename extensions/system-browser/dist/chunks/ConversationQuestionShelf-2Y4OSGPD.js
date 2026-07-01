import {
  Button,
  ChoiceRow,
  Pill,
  cx
} from "./chunk-GBCNBHDJ.js";
import "./chunk-P4G4CXIQ.js";
import {
  jsx,
  jsxs
} from "./chunk-TTFLGCWD.js";
import "./chunk-MZHE4QUL.js";

// packages/desktop/ui/src/components/conversation/ConversationQuestionShelf.tsx
function ConversationQuestionShelf({
  presentation,
  activeQuestion,
  activeQuestionIndex,
  activeOptionIndex,
  answers,
  submitting,
  answeredCount,
  onActivateQuestion,
  onSelectOption
}) {
  return /* @__PURE__ */ jsxs("div", { className: "border-b border-border-subtle/60 bg-base/20 px-4 py-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "ui-section-label text-[11px] tracking-[0.12em] text-accent", children: "Answer below" }),
      /* @__PURE__ */ jsxs(Pill, { tone: "warning", className: "px-2 py-0.5 text-[11px]", children: [
        answeredCount,
        "/",
        presentation.questions.length
      ] })
    ] }),
    presentation.questions.length > 1 && /* @__PURE__ */ jsx("div", { className: "mt-2 flex min-w-0 flex-wrap items-center gap-1.5", children: presentation.questions.map((question, index) => {
      const answered = (answers[question.id]?.length ?? 0) > 0;
      const active = index === activeQuestionIndex;
      return /* @__PURE__ */ jsxs(
        Button,
        {
          variant: "action",
          onClick: () => onActivateQuestion(index),
          className: cx("min-w-0 px-2 py-1 text-[11px]", active ? "text-primary" : answered ? "text-secondary" : "text-dim"),
          children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                "aria-hidden": "true",
                className: cx("shrink-0 text-[11px]", answered ? "text-success" : active ? "text-accent" : "text-dim/70"),
                children: answered ? "\u2713" : active ? "\u2022" : "\u25CB"
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "truncate", children: question.label })
          ]
        },
        question.id
      );
    }) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-2.5", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[13px] font-medium leading-snug text-primary break-words", children: activeQuestion.label }),
      activeQuestion.details && /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[12px] leading-relaxed text-secondary break-words", children: activeQuestion.details })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-2 space-y-0.5", role: activeQuestion.style === "check" ? "group" : "radiogroup", "aria-label": activeQuestion.label, children: activeQuestion.options.map((option, optionIndex) => {
      const selectedValues = answers[activeQuestion.id] ?? [];
      const checked = selectedValues.includes(option.value);
      const active = optionIndex === activeOptionIndex;
      const indicator = activeQuestion.style === "check" ? checked ? "\u2611" : "\u2610" : checked ? "\u25C9" : "\u25EF";
      return /* @__PURE__ */ jsx(
        ChoiceRow,
        {
          type: "button",
          disabled: submitting,
          onClick: () => onSelectOption(activeQuestionIndex, optionIndex),
          checked,
          prefix: optionIndex < 9 ? `${optionIndex + 1}.` : null,
          indicator,
          label: option.label,
          details: option.details,
          className: cx(
            "rounded-md px-2 py-1.5 disabled:opacity-40",
            active && !checked && "bg-elevated/35 text-primary",
            submitting && "cursor-default"
          )
        },
        `${activeQuestion.id}:${option.value}`
      );
    }) }),
    /* @__PURE__ */ jsx("p", { className: "mt-2.5 text-[11px] leading-relaxed text-dim", children: "1-9 selects \xB7 Tab/Shift+Tab or \u2190/\u2192 switches questions \xB7 \u2191/\u2193 moves \xB7 Enter selects or submits \xB7 type a normal message to skip" })
  ] });
}
export {
  ConversationQuestionShelf
};
