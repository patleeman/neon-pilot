import './frontend.css';

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

function SettingsSectionPage({ sectionIds }: { sectionIds: SettingsSectionId[] }) {
  useEffect(() => {
    window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionIds[0]);
      if (typeof section?.scrollIntoView === 'function') {
        section.scrollIntoView({ block: 'start' });
      }
    });
  }, [sectionIds]);

  return <SettingsPage sectionIds={sectionIds} />;
}

export { SettingsPage, SettingsSidebar };

export function ProviderSettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-providers']} />;
}

export function WorkspaceSettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-workspace']} />;
}

export function CommandsSettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-commands']} />;
}

export function SecuritySettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-security']} />;
}

export function ExtensionsSettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-extensions']} />;
}

export function DesktopSettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-desktop']} />;
}
