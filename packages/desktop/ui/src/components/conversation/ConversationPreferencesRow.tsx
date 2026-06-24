import type { ComposerControlContext } from '@neon-pilot/extensions/composer';
import { useCallback, useEffect, useRef, useState } from 'react';

import { setExtensionCommandContext } from '../../extensions/commands';
import { ComposerButtonHost } from '../../extensions/ComposerButtonHost';
import type { ExtensionComposerControlRegistration } from '../../extensions/useExtensionRegistry';
import { ContextMenu } from '../shared/ContextMenu';
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

const COMPOSER_PREFERENCES_MENU_WIDTH = 208;

export function ConversationPreferencesRow({
  composerControls = [],
  composerControlContext,
  inlineLimit,
}: {
  composerControls: ExtensionComposerControlRegistration[];
  composerControlContext: Omit<ComposerControlContext, 'renderMode'>;
  inlineLimit: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inlineCount = Math.max(0, inlineLimit);
  const inlineControls = composerControls.slice(0, inlineCount);
  const menuControls = composerControls.slice(inlineCount);
  const hasMenuItems = menuControls.length > 0;
  const estimatedMenuHeight = Math.max(56, menuControls.length * 40 + 20);

  const openMenu = useCallback(() => {
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) {
      setMenuPosition({ x: 12, y: 12 });
      setMenuOpen(true);
      return;
    }

    setMenuPosition({
      x: bounds.left + bounds.width / 2 - COMPOSER_PREFERENCES_MENU_WIDTH / 2,
      y: bounds.top - estimatedMenuHeight - 8,
    });
    setMenuOpen(true);
  }, [estimatedMenuHeight]);

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
      if (hasMenuItems) openMenu();
    }

    window.addEventListener(COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT, handleOpenPreferencesCommand);
    return () => window.removeEventListener(COMPOSER_OPEN_PREFERENCES_COMMAND_EVENT, handleOpenPreferencesCommand);
  }, [hasMenuItems, openMenu]);

  useEffect(() => {
    function handleTogglePreferencesCommand() {
      if (!hasMenuItems) return;
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      openMenu();
    }

    window.addEventListener(COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT, handleTogglePreferencesCommand);
    return () => window.removeEventListener(COMPOSER_TOGGLE_PREFERENCES_COMMAND_EVENT, handleTogglePreferencesCommand);
  }, [hasMenuItems, menuOpen, openMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClosePreferencesCommand() {
      setMenuOpen(false);
    }

    window.addEventListener(COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT, handleClosePreferencesCommand);
    return () => window.removeEventListener(COMPOSER_CLOSE_PREFERENCES_COMMAND_EVENT, handleClosePreferencesCommand);
  }, [menuOpen]);

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2">
      {inlineControls.map((control) => (
        <ComposerButtonHost
          key={`${control.extensionId}:${control.id}`}
          registration={control}
          controlContext={{ ...composerControlContext, renderMode: 'inline' }}
        />
      ))}

      {hasMenuItems && (
        <div className="relative">
          <IconButton
            ref={buttonRef}
            type="button"
            onClick={() => {
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              openMenu();
            }}
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
          {menuOpen && menuPosition ? (
            <ContextMenu
              aria-label="Composer settings"
              className="z-50 grid gap-2 p-2.5"
              estimatedHeight={estimatedMenuHeight}
              ignoreRefs={[buttonRef]}
              minWidth={COMPOSER_PREFERENCES_MENU_WIDTH}
              onClose={() => setMenuOpen(false)}
              position={menuPosition}
              role="dialog"
              style={{ width: `min(${COMPOSER_PREFERENCES_MENU_WIDTH / 16}rem, calc(100vw - 1rem))` }}
            >
              <div className="flex flex-col gap-2">
                {menuControls.map((control) => (
                  <ComposerButtonHost
                    key={`${control.extensionId}:${control.id}`}
                    registration={control}
                    controlContext={{ ...composerControlContext, renderMode: 'menu' }}
                  />
                ))}
              </div>
            </ContextMenu>
          ) : null}
        </div>
      )}
    </div>
  );
}
