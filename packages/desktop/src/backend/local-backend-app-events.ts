import type { AppEvent, AppEventTopic } from '../../server/shared/appEvents.js';
import { invalidateAppTopics, publishAppEvent } from '../../server/shared/appEvents.js';
import type { LocalApiModule } from '../local-api-module.js';

export interface DesktopAppEventBridgeMessage {
  type: 'desktop-app-event';
  event: AppEvent;
}

export function isAppEventTopic(value: unknown): value is AppEventTopic {
  return (
    value === 'sessions' ||
    value === 'sessionFiles' ||
    value === 'artifacts' ||
    value === 'checkpoints' ||
    value === 'attachments' ||
    value === 'extensions' ||
    value === 'tasks' ||
    value === 'models' ||
    value === 'runs' ||
    value === 'executions' ||
    value === 'automation' ||
    value === 'daemon' ||
    value === 'workspace' ||
    value === 'knowledgeBase' ||
    value === 'notifications'
  );
}

export function isDesktopAppEventBridgeMessage(value: unknown): value is DesktopAppEventBridgeMessage {
  return (
    Boolean(value && typeof value === 'object') &&
    (value as { type?: unknown }).type === 'desktop-app-event' &&
    Boolean((value as { event?: unknown }).event && typeof (value as { event?: unknown }).event === 'object')
  );
}

export function publishBundledDesktopAppEvent(event: AppEvent): void {
  if (event.type === 'invalidate') {
    const topics = event.topics.filter(isAppEventTopic);
    if (topics.length > 0) {
      invalidateAppTopics(...topics);
    }
    return;
  }
  publishAppEvent(event);
}

export async function bridgeRawLocalApiAppEventsToBundledRuntime(
  localApi: Pick<LocalApiModule, 'subscribeDesktopAppEvents'>,
): Promise<() => void> {
  return localApi.subscribeDesktopAppEvents((message) => {
    const bridgedMessage = { type: 'desktop-app-event', event: message.type === 'event' ? message.event : undefined };
    if (!isDesktopAppEventBridgeMessage(bridgedMessage)) {
      return;
    }

    publishBundledDesktopAppEvent(bridgedMessage.event);
  });
}
