export interface DesktopBackendWarmupOptions {
  ensureBackend: () => Promise<boolean>;
  onReady?: () => void;
  onUnavailable?: () => void;
  onError?: (error: unknown) => void;
}

export function startDesktopBackendWarmup(options: DesktopBackendWarmupOptions): void {
  void options
    .ensureBackend()
    .then((ready) => {
      if (ready) {
        options.onReady?.();
        return;
      }

      options.onUnavailable?.();
    })
    .catch((error) => {
      options.onError?.(error);
      options.onUnavailable?.();
    });
}
