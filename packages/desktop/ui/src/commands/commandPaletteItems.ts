import type { ExtensionQuickOpenRegistration, ExtensionSearchItem, ExtensionSearchProviderRegistration } from '../extensions/types';
import type { ConversationContentSearchMatch, SessionMeta } from '../shared/types';
import { timeAgo } from '../shared/utils';
import type { CommandPaletteItem } from './commandPalette';
import { THREADS_COMMAND_PALETTE_SCOPE } from './commandPalette';
import type { CommandPaletteAction } from './commandPaletteActions';

export interface ExtensionQuickOpenItem {
  id: string;
  section?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  keywords?: Array<string | undefined>;
  order?: number;
  action?: CommandPaletteAction;
}

export interface ScopedSessionMeta extends SessionMeta {
  pinned?: boolean;
}

export function excerpt(value: string | undefined, maxLength = 110): string | undefined {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function workspaceDisplayLabel(cwd: string | undefined, cwdSlug?: string | null): string | undefined {
  const normalized = cwd?.trim();
  if (normalized) {
    return (
      normalized
        .split(/[\\/]+/)
        .filter(Boolean)
        .at(-1) ?? normalized
    );
  }

  const slug = cwdSlug?.trim();
  return slug || undefined;
}

export function buildConversationItems(
  section: 'open' | 'archived',
  sessions: ScopedSessionMeta[],
): CommandPaletteItem<CommandPaletteAction>[] {
  const orderedSessions =
    section === 'archived'
      ? [...sessions].sort((left, right) => {
          const leftTimestamp = left.lastActivityAt ?? left.timestamp;
          const rightTimestamp = right.lastActivityAt ?? right.timestamp;
          return rightTimestamp.localeCompare(leftTimestamp);
        })
      : sessions;

  return orderedSessions.map((session, index) => {
    const timestamp = session.lastActivityAt ?? session.timestamp;
    const metaParts = [timeAgo(timestamp)];

    if (section === 'open' && session.pinned) {
      metaParts.push('pinned');
    }

    if (session.isRunning) {
      metaParts.push('running');
    }

    if (session.needsAttention) {
      metaParts.push('attention');
    }

    if (session.model) {
      metaParts.push(session.model.split('/').pop() ?? session.model);
    }

    return {
      id: `${section}:${session.id}`,
      section,
      title: session.title,
      subtitle: workspaceDisplayLabel(session.cwd, session.cwdSlug),
      meta: metaParts.join(' · '),
      keywords: [session.id, session.file, session.cwd, session.model, session.cwdSlug],
      order: index,
      action:
        section === 'archived'
          ? { kind: 'restoreArchivedConversation', conversationId: session.id }
          : { kind: 'navigate', to: `/conversations/${encodeURIComponent(session.id)}` },
    };
  });
}

export function normalizeExtensionSearchItem(
  provider: ExtensionSearchProviderRegistration,
  item: ExtensionSearchItem,
  index: number,
): CommandPaletteItem<CommandPaletteAction> | null {
  if (!item.title || !item.action) return null;
  return {
    id: `extension-search:${provider.extensionId}:${provider.id}:${item.id ?? index}`,
    section: provider.id,
    title: item.title,
    subtitle: item.subtitle,
    meta: item.snippet ?? item.meta,
    keywords: item.keywords?.filter((keyword): keyword is string => typeof keyword === 'string'),
    order: item.order ?? index,
    action: { kind: 'extensionSearchAction', extensionId: provider.extensionId, action: item.action },
  };
}

export function normalizeQuickOpenItem(
  registration: ExtensionQuickOpenRegistration,
  item: ExtensionQuickOpenItem,
  index: number,
): CommandPaletteItem<CommandPaletteAction> | null {
  const section = item.section ?? registration.section ?? registration.id;
  if (!section || section === THREADS_COMMAND_PALETTE_SCOPE || section === 'open' || section === 'archived') return null;
  if (!item.action) return null;
  return {
    id: `extension-quick-open:${registration.extensionId}:${registration.id}:${item.id}`,
    section,
    title: item.title,
    subtitle: item.subtitle,
    meta: item.meta,
    keywords: item.keywords?.filter((keyword): keyword is string => typeof keyword === 'string'),
    order: item.order ?? index,
    action: item.action,
  };
}

export function buildConversationContentSearchItems(
  results: ConversationContentSearchMatch[],
  query: string,
): CommandPaletteItem<CommandPaletteAction>[] {
  return results.map((result, index) => ({
    id: `conversation-search:${result.conversationId}:${result.blockId}`,
    section: result.isLive ? ('open' as const) : ('archived' as const),
    title: result.title,
    subtitle: workspaceDisplayLabel(result.cwd),
    meta: excerpt(result.snippet, 160),
    keywords: [query, result.conversationId, result.cwd, result.snippet, result.blockId],
    order: index,
    action: result.isLive
      ? { kind: 'navigate', to: `/conversations/${encodeURIComponent(result.conversationId)}` }
      : { kind: 'restoreArchivedConversation', conversationId: result.conversationId },
  }));
}
