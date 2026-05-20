/**
 * why-did-you-render — dev-only excessive re-render detector.
 *
 * Logs to the console whenever a component re-renders more than expected.
 * Import this file as the *very first* import in main.tsx (before React).
 *
 * Only active in development mode — the entire module is tree-shaken in
 * production builds because of the `import.meta.env.DEV` guard.
 */
import React from 'react';

if (import.meta.env.DEV) {
  const { default: whyDidYouRender } = await import('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    // Track all pure components and components wrapped in React.memo.
    trackAllPureComponents: true,
    // Log re-renders caused by hooks (useState, useContext, …).
    trackHooks: true,
    // Include the component display name and owner in logs.
    logOwnerReasons: true,
    // Collapse repeated identical reasons into one console group.
    collapseGroups: true,
    // Don't spam on every single render — only when something changes.
    onlyLogs: false,
  });
}

export {};
