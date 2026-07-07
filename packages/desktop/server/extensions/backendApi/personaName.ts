/**
 * Host-owned backend API shim for persona name read/write.
 *
 * This module is a boundary shim per the project rules: it stays small,
 * typed from public extension contracts, and lazy-loads host/core
 * implementation through {@link callServerModuleExport}.
 *
 * @module
 */

import { callServerModuleExport } from './serverModuleResolver.js';

/**
 * Read the persona display name from a soul doc.
 *
 * @param soulDocPath - Absolute path to the persona soul doc file.
 * @returns The extracted display name or DEFAULT_PERSONA_NAME.
 */
export async function readPersonaName(soulDocPath: string): Promise<string> {
  const content = await callServerModuleExport<string>('../../knowledge/personaSoulDoc.js', 'readPersonaSoulDoc', soulDocPath);
  return callServerModuleExport<string>('../../knowledge/personaName.js', 'extractPersonaName', content);
}

/**
 * Write the persona display name into a soul doc.
 *
 * Updates the first H1 heading inline and persists the file.
 *
 * @param soulDocPath - Absolute path to the persona soul doc file.
 * @param newName - The new display name (must be non-empty after trim).
 */
export async function writePersonaName(soulDocPath: string, newName: string): Promise<void> {
  const currentContent = await callServerModuleExport<string>('../../knowledge/personaSoulDoc.js', 'readPersonaSoulDoc', soulDocPath);
  const updatedContent = await callServerModuleExport<string>(
    '../../knowledge/personaName.js',
    'updatePersonaNameInSoulDoc',
    currentContent,
    newName,
  );
  await callServerModuleExport('../../knowledge/personaSoulDoc.js', 'writePersonaSoulDoc', soulDocPath, updatedContent);
}
