#!/usr/bin/env node
/* eslint-env node */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)));
const defaultRoots = ['packages/desktop/ui/src', 'extensions', 'docs/extension-templates'];
const includeExt = new Set(['.css', '.ts', '.tsx']);
const ignoreSegments = new Set(['node_modules', 'dist', 'coverage', '.git']);
const ignoredFileRegexes = [/\.(test|spec)\.[cm]?[tj]sx?$/, /\.stories\.[cm]?[tj]sx?$/];
const inlineExceptionId = 'invalid-ui-pattern-exception';

const designSystemSourceRegexes = [/^packages\/ui\/src\//, /^packages\/desktop\/ui\/src\/components\/ui\.[tj]sx?$/];

const defaultAllowlist = [];

const rules = [
  {
    id: 'forbidden-extension-import',
    message: 'extension code must import UI and host APIs through @neon-pilot/extensions public contracts',
    extensions: new Set(['.ts', '.tsx']),
    appliesTo: ({ file }) => file.startsWith('extensions/'),
    match: ({ line }) =>
      /(?:from\s*|import\s*\(\s*)['"](?:@neon-pilot\/(?:ui|desktop)(?:\/[^'"]*)?|(?:@?[^'"]*\/)?packages\/(?:ui|desktop)\/[^'"]*)['"]/.test(
        line,
      ),
  },
  {
    id: 'raw-control',
    message:
      'raw JSX control/action markup; use Button, ToolbarButton, IconButton, TextButton, Select, TextInput, Textarea, or Switch, or document a narrow exception with ui-pattern-ok <rule-id> reason="specific reason"',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ line, snippet }) =>
      /<\s*(?:button|input|select|textarea)(?=[\s>/]|$)/.test(line) || /<\s*(?:button|input|select|textarea)(?=[\s>/])/.test(snippet),
  },
  {
    id: 'raw-details-summary',
    message:
      'raw details/summary disclosure markup; use Disclosure or another design-system disclosure primitive, or document a narrow exception with ui-pattern-ok <rule-id> reason="specific reason"',
    extensions: new Set(['.tsx']),
    appliesTo: ({ file }) => isInternalFrontendFile(file),
    match: ({ line, snippet }) => /<\s*(?:details|summary)(?=[\s>/]|$)/.test(line) || /<\s*(?:details|summary)(?=[\s>/])/.test(snippet),
  },
  {
    id: 'custom-pill',
    message: 'custom pill/status badge styling; use Pill, StatusDot, InlineMeta, or compact text status',
    appliesTo: ({ file, extension }) => extension !== '.css' || isExtensionFrontendFile(file) || file.startsWith('extensions/'),
    match: ({ snippet }) => /\brounded-full\b(?=[^`'"]*(?:px-|border-|bg-|text-))/.test(snippet),
  },
  {
    id: 'custom-button-chrome',
    message: 'custom button chrome; use Button, ToolbarButton, IconButton, TextButton, RowButton, or MessageActionButton',
    match: ({ snippet }) =>
      /<\s*(?:button|a)(?=[\s>/])/.test(snippet) &&
      /\b(?:focus-visible:ring|hover:bg-|active:bg-|rounded-md border|rounded-lg border|rounded bg-(?:accent|success|warning|danger))\b/.test(
        snippet,
      ),
  },
  {
    id: 'raw-semantic-surface',
    message: 'raw semantic color surface; prefer Notice, Pill, ToolResultCard, StatusDot, or tone props',
    appliesTo: ({ file }) => isExtensionFrontendFile(file),
    match: ({ snippet }) => /\b(?:bg|border|ring|outline)-(?:success|warning|danger|accent)(?:\/\d+)?\b/.test(snippet),
  },
  {
    id: 'web-shadow-blur',
    message: 'shadow/backdrop treatment; prefer flat desktop workbench surfaces or a design-system primitive',
    appliesTo: ({ file, extension }) => isExtensionFrontendFile(file) || (extension === '.css' && file.startsWith('extensions/')),
    match: ({ snippet }) =>
      /(?:^|[^\w-])(?:(?<!drop-)shadow-\[(?!none\])|(?<!drop-)shadow-(?!none\b)(?:sm|md|lg|xl|2xl)|shadow(?!-)\b|backdrop-blur(?:-\w+)?|backdropFilter\s*:|boxShadow\s*:|box-shadow\s*:|backdrop-filter\s*:)/.test(
        snippet,
      ),
  },
  {
    id: 'css-surface-bypass',
    message: 'raw CSS surface token; prefer design-system CSS classes/primitives instead of local surface recipes',
    extensions: new Set(['.css']),
    appliesTo: ({ file }) => file.startsWith('extensions/'),
    match: ({ line }) => /\bbackground(?:-color)?\s*:\s*var\(--(?:surface|panel|elevated|base)\)/.test(line),
  },
  {
    id: 'desktop-css-component-recipe',
    message:
      'desktop app CSS component recipe; move UI chrome to @neon-pilot/ui primitives or add a structured exception for host-level primitive CSS',
    extensions: new Set(['.css']),
    appliesTo: ({ file }) => file === 'packages/desktop/ui/src/app/index.css',
    match: ({ line }) =>
      /^\s*\.(?:ui-desktop-layout-switcher__button|ui-segmented-button|ui-node-title-input|ui-rich-editor-button|ui-skill-invocation(?:\s+summary)?|ui-disclosure\s+summary)\b/.test(
        line,
      ),
  },
  {
    id: 'arbitrary-text-size',
    message: 'arbitrary text size; prefer shared primitive typography or documented utility classes',
    match: ({ snippet }) => /\btext-\[(?:10|10\.5|11|12|13|14|15|22|30|32|36)px\]\b/.test(snippet),
  },
];

function normalizePath(path) {
  return path.split(sep).join('/');
}

function isIgnoredFile(file) {
  return ignoredFileRegexes.some((regex) => regex.test(file));
}

function isDesignSystemSource(file) {
  return designSystemSourceRegexes.some((regex) => regex.test(file));
}

function isExtensionFrontendFile(file) {
  return (
    /^extensions\/[^/]+\/src\/.*\.tsx$/.test(file) ||
    /^extensions\/[^/]+\/webapp\/.*\.tsx$/.test(file) ||
    /^docs\/extension-templates\/templates\/[^/]+\/src\/.*\.tsx$/.test(file) ||
    /^packages\/desktop\/ui\/src\/extensions\/.*\.tsx$/.test(file)
  );
}

function isInternalFrontendFile(file) {
  return /^packages\/desktop\/ui\/src\/.*\.tsx$/.test(file) || isExtensionFrontendFile(file);
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (ignoreSegments.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (includeExt.has(extname(path)) && !isIgnoredFile(path)) files.push(path);
  }
  return files;
}

function collectOpeningSnippet(lines, index) {
  const parts = [];
  for (let offset = 0; offset < 6 && index + offset < lines.length; offset += 1) {
    parts.push(lines[index + offset].trim());
    if (lines[index + offset].includes('>')) break;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function sampleForLine(lines, index) {
  const line = lines[index] ?? '';
  if (/<\s*[A-Za-z][\w.:/-]*(?=[\s>/])/.test(line)) return collectOpeningSnippet(lines, index).slice(0, 260);
  return line.trim().replace(/\s+/g, ' ').slice(0, 260);
}

function hasSpecificReason(reason) {
  const trimmedReason = reason?.trim() ?? '';
  return trimmedReason.length >= 12 && !/^(?:ok|todo|fix later|temporary|n\/a|na)$/i.test(trimmedReason);
}

function parseInlineException(line) {
  const markerIndex = line.indexOf('ui-pattern-ok');
  if (markerIndex === -1) return null;

  const tail = line.slice(markerIndex);
  const match = /^ui-pattern-ok\s+([a-z0-9-]+)\s+reason="([^"]+)"/.exec(tail);
  if (!match) {
    return {
      valid: false,
      reason: 'use ui-pattern-ok <rule-id> reason="specific reason"',
    };
  }

  const [, ruleId, reason] = match;
  const trimmedReason = reason.trim();
  if (!ruleIds.has(ruleId)) {
    return {
      valid: false,
      reason: `unknown rule id "${ruleId}"`,
      ruleId,
    };
  }

  if (!hasSpecificReason(trimmedReason)) {
    return {
      valid: false,
      reason: 'reason must be a specific justification',
      ruleId,
    };
  }

  return {
    valid: true,
    reason: trimmedReason,
    ruleId,
  };
}

function inlineExceptionFor(lines, index, id) {
  const previous = index > 0 ? parseInlineException(lines[index - 1]) : null;
  if (previous?.valid && previous.ruleId === id) return previous;

  const current = parseInlineException(lines[index] ?? '');
  if (current?.valid && current.ruleId === id) return current;

  if (/^\s*\.[^{]+\{\s*$/.test(lines[index] ?? '')) {
    const next = parseInlineException(lines[index + 1] ?? '');
    if (next?.valid && next.ruleId === id) return next;
  }

  return null;
}

function isInlineAllowed(lines, index, id) {
  return inlineExceptionFor(lines, index, id) !== null;
}

function allowlistMatches(allowlistEntry, finding) {
  if (!hasSpecificReason(allowlistEntry.reason)) return false;
  if (allowlistEntry.id && allowlistEntry.id !== finding.id) return false;
  if (allowlistEntry.file && allowlistEntry.file !== finding.file) return false;
  if (allowlistEntry.fileRegex && !allowlistEntry.fileRegex.test(finding.file)) return false;
  if (allowlistEntry.sample && allowlistEntry.sample !== finding.sample) return false;
  if (allowlistEntry.sampleIncludes && !finding.sample.includes(allowlistEntry.sampleIncludes)) return false;
  if (allowlistEntry.sampleRegex && !allowlistEntry.sampleRegex.test(finding.sample)) return false;
  return true;
}

function isAllowlisted(finding, allowlist) {
  return allowlist.some((entry) => allowlistMatches(entry, finding));
}

const ruleIds = new Set(rules.map((rule) => rule.id));

function collectInvalidInlineExceptionFinding(relativeFile, lines, index) {
  const parsed = parseInlineException(lines[index] ?? '');
  if (parsed === null || parsed.valid) return null;

  return {
    file: relativeFile,
    line: index + 1,
    id: inlineExceptionId,
    message: `invalid UI pattern exception; ${parsed.reason}`,
    sample: sampleForLine(lines, index),
  };
}

export function auditUiPatterns(options = {}) {
  const root = options.repoRoot ?? repoRoot;
  const roots = options.roots ?? defaultRoots;
  const allowlist = options.allowlist ?? defaultAllowlist;
  const findings = [];

  for (const scanRoot of roots) {
    const absRoot = join(root, scanRoot);
    for (const file of walk(absRoot)) {
      const relativeFile = normalizePath(relative(root, file));
      if (isDesignSystemSource(relativeFile)) continue;

      const extension = extname(file);
      const text = readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/);

      lines.forEach((line, index) => {
        const invalidInlineException = collectInvalidInlineExceptionFinding(relativeFile, lines, index);
        if (invalidInlineException) findings.push(invalidInlineException);

        const snippet = sampleForLine(lines, index);
        for (const rule of rules) {
          if (rule.extensions && !rule.extensions.has(extension)) continue;
          if (rule.appliesTo && !rule.appliesTo({ file: relativeFile, extension })) continue;
          if (!rule.match({ file: relativeFile, extension, line, snippet, index, lines })) continue;
          if (isInlineAllowed(lines, index, rule.id)) continue;

          const finding = {
            file: relativeFile,
            line: index + 1,
            id: rule.id,
            message: rule.message,
            sample: snippet,
          };
          if (!isAllowlisted(finding, allowlist)) findings.push(finding);
        }
      });
    }
  }

  return findings;
}

export function parseMaxFindings(rawLimit) {
  if (rawLimit === undefined || rawLimit.trim() === '') return 0;
  if (rawLimit.trim().toLowerCase() === 'unbounded') return null;
  const limit = Number.parseInt(rawLimit, 10);
  return Number.isFinite(limit) ? limit : 0;
}

export function exceedsMaxFindings(findings, limit) {
  return limit !== null && findings.length > limit;
}

export function formatUiPatternReport(findings, roots = defaultRoots) {
  const byId = new Map();
  for (const finding of findings) byId.set(finding.id, (byId.get(finding.id) ?? 0) + 1);

  const lines = ['UI pattern audit', `Scanned: ${roots.join(', ')}`, `Findings: ${findings.length}`];
  for (const [id, count] of [...byId.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`- ${id}: ${count}`);
  }

  if (findings.length > 0) {
    lines.push('', 'Top findings:');
    for (const finding of findings.slice(0, 80)) {
      lines.push(`${finding.file}:${finding.line} [${finding.id}] ${finding.message}`);
      lines.push(`  ${finding.sample}`);
    }
    if (findings.length > 80) lines.push(`... ${findings.length - 80} more`);
  }

  return lines.join('\n');
}

function runCli() {
  const reportOnly = process.argv.includes('--report-only');
  const findings = auditUiPatterns();
  console.log(formatUiPatternReport(findings));

  const limit = parseMaxFindings(process.env.UI_PATTERN_MAX_FINDINGS);
  if (!reportOnly && exceedsMaxFindings(findings, limit)) {
    console.error(
      `\nUI pattern audit failed: ${findings.length} findings exceed UI_PATTERN_MAX_FINDINGS=${limit}. Use --report-only or UI_PATTERN_MAX_FINDINGS=unbounded for exploratory audits.`,
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runCli();
