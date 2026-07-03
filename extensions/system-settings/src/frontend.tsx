import './frontend.css';

import type { ExtensionSurfaceProps } from '@neon-pilot/extensions/ui';
import { useEffect } from 'react';

import { SettingsPage, SettingsSidebar } from './SettingsPage';

type SettingsSectionId =
  | 'settings-appearance'
  | 'settings-conversation'
  | 'settings-workspace'
  | 'settings-commands'
  | 'settings-security'
  | 'settings-extensions'
  | 'settings-providers'
  | 'settings-desktop';

function SettingsSectionPage({ sectionIds, context }: ExtensionSurfaceProps & { sectionIds: SettingsSectionId[] }) {
  if (context.shellPresentation === 'windowed') {
    return <SettingsPage context={context} />;
  }

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionIds[0]);
      if (typeof section?.scrollIntoView === 'function') {
        section.scrollIntoView({ block: 'start' });
      }
    });
  }, [sectionIds]);

  return <SettingsPage sectionIds={sectionIds} context={context} />;
}

export { SettingsPage, SettingsSidebar };

export function AppearanceSettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-appearance']} />;
}

export function ProviderSettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-providers']} />;
}

export function ConversationSettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-conversation']} />;
}

export function WorkspaceSettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-workspace']} />;
}

export function CommandsSettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-commands']} />;
}

export function SecuritySettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-security']} />;
}

export function ExtensionsSettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-extensions']} />;
}

export function DesktopSettingsPage(props: ExtensionSurfaceProps) {
  return <SettingsSectionPage {...props} sectionIds={['settings-desktop']} />;
}
