import type { AskUserQuestionAnswers, AskUserQuestionPresentation } from '../../transcript/askUserQuestions';
import { Button, ChoiceRow, cx, Pill } from '../ui';

type ConversationQuestion = AskUserQuestionPresentation['questions'][number];

export function ConversationQuestionShelf({
  presentation,
  activeQuestion,
  activeQuestionIndex,
  activeOptionIndex,
  answers,
  submitting,
  answeredCount,
  onActivateQuestion,
  onSelectOption,
}: {
  presentation: AskUserQuestionPresentation;
  activeQuestion: ConversationQuestion;
  activeQuestionIndex: number;
  activeOptionIndex: number;
  answers: AskUserQuestionAnswers;
  submitting: boolean;
  answeredCount: number;
  onActivateQuestion: (questionIndex: number) => void;
  onSelectOption: (questionIndex: number, optionIndex: number) => void;
}) {
  return (
    <div className="px-4 pb-3 pt-2">
      <div className="rounded-lg border border-border-subtle/70 bg-surface/35 px-3 py-3 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="ui-section-label text-[11px] tracking-[0.12em] text-accent">Answer below</span>
          <Pill tone="warning" className="px-2 py-0.5 text-[11px]">
            {answeredCount}/{presentation.questions.length}
          </Pill>
        </div>

        {presentation.questions.length > 1 && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            {presentation.questions.map((question, index) => {
              const answered = (answers[question.id]?.length ?? 0) > 0;
              const active = index === activeQuestionIndex;
              return (
                <Button
                  key={question.id}
                  variant="action"
                  onClick={() => onActivateQuestion(index)}
                  className={cx('min-w-0 px-2 py-1 text-[11px]', active ? 'text-primary' : answered ? 'text-secondary' : 'text-dim')}
                >
                  <span
                    aria-hidden="true"
                    className={cx('shrink-0 text-[11px]', answered ? 'text-success' : active ? 'text-accent' : 'text-dim/70')}
                  >
                    {answered ? '✓' : active ? '•' : '○'}
                  </span>
                  <span className="truncate">{question.label}</span>
                </Button>
              );
            })}
          </div>
        )}

        <div className="mt-2.5">
          <p className="text-[13px] font-medium leading-snug text-primary break-words">{activeQuestion.label}</p>
          {activeQuestion.details && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-secondary break-words">{activeQuestion.details}</p>
          )}
        </div>

        <div className="mt-2 space-y-0.5" role={activeQuestion.style === 'check' ? 'group' : 'radiogroup'} aria-label={activeQuestion.label}>
          {activeQuestion.options.map((option, optionIndex) => {
            const selectedValues = answers[activeQuestion.id] ?? [];
            const checked = selectedValues.includes(option.value);
            const active = optionIndex === activeOptionIndex;
            const indicator = activeQuestion.style === 'check' ? (checked ? '☑' : '☐') : checked ? '◉' : '◯';
            return (
              <ChoiceRow
                key={`${activeQuestion.id}:${option.value}`}
                type="button"
                disabled={submitting}
                onClick={() => onSelectOption(activeQuestionIndex, optionIndex)}
                checked={checked}
                prefix={optionIndex < 9 ? `${optionIndex + 1}.` : null}
                indicator={indicator}
                label={option.label}
                details={option.details}
                className={cx(
                  'rounded-md px-2 py-1.5 disabled:opacity-40',
                  active && !checked && 'bg-elevated/35 text-primary',
                  submitting && 'cursor-default',
                )}
              />
            );
          })}
        </div>

        <p className="mt-2.5 text-[11px] leading-relaxed text-dim">
          1-9 selects · Tab/Shift+Tab or ←/→ switches questions · ↑/↓ moves · Enter selects or submits · type a normal message to skip
        </p>
      </div>
    </div>
  );
}
