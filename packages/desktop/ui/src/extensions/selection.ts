export type ExtensionSelectionKind = 'text' | 'messages' | 'files' | 'transcriptRange' | 'resource';

export interface ExtensionResourceSelection {
  type: string;
  id: string;
  label?: string;
  source?: string;
  data?: unknown;
}

export interface ExtensionSelectionState {
  kind: ExtensionSelectionKind;
  text?: string;
  messageBlockIds?: string[];
  files?: Array<{ cwd: string; path: string }>;
  transcriptRange?: { conversationId: string; startBlockId: string; endBlockId: string };
  /**
   * Route page selection state for right-sidebar context rails. Main pages
   * publish the selected row/object here; route-owned rails subscribe to render
   * details without opening modal inspectors.
   */
  resource?: ExtensionResourceSelection;
  conversationId?: string | null;
  cwd?: string | null;
  updatedAt: string;
}

let currentSelection: ExtensionSelectionState | null = null;
const listeners = new Set<(selection: ExtensionSelectionState | null) => void>();

export function readExtensionSelection(): ExtensionSelectionState | null {
  return currentSelection;
}

export function setExtensionSelection(selection: Omit<ExtensionSelectionState, 'updatedAt'> | null): void {
  currentSelection = selection ? { ...selection, updatedAt: new Date().toISOString() } : null;
  for (const listener of listeners) {
    try {
      listener(currentSelection);
    } catch (error) {
      console.warn('[extension-selection] listener error:', error);
    }
  }
  window.dispatchEvent(new CustomEvent('neon-pilot-extension-selection-change', { detail: currentSelection }));
  window.dispatchEvent(new CustomEvent('pa-ext-event', { detail: { event: 'host:selection', payload: currentSelection } }));
}

export function subscribeExtensionSelection(listener: (selection: ExtensionSelectionState | null) => void): { unsubscribe: () => void } {
  listeners.add(listener);
  listener(currentSelection);
  return { unsubscribe: () => listeners.delete(listener) };
}
