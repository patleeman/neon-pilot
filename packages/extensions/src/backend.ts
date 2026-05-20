export { recordTelemetryEvent } from './backend/telemetry';
export type { ExtensionBackendContext } from './index';

/**
 * Backend imports are resolved by the Neon Pilot host when building trusted
 * local extensions. This package subpath exists so tooling has a real public
 * contract; runtime implementations are provided by the desktop host alias.
 */
export function assertHostResolvedBackendImport(): never {
  throw new Error('@neon-pilot/extensions/backend must be resolved by the Neon Pilot host runtime.');
}
