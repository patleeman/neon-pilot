import type { RuntimeScopeTaskSummary } from '../routes/context.js';
import {
  type ConversationConnectionItem,
  type ConversationConnectionVisibility,
  listConversationConnections,
} from './conversationConnections.js';

export type ConversationActivityKind = 'execution' | 'deferred-resume' | 'scheduled-task' | 'queued-prompt';
export type ConversationActivityVisibility = ConversationConnectionVisibility;
export type ConversationActivityStatus =
  | 'queued'
  | 'waiting'
  | 'running'
  | 'scheduled'
  | 'ready'
  | 'failed'
  | 'done'
  | 'cancelled'
  | 'unknown';

export interface ConversationActivityAction {
  id: string;
  label: string;
  command?: string;
}

export interface ConversationActivityItem {
  id: string;
  kind: ConversationActivityKind;
  title: string;
  subtitle?: string;
  status: ConversationActivityStatus;
  active: boolean;
  visibility: ConversationActivityVisibility;
  conversationId: string;
  source: {
    type: ConversationActivityKind;
    id: string;
  };
  createdAt?: string;
  updatedAt?: string;
  dueAt?: string;
  actions: ConversationActivityAction[];
  payload?: unknown;
}

export interface ConversationActivityResult {
  conversationId: string;
  items: ConversationActivityItem[];
  primary: ConversationActivityItem[];
  system: ConversationActivityItem[];
  hidden: ConversationActivityItem[];
}

export interface ConversationActivityOptions {
  active?: boolean;
  visibility?: ConversationActivityVisibility | 'visible' | 'all';
  tasks?: RuntimeScopeTaskSummary[];
  profile?: string;
}

function activityKind(item: ConversationConnectionItem): ConversationActivityKind | null {
  if (item.source.type === 'execution') return 'execution';
  if (item.source.type === 'deferred-resume') return 'deferred-resume';
  if (item.source.type === 'scheduled-task') return 'scheduled-task';
  if (item.source.type === 'queued-prompt') return 'queued-prompt';
  return null;
}

function toActivityItem(item: ConversationConnectionItem): ConversationActivityItem | null {
  const kind = activityKind(item);
  if (!kind) return null;
  const status = item.status;
  return {
    id: item.id,
    kind,
    title: item.title,
    ...(item.subtitle ? { subtitle: item.subtitle } : {}),
    status:
      status === 'queued' ||
      status === 'waiting' ||
      status === 'running' ||
      status === 'scheduled' ||
      status === 'ready' ||
      status === 'failed' ||
      status === 'done' ||
      status === 'cancelled'
        ? status
        : 'unknown',
    active: item.active,
    visibility: item.visibility,
    conversationId: item.conversationId,
    source: { type: kind, id: item.source.id },
    ...(item.createdAt ? { createdAt: item.createdAt } : {}),
    ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
    ...(item.dueAt ? { dueAt: item.dueAt } : {}),
    actions: item.actions,
    ...(item.payload !== undefined ? { payload: item.payload } : {}),
  };
}

export async function listConversationActivity(
  conversationId: string,
  options: ConversationActivityOptions = {},
): Promise<ConversationActivityResult> {
  const connections = await listConversationConnections(conversationId, {
    active: options.active,
    visibility: options.visibility,
    kind: 'activity',
    surface: 'activityShelf',
    tasks: options.tasks,
    profile: options.profile,
    includeExtensionProviders: false,
  });
  const items = connections.items.flatMap((item) => {
    const activity = toActivityItem(item);
    return activity ? [activity] : [];
  });
  return {
    conversationId: connections.conversationId,
    items,
    primary: items.filter((item) => item.visibility === 'primary'),
    system: items.filter((item) => item.visibility === 'system'),
    hidden: items.filter((item) => item.visibility === 'hidden'),
  };
}
