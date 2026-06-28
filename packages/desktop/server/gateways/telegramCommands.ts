export type TelegramGatewayCommand =
  | { kind: 'start' }
  | { kind: 'help' }
  | { kind: 'status' }
  | { kind: 'diagnostics' }
  | { kind: 'whoami' }
  | { kind: 'stop' }
  | { kind: 'resume' }
  | { kind: 'cancel' }
  | { kind: 'new' }
  | { kind: 'threads'; query?: string }
  | { kind: 'tail'; count?: number }
  | { kind: 'transcript'; count?: number }
  | { kind: 'export'; count?: number }
  | { kind: 'summary'; count?: number }
  | { kind: 'peek'; target?: string }
  | { kind: 'switch'; target?: string }
  | { kind: 'attach' }
  | { kind: 'detach' }
  | { kind: 'mirror'; mode?: 'mirror_all' | 'notify_only' | 'muted' }
  | { kind: 'model'; model?: string }
  | { kind: 'default_model'; model?: string | null }
  | { kind: 'default_cwd'; cwd?: string | null }
  | { kind: 'defaults' }
  | { kind: 'compact' }
  | { kind: 'title' }
  | { kind: 'rename'; title: string }
  | { kind: 'pins' }
  | { kind: 'pin'; target?: string }
  | { kind: 'unpin'; target?: string }
  | { kind: 'archive' }
  | { kind: 'archives'; query?: string };

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
    case '/diagnostics':
    case '/diag':
      return { kind: 'diagnostics' };
    case '/whoami':
      return { kind: 'whoami' };
    case '/stop':
    case '/pause':
      return { kind: 'stop' };
    case '/cancel':
    case '/stoprun':
    case '/abort':
      return { kind: 'cancel' };
    case '/new':
    case '/reset':
      return { kind: 'new' };
    case '/threads':
    case '/sessions':
      return arg ? { kind: 'threads', query: arg } : { kind: 'threads' };
    case '/tail': {
      const count = arg ? Number.parseInt(arg, 10) : undefined;
      return { kind: 'tail', count: Number.isFinite(count) ? count : undefined };
    }
    case '/transcript':
    case '/recent': {
      const count = arg ? Number.parseInt(arg, 10) : undefined;
      return { kind: 'transcript', count: Number.isFinite(count) ? count : undefined };
    }
    case '/export': {
      const count = arg ? Number.parseInt(arg, 10) : undefined;
      return Number.isFinite(count) ? { kind: 'export', count } : { kind: 'export' };
    }
    case '/summary': {
      const count = arg ? Number.parseInt(arg, 10) : undefined;
      return Number.isFinite(count) ? { kind: 'summary', count } : { kind: 'summary' };
    }
    case '/peek':
      return arg ? { kind: 'peek', target: arg } : { kind: 'peek' };
    case '/thread':
    case '/switch':
      return arg ? { kind: 'switch', target: arg } : { kind: 'switch' };
    case '/resume':
      return arg ? { kind: 'switch', target: arg } : { kind: 'resume' };
    case '/attach':
      return { kind: 'attach' };
    case '/detach':
      return { kind: 'detach' };
    case '/mirror':
    case '/notifications':
      return { kind: 'mirror', mode: readMirrorMode(arg) };
    case '/mute':
      return { kind: 'mirror', mode: 'muted' };
    case '/unmute':
      return { kind: 'mirror', mode: 'mirror_all' };
    case '/model':
      return arg ? { kind: 'model', model: arg } : { kind: 'model' };
    case '/defaultmodel':
    case '/default_model':
      return arg ? { kind: 'default_model', model: readClearValue(arg) } : { kind: 'default_model' };
    case '/defaultcwd':
    case '/default_cwd':
      return arg ? { kind: 'default_cwd', cwd: readClearValue(arg) } : { kind: 'default_cwd' };
    case '/defaults':
    case '/settings':
      return { kind: 'defaults' };
    case '/compact':
      return { kind: 'compact' };
    case '/title':
      return arg ? { kind: 'rename', title: arg } : { kind: 'title' };
    case '/rename':
      return arg ? { kind: 'rename', title: arg } : null;
    case '/pins':
    case '/pinned':
      return { kind: 'pins' };
    case '/pin':
      return arg ? { kind: 'pin', target: arg } : { kind: 'pin' };
    case '/unpin':
      return arg ? { kind: 'unpin', target: arg } : { kind: 'unpin' };
    case '/archive':
      return { kind: 'archive' };
    case '/archives':
    case '/archived':
      return arg ? { kind: 'archives', query: arg } : { kind: 'archives' };
    default:
      return null;
  }
}

function readMirrorMode(value: string): 'mirror_all' | 'notify_only' | 'muted' | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  if (!normalized) return undefined;
  if (normalized === 'all' || normalized === 'mirror' || normalized === 'mirror_all' || normalized === 'on') return 'mirror_all';
  if (normalized === 'notify' || normalized === 'notify_only' || normalized === 'notifications') return 'notify_only';
  if (normalized === 'muted' || normalized === 'mute' || normalized === 'off') return 'muted';
  return undefined;
}

function readClearValue(value: string): string | null {
  const trimmed = value.trim();
  return /^(clear|none|default|unset)$/i.test(trimmed) ? null : trimmed;
}

export function formatTelegramGatewayHelp(): string {
  return [
    'Neon Pilot Telegram commands:',
    '/status — show gateway status',
    '/diagnostics — show gateway delivery diagnostics',
    '/whoami — show your Telegram IDs and access status',
    '/new or /reset — start a new conversation',
    '/threads [search] — list or search active sidebar conversations',
    '/archives [search] — search archived conversations',
    '/pins — list pinned Telegram conversations',
    '/pin [number|id|title] — pin a conversation in Telegram',
    '/unpin [number|id|title] — unpin a conversation',
    '/switch <number|id|title> — switch this chat to another conversation',
    '/peek [number|id|title] — preview a conversation without switching',
    '/tail [count] — show recent messages in the current thread',
    '/transcript [count] — output more recent transcript messages',
    '/export [count] — export recent transcript as a text file',
    '/summary [count] — summarize recent thread activity',
    '/mirror [all|notify|muted] — control desktop-to-Telegram delivery',
    '/attach — attach this chat as the main gateway thread',
    '/detach — detach this chat',
    '/stop or /pause — stop replies',
    '/cancel — stop the running agent turn',
    '/resume — resume replies',
    '/model [name] — show or change model',
    '/defaults — show Telegram defaults',
    '/defaultmodel [model|clear] — set model for new Telegram threads',
    '/defaultcwd [path|clear] — set cwd for new Telegram threads',
    '/compact — compact the thread',
    '/title [name] — show or rename the thread',
    '/rename <title> — rename the thread',
    '/archive — archive and detach the thread',
  ].join('\n');
}
