import { useEffect, useRef } from 'react';

import { getDesktopBridge } from '../desktop/desktopBridge';
import type { ExtensionSurfaceSummary } from '../extensions/types';
import { routeIsKnowledge } from '../navigation/routeRegistry';

const SIDEBAR_BROWSER_NEW_CHAT_HOTKEY = 'Ctrl+Shift+N';
const DESKTOP_CONVERSATION_SHORTCUT_EVENT = 'neon-pilot-desktop-shortcut';
const WORKBENCH_CLOSE_ACTIVE_FILE_EVENT = 'pa:workbench-close-active-file';
const WORKBENCH_DOCUMENT_WITH_OPEN_FILE_SELECTOR = '[data-workbench-document-pane="true"][data-has-open-file="true"]';

type DesktopConversationShortcutAction =
  | 'close-conversation'
  | 'reopen-closed-conversation'
  | 'previous-conversation'
  | 'next-conversation'
  | 'toggle-conversation-pin'
  | 'toggle-conversation-archive';

type UseSidebarShortcutsOptions = {
  activeConversationCount: number;
  extensionSurfaces: readonly ExtensionSurfaceSummary[];
  locationPathname: string;
  onCloseActiveConversation: () => void;
  onJumpToConversation: (index: number) => void;
  onNavigateConversation: (direction: -1 | 1) => void;
  onNewConversation: () => void;
  onReopenClosedConversation: () => void;
  onShiftActiveConversation: (direction: -1 | 1) => void;
  onToggleArchivedActiveConversation: () => void;
  onTogglePinnedActiveConversation: () => void;
};

function normalizeHotkeyKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

function hasCommandOrControlHotkey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function resolveConversationNumberHotkey(event: KeyboardEvent): number {
  if (event.shiftKey || event.altKey || !hasCommandOrControlHotkey(event)) {
    return -1;
  }

  const match = event.code.match(/^Digit([1-9])$/);
  if (match) {
    return Number(match[1]) - 1;
  }

  const key = normalizeHotkeyKey(event.key);
  return /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
}

function matchesLetterHotkey(event: KeyboardEvent, code: string, letter: string): boolean {
  return event.code === code || normalizeHotkeyKey(event.key) === letter;
}

function hasOverlayOpen(): boolean {
  return document.querySelector('.ui-overlay-backdrop') !== null;
}

function isFocusWithinWorkbenchOpenFile(): boolean {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof Element)) {
    return false;
  }

  return activeElement.closest(WORKBENCH_DOCUMENT_WITH_OPEN_FILE_SELECTOR) !== null;
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

function isDesktopConversationShortcutAction(value: unknown): value is DesktopConversationShortcutAction {
  return (
    value === 'close-conversation' ||
    value === 'reopen-closed-conversation' ||
    value === 'previous-conversation' ||
    value === 'next-conversation' ||
    value === 'toggle-conversation-pin' ||
    value === 'toggle-conversation-archive'
  );
}

export function getNewConversationHotkeyLabel(): string {
  if (getDesktopBridge() !== null) {
    return isMacPlatform() ? '⌘N' : 'Ctrl+N';
  }

  return SIDEBAR_BROWSER_NEW_CHAT_HOTKEY;
}

export function useSidebarShortcuts({
  activeConversationCount,
  extensionSurfaces,
  locationPathname,
  onCloseActiveConversation,
  onJumpToConversation,
  onNavigateConversation,
  onNewConversation,
  onReopenClosedConversation,
  onShiftActiveConversation,
  onToggleArchivedActiveConversation,
  onTogglePinnedActiveConversation,
}: UseSidebarShortcutsOptions) {
  const handlersRef = useRef({
    onCloseActiveConversation,
    onJumpToConversation,
    onNavigateConversation,
    onNewConversation,
    onReopenClosedConversation,
    onShiftActiveConversation,
    onToggleArchivedActiveConversation,
    onTogglePinnedActiveConversation,
  });

  useEffect(() => {
    handlersRef.current = {
      onCloseActiveConversation,
      onJumpToConversation,
      onNavigateConversation,
      onNewConversation,
      onReopenClosedConversation,
      onShiftActiveConversation,
      onToggleArchivedActiveConversation,
      onTogglePinnedActiveConversation,
    };
  }, [
    onCloseActiveConversation,
    onJumpToConversation,
    onNavigateConversation,
    onNewConversation,
    onReopenClosedConversation,
    onShiftActiveConversation,
    onToggleArchivedActiveConversation,
    onTogglePinnedActiveConversation,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || hasOverlayOpen()) {
        return;
      }

      const desktopBridge = getDesktopBridge();
      if (desktopBridge !== null) {
        const conversationIndex = resolveConversationNumberHotkey(event);
        if (conversationIndex !== -1 && conversationIndex < activeConversationCount) {
          event.preventDefault();
          handlersRef.current.onJumpToConversation(conversationIndex);
          return;
        }

        if (hasCommandOrControlHotkey(event) && event.altKey && !event.shiftKey) {
          if (event.code === 'BracketLeft') {
            event.preventDefault();
            handlersRef.current.onShiftActiveConversation(-1);
            return;
          }

          if (event.code === 'BracketRight') {
            event.preventDefault();
            handlersRef.current.onShiftActiveConversation(1);
            return;
          }
        }
      }

      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
        return;
      }

      const key = normalizeHotkeyKey(event.key);
      if (matchesLetterHotkey(event, 'KeyN', 'n')) {
        event.preventDefault();
        handlersRef.current.onNewConversation();
        return;
      }

      if (event.code === 'BracketLeft' || key === '[' || key === '{') {
        event.preventDefault();
        handlersRef.current.onNavigateConversation(-1);
        return;
      }

      if (event.code === 'BracketRight' || key === ']' || key === '}') {
        event.preventDefault();
        handlersRef.current.onNavigateConversation(1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeConversationCount]);

  useEffect(() => {
    if (getDesktopBridge() === null) {
      return;
    }

    function handleDesktopShortcut(event: Event) {
      if (hasOverlayOpen()) {
        return;
      }

      const action = (event as CustomEvent<{ action?: unknown }>).detail?.action;
      if (!isDesktopConversationShortcutAction(action)) {
        return;
      }

      const isKnowledgeRoute = routeIsKnowledge(locationPathname, extensionSurfaces);

      if (action === 'close-conversation') {
        if (isFocusWithinWorkbenchOpenFile()) {
          window.dispatchEvent(new CustomEvent(WORKBENCH_CLOSE_ACTIVE_FILE_EVENT));
          return;
        }

        if (isKnowledgeRoute) {
          window.dispatchEvent(new CustomEvent('kb:close-active-file'));
          return;
        }

        handlersRef.current.onCloseActiveConversation();
        return;
      }

      if (action === 'reopen-closed-conversation') {
        if (isKnowledgeRoute) {
          window.dispatchEvent(new CustomEvent('kb:reopen-closed-file'));
          return;
        }

        handlersRef.current.onReopenClosedConversation();
        return;
      }

      if (action === 'toggle-conversation-pin') {
        handlersRef.current.onTogglePinnedActiveConversation();
        return;
      }

      if (action === 'toggle-conversation-archive') {
        handlersRef.current.onToggleArchivedActiveConversation();
        return;
      }

      if (action === 'previous-conversation') {
        handlersRef.current.onNavigateConversation(-1);
        return;
      }

      handlersRef.current.onNavigateConversation(1);
    }

    window.addEventListener(DESKTOP_CONVERSATION_SHORTCUT_EVENT, handleDesktopShortcut);
    return () => window.removeEventListener(DESKTOP_CONVERSATION_SHORTCUT_EVENT, handleDesktopShortcut);
  }, [extensionSurfaces, locationPathname]);
}
