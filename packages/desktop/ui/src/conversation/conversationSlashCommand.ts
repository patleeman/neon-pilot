import { parseSlashInput } from '../commands/slashMenu';

export type ConversationSlashCommand =
  | { action: 'compact'; customInstructions?: string }
  | { action: 'export'; outputPath?: string }
  | { action: 'name'; name?: string }
  | { action: 'run'; command: string }
  | { action: 'search'; query: string }
  | { action: 'summarize' }
  | { action: 'think'; topic?: string }
  | { action: 'copy' };

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
    case '/name':
      return { kind: 'command', command: { action: 'name', ...(argument ? { name: argument } : {}) } };
    case '/run':
      return argument
        ? { kind: 'command', command: { action: 'run', command: argument } }
        : { kind: 'invalid', message: 'Usage: /run <command>' };
    case '/search':
      return argument
        ? { kind: 'command', command: { action: 'search', query: argument } }
        : { kind: 'invalid', message: 'Usage: /search <query>' };
    case '/summarize':
      return { kind: 'command', command: { action: 'summarize' } };
    case '/think':
      return { kind: 'command', command: { action: 'think', ...(argument ? { topic: argument } : {}) } };
    case '/copy':
      return argument ? { kind: 'invalid', message: 'Usage: /copy' } : { kind: 'command', command: { action: 'copy' } };
    default:
      return null;
  }
}

export function resolveConversationSlashCommandExecution(command: ConversationSlashCommand): ConversationSlashCommandExecution {
  switch (command.action) {
    case 'compact':
    case 'export':
    case 'name':
    case 'copy':
      return { kind: 'local' };
    case 'run':
      return { kind: 'send', text: `Run this shell command: ${command.command}` };
    case 'search':
      return { kind: 'send', text: `Search the web for: ${command.query}` };
    case 'summarize':
      return { kind: 'send', text: 'Summarize our conversation so far' };
    case 'think':
      return {
        kind: 'send',
        text: command.topic ? `Think step-by-step about: ${command.topic}` : 'Think step-by-step about the next step',
      };
  }
}
