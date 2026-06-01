import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';

import { loadExtensionAgentFactory, runExtensionAgentFactory } from './extensionBackend.js';
import { ExtensionProcessTerminationBlockedError } from './extensionProcessGuard.js';
import {
  listExtensionAgentRegistrations,
  recordExtensionFailure,
  resolveExtensionModelProfile,
  setExtensionEnabled,
  setExtensionHealthError,
} from './extensionRegistry.js';

function quarantineExtensionFatalError(extensionId: string, error: unknown): void {
  if (!(error instanceof ExtensionProcessTerminationBlockedError)) return;
  setExtensionHealthError(extensionId, error.message);
  setExtensionEnabled(extensionId, false);
}

export function createManifestAgentExtensions(options: { onError?: (message: string, fields?: Record<string, unknown>) => void } = {}): {
  factories: ExtensionFactory[];
  errors: Array<{ extensionId: string; message: string }>;
} {
  const registrations = listExtensionAgentRegistrations();
  const errors: Array<{ extensionId: string; message: string }> = [];

  // Eagerly preload all agent extension backends so tool registration is
  // synchronous when the factory is invoked. Without preloading the factory
  // must await import() via .then(), which registers tools on a later
  // microtask — after the model has already queried the tool registry.
  const preloaded = new Array<ExtensionFactory | null>(registrations.length);
  for (const [index, reg] of registrations.entries()) {
    loadExtensionAgentFactory(reg.extensionId, reg.exportName)
      .then((factory) => {
        preloaded[index] = factory;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ extensionId: reg.extensionId, message });
        options.onError?.('failed to load extension agent factory', {
          extensionId: reg.extensionId,
          exportName: reg.exportName,
          message,
        });
      });
  }

  return {
    factories: registrations.map((reg, index): ExtensionFactory => {
      return async (pi) => {
        const factory = preloaded[index];
        if (factory) {
          // Preloaded — call synchronously. Since this function is async,
          // await factory(api) in the SDK will still await the returned
          // promise, which resolves on the next microtask.
          try {
            await runExtensionAgentFactory(reg.extensionId, reg.exportName, factory, pi);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            quarantineExtensionFatalError(reg.extensionId, error);
            if (!(error instanceof ExtensionProcessTerminationBlockedError)) {
              recordExtensionFailure({ extensionId: reg.extensionId, operation: 'agent extension factory', error: message });
            }
            errors.push({ extensionId: reg.extensionId, message });
            options.onError?.('failed to run extension agent factory', {
              extensionId: reg.extensionId,
              exportName: reg.exportName,
              message,
            });
          }
        } else {
          // Edge case: session starts before preload finishes.
          try {
            const f = await loadExtensionAgentFactory(reg.extensionId, reg.exportName);
            await runExtensionAgentFactory(reg.extensionId, reg.exportName, f, pi);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            quarantineExtensionFatalError(reg.extensionId, error);
            if (!(error instanceof ExtensionProcessTerminationBlockedError)) {
              recordExtensionFailure({ extensionId: reg.extensionId, operation: 'agent extension factory', error: message });
            }
            errors.push({ extensionId: reg.extensionId, message });
            options.onError?.('failed to load extension agent factory', {
              extensionId: reg.extensionId,
              exportName: reg.exportName,
              message,
            });
          }
        }
      };
    }),
    errors,
  };
}

export function listManifestAgentExtensionCacheEntries(): Array<{ extensionId: string; exportName: string }> {
  return listExtensionAgentRegistrations().map((registration) => ({
    extensionId: registration.extensionId,
    exportName: registration.exportName,
  }));
}

export function resolveManifestAgentLifecycleModelProfile(input: { provider: string; model: string }) {
  return resolveExtensionModelProfile(input);
}
