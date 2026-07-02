// Must be first — patches React.createElement before any component is imported.
// eslint-disable-next-line simple-import-sort/imports
import './wdyr.ts';

// ── Font loading strategy ────────────────────────────────────────────────────
// Keep the primary variable body and monospace fonts in the critical CSS path.
// The app uses intermediate weights such as 500, 600, and 650 throughout the
// shell, so loading only a static 400 face causes synthetic-weight rendering.
// Secondary/editor font families are loaded asynchronously after first paint.

import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './index.css';
import '../../../../ui/src/styles.css';
import '../../../../windowed-os-ui/src/styles.css';
import '../extensions/extensionRegistryPrewarm';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { startRendererBlockTelemetry } from '../client/perfDiagnostics';
import { addNotification } from '../components/notifications/notificationStore';
import { recordRendererTelemetry } from '../telemetry/appTelemetry';
import { App } from './App';
import { loadDeferredFonts } from './loadDeferredFonts';

// ── Renderer-side crash logging ───────────────────────────────────────────────
// These fire for uncaught JS errors and unhandled promise rejections in the
// renderer process. They pipe to the main process log via the desktop bridge.

window.addEventListener('error', (event) => {
  const message = event.error instanceof Error ? event.error.message : event.message || 'Script error';
  const stack = event.error instanceof Error ? event.error.stack : undefined;

  console.error('[renderer] uncaught error', event.error ?? event.message);
  recordRendererTelemetry({
    category: 'renderer',
    name: 'uncaught_error',
    route: `${window.location.pathname}${window.location.search}`,
    metadata: { message, stack, filename: event.filename, lineno: event.lineno, colno: event.colno },
  });

  addNotification({
    type: 'error',
    message: `Uncaught error: ${message}`,
    details: stack,
    source: 'core',
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'unknown');
  const stack = event.reason instanceof Error ? event.reason.stack : undefined;

  console.error('[renderer] unhandled rejection', reason);
  recordRendererTelemetry({
    category: 'renderer',
    name: 'unhandled_rejection',
    route: `${window.location.pathname}${window.location.search}`,
    metadata: { reason, stack },
  });

  addNotification({
    type: 'warning',
    message: `Unhandled rejection: ${reason}`,
    details: stack,
    source: 'core',
  });
});

// ── Desktop shell detection ───────────────────────────────────────────────────

const desktopShellParams = new URLSearchParams(window.location.search);
if (desktopShellParams.get('desktop-shell') === '1') {
  try {
    window.sessionStorage.setItem('__pa_desktop_shell__', '1');
  } catch {
    // Ignore storage failures.
  }
}

startRendererBlockTelemetry();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Defer non-critical font loading until after first paint. This avoids adding
// ~130KB of @font-face declarations to the critical CSS and lets the browser
// paint the initial view without waiting for dozens of font file downloads.
loadDeferredFonts();
