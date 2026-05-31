import type { NeonPilotDesktopBridge } from '../desktop/desktopBridge';

declare global {
  interface Window {
    neonPilotDesktop?: NeonPilotDesktopBridge;
    __TAURI_INTERNALS__?: {
      invoke<T = unknown>(command: string, payload?: Record<string, unknown>): Promise<T>;
    };
  }
}

export {};
