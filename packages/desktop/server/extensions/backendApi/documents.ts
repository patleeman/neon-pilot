import type { DocumentProbeExtractionResult, StoredDocumentProbeAttachment } from '@neon-pilot/extensions/backend/documents';

import { callServerModuleExport } from './serverModuleResolver.js';

export type { DocumentProbeExtractionResult, StoredDocumentProbeAttachment };

const DOCUMENT_PROBE_STORE = '../../extensions/documentProbeAttachmentStore.js';

export async function clearDocumentProbeAttachmentCacheForTests(...args: unknown[]) {
  return callServerModuleExport<void>(DOCUMENT_PROBE_STORE, 'clearDocumentProbeAttachmentCacheForTests', ...args);
}

export async function getDocumentProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredDocumentProbeAttachment[]>(DOCUMENT_PROBE_STORE, 'getDocumentProbeAttachments', ...args);
}

export async function getDocumentProbeAttachmentsById(...args: unknown[]) {
  return callServerModuleExport<StoredDocumentProbeAttachment[]>(DOCUMENT_PROBE_STORE, 'getDocumentProbeAttachmentsById', ...args);
}

export async function getDocumentProbeAttachmentsByIdFromAnySession(...args: unknown[]) {
  return callServerModuleExport<StoredDocumentProbeAttachment[]>(
    DOCUMENT_PROBE_STORE,
    'getDocumentProbeAttachmentsByIdFromAnySession',
    ...args,
  );
}

export async function rememberDocumentProbeAttachments(...args: unknown[]) {
  return callServerModuleExport<StoredDocumentProbeAttachment[]>(DOCUMENT_PROBE_STORE, 'rememberDocumentProbeAttachments', ...args);
}

export async function extractDocumentText(...args: unknown[]) {
  return callServerModuleExport<DocumentProbeExtractionResult>(DOCUMENT_PROBE_STORE, 'extractDocumentText', ...args);
}
