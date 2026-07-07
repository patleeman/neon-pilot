/**
 * Persona display name extraction and update helpers.
 *
 * The persona's display name is derived from the first markdown H1 heading
 * in the soul doc (`# Name`). These are pure functions over soul doc
 * content strings; callers handle file I/O.
 */

/** Sentinel returned when the soul doc has no H1 heading. */
export const DEFAULT_PERSONA_NAME = 'Neon Pilot Persona';

/**
 * Extract the persona display name from soul doc markdown content.
 *
 * Returns the text of the first `# `-prefixed heading line, trimmed of
 * leading/trailing whitespace. If no H1 heading exists, returns
 * {@link DEFAULT_PERSONA_NAME}.
 *
 * @param soulDocContent - Raw markdown content of the soul doc.
 * @returns The extracted display name or the default sentinel.
 */
export function extractPersonaName(soulDocContent: string): string {
  const trimmed = soulDocContent.trimStart();
  const match = trimmed.match(/^#[ \t]+(.+)$/m);
  if (!match) {
    return DEFAULT_PERSONA_NAME;
  }
  const name = match[1]!.trim();
  return name.length > 0 ? name : DEFAULT_PERSONA_NAME;
}

/**
 * Update the persona display name in soul doc markdown content.
 *
 * Replaces the text of the first `# `-prefixed heading with
 * `# <newName>`, preserving all other content exactly.
 *
 * If no H1 heading exists, prepends `# <newName>\n\n` before the
 * existing content.
 *
 * @param soulDocContent - Raw markdown content of the soul doc.
 * @param newName - The new display name. Must be non-empty after trim.
 * @returns Updated soul doc content.
 * @throws {Error} If `newName` is empty or whitespace-only after trim.
 */
export function updatePersonaNameInSoulDoc(soulDocContent: string, newName: string): string {
  const normalized = newName.trim();
  if (!normalized) {
    throw new Error('Persona name must not be empty.');
  }

  const firstH1Match = soulDocContent.match(/^#[ \t]+(.+)$/m);
  if (!firstH1Match) {
    // No existing H1: prepend one.
    return `# ${normalized}\n\n${soulDocContent}`;
  }

  // Replace only the first H1 line content after `# `.
  const beforeHeading = soulDocContent.slice(0, firstH1Match.index!);
  const afterHeading = soulDocContent.slice(firstH1Match.index! + firstH1Match[0].length);
  return `${beforeHeading}# ${normalized}${afterHeading}`;
}
