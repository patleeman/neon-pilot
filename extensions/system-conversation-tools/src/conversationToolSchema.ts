import { Type } from '@sinclair/typebox';

import { AskUserQuestionToolParams } from './askUserQuestionAgentExtension.js';
import { ChangeWorkingDirectoryToolParams } from './changeWorkingDirectoryAgentExtension.js';
import { ConversationInspectToolParams } from './conversationInspectAgentExtension.js';
import { ConversationTitleToolParams } from './conversationTitleAgentExtension.js';

function optionalProperties(schema: { properties?: Record<string, unknown> }, except = new Set<string>()): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, value]) => [key, except.has(key) ? value : Type.Optional(value as never)]),
  );
}

const DeferredResumeParams = Type.Object({
  action: Type.Literal('deferred_resume'),
  deferredAction: Type.Union([Type.Literal('add'), Type.Literal('list'), Type.Literal('cancel')], {
    description: 'Deferred resume operation to perform.',
  }),
  id: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
  trigger: Type.Optional(Type.Union([Type.Literal('after_turn'), Type.Literal('delay'), Type.Literal('at')])),
  delay: Type.Optional(Type.String()),
  at: Type.Optional(Type.String()),
  deliverAs: Type.Optional(Type.Union([Type.Literal('steer'), Type.Literal('followUp')])),
  title: Type.Optional(Type.String()),
  reason: Type.Optional(
    Type.String({
      description:
        'Required when scheduling a wakeup that references a running background run which already delivers completion, explaining the distinct time-based action.',
    }),
  ),
});

const { action: inspectAction, ...inspectProperties } = ConversationInspectToolParams.properties;

export const ConversationToolParams = Type.Object(
  {
    action: Type.Union([
      Type.Literal('ask'),
      Type.Literal('inspect'),
      Type.Literal('set_title'),
      Type.Literal('change_working_directory'),
      Type.Literal('deferred_resume'),
    ]),
    ...optionalProperties(AskUserQuestionToolParams),
    inspectAction: Type.Optional(inspectAction),
    ...Object.fromEntries(Object.entries(inspectProperties).map(([key, value]) => [key, Type.Optional(value as never)])),
    ...optionalProperties(ConversationTitleToolParams),
    ...optionalProperties(ChangeWorkingDirectoryToolParams),
    ...optionalProperties(DeferredResumeParams),
  },
  { additionalProperties: false },
);

export const CONVERSATION_ACTIONS = ['ask', 'inspect', 'set_title', 'change_working_directory', 'deferred_resume'] as const;

export type ConversationAction = (typeof CONVERSATION_ACTIONS)[number];
