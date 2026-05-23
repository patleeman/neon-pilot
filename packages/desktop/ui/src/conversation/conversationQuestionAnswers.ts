import type { AskUserQuestionAnswers } from '../transcript/askUserQuestions';

export const EMPTY_ASK_USER_ANSWERS: AskUserQuestionAnswers = {};

export function buildComposerQuestionAnswersStorageKey(conversationId: string | undefined, pendingQuestionKey: string): string | null {
  if (!conversationId || !pendingQuestionKey) {
    return null;
  }

  return `pa:conversation-question-answers:${conversationId}:${pendingQuestionKey}`;
}

export function hasAskUserQuestionAnswers(answers: AskUserQuestionAnswers): boolean {
  return Object.values(answers).some((values) => values.length > 0);
}
