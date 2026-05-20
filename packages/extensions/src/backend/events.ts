function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/events must be resolved by the Neon Pilot host runtime.');
}

export const invalidateAppTopics = (..._args: unknown[]): unknown => hostResolved();
export const publishAppEvent = (..._args: unknown[]): unknown => hostResolved();
