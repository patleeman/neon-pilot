import { WindowedStateBlock } from '@neon-pilot/windowed-os-ui';
import React, { type ComponentType, lazy, Suspense, useMemo } from 'react';

import { buildApiPath } from '../client/apiBase';
import { addNotification } from '../components/notifications/notificationStore';
import { cx, ErrorState, QuietLoadingState } from '../components/ui';
import { ensureExtensionFrontendReactGlobals } from './extensionFrontendReactGlobals';
import { getExtensionRegistryRevision } from './extensionRegistryEvents';
import {
  type ExtensionHostViewComponent,
  type ExtensionHostViewComponentProps,
  type ExtensionHostViewWrapperComponent,
  isHostViewComponentReference,
  lazyHostViewComponent,
} from './hostViewComponents';
import { createNativeExtensionClient } from './nativePaClient';
import { systemExtensionModules } from './systemExtensionModules';
import type { NativeExtensionViewSummary } from './types';
import { useExtensionStyles } from './useExtensionStyles';

type ExtensionComponent = ComponentType<ExtensionHostViewComponentProps>;

function loadExtensionModule(surface: NativeExtensionViewSummary, revision: number, retryNonce?: number): Promise<Record<string, unknown>> {
  ensureExtensionFrontendReactGlobals();
  const systemLoader = systemExtensionModules.get(surface.extensionId);
  if (systemLoader) {
    return systemLoader().catch((error: unknown) => {
      if (!isRecoverableDynamicImportError(error)) throw error;
      return loadExtensionDistModule(surface, revision, retryNonce);
    });
  }
  return loadExtensionDistModule(surface, revision, retryNonce);
}

function isRecoverableDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Failed to fetch dynamically imported module') || message.includes('Importing a module script failed');
}

function loadExtensionDistModule(
  surface: NativeExtensionViewSummary,
  revision: number,
  retryNonce?: number,
): Promise<Record<string, unknown>> {
  const entry = surface.frontend?.entry;
  if (!entry) throw new Error(`Extension ${surface.extensionId} has no frontend entry.`);
  const query = retryNonce === undefined ? `v=${revision}` : `v=${revision}&retry=${retryNonce}`;
  const source = buildApiPath(
    `/extensions/${encodeURIComponent(surface.extensionId)}/files/${entry.split('/').map(encodeURIComponent).join('/')}?${query}`,
  );
  return import(/* @vite-ignore */ source) as Promise<Record<string, unknown>>;
}

async function loadExtensionModuleWithRetry(surface: NativeExtensionViewSummary, revision: number): Promise<Record<string, unknown>> {
  try {
    return await loadExtensionModule(surface, revision);
  } catch {
    // Browser module loaders permanently cache failed dynamic imports by URL.
    // If an extension was rebuilt after an earlier bad bundle, retry once with
    // a fresh URL so the fixed dist/frontend.js can load without an app restart.
    return loadExtensionModule(surface, revision, Date.now());
  }
}

function extensionModuleKey(surface: NativeExtensionViewSummary): string {
  return `${surface.extensionId}:${surface.id}:${surface.frontend?.entry ?? ''}`;
}

function lazyExtensionComponent(surface: NativeExtensionViewSummary, revision: number) {
  return lazy(async () => {
    const module = await loadExtensionModuleWithRetry(surface, revision);
    if (typeof surface.component !== 'string') {
      return { default: ExtensionSurfaceErrorComponent };
    }
    const component = module[surface.component];
    if (typeof component !== 'function') {
      return { default: ExtensionSurfaceErrorComponent };
    }
    return { default: component as ExtensionComponent };
  });
}

function normalizeSlotOverrides(component: NativeExtensionViewSummary['component']): Record<string, string> {
  if (!isHostViewComponentReference(component)) return {};
  const overrides = component.overrides && typeof component.overrides === 'object' ? { ...component.overrides } : {};
  if (component.override && !overrides.wrapper) overrides.wrapper = component.override;
  return overrides;
}

function lazyHostViewSurfaceComponent(surface: NativeExtensionViewSummary, revision: number) {
  if (!isHostViewComponentReference(surface.component)) throw new Error('Host view component reference expected.');
  const hostId = surface.component.host;
  const slotOverrideExports = normalizeSlotOverrides(surface.component);
  const wrapperExport = slotOverrideExports.wrapper;
  const slotExports = Object.fromEntries(Object.entries(slotOverrideExports).filter(([slot]) => slot !== 'wrapper'));
  const HostComponent = lazyHostViewComponent(hostId);

  if (!wrapperExport && Object.keys(slotExports).length === 0) {
    return HostComponent;
  }

  return lazy(async () => {
    const module = await loadExtensionModuleWithRetry(surface, revision);
    const slotOverrides: Record<string, React.ComponentType<ExtensionHostViewComponentProps>> = {};
    for (const [slot, exportName] of Object.entries(slotExports)) {
      const slotComponent = module[exportName];
      if (typeof slotComponent !== 'function') throw new Error(`Extension host view override not found: ${slot} -> ${exportName}`);
      slotOverrides[slot] = slotComponent as React.ComponentType<ExtensionHostViewComponentProps>;
    }

    if (wrapperExport) {
      const wrapper = module[wrapperExport];
      if (typeof wrapper !== 'function') throw new Error(`Extension host view wrapper override not found: ${wrapperExport}`);
      const Wrapper = wrapper as ExtensionHostViewWrapperComponent;
      return {
        default: function HostViewWrapper(props: ExtensionHostViewComponentProps) {
          return <Wrapper {...props} HostComponent={HostComponent as ExtensionHostViewComponent} slotOverrides={slotOverrides} />;
        },
      };
    }

    return {
      default: function HostViewWithSlotOverrides(props: ExtensionHostViewComponentProps) {
        return <HostComponent {...props} slotOverrides={slotOverrides} />;
      },
    };
  });
}

const EXTENSION_SURFACE_ERROR_MESSAGE = 'This app page could not be loaded.';

function ExtensionSurfaceError({ shellPresentation }: { shellPresentation?: 'stable' | 'windowed' }) {
  if (shellPresentation === 'windowed') {
    return (
      <div className="wos-window-route-loading" role="status" aria-live="polite" aria-label="App page failed to load">
        <WindowedStateBlock tone="danger" title="App page failed to load">
          {EXTENSION_SURFACE_ERROR_MESSAGE}
        </WindowedStateBlock>
      </div>
    );
  }
  return <ErrorState message={EXTENSION_SURFACE_ERROR_MESSAGE} className="m-6" />;
}

function ExtensionSurfaceErrorComponent({ context }: ExtensionHostViewComponentProps) {
  return <ExtensionSurfaceError shellPresentation={context.shellPresentation} />;
}

export function NativeExtensionSurfaceHost({
  surface,
  pathname,
  search,
  hash,
  shellPresentation = 'windowed',
  conversationId,
  cwd,
  instanceId,
}: {
  surface: NativeExtensionViewSummary;
  pathname: string;
  search: string;
  hash: string;
  shellPresentation?: 'stable' | 'windowed';
  conversationId?: string | null;
  cwd?: string | null;
  instanceId?: string | null;
}) {
  useExtensionStyles(surface.extensionId, surface.frontend?.styles);

  const pa = useMemo(() => createNativeExtensionClient(surface.extensionId), [surface.extensionId]);
  const moduleKey = extensionModuleKey(surface);
  const Component = useMemo(() => {
    if (isHostViewComponentReference(surface.component)) return lazyHostViewSurfaceComponent(surface, getExtensionRegistryRevision());
    return lazyExtensionComponent(surface, getExtensionRegistryRevision());
  }, [surface, moduleKey]);
  const context = useMemo(
    () => ({
      extensionId: surface.extensionId,
      surfaceId: surface.id,
      shellPresentation,
      route: surface.route,
      pathname,
      search,
      hash,
      conversationId,
      cwd,
      instanceId,
    }),
    [conversationId, cwd, hash, instanceId, pathname, search, shellPresentation, surface.extensionId, surface.id, surface.route],
  );

  const isWindowedMainSurface = shellPresentation === 'windowed' && surface.location === 'main';
  const shouldUseTransparentChrome = surface.location === 'sidebar' || surface.location === 'rightRail' || isWindowedMainSurface;

  return (
    <section
      className={cx(
        'h-full min-h-0 overflow-auto',
        shouldUseTransparentChrome ? 'bg-transparent' : 'bg-base',
        isWindowedMainSurface && 'wos-native-extension-surface wos-native-extension-surface--windowed',
      )}
      data-extension-id={surface.extensionId}
      data-extension-surface-id={surface.id}
      data-shell-presentation={shellPresentation}
    >
      <Suspense fallback={<ExtensionSurfaceLoading shellPresentation={shellPresentation} />}>
        <ExtensionErrorBoundary extensionId={surface.extensionId} shellPresentation={shellPresentation}>
          <Component
            pa={pa}
            context={context}
            surface={surface}
            params={{}}
            hostProps={isHostViewComponentReference(surface.component) ? surface.component.props : undefined}
          />
        </ExtensionErrorBoundary>
      </Suspense>
    </section>
  );
}

function ExtensionSurfaceLoading({ shellPresentation }: { shellPresentation: 'stable' | 'windowed' }) {
  if (shellPresentation === 'windowed') {
    return (
      <div className="wos-window-route-loading" role="status" aria-live="polite" aria-label="Loading app page">
        <WindowedStateBlock title="Loading app page">Preparing the window contents.</WindowedStateBlock>
      </div>
    );
  }
  return <QuietLoadingState label="Loading app page" />;
}

class ExtensionErrorBoundary extends React.Component<
  { children: React.ReactNode; extensionId: string; shellPresentation: 'stable' | 'windowed' },
  { message: string | null }
> {
  state = { message: null };

  static getDerivedStateFromError(error: unknown) {
    void error;
    return { message: EXTENSION_SURFACE_ERROR_MESSAGE };
  }

  componentDidCatch(error: unknown, _errorInfo: { componentStack?: string }) {
    addNotification({
      type: 'error',
      message: EXTENSION_SURFACE_ERROR_MESSAGE,
      details: error instanceof Error ? error.stack : undefined,
      source: this.props.extensionId,
    });
  }

  render() {
    return this.state.message ? <ExtensionSurfaceError shellPresentation={this.props.shellPresentation} /> : this.props.children;
  }
}
