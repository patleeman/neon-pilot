export const REFERENCED_CONTEXT_CUSTOM_TYPE = 'referenced_context';
export const CONVERSATION_WORKSPACE_CHANGE_CUSTOM_TYPE = 'conversation_workspace_change';
export const GOAL_CONTINUATION_CUSTOM_TYPE = 'goal-continuation';
export const CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE = 'child_conversation_topology';
export const PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE = 'parent_conversation_backlink';

const INJECTED_CONTEXT_CUSTOM_TYPES = new Set<string>([
  REFERENCED_CONTEXT_CUSTOM_TYPE,
  CONVERSATION_WORKSPACE_CHANGE_CUSTOM_TYPE,
  CHILD_CONVERSATION_TOPOLOGY_CUSTOM_TYPE,
  PARENT_CONVERSATION_BACKLINK_CUSTOM_TYPE,
  GOAL_CONTINUATION_CUSTOM_TYPE,
]);

export function isInjectedContextMessage(message: { role: string; customType?: string }): boolean {
  return message.role === 'custom' && typeof message.customType === 'string' && INJECTED_CONTEXT_CUSTOM_TYPES.has(message.customType);
}
