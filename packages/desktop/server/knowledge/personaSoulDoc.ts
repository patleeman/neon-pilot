import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Read the persona soul doc content.
 *
 * The soul doc is a single markdown file that defines the persona identity
 * instructions. It is kept separate from persona memory docs and loaded
 * before them in direct persona sessions.
 * Returns an empty string if the file does not exist or cannot be read.
 */
export function readPersonaSoulDoc(soulDocPath: string): string {
  try {
    return readFileSync(resolve(soulDocPath), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Write content to the persona soul doc file.
 *
 * Creates parent directories if they do not exist and overwrites the file.
 */
export function writePersonaSoulDoc(soulDocPath: string, content: string): void {
  mkdirSync(dirname(soulDocPath), { recursive: true });
  writeFileSync(resolve(soulDocPath), content, { encoding: 'utf-8', mode: 0o600 });
}

/**
 * Build a context block from the persona soul doc.
 *
 * Returns a formatted instruction block suitable for prepending before
 * persona memory context in direct persona sessions. Returns an empty
 * string when no soul doc exists.
 */
export function buildPersonaSoulDocContext(soulDocPath: string): string {
  const content = readPersonaSoulDoc(soulDocPath);
  if (!content.trim()) {
    return '';
  }
  return `Persona identity:\n${content.trim()}`;
}
