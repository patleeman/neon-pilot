import type { GatewayState } from '../shared/types';

export const GATEWAY_STATE_CHANGED_EVENT = 'pa:gateway-state-changed';

export function notifyGatewayStateChanged(state: GatewayState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<GatewayState>(GATEWAY_STATE_CHANGED_EVENT, { detail: state }));
}
