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

const imageAttachmentSchema = {
  type: 'object',
  properties: {
    data: { type: 'string' },
    mimeType: { type: 'string' },
    name: { type: 'string' },
  },
  required: ['data', 'mimeType'],
  additionalProperties: false,
} as const;

const AdminConversationParams = {
  type: 'object',
  properties: {
    conversationId: { type: 'string', description: 'Target conversation id. Defaults to the current conversation only where documented.' },
    text: { type: 'string', description: 'Message or prompt text for send_message and run_turn.' },
    steer: { type: 'boolean', description: 'Steer a running conversation instead of queueing a follow-up.' },
    images: { type: 'array', items: imageAttachmentSchema, description: 'Optional image attachments for send_message and run_turn.' },
    timeoutMs: { type: 'number', minimum: 1, description: 'Maximum time to wait for run_turn completion.' },
    customInstructions: { type: 'string', description: 'Optional compaction instructions.' },
    count: { type: 'number', minimum: 1, description: 'Number of turns to roll back.' },
    toolNames: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Active tool names for set_active_tools.',
    },
    live: { type: 'boolean', description: 'Whether create should start a live session. Defaults to true.' },
    initialPrompt: { type: 'string', description: 'Initial prompt for create.' },
    prompt: { type: 'string', description: 'Initial prompt for create, or deferred resume prompt.' },
    model: { type: 'string' },
    thinkingLevel: { type: 'string' },
    serviceTier: { type: 'string' },
    allowedToolNames: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Tool allowlist for create.',
    },
    targetCwd: { type: 'string', description: 'Target cwd for fork.' },
    blockType: { type: 'string', description: 'Extension transcript block type.' },
    blockId: { type: 'string', description: 'Transcript block id for update_transcript_block.' },
    data: { description: 'Extension-owned transcript block data.' },
    openConversationIds: { type: 'array', items: { type: 'string' } },
    pinnedConversationIds: { type: 'array', items: { type: 'string' } },
    archivedConversationIds: { type: 'array', items: { type: 'string' } },
    activeConversationId: { type: 'string' },
    workspacePaths: { type: 'array', items: { type: 'string' } },
    remoteControlledConversationIds: { type: 'array', items: { type: 'string' } },
    operation: { type: 'string', enum: ['add', 'remove', 'pin', 'unpin', 'active', 'archive', 'unarchive'] },
    conversationIds: { type: 'array', items: { type: 'string' } },
    olderThanMs: { type: 'number', minimum: 1 },
    archivedOnly: { type: 'boolean' },
    dryRun: { type: 'boolean' },
    active: { type: 'boolean', description: 'Only include currently active conversation activity items.' },
    visibility: { type: 'string', enum: ['primary', 'system', 'hidden', 'visible', 'all'] },
    kind: { type: 'string', enum: ['activity', 'state', 'asset', 'context', 'integration', 'surface', 'all'] },
    surface: { type: 'string', enum: ['activityShelf', 'composerShelf', 'rightRail', 'workbench', 'sidebar', 'cli', 'all'] },
  },
} as const;

export const ConversationToolParams = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: [
        'ask',
        'activity',
        'connections',
        'inspect',
        'set_title',
        'change_working_directory',
        'deferred_resume',
        'create',
        'create_and_run',
        'ensure_live',
        'send_message',
        'run_turn',
        'abort',
        'compact',
        'fork',
        'set_active_tools',
        'workspace_get',
        'workspace_update',
        'workspace_open_update',
        'delete',
        'retention_prune',
        'append_transcript_block',
        'update_transcript_block',
        'rollback',
      ],
    },
    ...properties(AskUserQuestionToolParams),
    inspectAction,
    ...inspectProperties,
    ...properties(ConversationTitleToolParams),
    ...properties(ChangeWorkingDirectoryToolParams),
    ...deferredResumeProperties,
    ...properties(AdminConversationParams),
  },
  required: ['action'],
  additionalProperties: false,
} as const;

export const CONVERSATION_ACTIONS = [
  'ask',
  'activity',
  'connections',
  'inspect',
  'set_title',
  'change_working_directory',
  'deferred_resume',
  'create',
  'create_and_run',
  'ensure_live',
  'send_message',
  'run_turn',
  'abort',
  'compact',
  'fork',
  'set_active_tools',
  'workspace_get',
  'workspace_update',
  'workspace_open_update',
  'delete',
  'retention_prune',
  'append_transcript_block',
  'update_transcript_block',
  'rollback',
] as const;

export type ConversationAction = (typeof CONVERSATION_ACTIONS)[number];
