import { describe, expect, it } from 'vitest';

import { parseConversationSlashCommand, resolveConversationSlashCommandExecution } from './conversationSlashCommand';

describe('parseConversationSlashCommand', () => {
  it('parses compact with optional custom instructions', () => {
    expect(parseConversationSlashCommand('/compact')).toEqual({
      kind: 'command',
      command: { action: 'compact' },
    });
    expect(parseConversationSlashCommand('/compact keep the project state')).toEqual({
      kind: 'command',
      command: { action: 'compact', customInstructions: 'keep the project state' },
    });
  });

  it('parses export and rename with optional arguments', () => {
    expect(parseConversationSlashCommand('/export')).toEqual({
      kind: 'command',
      command: { action: 'export' },
    });
    expect(parseConversationSlashCommand('/export /tmp/session.html')).toEqual({
      kind: 'command',
      command: { action: 'export', outputPath: '/tmp/session.html' },
    });
    expect(parseConversationSlashCommand('/rename')).toEqual({
      kind: 'command',
      command: { action: 'rename' },
    });
    expect(parseConversationSlashCommand('/rename Better title')).toEqual({
      kind: 'command',
      command: { action: 'rename', name: 'Better title' },
    });
  });

  it('parses slash commands that turn into agent prompts', () => {
    expect(parseConversationSlashCommand('/run git status')).toEqual({
      kind: 'command',
      command: { action: 'run', command: 'git status' },
    });
    expect(parseConversationSlashCommand('/search compaction bug')).toEqual({
      kind: 'command',
      command: { action: 'search', query: 'compaction bug' },
    });
    expect(parseConversationSlashCommand('/summarize')).toEqual({
      kind: 'command',
      command: { action: 'summarize' },
    });
    expect(parseConversationSlashCommand('/think next step')).toEqual({
      kind: 'command',
      command: { action: 'think', topic: 'next step' },
    });
  });

  it('returns usage errors for commands that require arguments or forbid them', () => {
    expect(parseConversationSlashCommand('/run')).toEqual({
      kind: 'invalid',
      message: 'Usage: /run <command>',
    });
    expect(parseConversationSlashCommand('/search')).toEqual({
      kind: 'invalid',
      message: 'Usage: /search <query>',
    });
    expect(parseConversationSlashCommand('/copy extra')).toEqual({
      kind: 'invalid',
      message: 'Usage: /copy',
    });
  });

  it('ignores slash commands that are handled elsewhere', () => {
    expect(parseConversationSlashCommand('/project')).toBeNull();
    expect(parseConversationSlashCommand('/resume 10m')).toBeNull();
  });

  it('parses thread-level local slash commands', () => {
    expect(parseConversationSlashCommand('/status')).toEqual({ kind: 'command', command: { action: 'status' } });
    expect(parseConversationSlashCommand('/queue clear')).toEqual({
      kind: 'command',
      command: { action: 'queue', subcommand: 'clear', argument: '' },
    });
    expect(parseConversationSlashCommand('/deferred_resume add 10m check logs')).toEqual({
      kind: 'command',
      command: { action: 'deferred_resume', subcommand: 'add', argument: '10m check logs' },
    });
    expect(parseConversationSlashCommand('/model set gpt-5.4')).toEqual({
      kind: 'command',
      command: { action: 'model', subcommand: 'set', argument: 'gpt-5.4' },
    });
    expect(parseConversationSlashCommand('/artifact open artifact-1')).toEqual({
      kind: 'command',
      command: { action: 'artifact', subcommand: 'open', argument: 'artifact-1' },
    });
    expect(parseConversationSlashCommand('/checkpoint list')).toEqual({
      kind: 'command',
      command: { action: 'checkpoint', subcommand: 'list', argument: '' },
    });
    expect(parseConversationSlashCommand('/background_command logs run-1')).toEqual({
      kind: 'command',
      command: { action: 'background_command', subcommand: 'logs', argument: 'run-1' },
    });
    expect(parseConversationSlashCommand('/context clear')).toEqual({
      kind: 'command',
      command: { action: 'context', subcommand: 'clear', argument: '' },
    });
    expect(parseConversationSlashCommand('/attach')).toEqual({ kind: 'command', command: { action: 'attach' } });
  });

  it('classifies every built-in command as local or prompt-sending work', () => {
    expect(resolveConversationSlashCommandExecution({ action: 'compact' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'export', outputPath: '/tmp/session.html' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'rename', name: 'Better title' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'copy' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'status' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'queue' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'artifact', subcommand: 'list' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'checkpoint', subcommand: 'open', argument: 'abc1234' })).toEqual({
      kind: 'local',
    });
    expect(resolveConversationSlashCommandExecution({ action: 'attach' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'run', command: 'git status' })).toEqual({
      kind: 'send',
      text: 'Run this shell command: git status',
    });
    expect(resolveConversationSlashCommandExecution({ action: 'search', query: 'compaction bug' })).toEqual({
      kind: 'send',
      text: 'Search the web for: compaction bug',
    });
    expect(resolveConversationSlashCommandExecution({ action: 'summarize' })).toEqual({
      kind: 'send',
      text: 'Summarize our conversation so far',
    });
    expect(resolveConversationSlashCommandExecution({ action: 'think', topic: 'next step' })).toEqual({
      kind: 'send',
      text: 'Think step-by-step about: next step',
    });
    expect(resolveConversationSlashCommandExecution({ action: 'think' })).toEqual({
      kind: 'send',
      text: 'Think step-by-step about the next step',
    });
  });
});
