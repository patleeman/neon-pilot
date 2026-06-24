import type { MessageBlock } from '../../shared/types';

// ── Tool icon & color ─────────────────────────────────────────────────────────

const TOOL_META: Record<
  string,
  { icon: string; label: string; color: string; tone: 'steel' | 'teal' | 'accent' | 'success' | 'warning' | 'muted' }
> = {
  bash: { icon: '$', label: 'bash', color: 'border border-border-subtle/70 bg-elevated/25 text-steel', tone: 'steel' },
  background_bash: {
    icon: '$',
    label: 'background task',
    color: 'border border-border-subtle/70 bg-elevated/25 text-steel',
    tone: 'steel',
  },
  read: { icon: '≡', label: 'read', color: 'border border-border-subtle/70 bg-elevated/25 text-teal', tone: 'teal' },
  write: { icon: '✎', label: 'write', color: 'border border-border-subtle/70 bg-elevated/25 text-accent', tone: 'accent' },
  edit: { icon: '✎', label: 'edit', color: 'border border-border-subtle/70 bg-elevated/25 text-accent', tone: 'accent' },
  web_fetch: {
    icon: '⌕',
    label: 'web_fetch',
    color: 'border border-border-subtle/70 bg-elevated/25 text-success',
    tone: 'success',
  },
  web_search: {
    icon: '⌕',
    label: 'web_search',
    color: 'border border-border-subtle/70 bg-elevated/25 text-success',
    tone: 'success',
  },
  image: { icon: '◌', label: 'image', color: 'border border-border-subtle/70 bg-elevated/25 text-accent', tone: 'accent' },
  screenshot: { icon: '⊡', label: 'screenshot', color: 'text-secondary bg-elevated', tone: 'muted' },
  artifact: { icon: '◫', label: 'artifact', color: 'border border-border-subtle/70 bg-elevated/25 text-accent', tone: 'accent' },
  checkpoint: { icon: '✓', label: 'checkpoint', color: 'border border-border-subtle/70 bg-elevated/25 text-success', tone: 'success' },
  conversation: { icon: '◆', label: 'conversation', color: 'border border-border-subtle/70 bg-elevated/25 text-warning', tone: 'warning' },
};
export function toolMeta(t: string) {
  return TOOL_META[t] ?? { icon: '⚙', label: t, color: 'text-secondary bg-elevated', tone: 'muted' as const };
}

// Tool output is plain transcript text, not a terminal emulator. Strip ANSI
// control sequences so CLIs that force color (Vitest, pnpm, etc.) do not leak
// raw escape codes like `[31m` into the chat view.
export function stripAnsiForTranscript(value: string): string {
  const escape = String.fromCharCode(27);
  const bell = String.fromCharCode(7);
  const oscPattern = new RegExp(`${escape}\\][^${bell}${escape}]*(?:${bell}|${escape}\\\\)`, 'gu');
  const csiPattern = new RegExp(`${escape}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`, 'gu');

  return value.replace(oscPattern, '').replace(csiPattern, '');
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

export type ConversationTranscriptDisclosureMode = 'auto' | 'expanded';
export type ConversationDiffDisclosureMode = 'collapsed' | 'expanded';

export const CONVERSATION_TRANSCRIPT_DISCLOSURE_SETTING_KEY = 'conversation.transcriptDisclosure';
export const CONVERSATION_DIFF_DISCLOSURE_SETTING_KEY = 'conversation.diffDisclosure';
export const CONVERSATION_PINNED_TOOL_CALLS_SETTING_KEY = 'conversation.pinnedToolCalls';

export function normalizeConversationTranscriptDisclosureMode(value: unknown): ConversationTranscriptDisclosureMode {
  return value === 'expanded' ? 'expanded' : 'auto';
}

export function normalizeConversationDiffDisclosureMode(value: unknown): ConversationDiffDisclosureMode {
  return value === 'expanded' ? 'expanded' : 'collapsed';
}

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

export function resolveConversationBlockAutoOpen(
  block: MessageBlock,
  index: number,
  total: number,
  isStreaming: boolean,
  mode: ConversationTranscriptDisclosureMode,
): boolean {
  if (mode === 'expanded' && (block.type === 'tool_use' || block.type === 'thinking')) {
    return true;
  }

  return shouldAutoOpenConversationBlock(block, index, total, isStreaming);
}

export function shouldAutoOpenConversationBlock(block: MessageBlock, index: number, total: number, isStreaming: boolean): boolean {
  const isLatestStreamingBlock = isStreaming && index === total - 1;

  if (block.type === 'tool_use') {
    return block.status === 'running' || !!block.running || isLatestStreamingBlock;
  }

  if (block.type === 'thinking') {
    return isLatestStreamingBlock;
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
