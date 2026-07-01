function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/documents must be resolved by the Neon Pilot host runtime.');
}

export interface StoredDocumentProbeAttachment {
  id: string;
  path: string;
  mimeType: string;
  name?: string;
  sizeBytes: number;
}

export interface DocumentProbeExtractionResult {
  text: string;
  content: Array<{ type: 'text'; text: string }>;
  details: {
    documentId: string;
    mimeType: string;
    name?: string;
    sizeBytes: number;
    extractor: string;
    truncated: boolean;
    warnings: string[];
  };
}

export const clearDocumentProbeAttachmentCacheForTests = (..._args: unknown[]): unknown => hostResolved();
export const getDocumentProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const getDocumentProbeAttachmentsById = (..._args: unknown[]): unknown => hostResolved();
export const getDocumentProbeAttachmentsByIdFromAnySession = (..._args: unknown[]): unknown => hostResolved();
export const rememberDocumentProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const extractDocumentText = (..._args: unknown[]): unknown => hostResolved();
