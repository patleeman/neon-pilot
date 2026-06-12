import type { ProviderOAuthLoginState } from '../shared/types';
import { createDesktopAwareEventSource } from './desktopEventSource';

export async function subscribeDesktopProviderOAuthLogin(
  loginId: string,
  onState: (state: ProviderOAuthLoginState) => void,
): Promise<() => void> {
  const source = createDesktopAwareEventSource(`/api/provider-auth/oauth/${encodeURIComponent(loginId)}/events`);
  let closed = false;
  source.onmessage = (event) => {
    if (closed) return;
    onState(JSON.parse(event.data) as ProviderOAuthLoginState);
  };
  source.onerror = () => {
    if (closed) return;
    // Keep the subscription object alive; callers poll/read final state separately.
  };
  return () => {
    if (closed) return;
    closed = true;
    source.close();
  };
}
