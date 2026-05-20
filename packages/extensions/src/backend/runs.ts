function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/runs must be resolved by the Neon Pilot host runtime.');
}

export const cancelDurableRun = (..._args: unknown[]): unknown => hostResolved();
export const followUpDurableRun = (..._args: unknown[]): unknown => hostResolved();
export const getDurableRun = (..._args: unknown[]): unknown => hostResolved();
export const getDurableRunLog = (..._args: unknown[]): unknown => hostResolved();
export const listDurableRuns = (..._args: unknown[]): unknown => hostResolved();
export const rerunDurableRun = (..._args: unknown[]): unknown => hostResolved();
export const applyScheduledTaskThreadBinding = (..._args: unknown[]): unknown => hostResolved();
export const invalidateAppTopics = (..._args: unknown[]): unknown => hostResolved();
export const startBackgroundRun = (..._args: unknown[]): unknown => hostResolved();
export const createStoredAutomation = (..._args: unknown[]): unknown => hostResolved();
export const parseDeferredResumeDelayMs = (..._args: unknown[]): unknown => hostResolved();
export const pingDaemon = (..._args: unknown[]): unknown => hostResolved();
export const setTaskCallbackBinding = (..._args: unknown[]): unknown => hostResolved();
