import { useEffect, useRef, useState } from 'react';

import { type ComposerButtonContext, ComposerButtonHost } from '../../extensions/ComposerButtonHost';
import { setExtensionCommandContext } from '../../extensions/commands';
import type { ExtensionComposerControlRegistration } from '../../extensions/useExtensionRegistry';
import { cx, IconButton } from '../ui';
import {
  COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT,
  COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT,
  COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT,
} from './composerPreferenceCommands';

function MoreHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function ConversationPreferencesRow({
  composerButtons = [],
  composerButtonContext,
  inlineLimit,
}: {
  composerButtons: ExtensionComposerControlRegistration[];
  composerButtonContext: Omit<ComposerButtonContext, 'renderMode'>;
  inlineLimit: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inlineCount = Math.max(0, inlineLimit);
  const inlineControls = composerButtons.slice(0, inlineCount);
  const menuControls = composerButtons.slice(inlineCount);
  const hasMenuItems = menuControls.length > 0;

  useEffect(() => {
    setExtensionCommandContext('composer.preferencesAvailable', hasMenuItems);
    return () => setExtensionCommandContext('composer.preferencesAvailable', null);
  }, [hasMenuItems]);

  useEffect(() => {
    setExtensionCommandContext('composer.preferencesOpen', menuOpen);
    return () => setExtensionCommandContext('composer.preferencesOpen', null);
  }, [menuOpen]);

  useEffect(() => {
    function handleOpenPreferencesCommand() {
      if (hasMenuItems) setMenuOpen(true);
    }

    window.addEventListener(COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT, handleOpenPreferencesCommand);
    return () => window.removeEventListener(COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT, handleOpenPreferencesCommand);
  }, [hasMenuItems]);

  useEffect(() => {
    function handleTogglePreferencesCommand() {
      if (hasMenuItems) setMenuOpen((current) => !current);
    }

    window.addEventListener(COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT, handleTogglePreferencesCommand);
    return () => window.removeEventListener(COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT, handleTogglePreferencesCommand);
  }, [hasMenuItems]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClosePreferencesCommand() {
      setMenuOpen(false);
    }

    window.addEventListener(COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT, handleClosePreferencesCommand);
    return () => window.removeEventListener(COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT, handleClosePreferencesCommand);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      {inlineControls.map((control) => (
        <ComposerButtonHost
          key={`${control.extensionId}:${control.id}`}
          registration={control}
          buttonContext={{ ...composerButtonContext, renderMode: 'inline' }}
        />
      ))}

      {hasMenuItems && (
        <div ref={menuRef} className="relative">
          <IconButton
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className={cx(
              'h-8 w-8 rounded-md border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/25 focus-visible:ring-offset-1 focus-visible:ring-offset-base',
              menuOpen && 'bg-surface/55 text-primary',
            )}
            aria-label="More composer settings"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            title="More composer settings"
          >
            <MoreHorizontalIcon />
          </IconButton>
          {menuOpen && (
            <div
              className="ui-context-menu-shell absolute bottom-full left-1/2 z-50 mb-2 w-[min(13rem,calc(100vw-1rem))] -translate-x-1/2 p-2.5"
              role="dialog"
              aria-label="Composer settings"
            >
              <div className="flex flex-col gap-2">
                {menuControls.map((control) => (
                  <ComposerButtonHost
                    key={`${control.extensionId}:${control.id}`}
                    registration={control}
                    buttonContext={{ ...composerButtonContext, renderMode: 'menu' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
