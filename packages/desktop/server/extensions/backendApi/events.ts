import { callServerModuleExport } from './serverModuleResolver.js';

interface AppEventsModule {
  publishAppEvent(...args: unknown[]): unknown;
  invalidateAppTopics(...args: unknown[]): unknown;
}

const APP_EVENTS_MODULE = '../../shared/appEvents.js';
const EVENT_BUS_MODULE = '../../automation/eventBusHost.js';

export async function publishAppEvent(...args: Parameters<AppEventsModule['publishAppEvent']>) {
  return callServerModuleExport<ReturnType<AppEventsModule['publishAppEvent']>>(APP_EVENTS_MODULE, 'publishAppEvent', ...args);
}

export async function invalidateAppTopics(...args: Parameters<AppEventsModule['invalidateAppTopics']>) {
  return callServerModuleExport<ReturnType<AppEventsModule['invalidateAppTopics']>>(APP_EVENTS_MODULE, 'invalidateAppTopics', ...args);
}

export async function emitEvent(input: unknown) {
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'emitEvent', input);
}

export async function replayEvent(input: unknown) {
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'replayEvent', input);
}

export async function listEvents(input?: unknown) {
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'listEvents', input);
}

export async function listSubscriptions(input?: unknown) {
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'listSubscriptions', input);
}

export async function saveSubscription(input: unknown) {
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'saveSubscription', input);
}

export async function deleteSubscription(input: unknown) {
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'deleteSubscription', input);
}
