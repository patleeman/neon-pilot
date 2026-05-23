import { closeSync, openSync, readSync, statSync } from 'node:fs';

export const DEFAULT_REVERSE_READ_CHUNK_BYTES = 64 * 1024;

export function readFileLinesReverse(
  filePath: string,
  visit: (line: string) => boolean | void,
  chunkBytes = DEFAULT_REVERSE_READ_CHUNK_BYTES,
): void {
  const stats = statSync(filePath);
  if (stats.size <= 0) {
    return;
  }

  const fd = openSync(filePath, 'r');
  const buffer = Buffer.alloc(chunkBytes);
  let position = stats.size;
  let remainder = '';

  try {
    while (position > 0) {
      const readLength = Math.min(chunkBytes, position);
      position -= readLength;
      readSync(fd, buffer, 0, readLength, position);
      const chunk = buffer.toString('utf-8', 0, readLength);
      const combined = chunk + remainder;
      const lines = combined.split('\n');
      remainder = lines.shift() ?? '';

      for (let index = lines.length - 1; index >= 0; index -= 1) {
        if (visit(lines[index]?.replace(/\r$/, '') ?? '') === false) {
          return;
        }
      }
    }

    if (remainder.length > 0) {
      visit(remainder.replace(/\r$/, ''));
    }
  } finally {
    closeSync(fd);
  }
}
