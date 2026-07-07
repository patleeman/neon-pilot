import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
