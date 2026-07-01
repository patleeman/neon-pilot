import type { ExtensionSurfaceProps } from '@neon-pilot/extensions';
import { QuietLoadingState } from '@neon-pilot/extensions/ui';
import React, { lazy, Suspense } from 'react';

const LazyPromptAssemblyPage = lazy(async () => ({ default: (await import('./page.js')).PromptAssemblyPage }));
const fallback = <QuietLoadingState label="Loading prompt assembly page" />;

export function PromptAssemblyPage(props: ExtensionSurfaceProps) {
  return (
    <Suspense fallback={fallback}>
      <LazyPromptAssemblyPage {...props} />
    </Suspense>
  );
}

export function PromptAssemblySettingsPanel({
  pa,
  settingsContext,
}: {
  pa: ExtensionSurfaceProps['pa'];
  settingsContext?: { sectionId?: string };
}) {
  return (
    <PromptAssemblyPage
      pa={pa}
      context={{
        cwd: undefined,
        pathname: '/settings',
        search: '',
        hash: settingsContext?.sectionId ? `#${settingsContext.sectionId}` : '#settings-prompt-assembly',
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
