import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDesktopAwareEventSourceMock = vi.fn();

vi.mock('./desktopEventSource', () => ({
  createDesktopAwareEventSource: createDesktopAwareEventSourceMock,
}));

describe('subscribeDesktopProviderOAuthLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes through the realtime stream client and forwards login state updates', async () => {
    const close = vi.fn();
    const source: { onmessage: ((event: MessageEvent<string>) => void) | null; onerror: (() => void) | null; close: () => void } = {
      onmessage: null,
      onerror: null,
      close,
    };
    createDesktopAwareEventSourceMock.mockReturnValue(source);

    const { subscribeDesktopProviderOAuthLogin } = await import('./desktopProviderOAuth');
    const onState = vi.fn();
    const unsubscribe = await subscribeDesktopProviderOAuthLogin('login-1', onState);

    expect(createDesktopAwareEventSourceMock).toHaveBeenCalledWith('/api/provider-auth/oauth/login-1/events');
    source.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ id: 'login-1', provider: 'openrouter', providerName: 'OpenRouter', status: 'running' }),
      }),
    );

    expect(onState).toHaveBeenCalledWith({
      id: 'login-1',
      provider: 'openrouter',
      providerName: 'OpenRouter',
      status: 'running',
    });

    unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
