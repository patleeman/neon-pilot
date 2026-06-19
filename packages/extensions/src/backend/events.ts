function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/events must be resolved by the Neon Pilot host runtime.');
}

export const invalidateAppTopics = (..._args: unknown[]): unknown => hostResolved();
export const publishAppEvent = (..._args: unknown[]): unknown => hostResolved();
export const emitEvent = (..._args: unknown[]): unknown => hostResolved();
export const delayEvent = (..._args: unknown[]): unknown => hostResolved();
export const replayEvent = (..._args: unknown[]): unknown => hostResolved();
export const listEvents = (..._args: unknown[]): unknown => hostResolved();
export const listSubscriptions = (..._args: unknown[]): unknown => hostResolved();
export const saveSubscription = (..._args: unknown[]): unknown => hostResolved();
export const deleteSubscription = (..._args: unknown[]): unknown => hostResolved();
export const cancelDelayedEvent = (..._args: unknown[]): unknown => hostResolved();
export const pruneEvents = (..._args: unknown[]): unknown => hostResolved();
export const processDueEvents = (..._args: unknown[]): unknown => hostResolved();
