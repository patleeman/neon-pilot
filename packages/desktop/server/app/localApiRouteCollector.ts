export function shouldRegisterLocalApiRoute(handler: unknown): boolean {
  return Boolean(handler);
}

export function noopLocalApiUse(): void {
  // Local desktop routes bypass HTTP auth middleware and other Express-only app.use chains.
}
