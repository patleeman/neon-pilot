import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';

import { deferredResume } from '../../system-automations/src/conversationQueueBackend.js';
import { createAskUserQuestionAgentExtension } from './askUserQuestionAgentExtension.js';
import {
  createChangeWorkingDirectoryAgentExtension,
  type RequestConversationWorkingDirectoryChangeInput,
  type RequestConversationWorkingDirectoryChangeResult,
} from './changeWorkingDirectoryAgentExtension.js';
import { createConversationInspectAgentExtension } from './conversationInspectAgentExtension.js';
import { createConversationTitleAgentExtension } from './conversationTitleAgentExtension.js';

type RegisteredTool = {
  name?: string;
  execute?: (...args: unknown[]) => Promise<unknown> | unknown;
};

type RegisterToolApi = {
  registerTool(tool: RegisteredTool): void;
};

const CONVERSATION_ACTIONS = ['ask', 'inspect', 'set_title', 'change_working_directory', 'deferred_resume'] as const;

type ConversationAction = (typeof CONVERSATION_ACTIONS)[number];

const ConversationToolParams = Type.Object(
  {
    action: Type.Union(
      CONVERSATION_ACTIONS.map((action) => Type.Literal(action)),
      {
        description: 'Conversation/session action to perform.',
      },
    ),
  },
  {
    additionalProperties: true,
  },
);

function registerLegacyConversationTools(options: {
  requestConversationWorkingDirectoryChange: (
    input: RequestConversationWorkingDirectoryChangeInput,
  ) => Promise<RequestConversationWorkingDirectoryChangeResult>;
}): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const api: RegisterToolApi = {
    registerTool(tool) {
      if (tool.name) tools.set(tool.name, tool);
    },
  };

  createAskUserQuestionAgentExtension()(api as ExtensionAPI);
  createConversationInspectAgentExtension()(api as ExtensionAPI);
  createConversationTitleAgentExtension()(api as ExtensionAPI);
  createChangeWorkingDirectoryAgentExtension(options)(api as ExtensionAPI);
  return tools;
}

function payloadWithoutAction(params: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...params };
  delete payload.action;
  return payload;
}

function readAction(params: unknown): ConversationAction {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('conversation action is required.');
  }
  const action = (params as { action?: unknown }).action;
  if (CONVERSATION_ACTIONS.includes(action as ConversationAction)) {
    return action as ConversationAction;
  }
  throw new Error(`Unsupported conversation action: ${String(action)}`);
}

export function createConversationAgentExtension(options: {
  requestConversationWorkingDirectoryChange: (
    input: RequestConversationWorkingDirectoryChangeInput,
  ) => Promise<RequestConversationWorkingDirectoryChangeResult>;
}): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    const legacyTools = registerLegacyConversationTools(options);

    pi.registerTool({
      name: 'conversation',
      label: 'Conversation',
      description:
        'Ask the user, inspect conversations, set the title, change working directory, or schedule a deferred resume for this conversation.',
      promptSnippet: 'Use conversation for conversation/session state, questions, inspection, title, cwd changes, and deferred resumes.',
      promptGuidelines: [
        'Use action="deferred_resume" for wait-then-continue; do not run sleep in bash.',
        'Ask the user only when blocked on a real decision or approval.',
      ],
      parameters: ConversationToolParams,
      async execute(toolCallId, params, signal, onUpdate, ctx) {
        const action = readAction(params);
        const payload = payloadWithoutAction(params as Record<string, unknown>);

        if (action === 'deferred_resume') {
          const result = await deferredResume(payload as never, {
            profile: 'shared',
            toolContext: {
              sessionId: ctx.sessionManager.getSessionId(),
              sessionFile: ctx.sessionManager.getSessionFile?.(),
              cwd: ctx.sessionManager.getCwd?.(),
            },
          });
          return {
            content: [{ type: 'text' as const, text: result.text }],
            details: result,
          };
        }

        const toolNameByAction: Record<Exclude<ConversationAction, 'deferred_resume'>, string> = {
          ask: 'ask_user_question',
          inspect: 'conversation_inspect',
          set_title: 'set_conversation_title',
          change_working_directory: 'change_working_directory',
        };
        const toolName = toolNameByAction[action as Exclude<ConversationAction, 'deferred_resume'>];
        const tool = legacyTools.get(toolName);
        if (!tool?.execute) throw new Error(`Conversation tool action ${action} is unavailable.`);
        return tool.execute(toolCallId, payload, signal, onUpdate, ctx);
      },
    });
  };
}
