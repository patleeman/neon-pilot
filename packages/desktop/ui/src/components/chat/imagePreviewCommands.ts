import { setExtensionCommandContext } from '../../extensions/commands';

export const IMAGE_PREVIEW_CLOSE_COMMAND_EVENT = 'neon-pilot-image-preview-close-command';
export const IMAGE_PREVIEW_INSPECT_FIRST_COMMAND_EVENT = 'neon-pilot:image-preview-inspect-first';
export const IMAGE_PREVIEW_LOAD_FIRST_COMMAND_EVENT = 'neon-pilot:image-preview-load-first';

export interface ImagePreviewCommandDetail {
  handled?: boolean;
}

type ImagePreviewCapability = 'inspect' | 'load';

const imagePreviewContextKeys: Record<ImagePreviewCapability, string> = {
  inspect: 'imagePreview.canInspectFirst',
  load: 'imagePreview.canLoadFirst',
};

const imagePreviewCapabilityCounts = new Map<ImagePreviewCapability, number>();

export function registerImagePreviewCapability(capability: ImagePreviewCapability): () => void {
  const nextCount = (imagePreviewCapabilityCounts.get(capability) ?? 0) + 1;
  imagePreviewCapabilityCounts.set(capability, nextCount);
  setExtensionCommandContext(imagePreviewContextKeys[capability], true);

  return () => {
    const currentCount = imagePreviewCapabilityCounts.get(capability) ?? 0;
    const remainingCount = Math.max(0, currentCount - 1);
    if (remainingCount === 0) {
      imagePreviewCapabilityCounts.delete(capability);
      setExtensionCommandContext(imagePreviewContextKeys[capability], null);
      return;
    }

    imagePreviewCapabilityCounts.set(capability, remainingCount);
  };
}
