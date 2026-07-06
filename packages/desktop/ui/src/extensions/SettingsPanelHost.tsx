import type { ExtensionSettingsPanelContext } from '@neon-pilot/extensions';
import React, { type ComponentType, lazy, Suspense, useMemo } from 'react';

import { buildApiPath } from '../client/apiBase';
import { ErrorState, QuietLoadingState } from '../components/ui';
import { ensureExtensionFrontendReactGlobals } from './extensionFrontendReactGlobals';
import { getExtensionRegistryRevision } from './extensionRegistryEvents';
import { createNativeExtensionClient } from './nativePaClient';
import { systemExtensionModules } from './systemExtensionModules';
export interface ExtensionSettingsPanelRegistration {
  extensionId: string;
  id: string;
  component: string;
  sectionId: string;
  label: string;
  description?: string;
  order?: number;
  frontendEntry?: string;
}

type ExtensionSettingsPanelComponent = ComponentType<{
  pa: ReturnType<typeof createNativeExtensionClient>;
  settingsContext: ExtensionSettingsPanelContext;
}>;

function renderSettingsPanelError(body: string) {
  return {
    default: () => <ErrorState title="App settings failed to render." body={body} className="p-4" />,
  };
}

function loadPanelModule(registration: ExtensionSettingsPanelRegistration, revision: number): Promise<Record<string, unknown>> {
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

export function SettingsPanelHost({
  registration,
  shellPresentation = 'windowed',
}: {
  registration: ExtensionSettingsPanelRegistration;
  shellPresentation?: 'windowed';
}) {
  const moduleKey = `${registration.extensionId}:${registration.frontendEntry ?? ''}:${getExtensionRegistryRevision()}`;
  const pa = useMemo(() => createNativeExtensionClient(registration.extensionId), [registration.extensionId]);
  const friendlyErrorBody = `The settings panel for ${registration.label} could not load. Reload the app or try again after updating it.`;
  const Component = useMemo(
    () =>
      lazy(async () => {
        let module: Record<string, unknown>;
        try {
          module = await loadPanelModule(registration, getExtensionRegistryRevision());
        } catch (error) {
          console.error(`Extension settings failed to load: ${registration.extensionId}:${registration.id}`, error);
          return renderSettingsPanelError(friendlyErrorBody);
        }
        const component = module[registration.component] as ExtensionSettingsPanelComponent | undefined;
        if (typeof component !== 'function') {
          return renderSettingsPanelError(friendlyErrorBody);
        }
        return { default: component };
      }),
    [friendlyErrorBody, moduleKey, registration],
  );

  return (
    <SettingsPanelErrorBoundary extensionId={registration.extensionId} componentId={registration.id} errorBody={friendlyErrorBody}>
      <Suspense fallback={<QuietLoadingState label="Loading app settings" />}>
        <Component
          pa={pa}
          settingsContext={{ sectionId: registration.sectionId, extensionId: registration.extensionId, shellPresentation }}
        />
      </Suspense>
    </SettingsPanelErrorBoundary>
  );
}

class SettingsPanelErrorBoundary extends React.Component<
  { children: React.ReactNode; extensionId: string; componentId: string; errorBody: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`Extension settings failed to render: ${this.props.extensionId}:${this.props.componentId}`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorState title="App settings failed to render." body={this.props.errorBody} className="p-4" />;
  }
}
