import type { StoredImageProbeAttachment } from '@neon-pilot/extensions/backend/images';

import { callServerModuleExport } from './serverModuleResolver.js';

export type { StoredImageProbeAttachment };

const IMAGE_PROBE_STORE = '../imageProbeAttachmentStore.js';

export async function clearImageProbeAttachmentCacheForTests(...args: unknown[]) {
  return callServerModuleExport<void>(IMAGE_PROBE_STORE, 'clearImageProbeAttachmentCacheForTests', ...args);
}

export async function getImageProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredImageProbeAttachment[]>(IMAGE_PROBE_STORE, 'getImageProbeAttachments', ...args);
}

export async function getImageProbeAttachmentsById(...args: unknown[]) {
  return callServerModuleExport<StoredImageProbeAttachment[]>(IMAGE_PROBE_STORE, 'getImageProbeAttachmentsById', ...args);
}

export async function rememberImageProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredImageProbeAttachment[]>(IMAGE_PROBE_STORE, 'rememberImageProbeAttachments', ...args);
}
