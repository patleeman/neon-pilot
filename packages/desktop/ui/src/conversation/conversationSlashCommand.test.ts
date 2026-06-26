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

  it('parses export and name with optional arguments', () => {
    expect(parseConversationSlashCommand('/export')).toEqual({
      kind: 'command',
      command: { action: 'export' },
    });
    expect(parseConversationSlashCommand('/export /tmp/session.html')).toEqual({
      kind: 'command',
      command: { action: 'export', outputPath: '/tmp/session.html' },
    });
    expect(parseConversationSlashCommand('/name')).toEqual({
      kind: 'command',
      command: { action: 'name' },
    });
    expect(parseConversationSlashCommand('/name Better title')).toEqual({
      kind: 'command',
      command: { action: 'name', name: 'Better title' },
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
    expect(parseConversationSlashCommand('/model')).toBeNull();
  });

  it('classifies every built-in command as local or prompt-sending work', () => {
    expect(resolveConversationSlashCommandExecution({ action: 'compact' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'export', outputPath: '/tmp/session.html' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'name', name: 'Better title' })).toEqual({ kind: 'local' });
    expect(resolveConversationSlashCommandExecution({ action: 'copy' })).toEqual({ kind: 'local' });
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
