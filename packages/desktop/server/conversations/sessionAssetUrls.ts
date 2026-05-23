export interface DisplayImageLike {
  src?: string;
  [key: string]: unknown;
}

export type DisplayBlockWithAssets =
  | { type: 'user'; id: string; images?: DisplayImageLike[]; [key: string]: unknown }
  | { type: 'image'; id: string; src?: string; [key: string]: unknown }
  | { type: string; id?: string; [key: string]: unknown };

export function buildSessionUserImagePath(sessionId: string, blockId: string, imageIndex: number): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/blocks/${encodeURIComponent(blockId)}/images/${imageIndex}`;
}

export function buildSessionBlockImagePath(sessionId: string, blockId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/blocks/${encodeURIComponent(blockId)}/image`;
}

export function decorateSessionAssetUrls<T extends DisplayBlockWithAssets>(blocks: T[], sessionId: string): T[] {
  return blocks.map((block) => {
    if (block.type === 'user' && block.images?.length) {
      return {
        ...block,
        images: block.images.map((image, imageIndex) => ({
          ...image,
          src: buildSessionUserImagePath(sessionId, block.id, imageIndex),
        })),
      } as T;
    }

    if (block.type === 'image') {
      return {
        ...block,
        src: buildSessionBlockImagePath(sessionId, block.id),
      } as T;
    }

    return block;
  });
}
