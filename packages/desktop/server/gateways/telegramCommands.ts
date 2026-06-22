export type TelegramGatewayCommand =
  | { kind: 'start' }
  | { kind: 'help' }
  | { kind: 'status' }
  | { kind: 'whoami' }
  | { kind: 'stop' }
  | { kind: 'resume' }
  | { kind: 'new' }
  | { kind: 'threads' }
  | { kind: 'switch'; target?: string }
  | { kind: 'attach' }
  | { kind: 'detach' }
  | { kind: 'model'; model?: string }
  | { kind: 'compact' }
  | { kind: 'title' }
  | { kind: 'rename'; title: string }
  | { kind: 'archive' };

export function parseTelegramGatewayCommand(text: string): TelegramGatewayCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [rawCommand = '', ...rest] = trimmed.split(/\s+/);
  const command = rawCommand.split('@')[0]?.toLowerCase();
  const arg = rest.join(' ').trim();

  switch (command) {
    case '/start':
      return { kind: 'start' };
    case '/help':
    case '/commands':
      return { kind: 'help' };
    case '/status':
      return { kind: 'status' };
    case '/whoami':
      return { kind: 'whoami' };
    case '/stop':
    case '/pause':
      return { kind: 'stop' };
    case '/new':
    case '/reset':
      return { kind: 'new' };
    case '/threads':
    case '/sessions':
      return { kind: 'threads' };
    case '/thread':
    case '/switch':
      return arg ? { kind: 'switch', target: arg } : { kind: 'switch' };
    case '/resume':
      return arg ? { kind: 'switch', target: arg } : { kind: 'resume' };
    case '/attach':
      return { kind: 'attach' };
    case '/detach':
      return { kind: 'detach' };
    case '/model':
      return arg ? { kind: 'model', model: arg } : { kind: 'model' };
    case '/compact':
      return { kind: 'compact' };
    case '/title':
      return arg ? { kind: 'rename', title: arg } : { kind: 'title' };
    case '/rename':
      return arg ? { kind: 'rename', title: arg } : null;
    case '/archive':
      return { kind: 'archive' };
    default:
      return null;
  }
}

export function formatTelegramGatewayHelp(): string {
  return [
    'Neon Pilot Telegram commands:',
    '/status — show gateway status',
    '/whoami — show your Telegram IDs and access status',
    '/new or /reset — start a new conversation',
    '/threads — list recent conversations',
    '/switch <number|id|title> — switch this chat to another conversation',
    '/attach — attach this chat as the main gateway thread',
    '/detach — detach this chat',
    '/stop or /pause — stop replies',
    '/resume — resume replies',
    '/model [name] — show or change model',
    '/compact — compact the thread',
    '/title [name] — show or rename the thread',
    '/rename <title> — rename the thread',
    '/archive — archive and detach the thread',
  ].join('\n');
}
