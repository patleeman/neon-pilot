export function assertLocalServerRouteContext<TContext>(context: TContext | null | undefined): TContext {
  if (!context) {
    throw new Error('Local server route context is not initialized.');
  }
  return context;
}

export function assertLocalLiveSessionCapabilityContext<TContext>(context: TContext | null | undefined): TContext {
  if (!context) {
    throw new Error('Local live-session capability context is not initialized.');
  }
  return context;
}

export function assertLocalProviderDesktopCapabilityContext<TContext>(context: TContext | null | undefined): TContext {
  if (!context) {
    throw new Error('Local provider/model capability context is not initialized.');
  }
  return context;
}
