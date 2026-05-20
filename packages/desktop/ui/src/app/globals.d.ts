import type { NeonPilotDesktopBridge } from '../desktop/desktopBridge';

declare global {
  interface Window {
    neonPilotDesktop?: NeonPilotDesktopBridge;
  }
}

export {};
