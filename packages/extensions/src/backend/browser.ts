function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/browser must be resolved by the Neon Pilot host runtime.');
}

export type WorkbenchBrowserToolHost = unknown;
export const getWorkbenchBrowserToolHost = (..._args: unknown[]): unknown => hostResolved();
