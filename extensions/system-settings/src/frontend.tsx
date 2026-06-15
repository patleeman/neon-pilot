import { useEffect } from 'react';

import { SettingsPage, SettingsSidebar } from './SettingsPage';
import './frontend.css';

type SettingsSectionId =
  | 'settings-appearance'
  | 'settings-conversation'
  | 'settings-workspace'
  | 'settings-commands'
  | 'settings-security'
  | 'settings-providers'
  | 'settings-desktop';

function SettingsSectionPage({ sectionIds }: { sectionIds: SettingsSectionId[] }) {
  useEffect(() => {
    window.requestAnimationFrame(() => document.getElementById(sectionIds[0])?.scrollIntoView({ block: 'start' }));
  }, [sectionIds]);

  return <SettingsPage sectionIds={sectionIds} />;
}

export { SettingsPage, SettingsSidebar };

export function ProviderSettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-providers']} />;
}

export function DesktopSettingsPage() {
  return <SettingsSectionPage sectionIds={['settings-desktop']} />;
}
