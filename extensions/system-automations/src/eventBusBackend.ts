import {
  cancelDelayedEvent,
  delayEvent,
  deleteSubscription,
  emitEvent,
  listEvents,
  listSubscriptions,
  processDueEvents,
  pruneEvents,
  replayEvent,
  saveSubscription,
} from '@neon-pilot/extensions/backend/events';

export interface EventBusBackendContext {
  ui?: { invalidate?(topics: string | string[]): void };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function details(result: unknown): Record<string, unknown> {
  return isRecord(result) ? result : { result };
}

export async function eventBus(input: unknown, ctx: EventBusBackendContext = {}) {
  const params = isRecord(input) ? input : {};
  const action = readString(params.action) ?? 'list';
  if (
    params.dryRun === true &&
    ['emit', 'delay', 'replay', 'process_due', 'save_subscription', 'delete_subscription', 'cancel_delayed', 'prune', 'clear'].includes(
      action,
    )
  ) {
    return {
      text: formatJson({ ok: true, dryRun: true, action, input: params }),
      details: { ok: true, dryRun: true, action, input: params },
    };
  }
  let result: unknown;

  switch (action) {
    case 'emit':
      result = await emitEvent(params);
      break;
    case 'delay':
    case 'schedule':
    case 'schedule_emit':
      result = await delayEvent(params);
      break;
    case 'replay':
      result = await replayEvent(params);
      break;
    case 'process_due':
      result = await processDueEvents(params);
      break;
    case 'prune':
      result = await pruneEvents(params);
      break;
    case 'clear':
      result = await pruneEvents({ ...params, keepLatest: 0 });
      break;
    case 'list':
    case 'events':
      result = await listEvents(params);
      break;
    case 'subscriptions':
    case 'list_subscriptions':
      result = await listSubscriptions(params);
      break;
    case 'save_subscription':
      result = await saveSubscription({
        ...params,
        action: params.subscriptionAction ?? params.action,
      });
      break;
    case 'delete_subscription':
      result = await deleteSubscription(params);
      break;
    case 'cancel_delayed':
      result = await cancelDelayedEvent(params);
      break;
    default:
      throw new Error(`Unsupported event bus action: ${action}`);
  }

  ctx.ui?.invalidate?.(['automation', 'events', 'tasks', 'runs']);
  return {
    text: formatJson(result),
    details: {
      action,
      ...details(result),
    },
  };
}
