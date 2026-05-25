function unresolved(): never {
  throw new Error('@neon-pilot/extensions/backend/tools must be resolved by the Neon Pilot host runtime.');
}

export async function listInvocableExtensionTools<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}

export async function invokeExtensionToolByName<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}

export async function invokeToolByName<TResult = unknown>(..._args: unknown[]): Promise<TResult> {
  return unresolved();
}
