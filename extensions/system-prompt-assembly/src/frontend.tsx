import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { WindowedLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, type ReactNode, Suspense } from 'react';

const LazyPromptAssemblyPage = lazy(async () => ({ default: (await import('./page.js')).PromptAssemblyPage }));

function loadingFallback(label: string): ReactNode {
  return <WindowedLoadingState label={label} />;
}

export function PromptAssemblyPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={loadingFallback('Loading prompt assembly page')}>
      <LazyPromptAssemblyPage {...props} />
    </Suspense>
  );
}

export function PromptAssemblySettingsPanel({
  pa,
  settingsContext,
}: {
  pa: ExtensionSurfaceProps['pa'];
  settingsContext?: { sectionId?: string; shellPresentation?: 'windowed' };
}) {
  return (
    <PromptAssemblyPage
      pa={pa}
      context={{
        cwd: undefined,
        pathname: '/settings',
        search: '',
        hash: settingsContext?.sectionId ? `#${settingsContext.sectionId}` : '#settings-prompt-assembly',
        shellPresentation: settingsContext?.shellPresentation,
      }}
      surface={{
        id: 'prompt-assembly-settings',
        extensionId: 'system-prompt-assembly',
        title: 'Prompt Assembly',
        location: 'main',
        component: 'PromptAssemblySettingsPanel',
      }}
      params={{}}
    />
  );
}
