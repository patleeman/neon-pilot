import { normalizeContent } from './sessionContent.js';
import { imageMimeType, imageSrc } from './sessionImages.js';

export interface DisplayImageLike {
  alt: string;
  src?: string;
  mimeType?: string;
  caption?: string;
}

export function extractUserContent(content: unknown): { text: string; images: DisplayImageLike[] } {
  const blocks = normalizeContent(content);
  const text = blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim();
  const images = blocks
    .filter((block) => block.type === 'image')
    .flatMap((block) => {
      const src = imageSrc(block);
      const mimeType = imageMimeType(block);
      if (!src || !mimeType) {
        return [];
      }

      return [
        {
          alt: typeof block.name === 'string' && block.name.trim().length > 0 ? `Attached image: ${block.name.trim()}` : 'Attached image',
          src,
          mimeType,
          ...(typeof block.name === 'string' && block.name.trim().length > 0 ? { caption: block.name.trim() } : {}),
        },
      ];
    });
  return { text, images };
}
