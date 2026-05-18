import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { deferredResume } from '../../system-automations/src/conversationQueueBackend.js';
import { executeAskUserQuestion } from './askUserQuestionAgentExtension.js';
import {
  executeChangeWorkingDirectory,
  type RequestConversationWorkingDirectoryChangeInput,
  type RequestConversationWorkingDirectoryChangeResult,
} from './changeWorkingDirectoryAgentExtension.js';
import { executeConversationInspectTool } from './conversationInspectAgentExtension.js';
import { executeSetConversationTitle } from './conversationTitleAgentExtension.js';
import { CONVERSATION_ACTIONS, type ConversationAction, ConversationToolParams } from './conversationToolSchema.js';

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
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const action = readAction(params);
        const payload = payloadWithoutAction(params as Record<string, unknown>);

        switch (action) {
          case 'ask':
            return executeAskUserQuestion(payload, ctx);
          case 'inspect':
            return executeConversationInspectTool(payload, ctx);
          case 'set_title':
            return executeSetConversationTitle(payload, ctx, (title) => pi.setSessionName(title));
          case 'change_working_directory':
            return executeChangeWorkingDirectory(payload, ctx, options.requestConversationWorkingDirectoryChange);
          case 'deferred_resume': {
            const { deferredAction, ...resumePayload } = payload;
            const result = await deferredResume({ ...resumePayload, action: deferredAction } as never, {
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
        }
      },
    });
  };
}
