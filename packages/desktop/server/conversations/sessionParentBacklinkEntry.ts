import type { ConversationOffshootKind } from './sessionCustomMetadata.js';

export function resolveParentBacklinkLabel(kind: ConversationOffshootKind): string {
  return kind === 'subagent' ? 'Subagent' : kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function buildParentBacklinkContent(input: {
  label: string;
  parentTitle: string;
  parentId: string;
  parentMessageId?: string;
}): string {
  return `${input.label} conversation from parent: ${input.parentTitle}\nOpen parent: /conversations/${input.parentId}${
    input.parentMessageId ? `\nSource message: ${input.parentMessageId}` : ''
  }`;
}
