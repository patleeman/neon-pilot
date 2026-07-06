import { resolveDesktopRootLayout } from '@neon-pilot/core';
import type { Express } from 'express';

import { logError } from '../shared/logging.js';
import { pickFilesCapability } from '../workspace/workspaceDesktopCapability.js';
import type { ServerRouteContext } from './context.js';

let _getDefaultWebCwd: () => string = () => resolveDesktopRootLayout().root;
let _resolveRequestedCwd: (cwd: string | null | undefined, defaultCwd?: string) => string | undefined = () => undefined;

function initializeFilePickerRoutesContext(context: Pick<ServerRouteContext, 'getDefaultWebCwd' | 'resolveRequestedCwd'>): void {
  _getDefaultWebCwd = context.getDefaultWebCwd;
  _resolveRequestedCwd = context.resolveRequestedCwd;
}

export function registerFilePickerRoutes(
  router: Pick<Express, 'post'>,
  context: Pick<ServerRouteContext, 'getDefaultWebCwd' | 'resolveRequestedCwd'>,
): void {
  initializeFilePickerRoutesContext(context);
  router.post('/api/file-picker', (req, res) => {
    try {
      const { cwd } = req.body as { cwd?: string | null };
      res.json(
        pickFilesCapability(
          { cwd },
          {
            getDefaultWebCwd: _getDefaultWebCwd,
            resolveRequestedCwd: _resolveRequestedCwd,
          },
        ),
      );
    } catch (error) {
      logError('file picker request failed', { message: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Could not open the file picker. Try again or enter the path manually.' });
    }
  });
}
