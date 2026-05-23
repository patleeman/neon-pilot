import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync, statSync } from 'node:fs';

export function getFileSignature(filePath: string): string | null {
  try {
    const stats = statSync(filePath);
    return `${stats.size}:${stats.mtimeMs}`;
  } catch {
    return null;
  }
}

export function parseSignatureSize(signature: string): number | null {
  const colon = signature.indexOf(':');
  if (colon <= 0) {
    return null;
  }
  const size = Number(signature.slice(0, colon));
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

export function computeFilePrefixHash(filePath: string, byteCount: number): string | null {
  try {
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(Math.min(byteCount, 64 * 1024));
    const fd = openSync(filePath, 'r');
    try {
      let remaining = byteCount;
      while (remaining > 0) {
        const chunkSize = Math.min(remaining, 64 * 1024);
        const bytesRead = readSync(fd, buffer, 0, chunkSize, null);
        if (bytesRead <= 0) {
          break;
        }
        hash.update(buffer.subarray(0, bytesRead));
        remaining -= bytesRead;
      }
    } finally {
      closeSync(fd);
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}

export function computeFileContentHash(filePath: string): string | null {
  try {
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024);
    const fd = openSync(filePath, 'r');
    try {
      let bytesRead: number;
      while ((bytesRead = readSync(fd, buffer, 0, 64 * 1024, null)) > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } finally {
      closeSync(fd);
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}
