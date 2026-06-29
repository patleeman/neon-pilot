import { parseSlashInput } from '../commands/slashMenu';

export interface ConversationComposerMenuState {
  slashInput: ReturnType<typeof parseSlashInput>;
  showModelPicker: boolean;
  mentionMatch: RegExpMatchArray | null;
  showSlash: boolean;
  showMention: boolean;
  slashQuery: string;
  modelQuery: string;
  mentionQuery: string;
}

export function resolveConversationComposerMenuState(input: string): ConversationComposerMenuState {
  const slashInput = parseSlashInput(input);
  const showModelPicker = slashInput?.command === '/model';
  const mentionMatch = input.match(/(^|.*\s)(@[\w./-]*)$/);
  const showSlash = !!slashInput && !input.includes('\n') && !showModelPicker;
  const showMention = !!mentionMatch && !showSlash && !showModelPicker;

  return {
    slashInput,
    showModelPicker,
    mentionMatch,
    showSlash,
    showMention,
    slashQuery: slashInput?.command ?? '',
    modelQuery: showModelPicker ? (slashInput?.argument ?? '') : '',
    mentionQuery: mentionMatch?.[2] ?? '',
  };
}
