import { createContext, createElement, type ReactNode, useContext, useEffect, useState } from 'react';

import { useAppEvents } from '../app/contexts';
import { api } from '../client/api';
import { recordExtensionRegistryUsability } from '../client/perfDiagnostics';
import { EXTENSION_REGISTRY_CHANGED_EVENT } from './extensionRegistryEvents';
import { criticalExtensionRegistryPrewarm } from './extensionRegistryPrewarm';
import {
  EMPTY_EXTENSION_REGISTRY_STATE,
  type ExtensionRegistryState,
  INITIAL_EXTENSION_REGISTRY_STATE,
  normalizeExtensionRegistryState,
} from './extensionRegistryProjection';

export type {
  ExtensionActivityTreeItemActionRegistration,
  ExtensionActivityTreeItemElementRegistration,
  ExtensionActivityTreeItemStyleRegistration,
  ExtensionComposerAttachmentProviderRegistration,
  ExtensionComposerAttachmentRendererRegistration,
  ExtensionComposerAttachmentResolverRegistration,
  ExtensionComposerControlRegistration,
  ExtensionComposerInputToolRegistration,
  ExtensionComposerShelfRegistration,
  ExtensionContextMenuRegistration,
  ExtensionConversationDecoratorRegistration,
  ExtensionConversationHeaderElementRegistration,
  ExtensionConversationLifecycleRegistration,
  ExtensionMessageActionRegistration,
  ExtensionNewConversationPanelRegistration,
  ExtensionRegistryEntry,
  ExtensionRegistryState,
  ExtensionSelectionActionRegistration,
  ExtensionSettingsComponentRegistration,
  ExtensionStatusBarItemRegistration,
  ExtensionThreadHeaderActionRegistration,
  ExtensionToolbarActionRegistration,
  ExtensionTopBarElementRegistration,
  ExtensionTranscriptBlockRegistration,
  ExtensionWidgetRegistration,
} from './extensionRegistryProjection';

const ExtensionRegistryContext = createContext<ExtensionRegistryState>(EMPTY_EXTENSION_REGISTRY_STATE);

function canLoadExtensionRegistry(): boolean {
  return typeof api.extensionRegistry === 'function';
}

function canLoadCriticalExtensionRegistry(): boolean {
  return typeof api.extensionCriticalRegistry === 'function';
}

async function fetchExtensionRegistryState(options?: { critical?: boolean }): Promise<ExtensionRegistryState> {
  if (!canLoadExtensionRegistry()) {
    return EMPTY_EXTENSION_REGISTRY_STATE;
  }

  const { extensions, routes, surfaces, settings } =
    options?.critical === true && canLoadCriticalExtensionRegistry()
      ? await api.extensionCriticalRegistry()
      : await api.extensionRegistry();
  return normalizeExtensionRegistryState(extensions, routes, surfaces, settings);
}

let initialExtensionRegistryState: ExtensionRegistryState | null = null;
let initialExtensionRegistryLoad: Promise<ExtensionRegistryState> | null = criticalExtensionRegistryPrewarm
  ? criticalExtensionRegistryPrewarm
      .then(({ extensions, routes, surfaces, settings }) => normalizeExtensionRegistryState(extensions, routes, surfaces, settings))
      .then((state) => {
        initialExtensionRegistryState = state;
        recordLoadedExtensionRegistry(state);
        return state;
      })
      .catch(() => {
        initialExtensionRegistryState = EMPTY_EXTENSION_REGISTRY_STATE;
        recordExtensionRegistryUsability({ loading: false, counts: {} });
        return EMPTY_EXTENSION_REGISTRY_STATE;
      })
  : null;

function recordLoadedExtensionRegistry(state: ExtensionRegistryState): void {
  recordExtensionRegistryUsability({
    loading: false,
    counts: {
      extensions: state.extensions.length,
      routes: state.routes.length,
      surfaces: state.surfaces.length,
      topBarElements: state.topBarElements.length,
      composerControls: state.composerControls.length,
      composerInputTools: state.composerInputTools.length,
    },
  });
}

function useExtensionRegistryLoader(): ExtensionRegistryState {
  const { versions } = useAppEvents();
  const [state, setState] = useState<ExtensionRegistryState>(() => initialExtensionRegistryState ?? INITIAL_EXTENSION_REGISTRY_STATE);

  useEffect(() => {
    let cancelled = false;
    let loadTimer: ReturnType<typeof window.setTimeout> | null = null;

    const load = () => {
      setState((previous) => ({ ...previous, loading: true, error: null }));

      if (!canLoadExtensionRegistry()) {
        if (cancelled) return;
        setState(EMPTY_EXTENSION_REGISTRY_STATE);
        return;
      }

      const loadPromise = initialExtensionRegistryState
        ? Promise.resolve(initialExtensionRegistryState)
        : (initialExtensionRegistryLoad ?? fetchExtensionRegistryState({ critical: true }));
      initialExtensionRegistryLoad = null;
      loadPromise
        .then((nextState) => {
          if (cancelled) return;
          initialExtensionRegistryState = null;
          setState(nextState);
          recordLoadedExtensionRegistry(nextState);
          if (canLoadExtensionRegistry()) {
            void fetchExtensionRegistryState()
              .then((fullState) => {
                if (cancelled) return;
                setState(fullState);
              })
              .catch(() => undefined);
          }
        })
        .catch((error: Error) => {
          if (cancelled) return;
          setState({
            ...EMPTY_EXTENSION_REGISTRY_STATE,
            error: error.message,
          });
          recordExtensionRegistryUsability({ loading: false, counts: {} });
        });
    };

    // Startup readiness waits for this registry, so kick the critical chrome
    // metadata request immediately instead of burning an artificial frame delay.
    loadTimer = window.setTimeout(load, 0);
    window.addEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);

    return () => {
      cancelled = true;
      if (loadTimer !== null) {
        window.clearTimeout(loadTimer);
      }
      window.removeEventListener(EXTENSION_REGISTRY_CHANGED_EVENT, load);
    };
  }, [versions.extensions]);

  return state;
}

export function ExtensionRegistryProvider({ children }: { children: ReactNode }) {
  const state = useExtensionRegistryLoader();
  return createElement(ExtensionRegistryContext.Provider, { value: state }, children);
}

export function useExtensionRegistry(): ExtensionRegistryState {
  return useContext(ExtensionRegistryContext);
}
