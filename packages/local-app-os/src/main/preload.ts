import { contextBridge, ipcRenderer } from 'electron';

import type { PlatformApiRequest, PlatformBridge, PlatformSnapshot } from '../shared/platformTypes';

const bridge: PlatformBridge = {
  invoke(request: PlatformApiRequest) {
    return ipcRenderer.invoke('platform:invoke', request);
  },
  onUpdate(listener: (snapshot: PlatformSnapshot) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, snapshot: PlatformSnapshot) => {
      listener(snapshot);
    };
    ipcRenderer.on('platform:update', wrapped);
    return () => {
      ipcRenderer.off('platform:update', wrapped);
    };
  },
};

contextBridge.exposeInMainWorld('localOS', bridge);
