import type { PlatformBridge } from '../shared/platformTypes';

declare global {
  interface Window {
    localOS: PlatformBridge;
  }
}
