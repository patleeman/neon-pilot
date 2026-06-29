import { parseStructuredSlashCommand } from '../commands/slashCommandSchema';
import { parseSlashInput } from '../commands/slashMenu';

export type ConversationSlashCommand =
  | { action: 'compact'; customInstructions?: string }
  | { action: 'export'; outputPath?: string }
  | { action: 'rename'; name?: string }
  | { action: 'run'; command: string }
  | { action: 'search'; query: string }
  | { action: 'fetch'; url: string }
  | { action: 'summarize' }
  | { action: 'think'; topic?: string }
  | { action: 'copy' }
  | { action: 'status' }
  | { action: 'heartbeat' }
  | { action: 'context_usage' }
  | { action: 'queue'; subcommand?: 'clear' | 'restore'; argument?: string }
  | { action: 'deferred_resume'; subcommand?: 'add' | 'fire' | 'cancel'; argument?: string }
  | { action: 'cwd'; subcommand?: 'set' | 'clear'; argument?: string }
  | { action: 'model'; subcommand?: 'set' | 'clear'; argument?: string }
  | { action: 'thinking_level'; subcommand?: 'set' | 'clear'; argument?: string }
  | { action: 'service_tier'; subcommand?: 'set' | 'clear'; argument?: string }
  | { action: 'goal'; subcommand?: 'set' | 'pause' | 'resume' | 'clear'; argument?: string }
  | { action: 'auto_mode'; subcommand?: 'set' | 'clear'; argument?: string }
  | { action: 'tools' }
  | { action: 'context'; subcommand?: 'list' | 'add' | 'remove' | 'clear'; argument?: string }
  | { action: 'artifact'; subcommand?: 'list' | 'open' | 'close'; argument?: string }
  | { action: 'checkpoint'; subcommand?: 'list' | 'open' | 'save'; argument?: string }
  | { action: 'background_command'; subcommand?: 'list' | 'start' | 'cancel' | 'rerun' | 'logs'; argument?: string }
  | { action: 'subagent'; subcommand?: 'list' | 'start' | 'cancel' | 'follow_up' | 'logs'; argument?: string }
  | { action: 'scheduled_task'; subcommand?: 'list' | 'add' | 'run' | 'pause' | 'resume' | 'delete'; argument?: string }
  | { action: 'mcp_tools'; subcommand?: 'refresh'; argument?: string }
  | { action: 'prompt_context'; subcommand?: 'refresh'; argument?: string }
  | { action: 'attach' | 'drawing' | 'dictation' }
  | { action: 'ephemeral'; title: string; text: string }
  | { action: 'prompt'; text: string };

type ConversationSlashParseResult = { kind: 'command'; command: ConversationSlashCommand } | { kind: 'invalid'; message: string };

export type ConversationSlashCommandExecution = { kind: 'local' } | { kind: 'send'; text: string };

export function parseConversationSlashCommand(input: string): ConversationSlashParseResult | null {
  const parsed = parseSlashInput(input.trim());
  if (!parsed) {
    return null;
  }

  const argument = parsed.argument.trim();

  switch (parsed.command) {
    case '/compact':
      return { kind: 'command', command: { action: 'compact', ...(argument ? { customInstructions: argument } : {}) } };
    case '/export':
      return { kind: 'command', command: { action: 'export', ...(argument ? { outputPath: argument } : {}) } };
    case '/rename':
      return { kind: 'command', command: { action: 'rename', ...(argument ? { name: argument } : {}) } };
    case '/run':
      return argument
        ? { kind: 'command', command: { action: 'run', command: argument } }
        : { kind: 'invalid', message: 'Usage: /run <command>' };
    case '/search':
      return argument
        ? { kind: 'command', command: { action: 'search', query: argument } }
        : { kind: 'invalid', message: 'Usage: /search <query>' };
    case '/fetch':
      return argument
        ? { kind: 'command', command: { action: 'fetch', url: argument } }
        : { kind: 'invalid', message: 'Usage: /fetch <url>' };
    case '/summarize':
      return { kind: 'command', command: { action: 'summarize' } };
    case '/think':
      return { kind: 'command', command: { action: 'think', ...(argument ? { topic: argument } : {}) } };
    case '/copy':
      return argument ? { kind: 'invalid', message: 'Usage: /copy' } : { kind: 'command', command: { action: 'copy' } };
    case '/status':
      return { kind: 'command', command: { action: 'status' } };
    case '/heartbeat':
      return { kind: 'command', command: { action: 'heartbeat' } };
    case '/context_usage':
      return { kind: 'command', command: { action: 'context_usage' } };
    case '/queue':
      return parseSubcommandSlash('queue', argument, ['clear', 'restore']);
    case '/deferred_resume':
      return parseSubcommandSlash('deferred_resume', argument, ['add', 'fire', 'cancel']);
    case '/cwd':
      return parseSubcommandSlash('cwd', argument, ['set', 'clear']);
    case '/model':
      return parseSubcommandSlash('model', argument, ['set', 'clear']);
    case '/thinking_level':
      return parseSubcommandSlash('thinking_level', argument, ['set', 'clear']);
    case '/service_tier':
      return parseSubcommandSlash('service_tier', argument, ['set', 'clear']);
    case '/goal':
      return parseSubcommandSlash('goal', argument, ['set', 'pause', 'resume', 'clear']);
    case '/auto_mode':
      return parseSubcommandSlash('auto_mode', argument, ['set', 'clear']);
    case '/tools':
      return argument ? { kind: 'invalid', message: 'Usage: /tools' } : { kind: 'command', command: { action: 'tools' } };
    case '/context':
      return parseSubcommandSlash('context', argument, ['list', 'add', 'remove', 'clear']);
    case '/artifact':
      return parseSubcommandSlash('artifact', argument, ['list', 'open', 'close']);
    case '/checkpoint':
      return parseSubcommandSlash('checkpoint', argument, ['save', 'list', 'open']);
    case '/background_command':
      return parseSubcommandSlash('background_command', argument, ['list', 'start', 'cancel', 'rerun', 'logs']);
    case '/subagent':
      return parseSubcommandSlash('subagent', argument, ['list', 'start', 'cancel', 'follow_up', 'logs']);
    case '/scheduled_task':
      return parseSubcommandSlash('scheduled_task', argument, ['list', 'add', 'run', 'pause', 'resume', 'delete']);
    case '/mcp_tools':
      return parseSubcommandSlash('mcp_tools', argument, ['refresh']);
    case '/prompt_context':
      return parseSubcommandSlash('prompt_context', argument, ['refresh']);
    case '/attach':
      return argument ? { kind: 'invalid', message: 'Usage: /attach' } : { kind: 'command', command: { action: 'attach' } };
    case '/drawing':
      return argument ? { kind: 'invalid', message: 'Usage: /drawing' } : { kind: 'command', command: { action: 'drawing' } };
    case '/dictation':
      return argument ? { kind: 'invalid', message: 'Usage: /dictation' } : { kind: 'command', command: { action: 'dictation' } };
    case '/visualize':
    case '/diff_review':
    case '/plan_review':
    case '/project_recap':
    case '/slides':
    case '/diff_summary':
    case '/probe_image':
    case '/skill_search':
      return argument
        ? { kind: 'command', command: { action: 'prompt', text: promptTextForSlash(parsed.command, argument) } }
        : { kind: 'invalid', message: `Usage: ${parsed.command} <text>` };
    default:
      return parseGenericStructuredSlash(input);
  }
}

function parseGenericStructuredSlash(input: string): ConversationSlashParseResult | null {
  const structured = parseStructuredSlashCommand(input);
  if (!structured?.command) return null;
  const subject = structured.subcommand ?? structured.command;
  const executionClass = subject.executionClass ?? structured.command.executionClass;
  if (executionClass === 'prompt') {
    return { kind: 'command', command: { action: 'prompt', text: promptTextForStructuredSlash(structured.raw) } };
  }
  if (executionClass === 'ephemeral') {
    return {
      kind: 'command',
      command: {
        action: 'ephemeral',
        title: `/${structured.command.name}`,
        text: `${subject.description}\n\nNo detailed local view is available for this command yet.`,
      },
    };
  }
  return {
    kind: 'command',
    command: {
      action: 'prompt',
      text: promptTextForStructuredSlash(structured.raw),
    },
  };
}

function promptTextForStructuredSlash(raw: string): string {
  const normalized = raw.replace(/^\//, '').trim();
  return `Handle this thread-level command: ${normalized}`;
}

function parseSubcommandSlash(
  action: Extract<
    ConversationSlashCommand['action'],
    | 'queue'
    | 'deferred_resume'
    | 'cwd'
    | 'model'
    | 'thinking_level'
    | 'service_tier'
    | 'goal'
    | 'auto_mode'
    | 'context'
    | 'artifact'
    | 'checkpoint'
    | 'background_command'
    | 'subagent'
    | 'scheduled_task'
    | 'mcp_tools'
    | 'prompt_context'
  >,
  argument: string,
  subcommands: string[],
): ConversationSlashParseResult {
  const [subcommandToken = '', ...rest] = argument.split(/\s+/).filter(Boolean);
  if (!subcommandToken) {
    return { kind: 'command', command: { action } as ConversationSlashCommand };
  }
  if (!subcommands.includes(subcommandToken)) {
    return { kind: 'invalid', message: `Unknown subcommand "${subcommandToken}" for /${action}.` };
  }
  return {
    kind: 'command',
    command: { action, subcommand: subcommandToken, argument: rest.join(' ') } as ConversationSlashCommand,
  };
}

function promptTextForSlash(command: string, argument: string): string {
  switch (command) {
    case '/visualize':
      return `Create a visual explainer artifact about: ${argument}`;
    case '/diff_review':
      return `Create a visual diff review artifact for: ${argument || 'the current workspace changes'}`;
    case '/plan_review':
      return `Create a visual plan review artifact for: ${argument}`;
    case '/project_recap':
      return `Create a visual project recap artifact for: ${argument || 'the current project'}`;
    case '/slides':
      return `Create a slide deck artifact about: ${argument}`;
    case '/diff_summary':
      return `Summarize the current workspace diff${argument ? ` with focus on: ${argument}` : ''}.`;
    case '/probe_image':
      return `Inspect the attached image(s) and answer: ${argument}`;
    case '/skill_search':
      return `Search for a skill matching: ${argument}`;
    default:
      return argument;
  }
}

export function resolveConversationSlashCommandExecution(command: ConversationSlashCommand): ConversationSlashCommandExecution {
  switch (command.action) {
    case 'compact':
    case 'export':
    case 'rename':
    case 'copy':
    case 'status':
    case 'heartbeat':
    case 'context_usage':
    case 'queue':
    case 'deferred_resume':
    case 'cwd':
    case 'model':
    case 'thinking_level':
    case 'service_tier':
    case 'goal':
    case 'auto_mode':
    case 'tools':
    case 'context':
    case 'artifact':
    case 'checkpoint':
    case 'background_command':
    case 'subagent':
    case 'scheduled_task':
    case 'mcp_tools':
    case 'prompt_context':
    case 'attach':
    case 'drawing':
    case 'dictation':
    case 'ephemeral':
      return { kind: 'local' };
    case 'run':
      return { kind: 'send', text: `Run this shell command: ${command.command}` };
    case 'search':
      return { kind: 'send', text: `Search the web for: ${command.query}` };
    case 'fetch':
      return { kind: 'send', text: `Fetch and read this URL: ${command.url}` };
    case 'summarize':
      return { kind: 'send', text: 'Summarize our conversation so far' };
    case 'think':
      return {
        kind: 'send',
        text: command.topic ? `Think step-by-step about: ${command.topic}` : 'Think step-by-step about the next step',
      };
    case 'prompt':
      return { kind: 'send', text: command.text };
  }
}
