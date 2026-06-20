import { callServerModuleExport } from './serverModuleResolver.js';

const EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for('neon-pilot.extensionHostCapabilityBridge');

type ExtensionHostCapabilityBridge = (capability: string, operation: string, input?: unknown) => Promise<unknown>;

type ExtensionBackendEventsGlobal = typeof globalThis & {
  [EXTENSION_HOST_CAPABILITY_BRIDGE]?: ExtensionHostCapabilityBridge;
};

interface AppEventsModule {
  publishAppEvent(...args: unknown[]): unknown;
  invalidateAppTopics(...args: unknown[]): unknown;
}

const APP_EVENTS_MODULE = '../../shared/appEvents.js';
const EVENT_BUS_MODULE = '../../automation/eventBusHost.js';

function getWorkerCapabilityBridge(): ExtensionHostCapabilityBridge | undefined {
  return (globalThis as ExtensionBackendEventsGlobal)[EXTENSION_HOST_CAPABILITY_BRIDGE];
}

export async function publishAppEvent(...args: Parameters<AppEventsModule['publishAppEvent']>) {
  return callServerModuleExport<ReturnType<AppEventsModule['publishAppEvent']>>(APP_EVENTS_MODULE, 'publishAppEvent', ...args);
}

export async function invalidateAppTopics(...args: Parameters<AppEventsModule['invalidateAppTopics']>) {
  return callServerModuleExport<ReturnType<AppEventsModule['invalidateAppTopics']>>(APP_EVENTS_MODULE, 'invalidateAppTopics', ...args);
}

export async function emitEvent(input: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'emit', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'emitEvent', input);
}

export async function delayEvent(input: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'delay', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'delayEvent', input);
}

export async function replayEvent(input: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'replay', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'replayEvent', input);
}

export async function listEvents(input?: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'list', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'listEvents', input);
}

export async function listSubscriptions(input?: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'listSubscriptions', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'listSubscriptions', input);
}

export async function saveSubscription(input: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'saveSubscription', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'saveSubscription', input);
}

export async function deleteSubscription(input: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'deleteSubscription', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'deleteSubscription', input);
}

export async function cancelDelayedEvent(input: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'cancelDelayed', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'cancelDelayedEvent', input);
}

export async function pruneEvents(input: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'prune', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'pruneEvents', input);
}

export async function processDueEvents(input?: unknown) {
  const bridge = getWorkerCapabilityBridge();
  if (bridge) return bridge('events', 'processDue', input) as Promise<Record<string, unknown>>;
  return callServerModuleExport<Record<string, unknown>>(EVENT_BUS_MODULE, 'processDueEvents', input);
}
