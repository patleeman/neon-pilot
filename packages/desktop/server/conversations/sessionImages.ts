export interface RawImageBlockLike {
  type?: string;
  mimeType?: string;
  mediaType?: string;
  data?: unknown;
  name?: unknown;
}

export interface SessionImageAsset {
  mimeType: string;
  data: Buffer;
  fileName?: string;
}

export function imageMimeType(block: RawImageBlockLike): string | undefined {
  const mimeType = block.mimeType ?? block.mediaType;
  if (typeof mimeType !== 'string') {
    return undefined;
  }

  const normalized = mimeType.trim();
  return normalized.toLowerCase().startsWith('image/') ? normalized : undefined;
}

export function normalizeBase64ImageData(data: unknown): string | undefined {
  if (typeof data !== 'string') {
    return undefined;
  }

  const normalized = data.trim();
  if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return undefined;
  }

  const decoded = Buffer.from(normalized, 'base64');
  return decoded.length > 0 ? normalized : undefined;
}

export function imageSrc(block: RawImageBlockLike): string | undefined {
  const mimeType = imageMimeType(block);
  const data = normalizeBase64ImageData(block.data);
  if (!mimeType || !data) {
    return undefined;
  }
  return `data:${mimeType};base64,${data}`;
}

export function buildSessionImageAsset(block: RawImageBlockLike): SessionImageAsset | null {
  const mimeType = imageMimeType(block);
  const data = normalizeBase64ImageData(block.data);
  if (!mimeType || !data) {
    return null;
  }

  return {
    mimeType,
    data: Buffer.from(data, 'base64'),
    fileName: typeof block.name === 'string' && block.name.trim().length > 0 ? block.name.trim() : undefined,
  };
}

export function buildSessionImageAssets<TBlock extends RawImageBlockLike>(
  blocks: TBlock[],
): Array<{ block: TBlock; asset: SessionImageAsset }> {
  return blocks.flatMap((block) => {
    if (block.type !== 'image') {
      return [];
    }

    const asset = buildSessionImageAsset(block);
    return asset ? [{ block, asset }] : [];
  });
}
