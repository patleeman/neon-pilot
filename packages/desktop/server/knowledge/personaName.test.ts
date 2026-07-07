import { describe, expect, it } from 'vitest';

import { DEFAULT_PERSONA_NAME, extractPersonaName, updatePersonaNameInSoulDoc } from './personaName.js';

// ---------------------------------------------------------------------------
// extractPersonaName
// ---------------------------------------------------------------------------

describe('extractPersonaName', () => {
  it('extracts the display name from a simple H1 heading', () => {
    const content = '# Alice\n\nYou are Alice, a helpful assistant.\n';
    expect(extractPersonaName(content)).toBe('Alice');
  });

  it('trims whitespace around the heading text', () => {
    const content = '#   Neon Pilot   \n\nIdentity instructions.\n';
    expect(extractPersonaName(content)).toBe('Neon Pilot');
  });

  it('returns the sentinel when the soul doc is empty', () => {
    expect(extractPersonaName('')).toBe(DEFAULT_PERSONA_NAME);
  });

  it('returns the sentinel when there is no H1 heading', () => {
    const content = 'Some text without a heading.\n\n## A subheading\n\nMore text.\n';
    expect(extractPersonaName(content)).toBe(DEFAULT_PERSONA_NAME);
  });

  it('returns the sentinel when the heading line is blank after `# `', () => {
    const content = '#   \n\nBody content.\n';
    expect(extractPersonaName(content)).toBe(DEFAULT_PERSONA_NAME);
  });

  it('returns the sentinel when the heading is only whitespace', () => {
    const content = '# \t \n\nBody content.\n';
    expect(extractPersonaName(content)).toBe(DEFAULT_PERSONA_NAME);
  });

  it('extracts the first H1 when multiple headings exist', () => {
    const content = '# Primary Name\n\nContent.\n\n# Secondary Name\n\nMore content.\n';
    expect(extractPersonaName(content)).toBe('Primary Name');
  });

  it('extracts the first H1 even when preceded by blank lines', () => {
    const content = '\n\n\n# Deeply Nested Heading\n\nContent.\n';
    expect(extractPersonaName(content)).toBe('Deeply Nested Heading');
  });

  it('ignores non-H1 markdown headings (H2, H3, etc.)', () => {
    const content = '## Subtitle\n\n### Sub-subtitle\n\nBody.\n';
    expect(extractPersonaName(content)).toBe(DEFAULT_PERSONA_NAME);
  });

  it('ignores inline code or backslash-escaped heading markers', () => {
    const content = '\\# Not a heading\n\n# Real Heading\n\nBody.\n';
    expect(extractPersonaName(content)).toBe('Real Heading');
  });

  it('handles H1 with trailing comment-style text', () => {
    const content = '# My Persona <!-- comment -->\n\nBody.\n';
    expect(extractPersonaName(content)).toBe('My Persona <!-- comment -->');
  });
});

// ---------------------------------------------------------------------------
// updatePersonaNameInSoulDoc
// ---------------------------------------------------------------------------

describe('updatePersonaNameInSoulDoc', () => {
  it('replaces the first H1 heading with the new name', () => {
    const original = '# Old Name\n\nYou are an assistant.\n\nSome other content.\n';
    const updated = updatePersonaNameInSoulDoc(original, 'New Name');
    expect(updated).toBe('# New Name\n\nYou are an assistant.\n\nSome other content.\n');
  });

  it('trims whitespace from the new name before writing', () => {
    const original = '# Old Name\n\nBody.\n';
    const updated = updatePersonaNameInSoulDoc(original, '  New Name  ');
    expect(updated).toBe('# New Name\n\nBody.\n');
  });

  it('preserves leading whitespace before the first H1', () => {
    const original = '\n\n# Deep\n\nBody.\n';
    const updated = updatePersonaNameInSoulDoc(original, 'Shallow');
    expect(updated).toBe('\n\n# Shallow\n\nBody.\n');
  });

  it('preserves content after the first H1 when multiple headings exist', () => {
    const original = '# First\n\nIntro.\n\n# Second\n\nDetails.\n';
    const updated = updatePersonaNameInSoulDoc(original, 'Renamed');
    expect(updated).toBe('# Renamed\n\nIntro.\n\n# Second\n\nDetails.\n');
  });

  it('prepends an H1 when no heading exists', () => {
    const original = 'Some content without a heading.\n\n## Subheading\n\nMore.\n';
    const updated = updatePersonaNameInSoulDoc(original, 'Brand New');
    expect(updated).toBe('# Brand New\n\nSome content without a heading.\n\n## Subheading\n\nMore.\n');
  });

  it('prepends an H1 when the doc is empty', () => {
    const updated = updatePersonaNameInSoulDoc('', 'Only Name');
    expect(updated).toBe('# Only Name\n\n');
  });

  it('prepends an H1 when the doc is whitespace only', () => {
    const updated = updatePersonaNameInSoulDoc('   \n\n  ', 'Whitespace');
    expect(updated).toBe('# Whitespace\n\n   \n\n  ');
  });

  it('replaces the H1 line even if the heading text was only whitespace', () => {
    const original = '#   \n\nBody.\n';
    const updated = updatePersonaNameInSoulDoc(original, 'Fixed Name');
    expect(updated).toBe('# Fixed Name\n\nBody.\n');
  });

  it('throws when the new name is empty', () => {
    expect(() => updatePersonaNameInSoulDoc('# Hello\n\nBody.\n', '')).toThrow('Persona name must not be empty.');
  });

  it('throws when the new name is whitespace only', () => {
    expect(() => updatePersonaNameInSoulDoc('# Hello\n\nBody.\n', '   ')).toThrow('Persona name must not be empty.');
  });

  it('round-trips: extract then update preserves the new name', () => {
    const original = '# Starting Point\n\nInstructions.\n\nMore instructions.\n';
    const newName = 'Round Trip';
    const updated = updatePersonaNameInSoulDoc(original, newName);
    const extracted = extractPersonaName(updated);
    expect(extracted).toBe(newName);
  });

  it('round-trips: update then update works on the updated H1', () => {
    const original = '# A\n\nContent.\n';
    const first = updatePersonaNameInSoulDoc(original, 'B');
    const second = updatePersonaNameInSoulDoc(first, 'C');
    expect(extractPersonaName(second)).toBe('C');
    expect(second).toBe('# C\n\nContent.\n');
  });

  it('preserves exact rest of file including trailing content and formatting', () => {
    const original = '# Title\n\nParagraph 1.\n\n```js\nconst x = 1;\n```\n\n- List item\n';
    const updated = updatePersonaNameInSoulDoc(original, 'Renamed');
    expect(updated).toBe('# Renamed\n\nParagraph 1.\n\n```js\nconst x = 1;\n```\n\n- List item\n');
  });
});
