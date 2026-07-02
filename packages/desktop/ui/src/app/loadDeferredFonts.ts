/**
 * Deferred font loading module.
 *
 * Loads non-critical font families after the initial render so the browser can
 * paint the first frame without waiting for extra @font-face CSS. The primary
 * variable body font (Geist Variable) and monospace font (Geist Mono Variable)
 * are imported eagerly in main.tsx because the shell uses intermediate weights.
 *
 * Uses requestIdleCallback when available, falling back to setTimeout to avoid
 * competing with the initial render cycle.
 */

const DEFERRED_FONT_IMPORTERS: Array<() => Promise<unknown>> = [
  // Secondary UI family.
  () => import('@fontsource-variable/dm-sans'),
  // Editor font.
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
