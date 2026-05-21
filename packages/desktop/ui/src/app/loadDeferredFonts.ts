/**
 * Deferred font loading module.
 *
 * Loads non-critical font weights and families after the initial render so the
 * browser can paint the first frame without waiting for ~130KB of @font-face
 * CSS.  The primary body font (Geist 400) and monospace (Geist Mono 400) are
 * imported eagerly in main.tsx — everything here is an enhancement.
 *
 * Uses requestIdleCallback when available, falling back to setTimeout to avoid
 * competing with the initial render cycle.
 */

const DEFERRED_FONT_IMPORTERS: Array<() => Promise<unknown>> = [
  // Geist — additional weights
  () => import('@fontsource/geist/500.css'),
  () => import('@fontsource/geist/600.css'),
  () => import('@fontsource/geist/700.css'),
  // Geist Mono — additional weights
  () => import('@fontsource/geist-mono/500.css'),
  () => import('@fontsource/geist-mono/600.css'),
  // Variable fonts (rarely used; loaded last)
  () => import('@fontsource-variable/dm-sans'),
  () => import('@fontsource-variable/geist'),
  () => import('@fontsource-variable/geist-mono'),
  // Editor font
  () => import('@fontsource/jetbrains-mono/400.css'),
  () => import('@fontsource/jetbrains-mono/500.css'),
];

let fontsLoaded = false;

function runDeferredFontImports(): void {
  if (fontsLoaded) return;
  fontsLoaded = true;

  // Fire all imports concurrently — the browser will fetch each CSS file and
  // apply the @font-face rules, downloading the font files in the background.
  for (const importer of DEFERRED_FONT_IMPORTERS) {
    importer().catch(() => {
      // Font loading is best-effort; failures are non-critical.
    });
  }
}

export function loadDeferredFonts(): void {
  if (typeof window === 'undefined') return;

  if ('requestIdleCallback' in window) {
    // @ts-expect-error — requestIdleCallback is optional in some TS libs
    window.requestIdleCallback(runDeferredFontImports, { timeout: 3000 });
  } else {
    // Fallback: yield to the browser after the current microtask flush.
    setTimeout(runDeferredFontImports, 0);
  }
}
