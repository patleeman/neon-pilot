export function buildAttachmentAssetDataUrl(input: { mimeType: string; base64Data: string }): string {
  return `data:${input.mimeType};base64,${input.base64Data}`;
}

export function buildAttachmentAssetResponse(input: { mimeType: string; fileName: string; base64Data: string }): {
  dataUrl: string;
  mimeType: string;
  fileName: string;
} {
  return {
    dataUrl: buildAttachmentAssetDataUrl(input),
    mimeType: input.mimeType,
    fileName: input.fileName,
  };
}
