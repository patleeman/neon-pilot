import type { ModelInfo, SessionContextUsage } from '../shared/types';

export type SlashCommandExecutionClass = 'action' | 'prompt' | 'ephemeral';
export type SlashCommandOwner =
  | 'core'
  | 'system-model-picker'
  | 'system-auto-mode'
  | 'system-automations'
  | 'system-runs'
  | 'system-todo'
  | 'system-artifacts'
  | 'system-diffs'
  | 'system-composer-attachments'
  | 'system-image-probe'
  | 'system-video-probe'
  | 'system-mcp'
  | 'system-skill-search'
  | 'system-prompt-assembly'
  | 'system-web-tools';

export interface SlashCommandDefinition {
  name: string;
  owner: SlashCommandOwner;
  description: string;
  executionClass: SlashCommandExecutionClass;
  subcommands?: SlashSubcommandDefinition[];
  argument?: SlashArgumentDefinition;
  requiresConversation?: boolean;
}

export interface SlashSubcommandDefinition {
  name: string;
  description: string;
  executionClass?: SlashCommandExecutionClass;
  argument?: SlashArgumentDefinition;
  requiresConversation?: boolean;
}

export type SlashArgumentDefinition =
  | { kind: 'freeform'; name: string; required?: boolean; placeholder?: string }
  | { kind: 'enum'; name: string; required?: boolean; values: string[]; placeholder?: string }
  | { kind: 'dynamic'; name: string; required?: boolean; source: SlashDynamicSuggestionSource; placeholder?: string };

export type SlashDynamicSuggestionSource =
  | 'models'
  | 'tools'
  | 'queuedPrompts'
  | 'deferredResumes'
  | 'artifacts'
  | 'checkpoints'
  | 'subagents'
  | 'backgroundCommands'
  | 'scheduledTasks'
  | 'skills'
  | 'videos';

export interface SlashCommandSuggestionContext {
  models?: ModelInfo[];
  activeTools?: string[];
  queuedPromptIds?: string[];
  deferredResumeIds?: string[];
  artifactIds?: string[];
  checkpointIds?: string[];
  subagentIds?: string[];
  backgroundCommandIds?: string[];
  scheduledTaskIds?: string[];
  skillNames?: string[];
  videoIds?: string[];
}

export interface SlashCommandValidationContext extends SlashCommandSuggestionContext {
  hasConversation?: boolean;
  isStreaming?: boolean;
  hasQueuedPrompts?: boolean;
  hasDeferredResumes?: boolean;
  contextUsage?: SessionContextUsage | null;
}

export interface ParsedStructuredSlashCommand {
  raw: string;
  commandName: string;
  command?: SlashCommandDefinition;
  subcommandName?: string;
  subcommand?: SlashSubcommandDefinition;
  argument: string;
  tokenCount: number;
}

export interface SlashCommandValidationResult {
  ok: boolean;
  message?: string;
}

export const THINKING_LEVEL_VALUES = ['minimal', 'low', 'medium', 'high', 'xhigh'];
export const SERVICE_TIER_VALUES = ['auto', 'priority'];
export const AUTO_MODE_VALUES = ['manual', 'nudge', 'mission', 'loop'];

export const STRUCTURED_SLASH_COMMANDS: SlashCommandDefinition[] = [
  { name: 'status', owner: 'core', description: 'Show current thread state.', executionClass: 'ephemeral' },
  { name: 'heartbeat', owner: 'core', description: 'Show a lightweight thread health heartbeat.', executionClass: 'ephemeral' },
  {
    name: 'stop',
    owner: 'core',
    description: 'Stop the current foreground agent turn.',
    executionClass: 'action',
    requiresConversation: true,
  },
  {
    name: 'continue',
    owner: 'core',
    description: 'Continue or resume this conversation.',
    executionClass: 'action',
    requiresConversation: true,
  },
  {
    name: 'compact',
    owner: 'core',
    description: 'Compact current conversation context.',
    executionClass: 'action',
    requiresConversation: true,
    argument: { kind: 'freeform', name: 'guidance', placeholder: 'optional guidance' },
  },
  {
    name: 'summarize',
    owner: 'core',
    description: 'Ask the agent to summarize this conversation.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'focus', placeholder: 'optional focus' },
  },
  {
    name: 'rename',
    owner: 'core',
    description: 'Rename this conversation.',
    executionClass: 'action',
    requiresConversation: true,
    argument: { kind: 'freeform', name: 'title', required: true, placeholder: 'title' },
  },
  {
    name: 'export',
    owner: 'core',
    description: 'Export this conversation.',
    executionClass: 'action',
    requiresConversation: true,
    argument: { kind: 'freeform', name: 'path', placeholder: 'optional path' },
  },
  { name: 'copy', owner: 'core', description: 'Copy the last assistant response.', executionClass: 'action' },
  {
    name: 'queue',
    owner: 'core',
    description: 'Show queued follow-ups.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'clear', description: 'Clear queued follow-ups.', executionClass: 'action', requiresConversation: true },
      {
        name: 'restore',
        description: 'Restore a queued follow-up into the composer.',
        executionClass: 'action',
        requiresConversation: true,
      },
    ],
  },
  {
    name: 'deferred_resume',
    owner: 'core',
    description: 'Manage scheduled continuations for this conversation.',
    executionClass: 'ephemeral',
    requiresConversation: true,
    subcommands: [
      {
        name: 'add',
        description: 'Schedule a deferred resume.',
        executionClass: 'action',
        requiresConversation: true,
        argument: { kind: 'freeform', name: 'delay and prompt', required: true, placeholder: '10m check the build' },
      },
      {
        name: 'fire',
        description: 'Fire a deferred resume now.',
        executionClass: 'action',
        requiresConversation: true,
        argument: { kind: 'dynamic', name: 'id', source: 'deferredResumes', required: true, placeholder: 'id or first' },
      },
      {
        name: 'cancel',
        description: 'Cancel deferred resume work.',
        executionClass: 'action',
        requiresConversation: true,
        argument: { kind: 'dynamic', name: 'id', source: 'deferredResumes', required: true, placeholder: 'id, first, or all' },
      },
    ],
  },
  {
    name: 'cwd',
    owner: 'core',
    description: 'Show or change this thread working directory.',
    executionClass: 'ephemeral',
    subcommands: [
      {
        name: 'set',
        description: 'Set this thread working directory.',
        executionClass: 'action',
        requiresConversation: true,
        argument: { kind: 'freeform', name: 'path', required: true, placeholder: 'path' },
      },
      { name: 'clear', description: 'Clear the explicit working directory.', executionClass: 'action', requiresConversation: true },
    ],
  },
  {
    name: 'tools',
    owner: 'core',
    description: 'Show active tools for this thread.',
    executionClass: 'ephemeral',
  },
  {
    name: 'context',
    owner: 'core',
    description: 'Show attached context for this thread.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'list', description: 'List attached context.' },
      { name: 'add', description: 'Attach context.', argument: { kind: 'freeform', name: 'path or reference', required: true } },
      { name: 'remove', description: 'Remove attached context.', argument: { kind: 'freeform', name: 'id', required: true } },
      { name: 'clear', description: 'Clear attached context.' },
    ],
  },
  { name: 'context_usage', owner: 'core', description: 'Show context usage for this thread.', executionClass: 'ephemeral' },
  { name: 'fork', owner: 'core', description: 'Fork this thread.', executionClass: 'action', requiresConversation: true },
  { name: 'duplicate', owner: 'core', description: 'Duplicate this thread.', executionClass: 'action', requiresConversation: true },
  { name: 'pin', owner: 'core', description: 'Pin or unpin this thread.', executionClass: 'action', requiresConversation: true },
  { name: 'lock', owner: 'core', description: 'Lock or unlock this thread.', executionClass: 'action', requiresConversation: true },
  { name: 'archive', owner: 'core', description: 'Archive this thread.', executionClass: 'action', requiresConversation: true },
  {
    name: 'model',
    owner: 'system-model-picker',
    description: 'Show or change this thread model.',
    executionClass: 'ephemeral',
    subcommands: [
      {
        name: 'set',
        description: 'Set thread model.',
        executionClass: 'action',
        argument: { kind: 'dynamic', name: 'model', source: 'models', required: true },
      },
      { name: 'clear', description: 'Use the default model.', executionClass: 'action' },
    ],
  },
  {
    name: 'thinking_level',
    owner: 'system-model-picker',
    description: 'Show or change thinking level.',
    executionClass: 'ephemeral',
    subcommands: [
      {
        name: 'set',
        description: 'Set thinking level.',
        executionClass: 'action',
        argument: { kind: 'enum', name: 'level', values: THINKING_LEVEL_VALUES, required: true },
      },
      { name: 'clear', description: 'Use the default thinking level.', executionClass: 'action' },
    ],
  },
  {
    name: 'service_tier',
    owner: 'system-model-picker',
    description: 'Show or change service tier.',
    executionClass: 'ephemeral',
    subcommands: [
      {
        name: 'set',
        description: 'Set service tier.',
        executionClass: 'action',
        argument: { kind: 'enum', name: 'tier', values: SERVICE_TIER_VALUES, required: true },
      },
      { name: 'clear', description: 'Use the default service tier.', executionClass: 'action' },
    ],
  },
  {
    name: 'goal',
    owner: 'system-auto-mode',
    description: 'Show or manage this conversation goal.',
    executionClass: 'ephemeral',
    subcommands: [
      {
        name: 'set',
        description: 'Set the current goal.',
        executionClass: 'action',
        argument: { kind: 'freeform', name: 'objective', required: true },
      },
      { name: 'pause', description: 'Pause the current goal.', executionClass: 'action' },
      { name: 'resume', description: 'Resume the current goal.', executionClass: 'action' },
      { name: 'clear', description: 'Clear the current goal.', executionClass: 'action' },
    ],
  },
  {
    name: 'auto_mode',
    owner: 'system-auto-mode',
    description: 'Show or change automatic continuation mode.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'set', description: 'Set auto mode.', argument: { kind: 'enum', name: 'mode', values: AUTO_MODE_VALUES, required: true } },
      { name: 'clear', description: 'Return to manual mode.' },
    ],
  },
  {
    name: 'mission',
    owner: 'system-auto-mode',
    description: 'Manage mission mode.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'start', description: 'Start mission mode.', argument: { kind: 'freeform', name: 'goal', required: true } },
      { name: 'stop', description: 'Stop mission mode.' },
    ],
  },
  {
    name: 'loop',
    owner: 'system-auto-mode',
    description: 'Manage loop mode.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'start', description: 'Start loop mode.', argument: { kind: 'freeform', name: 'count and prompt', required: true } },
      { name: 'stop', description: 'Stop loop mode.' },
    ],
  },
  {
    name: 'scheduled_task',
    owner: 'system-automations',
    description: 'Manage scheduled tasks owned by this thread.',
    executionClass: 'ephemeral',
    subcommands: ['list', 'add', 'run', 'pause', 'resume', 'delete'].map((name) => ({
      name,
      description: `${name.charAt(0).toUpperCase()}${name.slice(1)} a scheduled task.`,
      argument:
        name === 'list'
          ? undefined
          : { kind: 'dynamic' as const, name: 'task', source: 'scheduledTasks' as const, required: name !== 'add' },
    })),
  },
  {
    name: 'background_command',
    owner: 'system-runs',
    description: 'Manage thread background commands.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'list', description: 'List background commands.' },
      {
        name: 'start',
        description: 'Start a durable background shell command.',
        executionClass: 'prompt',
        argument: { kind: 'freeform', name: 'shell command', required: true },
      },
      {
        name: 'cancel',
        description: 'Cancel a background command.',
        argument: { kind: 'dynamic', name: 'id', source: 'backgroundCommands', required: true },
      },
      {
        name: 'rerun',
        description: 'Rerun a background command.',
        argument: { kind: 'dynamic', name: 'id', source: 'backgroundCommands', required: true },
      },
      {
        name: 'logs',
        description: 'Show background command logs.',
        argument: { kind: 'dynamic', name: 'id', source: 'backgroundCommands', required: true },
      },
    ],
  },
  {
    name: 'subagent',
    owner: 'system-runs',
    description: 'Manage thread-linked subagents.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'list', description: 'List subagents.' },
      {
        name: 'start',
        description: 'Start a subagent.',
        executionClass: 'prompt',
        argument: { kind: 'freeform', name: 'objective', required: true },
      },
      { name: 'cancel', description: 'Cancel a subagent.', argument: { kind: 'dynamic', name: 'id', source: 'subagents', required: true } },
      {
        name: 'follow_up',
        description: 'Send a follow-up to a subagent.',
        argument: { kind: 'dynamic', name: 'id', source: 'subagents', required: true },
      },
      { name: 'logs', description: 'Show subagent logs.', argument: { kind: 'dynamic', name: 'id', source: 'subagents', required: true } },
    ],
  },
  {
    name: 'todo',
    owner: 'system-todo',
    description: 'Manage conversation todos.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'add', description: 'Add a todo.', argument: { kind: 'freeform', name: 'item', required: true } },
      { name: 'done', description: 'Mark a todo done.', argument: { kind: 'freeform', name: 'id or number', required: true } },
      { name: 'update', description: 'Update a todo.', argument: { kind: 'freeform', name: 'id and text', required: true } },
      { name: 'delete', description: 'Delete a todo.', argument: { kind: 'freeform', name: 'id or number', required: true } },
      { name: 'clear', description: 'Clear todos.' },
    ],
  },
  {
    name: 'artifact',
    owner: 'system-artifacts',
    description: 'Show or open artifacts in this thread.',
    executionClass: 'ephemeral',
    subcommands: [
      { name: 'list', description: 'List artifacts.' },
      { name: 'open', description: 'Open an artifact.', argument: { kind: 'dynamic', name: 'id', source: 'artifacts', required: true } },
      { name: 'close', description: 'Close the active artifact.' },
    ],
  },
  {
    name: 'visualize',
    owner: 'system-artifacts',
    description: 'Create a visual explainer artifact.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'topic', required: true },
  },
  {
    name: 'diff_review',
    owner: 'system-artifacts',
    description: 'Create a visual diff review artifact.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'scope' },
  },
  {
    name: 'plan_review',
    owner: 'system-artifacts',
    description: 'Create a visual plan review artifact.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'plan or scope', required: true },
  },
  {
    name: 'project_recap',
    owner: 'system-artifacts',
    description: 'Create a visual project recap artifact.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'scope' },
  },
  {
    name: 'slides',
    owner: 'system-artifacts',
    description: 'Create a slide deck artifact.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'topic or source', required: true },
  },
  {
    name: 'checkpoint',
    owner: 'system-diffs',
    description: 'Manage code checkpoints for this thread.',
    executionClass: 'ephemeral',
    subcommands: [
      {
        name: 'save',
        description: 'Save a checkpoint.',
        executionClass: 'prompt',
        argument: { kind: 'freeform', name: 'message', required: true },
      },
      { name: 'list', description: 'List checkpoints.' },
      { name: 'open', description: 'Open a checkpoint.', argument: { kind: 'dynamic', name: 'id', source: 'checkpoints', required: true } },
    ],
  },
  { name: 'diff_summary', owner: 'system-diffs', description: 'Summarize current workspace diff.', executionClass: 'prompt' },
  { name: 'attach', owner: 'system-composer-attachments', description: 'Open the attachment picker.', executionClass: 'action' },
  { name: 'drawing', owner: 'system-composer-attachments', description: 'Open the drawing tool.', executionClass: 'action' },
  { name: 'dictation', owner: 'system-composer-attachments', description: 'Toggle dictation into the composer.', executionClass: 'action' },
  {
    name: 'probe_image',
    owner: 'system-image-probe',
    description: 'Ask about attached images.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'question', required: true },
  },
  {
    name: 'video',
    owner: 'system-video-probe',
    description: 'Inspect attached video.',
    executionClass: 'ephemeral',
    subcommands: [
      {
        name: 'sample',
        description: 'Sample frames from a video.',
        executionClass: 'prompt',
        argument: { kind: 'dynamic', name: 'video id', source: 'videos' },
      },
      {
        name: 'transcribe',
        description: 'Transcribe a video.',
        executionClass: 'prompt',
        argument: { kind: 'dynamic', name: 'video id', source: 'videos' },
      },
    ],
  },
  {
    name: 'mcp_tools',
    owner: 'system-mcp',
    description: 'Show MCP tools available to this thread.',
    executionClass: 'ephemeral',
    subcommands: [{ name: 'refresh', description: 'Refresh MCP tool config.' }],
  },
  {
    name: 'skill_search',
    owner: 'system-skill-search',
    description: 'Search available skills.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'query', required: true },
  },
  {
    name: 'skill',
    owner: 'system-skill-search',
    description: 'Use a skill.',
    executionClass: 'prompt',
    subcommands: [
      { name: 'use', description: 'Use a skill.', argument: { kind: 'dynamic', name: 'name', source: 'skills', required: true } },
    ],
  },
  {
    name: 'prompt_context',
    owner: 'system-prompt-assembly',
    description: 'Show assembled prompt context.',
    executionClass: 'ephemeral',
    subcommands: [{ name: 'refresh', description: 'Refresh prompt context.' }],
  },
  {
    name: 'search',
    owner: 'system-web-tools',
    description: 'Search the web.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'query', required: true },
  },
  {
    name: 'fetch',
    owner: 'system-web-tools',
    description: 'Fetch and read a URL.',
    executionClass: 'prompt',
    argument: { kind: 'freeform', name: 'url', required: true },
  },
];

const COMMAND_BY_NAME = new Map(STRUCTURED_SLASH_COMMANDS.map((command) => [command.name, command]));

export function findStructuredSlashCommand(name: string): SlashCommandDefinition | undefined {
  return COMMAND_BY_NAME.get(name.replace(/^\//, ''));
}

export function parseStructuredSlashCommand(input: string): ParsedStructuredSlashCommand | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('/')) return null;
  const withoutSlash = trimmed.slice(1);
  const commandMatch = /^([^\s]*)/.exec(withoutSlash);
  const commandName = commandMatch?.[1] ?? '';
  const command = findStructuredSlashCommand(commandName);
  const rest = withoutSlash.slice(commandName.length);
  const restWithoutLeading = rest.trimStart();
  const tokenMatch = /^([^\s]+)/.exec(restWithoutLeading);
  const token = tokenMatch?.[1] ?? '';
  const subcommand = command?.subcommands?.find((candidate) => candidate.name === token);
  const hasSubcommandToken = Boolean(token && command?.subcommands?.some((candidate) => candidate.name === token));
  const argument = hasSubcommandToken ? restWithoutLeading.slice(token.length).trimStart() : restWithoutLeading;
  return {
    raw: trimmed,
    commandName,
    command,
    subcommandName: hasSubcommandToken ? token : token || undefined,
    subcommand,
    argument,
    tokenCount: withoutSlash.trim() ? withoutSlash.trim().split(/\s+/).length : 0,
  };
}

function dynamicSuggestionValues(source: SlashDynamicSuggestionSource, context: SlashCommandSuggestionContext): string[] {
  switch (source) {
    case 'models':
      return (context.models ?? []).map((model) => model.id);
    case 'tools':
      return context.activeTools ?? [];
    case 'queuedPrompts':
      return ['first', ...(context.queuedPromptIds ?? [])];
    case 'deferredResumes':
      return ['first', 'all', ...(context.deferredResumeIds ?? [])];
    case 'artifacts':
      return context.artifactIds ?? [];
    case 'checkpoints':
      return ['latest', ...(context.checkpointIds ?? [])];
    case 'subagents':
      return ['latest', ...(context.subagentIds ?? [])];
    case 'backgroundCommands':
      return ['latest', ...(context.backgroundCommandIds ?? [])];
    case 'scheduledTasks':
      return context.scheduledTaskIds ?? [];
    case 'skills':
      return context.skillNames ?? [];
    case 'videos':
      return context.videoIds ?? [];
  }
}

export function valuesForSlashArgument(argument: SlashArgumentDefinition | undefined, context: SlashCommandSuggestionContext): string[] {
  if (!argument) return [];
  if (argument.kind === 'enum') return argument.values;
  if (argument.kind === 'dynamic') return dynamicSuggestionValues(argument.source, context);
  return [];
}

export function validateStructuredSlashCommand(input: string, context: SlashCommandValidationContext = {}): SlashCommandValidationResult {
  const parsed = parseStructuredSlashCommand(input);
  if (!parsed) return { ok: true };
  const { command } = parsed;
  if (!command) {
    if (STRUCTURED_SLASH_COMMANDS.some((candidate) => candidate.name.startsWith(parsed.commandName))) {
      return { ok: true };
    }
    return { ok: false, message: `Unknown command "/${parsed.commandName}".` };
  }

  const subject = parsed.subcommand ?? command;
  if ((subject.requiresConversation ?? command.requiresConversation) && context.hasConversation === false) {
    return { ok: false, message: 'This command needs a saved conversation.' };
  }

  if (command.subcommands?.length) {
    const rest = parsed.raw.slice(parsed.commandName.length + 1).trimStart();
    if (!rest) {
      return { ok: true };
    }
    const firstToken = rest.split(/\s+/)[0] ?? '';
    if (!parsed.subcommand && firstToken) {
      const suggestion = command.subcommands.find((candidate) => candidate.name.startsWith(firstToken));
      if (suggestion) {
        return { ok: true };
      }
      return {
        ok: false,
        message: `Unknown subcommand "${firstToken}" for /${command.name}.`,
      };
    }
  }

  const argument = parsed.subcommand?.argument ?? (!command.subcommands ? command.argument : undefined);
  if (argument?.required && parsed.argument.trim().length === 0) {
    return { ok: false, message: `Missing ${argument.name}.` };
  }
  if ((argument?.kind === 'enum' || argument?.kind === 'dynamic') && parsed.argument.trim()) {
    const values = valuesForSlashArgument(argument, context);
    const argumentToken = parsed.argument.trim().split(/\s+/)[0] ?? '';
    if (values.length > 0 && !values.includes(argumentToken)) {
      return { ok: false, message: `Choose ${argument.name} from the suggestion list.` };
    }
  }
  if (command.name === 'stop' && context.isStreaming === false) {
    return { ok: false, message: 'There is no running response to stop.' };
  }
  if (command.name === 'queue' && parsed.subcommand?.name === 'restore' && context.hasQueuedPrompts === false) {
    return { ok: false, message: 'There are no queued follow-ups to restore.' };
  }
  if (
    command.name === 'deferred_resume' &&
    ['fire', 'cancel'].includes(parsed.subcommand?.name ?? '') &&
    context.hasDeferredResumes === false
  ) {
    return { ok: false, message: 'There are no deferred resumes for this conversation.' };
  }
  return { ok: true };
}
