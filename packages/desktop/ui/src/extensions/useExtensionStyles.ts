import { useEffect } from 'react';

import { buildApiPath } from '../client/apiBase';
import { systemExtensionModules } from './systemExtensionModules';

/**
 * Tracks which extension stylesheets have already been injected into the DOM.
 * A single global set ensures deduplication across all extension surfaces,
 * and a counter map tracks how many active consumers reference each style
 * so it can be removed when no longer needed.
 */
const loadedStyles = new Map<string, { link: HTMLLinkElement; refCount: number }>();

/**
 * @internal — exported only for testing.
 */
export function __resetLoadedStylesForTest(): void {
  for (const { link } of loadedStyles.values()) {
    link.remove();
  }
  loadedStyles.clear();
}

const RESOLVE_CACHE = new Map<string, string>();

function resolveExtensionStyleUrl(extensionId: string, stylePath: string, revision: string | undefined): string {
  const cacheKey = `${extensionId}:${stylePath}`;
  const cached = RESOLVE_CACHE.get(cacheKey);
  if (cached) return cached;
  let url = buildApiPath(`/extensions/${encodeURIComponent(extensionId)}/files/${stylePath.split('/').map(encodeURIComponent).join('/')}`);
  if (revision) url += `?v=${encodeURIComponent(revision)}`;
  RESOLVE_CACHE.set(cacheKey, url);
  return url;
}

/**
 * Injects `<link rel="stylesheet">` elements for the extension's declared
 * frontend stylesheets. Only acts for non-system extensions — system extensions
 * are Vite-bundled and their CSS imports are handled automatically.
 *
 * Stylesheets are reference-counted: each mount increments the ref count and
 * each unmount decrements it. When the count reaches zero the `<link>` element
 * is removed from the DOM.
 */
export function useExtensionStyles(extensionId: string, styles: string[] | undefined, revision?: string): void {
  useEffect(() => {
    // System extensions rely on Vite's CSS import — skip.
    if (systemExtensionModules.has(extensionId)) return;
    if (!styles || styles.length === 0) return;

    const injected: string[] = [];

    for (const stylePath of styles) {
      const key = `${extensionId}:${stylePath}`;
      const existing = loadedStyles.get(key);
      if (existing) {
        existing.refCount++;
        injected.push(key);
        continue;
      }

      const url = resolveExtensionStyleUrl(extensionId, stylePath, revision);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.dataset.extensionStyle = key;
      document.head.appendChild(link);
      loadedStyles.set(key, { link, refCount: 1 });
      injected.push(key);
    }

    return () => {
      for (const key of injected) {
        const entry = loadedStyles.get(key);
        if (!entry) continue;
        entry.refCount--;
        if (entry.refCount <= 0) {
          entry.link.remove();
          loadedStyles.delete(key);
        }
      }
    };
  }, [extensionId, styles, revision]);
}
