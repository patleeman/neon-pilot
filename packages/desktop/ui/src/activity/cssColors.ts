/**
 * Shared CSS color utilities for activity tree styling.
 */

/**
 * Validates and sanitizes a CSS color value.
 * Returns the trimmed color string if valid, or null if invalid or empty.
 *
 * Accepts:
 * - Hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 * - CSS rgb/rgba functions
 * - CSS color-mix with hex colors
 */
export function sanitizeCssColor(value: string | undefined): string | null {
  const color = value?.trim();
  if (!color) return null;

  // Valid CSS hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F])?$|^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(color)) return color;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(color)) return color;
  if (/^color-mix\(in srgb, #[0-9a-fA-F]{3,8} \d{1,3}%, transparent\)$/.test(color)) return color;

  return null;
}

/**
 * Escapes a string for use as a CSS attribute selector value.
 */
export function escapeCssString(value: string): string {
  return value.replace(/["\\\n\r\f]/g, (character) => `\\${character}`);
}
