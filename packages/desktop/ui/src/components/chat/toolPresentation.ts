import type { MessageBlock } from '../../shared/types';

// ── Tool icon & color ─────────────────────────────────────────────────────────

const TOOL_META: Record<
  string,
  { icon: string; label: string; color: string; tone: 'steel' | 'teal' | 'accent' | 'success' | 'warning' | 'muted' }
> = {
  bash: { icon: '$', label: 'bash', color: 'text-steel bg-steel/5', tone: 'steel' },
  background_bash: { icon: '$', label: 'background_bash', color: 'text-steel bg-steel/5', tone: 'steel' },
  read: { icon: '≡', label: 'read', color: 'text-teal bg-teal/5', tone: 'teal' },
  write: { icon: '✎', label: 'write', color: 'text-accent bg-accent/5', tone: 'accent' },
  edit: { icon: '✎', label: 'edit', color: 'text-accent bg-accent/5', tone: 'accent' },
  'web.fetch': { icon: '⌕', label: 'web.fetch', color: 'text-success bg-success/5', tone: 'success' },
  'web.search': { icon: '⌕', label: 'web.search', color: 'text-success bg-success/5', tone: 'success' },
  image: { icon: '◌', label: 'image', color: 'text-accent bg-accent/5', tone: 'accent' },
  screenshot: { icon: '⊡', label: 'screenshot', color: 'text-secondary bg-elevated', tone: 'muted' },
  artifact: { icon: '◫', label: 'artifact', color: 'text-accent bg-accent/5', tone: 'accent' },
  checkpoint: { icon: '✓', label: 'checkpoint', color: 'text-success bg-success/5', tone: 'success' },
  conversation: { icon: '◆', label: 'conversation', color: 'text-warning bg-warning/5', tone: 'warning' },
};
export function toolMeta(t: string) {
  return TOOL_META[t] ?? { icon: '⚙', label: t, color: 'text-secondary bg-elevated', tone: 'muted' as const };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isBackgroundShellStart(block: Extract<MessageBlock, { type: 'tool_use' }>): boolean {
  const input = isRecord(block.input) ? block.input : null;
  const details = isRecord(block.details) ? block.details : null;

  if (block.tool === 'bash') {
    return input?.background === true || details?.background === true;
  }

  return (
    (block.tool === 'background_command' || block.tool === 'background_bash') && (input?.action === 'start' || details?.action === 'start')
  );
}

export type DisclosurePreference = 'auto' | 'open' | 'closed';

export function resolveDisclosureOpen(autoOpen: boolean, preference: DisclosurePreference): boolean {
  if (preference === 'open') return true;
  if (preference === 'closed') return false;
  return autoOpen;
}

export function toggleDisclosurePreference(autoOpen: boolean, preference: DisclosurePreference): DisclosurePreference {
  // When autoOpen opened the item and the user clicks without having
  // expressed a preference, make the open preference explicit instead of
  // toggling to closed. This way clicking on an auto-opened tool/thinking
  // block to "look at it" keeps it open, and the user can still close it
  // with a second click.
  if (preference === 'auto' && autoOpen) {
    return 'open';
  }

  return resolveDisclosureOpen(autoOpen, preference) ? 'closed' : 'open';
}

export function shouldAutoOpenTraceCluster(live: boolean, hasRunning: boolean): boolean {
  return live || hasRunning;
}

export function shouldAutoOpenConversationBlock(block: MessageBlock, index: number, total: number, isStreaming: boolean): boolean {
  if (block.type === 'tool_use') {
    return block.status === 'running' || !!block.running;
  }

  if (block.type === 'thinking') {
    return isStreaming && index === total - 1;
  }

  return false;
}

export function getStreamingStatusLabel(messages: MessageBlock[], isStreaming: boolean): string | null {
  if (!isStreaming) {
    return null;
  }

  const last = messages[messages.length - 1];
  if (!last) {
    return 'Working…';
  }

  switch (last.type) {
    case 'thinking':
      return 'Thinking…';
    case 'tool_use':
      return last.status === 'running' || !!last.running ? `Running ${toolMeta(last.tool).label}…` : 'Working…';
    case 'subagent':
      return last.status === 'running' ? `Running ${last.name}…` : 'Working…';
    case 'text':
      return 'Responding…';
    default:
      return 'Working…';
  }
}
