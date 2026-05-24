import type { ProviderOAuthLoginState } from '../shared/types';
import { createDesktopAwareEventSource } from './desktopEventSource';

export async function subscribeDesktopProviderOAuthLogin(
  loginId: string,
  onState: (state: ProviderOAuthLoginState) => void,
): Promise<() => void> {
  const source = createDesktopAwareEventSource(`/api/provider-auth/oauth/${encodeURIComponent(loginId)}/events`);
  source.onmessage = (event) => {
    onState(JSON.parse(event.data) as ProviderOAuthLoginState);
  };
  source.onerror = () => {
    // Keep the subscription object alive; callers poll/read final state separately.
  };
  return () => source.close();
}
