/**
 * Model discovery — extension contribution point for dynamic model providers.
 *
 * Extensions declare `contributes.modelDiscovery.action` in their manifest.
 * At model-list query time the registered action is invoked with no input.
 * It returns either null (runtime not available) or a live provider descriptor.
 *
 * This replaces the UI-side sync loop that was the only way to inject local
 * models into the picker. Discovery runs on every /api/models request so the
 * picker always reflects current runtime state with no persistent side effects.
 */

import { invokeExtensionAction } from '../extensions/extensionBackend.js';
import { listEnabledExtensionEntries } from '../extensions/extensionRegistry.js';

export interface DiscoveredModelEntry {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<'text' | 'image'>;
  contextWindow: number;
}

export interface DiscoveredProvider {
  provider: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  models: DiscoveredModelEntry[];
}

/** Run all enabled extension model discovery actions and return live providers. */
export async function runModelDiscovery(): Promise<DiscoveredProvider[]> {
  const registrations = listEnabledExtensionEntries().flatMap((entry) => {
    const action = entry.manifest.contributes?.modelDiscovery?.action;
    if (!action || typeof action !== 'string') return [];
    return [{ extensionId: entry.manifest.id, action }];
  });

  if (registrations.length === 0) return [];

  const results = await Promise.allSettled(
    registrations.map(({ extensionId, action }) => invokeExtensionAction(extensionId, action, null).then((r) => (r.ok ? r.result : null))),
  );

  return results.flatMap((r) => {
    if (r.status === 'rejected' || !r.value || typeof r.value !== 'object') return [];
    const provider = r.value as DiscoveredProvider;
    if (!provider.provider || !provider.baseUrl || !Array.isArray(provider.models)) return [];
    return [provider];
  });
}
