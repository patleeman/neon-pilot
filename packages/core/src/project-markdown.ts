const FRONTMATTER_DELIMITER = '---';

export interface FrontmatterSection {
  attributes: Record<string, string>;
  body: string;
}

export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n');
}

export function assertNonEmptyText(value: string, label: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  return trimmed;
}

function stripWrappingQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

export function splitFrontmatter(markdown: string, label: string): FrontmatterSection {
  const normalized = normalizeMarkdown(markdown);
  const lines = normalized.split('\n');

  if (lines.length === 0 || lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    throw new Error(`${label} markdown must start with YAML-like frontmatter.`);
  }

  let endIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === FRONTMATTER_DELIMITER) {
      endIndex = index;
      break;
    }
  }

  if (endIndex === -1) {
    throw new Error(`Missing closing frontmatter delimiter in ${label} markdown.`);
  }

  const attributes: Record<string, string> = {};

  for (const line of lines.slice(1, endIndex)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex <= 0) {
      throw new Error(`Invalid frontmatter line in ${label} markdown: ${line}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());

    if (key.length === 0) {
      throw new Error(`Invalid frontmatter key in ${label} markdown: ${line}`);
    }

    attributes[key] = value;
  }

  return {
    attributes,
    body: lines
      .slice(endIndex + 1)
      .join('\n')
      .trim(),
  };
}

export function readRequiredAttribute(attributes: Record<string, string>, key: string, label: string): string {
  const value = attributes[key];

  if (typeof value !== 'string') {
    throw new Error(`Missing required frontmatter key ${key} in ${label} markdown.`);
  }

  return assertNonEmptyText(value, `${label} frontmatter key ${key}`);
}

export function formatFrontmatter(attributes: Record<string, string>): string {
  const lines = Object.entries(attributes).map(([key, value]) => `${key}: ${value}`);
  return [FRONTMATTER_DELIMITER, ...lines, FRONTMATTER_DELIMITER].join('\n');
}

export function parseMarkdownSections(markdownBody: string, expectedTitle: string, label: string): Record<string, string> {
  const normalized = normalizeMarkdown(markdownBody).trim();
  const lines = normalized.split('\n');

  let index = 0;
  while (index < lines.length && lines[index]?.trim().length === 0) {
    index += 1;
  }

  const expectedHeading = `# ${expectedTitle}`;
  if (lines[index]?.trim() !== expectedHeading) {
    throw new Error(`${label} markdown must start with heading: ${expectedHeading}`);
  }

  const sections: Record<string, string[]> = {};
  let currentSection: string | undefined;

  for (index += 1; index < lines.length; index += 1) {
    const line = lines[index] as string;

    if (line.startsWith('## ')) {
      const sectionName = line.slice(3).trim();
      if (sectionName.length === 0) {
        throw new Error(`Invalid empty section heading in ${label} markdown.`);
      }
      if (Object.prototype.hasOwnProperty.call(sections, sectionName)) {
        throw new Error(`Duplicate section heading in ${label} markdown: ${sectionName}`);
      }

      currentSection = sectionName;
      sections[currentSection] = [];
      continue;
    }

    if (!currentSection) {
      if (line.trim().length === 0) {
        continue;
      }
      throw new Error(`Unexpected content before first section in ${label} markdown.`);
    }

    sections[currentSection].push(line);
  }

  const output: Record<string, string> = {};

  for (const [sectionName, sectionLines] of Object.entries(sections)) {
    output[sectionName] = sectionLines.join('\n').trim();
  }

  return output;
}

export function readRequiredSection(sections: Record<string, string>, key: string, label: string): string {
  const value = sections[key];

  if (typeof value !== 'string') {
    throw new Error(`Missing required section in ${label} markdown: ${key}`);
  }

  return assertNonEmptyText(value, `${label} section ${key}`);
}

export function formatMarkdownDocument(title: string, sections: Array<[string, string | undefined]>): string {
  const renderedSections = sections
    .filter(([, content]) => content !== undefined)
    .map(([heading, content]) => `## ${heading}\n\n${assertNonEmptyText(content as string, `Section ${heading}`)}`);

  return `# ${title}\n\n${renderedSections.join('\n\n')}\n`;
}
