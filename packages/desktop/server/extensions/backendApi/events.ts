import { callServerModuleExport } from './serverModuleResolver.js';

interface AppEventsModule {
  publishAppEvent(...args: unknown[]): unknown;
  invalidateAppTopics(...args: unknown[]): unknown;
}

const APP_EVENTS_MODULE = '../../shared/appEvents.js';

export async function publishAppEvent(...args: Parameters<AppEventsModule['publishAppEvent']>) {
  return callServerModuleExport<ReturnType<AppEventsModule['publishAppEvent']>>(APP_EVENTS_MODULE, 'publishAppEvent', ...args);
}

export async function invalidateAppTopics(...args: Parameters<AppEventsModule['invalidateAppTopics']>) {
  return callServerModuleExport<ReturnType<AppEventsModule['invalidateAppTopics']>>(
    APP_EVENTS_MODULE,
    'invalidateAppTopics',
    ...args,
  );
}
