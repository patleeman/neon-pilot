import { describe, expect, it } from 'vitest';

import { parseTelegramGatewayCommand } from './telegramCommands.js';

describe('parseTelegramGatewayCommand', () => {
  it('parses supported commands and bot mentions', () => {
    expect(parseTelegramGatewayCommand('/start')).toEqual({ kind: 'start' });
    expect(parseTelegramGatewayCommand('/pause@my_bot')).toEqual({ kind: 'stop' });
    expect(parseTelegramGatewayCommand('/model gpt-5.5')).toEqual({ kind: 'model', model: 'gpt-5.5' });
    expect(parseTelegramGatewayCommand('/commands')).toEqual({ kind: 'help' });
    expect(parseTelegramGatewayCommand('/whoami')).toEqual({ kind: 'whoami' });
    expect(parseTelegramGatewayCommand('/reset')).toEqual({ kind: 'new' });
    expect(parseTelegramGatewayCommand('/threads')).toEqual({ kind: 'threads' });
    expect(parseTelegramGatewayCommand('/threads deploy')).toEqual({ kind: 'threads', query: 'deploy' });
    expect(parseTelegramGatewayCommand('/archives build')).toEqual({ kind: 'archives', query: 'build' });
    expect(parseTelegramGatewayCommand('/archived')).toEqual({ kind: 'archives' });
    expect(parseTelegramGatewayCommand('/peek')).toEqual({ kind: 'peek' });
    expect(parseTelegramGatewayCommand('/peek 2')).toEqual({ kind: 'peek', target: '2' });
    expect(parseTelegramGatewayCommand('/tail 10')).toEqual({ kind: 'tail', count: 10 });
    expect(parseTelegramGatewayCommand('/transcript 20')).toEqual({ kind: 'transcript', count: 20 });
    expect(parseTelegramGatewayCommand('/export')).toEqual({ kind: 'export' });
    expect(parseTelegramGatewayCommand('/summary 12')).toEqual({ kind: 'summary', count: 12 });
    expect(parseTelegramGatewayCommand('/switch 2')).toEqual({ kind: 'switch', target: '2' });
    expect(parseTelegramGatewayCommand('/resume Project planning')).toEqual({ kind: 'switch', target: 'Project planning' });
    expect(parseTelegramGatewayCommand('/resume')).toEqual({ kind: 'resume' });
    expect(parseTelegramGatewayCommand('/cancel')).toEqual({ kind: 'cancel' });
    expect(parseTelegramGatewayCommand('/mirror notify')).toEqual({ kind: 'mirror', mode: 'notify_only' });
    expect(parseTelegramGatewayCommand('/mute')).toEqual({ kind: 'mirror', mode: 'muted' });
    expect(parseTelegramGatewayCommand('/unmute')).toEqual({ kind: 'mirror', mode: 'mirror_all' });
    expect(parseTelegramGatewayCommand('/pins')).toEqual({ kind: 'pins' });
    expect(parseTelegramGatewayCommand('/pin 2')).toEqual({ kind: 'pin', target: '2' });
    expect(parseTelegramGatewayCommand('/unpin 2')).toEqual({ kind: 'unpin', target: '2' });
    expect(parseTelegramGatewayCommand('/diagnostics')).toEqual({ kind: 'diagnostics' });
    expect(parseTelegramGatewayCommand('/defaults')).toEqual({ kind: 'defaults' });
    expect(parseTelegramGatewayCommand('/defaultmodel gpt-5.5')).toEqual({ kind: 'default_model', model: 'gpt-5.5' });
    expect(parseTelegramGatewayCommand('/defaultmodel clear')).toEqual({ kind: 'default_model', model: null });
    expect(parseTelegramGatewayCommand('/defaultcwd /repo')).toEqual({ kind: 'default_cwd', cwd: '/repo' });
    expect(parseTelegramGatewayCommand('/title')).toEqual({ kind: 'title' });
    expect(parseTelegramGatewayCommand('/title Daily agent')).toEqual({ kind: 'rename', title: 'Daily agent' });
    expect(parseTelegramGatewayCommand('/rename Daily agent')).toEqual({ kind: 'rename', title: 'Daily agent' });
  });

  it('rejects unknown or incomplete commands', () => {
    expect(parseTelegramGatewayCommand('hello')).toBeNull();
    expect(parseTelegramGatewayCommand('/wat')).toBeNull();
    expect(parseTelegramGatewayCommand('/rename')).toBeNull();
  });
});
