import { buildCriticalExtensionRegistryResponse } from '../app/localApiExtensionRegistryPresentation.js';
import { readExtensionRegistrySnapshot } from './extensionRegistry.js';

export function readCriticalExtensionRegistryResponse() {
  return buildCriticalExtensionRegistryResponse(readExtensionRegistrySnapshot());
}
