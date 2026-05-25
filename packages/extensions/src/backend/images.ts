function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/images must be resolved by the Neon Pilot host runtime.');
}

export interface StoredImageProbeAttachment {
  id: string;
  path: string;
  sizeBytes: number;
  data: string;
  mimeType: string;
  name?: string;
}
export const clearImageProbeAttachmentCacheForTests = (..._args: unknown[]): unknown => hostResolved();
export const getImageProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const getImageProbeAttachmentsById = (..._args: unknown[]): unknown => hostResolved();
export const rememberImageProbeAttachments = (..._args: unknown[]): unknown => hostResolved();
export const getPiAgentRuntimeDir = (..._args: unknown[]): unknown => hostResolved();
