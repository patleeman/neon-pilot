import { AskUserQuestionToolParams } from './askUserQuestionAgentExtension.js';
import { ChangeWorkingDirectoryToolParams } from './changeWorkingDirectoryAgentExtension.js';
import { ConversationInspectToolParams } from './conversationInspectAgentExtension.js';
import { ConversationTitleToolParams } from './conversationTitleAgentExtension.js';

function properties(schema: { properties?: Record<string, unknown> }): Record<string, unknown> {
  return schema.properties ?? {};
}

const DeferredResumeParams = {
  type: 'object',
  properties: {
    action: { type: 'string', const: 'deferred_resume' },
    deferredAction: {
      type: 'string',
      enum: ['add', 'list', 'cancel'],
      description: 'Deferred resume operation to perform.',
    },
    id: { type: 'string' },
    prompt: { type: 'string' },
    trigger: { type: 'string', enum: ['after_turn', 'delay', 'at'] },
    delay: { type: 'string' },
    at: { type: 'string' },
    deliverAs: { type: 'string', enum: ['steer', 'followUp'] },
    title: { type: 'string' },
    reason: {
      type: 'string',
      description:
        'Required when scheduling a wakeup that references a running background run which already delivers completion, explaining the distinct time-based action.',
    },
  },
  required: ['action', 'deferredAction'],
} as const;

const { action: inspectAction, ...inspectProperties } = ConversationInspectToolParams.properties;
const deferredResumeProperties = Object.fromEntries(Object.entries(DeferredResumeParams.properties).filter(([key]) => key !== 'action'));

export const ConversationToolParams = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['ask', 'inspect', 'set_title', 'change_working_directory', 'deferred_resume'],
    },
    ...properties(AskUserQuestionToolParams),
    inspectAction,
    ...inspectProperties,
    ...properties(ConversationTitleToolParams),
    ...properties(ChangeWorkingDirectoryToolParams),
    ...deferredResumeProperties,
  },
  required: ['action'],
  additionalProperties: false,
} as const;

export const CONVERSATION_ACTIONS = ['ask', 'inspect', 'set_title', 'change_working_directory', 'deferred_resume'] as const;

export type ConversationAction = (typeof CONVERSATION_ACTIONS)[number];
