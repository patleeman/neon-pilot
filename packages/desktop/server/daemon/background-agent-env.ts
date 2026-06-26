export function attachExtensionHostEnvForTrustedBackgroundAgent(
  childEnv: NodeJS.ProcessEnv,
  sourceEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const extensionHostBaseUrl = sourceEnv.NEON_PILOT_EXTENSION_HOST_BASE_URL?.trim();
  const extensionHostToken = sourceEnv.NEON_PILOT_EXTENSION_HOST_TOKEN?.trim();
  if (extensionHostBaseUrl && extensionHostToken) {
    childEnv.NEON_PILOT_EXTENSION_HOST_BASE_URL = extensionHostBaseUrl;
    childEnv.NEON_PILOT_EXTENSION_HOST_TOKEN = extensionHostToken;
  }
  return childEnv;
}
