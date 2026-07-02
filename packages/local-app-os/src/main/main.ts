import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, ipcMain } from 'electron';

import type { PlatformApiRequest } from '../shared/platformTypes';
import { PlatformBackend } from './platformBackend';

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const backend = new PlatformBackend();
const windows = new Set<BrowserWindow>();

const createShellWindow = () => {
  const shellWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Local App OS',
    backgroundColor: '#090a0d',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(runtimeDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  windows.add(shellWindow);
  shellWindow.on('closed', () => {
    windows.delete(shellWindow);
  });
  void shellWindow.loadFile(path.join(runtimeDir, 'index.html'));
};

ipcMain.handle('platform:invoke', (_event, request: PlatformApiRequest) => backend.handle(request));

backend.subscribe((snapshot) => {
  for (const shellWindow of windows) {
    shellWindow.webContents.send('platform:update', snapshot);
  }
});

app.whenReady().then(() => {
  createShellWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createShellWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
