import { logError, logInfo } from '../shared/logging.js';
import type { ExtensionBackendServerContext } from './extensionBackend.js';
import { createBackendContext, loadExtensionBackend } from './extensionBackend.js';
import { type ExtensionEvent, publishExtensionEvent, subscribeExtensionEvents } from './extensionEventBus.js';
import { findExtensionEntry, isExtensionEnabled, listExtensionInstallSummaries } from './extensionRegistry.js';

interface InstalledSubscription {
  unsubscribe: () => void;
  /** Active debounce timer, if any. */
  debounceTimer?: ReturnType<typeof setTimeout>;
}

// Key: `${extensionId}:${subscriptionId}` → installed subscription with cleanup handle.
const installedSubscriptions = new Map<string, InstalledSubscription>();

const sourceEventName = (source: string) => (source.includes(':') ? source : `host:${source}`);

export async function publishExtensionHostEvent(source: string, payload: unknown): Promise<void> {
  await publishExtensionEvent('host', sourceEventName(source), payload);
  if (!source.includes(':') && payload && typeof payload === 'object') {
    const type = (payload as { type?: unknown }).type;
    if (typeof type === 'string' && type.trim()) {
      await publishExtensionEvent('host', `${sourceEventName(source)}:${type.trim()}`, payload);
    }
  }
}

/**
 * Install subscriptions for all currently-enabled extensions that haven't been
 * installed yet.  Safe to call multiple times — already-installed subscriptions
 * are skipped.  Call after enabling an extension to wire up its subscriptions.
 */
export async function installExtensionSubscriptions(serverContext?: ExtensionBackendServerContext): Promise<void> {
  for (const summary of listExtensionInstallSummaries()) {
    if (summary.status !== 'enabled') continue;
    await installSubscriptionsForExtension(summary.id, serverContext);
  }
}

/**
 * Install subscriptions for a single extension.
 * No-ops for already-installed subscriptions.
 */
export async function installSubscriptionsForExtension(extensionId: string, serverContext?: ExtensionBackendServerContext): Promise<void> {
  const entry = findExtensionEntry(extensionId);
  for (const subscription of entry?.manifest.contributes?.subscriptions ?? []) {
    const key = `${extensionId}:${subscription.id}`;
    if (installedSubscriptions.has(key)) continue;

    const pattern = subscription.pattern
      ? `${sourceEventName(subscription.source)}:${subscription.pattern}`
      : sourceEventName(subscription.source);
    const debounceMs = typeof subscription.debounceMs === 'number' && subscription.debounceMs > 0 ? subscription.debounceMs : 0;

    const installed: InstalledSubscription = { unsubscribe: () => {} };

    const dispatchEvent = async (event: ExtensionEvent) => {
      // Skip if the extension was disabled after the subscription was installed.
      if (!isExtensionEnabled(extensionId)) return;
      try {
        const backend = await loadExtensionBackend(extensionId);
        const handler = backend[subscription.handler];
        if (typeof handler !== 'function') throw new Error(`Missing subscription handler export "${subscription.handler}".`);
        await (handler as (input: unknown, ctx: unknown) => unknown | Promise<unknown>)(
          { subscriptionId: subscription.id, event: event.event, payload: event.payload, sourceExtensionId: event.sourceExtensionId },
          createBackendContext(extensionId, serverContext),
        );
      } catch (error) {
        logError('extension subscription handler failed', {
          extensionId,
          subscriptionId: subscription.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const eventSubscription = subscribeExtensionEvents(extensionId, pattern, (event: ExtensionEvent) => {
      if (debounceMs > 0) {
        clearTimeout(installed.debounceTimer);
        installed.debounceTimer = setTimeout(() => void dispatchEvent(event), debounceMs);
      } else {
        void dispatchEvent(event);
      }
    });

    installed.unsubscribe = () => {
      clearTimeout(installed.debounceTimer);
      eventSubscription.unsubscribe();
    };

    installedSubscriptions.set(key, installed);

    logInfo('extension subscription installed', {
      extensionId,
      subscriptionId: subscription.id,
      source: subscription.source,
      ...(debounceMs > 0 ? { debounceMs } : {}),
    });
  }
}

/**
 * Uninstall all subscriptions for an extension.
 * Called when an extension is disabled so handlers no longer fire.
 */
export function uninstallExtensionSubscriptions(extensionId: string): void {
  for (const [key, installed] of installedSubscriptions) {
    if (!key.startsWith(`${extensionId}:`)) continue;
    installed.unsubscribe();
    installedSubscriptions.delete(key);
    logInfo('extension subscription uninstalled', { extensionId, key });
  }
}
