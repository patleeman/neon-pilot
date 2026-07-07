import { type ComponentType, lazy, Suspense, useMemo } from 'react';

import { buildApiPath } from '../client/apiBase';
import { ensureExtensionFrontendReactGlobals } from './extensionFrontendReactGlobals';
import { getExtensionRegistryRevision } from './extensionRegistryEvents';
import { createNativeExtensionClient } from './nativePaClient';
import { systemExtensionModules } from './systemExtensionModules';
import type { ExtensionWidgetRegistration } from './useExtensionRegistry';

type WidgetComponent = ComponentType<{
  pa: ReturnType<typeof createNativeExtensionClient>;
}>;

function loadWidgetModule(registration: ExtensionWidgetRegistration, revision: number): Promise<Record<string, unknown>> {
  ensureExtensionFrontendReactGlobals();
  const systemLoader = systemExtensionModules.get(registration.extensionId);
  if (systemLoader) return systemLoader();
  const entry = registration.frontendEntry;
  if (!entry) throw new Error(`Extension ${registration.extensionId} has no frontend entry.`);
  const source = buildApiPath(
    `/extensions/${encodeURIComponent(registration.extensionId)}/files/${entry.split('/').map(encodeURIComponent).join('/')}?v=${revision}`,
  );
  return import(/* @vite-ignore */ source) as Promise<Record<string, unknown>>;
}

export function WidgetHost({ registration }: { registration: ExtensionWidgetRegistration }) {
  const moduleKey = `${registration.extensionId}:${registration.id}:${registration.frontendEntry ?? ''}:${getExtensionRegistryRevision()}`;
  const pa = useMemo(() => createNativeExtensionClient(registration.extensionId), [registration.extensionId]);
  const Component = useMemo(
    () =>
      lazy(async () => {
        const module = await loadWidgetModule(registration, getExtensionRegistryRevision());
        const component = module[registration.component] as WidgetComponent | undefined;
        if (typeof component !== 'function') {
          return { default: () => null as unknown as React.ReactElement };
        }
        return { default: component as React.ComponentType<{ pa: ReturnType<typeof createNativeExtensionClient> }> };
      }),
    [moduleKey],
  );

  return (
    <Suspense fallback={null}>
      <Component pa={pa} />
    </Suspense>
  );
}
