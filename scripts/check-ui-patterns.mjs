#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const roots = ['packages/desktop/ui/src', 'extensions'];
const includeExt = new Set(['.ts', '.tsx']);
const ignoreSegments = new Set(['node_modules', 'dist', 'coverage', '.git']);

const patterns = [
  {
    id: 'custom-pill',
    message: 'custom pill/status badge styling; use Pill, StatusDot, InlineMeta, or compact text status',
    regex: /\brounded-full\b(?=[^`'"]*(?:px-|border-|bg-|text-))/,
  },
  {
    id: 'custom-button-chrome',
    message: 'custom button chrome; use Button, ToolbarButton, IconButton, TextButton, RowButton, or MessageActionButton',
    regex: /\b(?:focus-visible:ring|hover:bg-|active:bg-|rounded-md border|rounded-lg border)\b/,
  },
  {
    id: 'web-shadow-blur',
    message: 'shadow/backdrop treatment; prefer flat desktop workbench surfaces',
    regex: /\b(?:shadow-(?:sm|md|lg|xl|2xl)|shadow\b|backdrop-blur(?:-\w+)?)\b/,
  },
  {
    id: 'arbitrary-text-size',
    message: 'arbitrary text size; prefer shared primitive typography or documented utility classes',
    regex: /\btext-\[(?:10|10\.5|11|12|13|14|15|22|30|32|36)px\]\b/,
  },
  {
    id: 'raw-semantic-surface',
    message: 'raw semantic color surface; prefer Notice, Pill, ToolResultCard, StatusDot, or tone props',
    regex: /\b(?:bg|border)-(?:success|warning|danger|accent)\/\d+\b/,
  },
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (ignoreSegments.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (includeExt.has(path.slice(path.lastIndexOf('.'))) && !/\.(test|spec)\.[tj]sx?$/.test(path)) files.push(path);
  }
  return files;
}

const findings = [];
for (const root of roots) {
  const absRoot = join(repoRoot, root);
  for (const file of walk(absRoot)) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (!pattern.regex.test(line)) continue;
        findings.push({
          file: relative(repoRoot, file),
          line: index + 1,
          id: pattern.id,
          message: pattern.message,
          sample: line.trim().slice(0, 220),
        });
      }
    });
  }
}

const byId = new Map();
for (const finding of findings) byId.set(finding.id, (byId.get(finding.id) ?? 0) + 1);

console.log('UI pattern audit');
console.log(`Scanned: ${roots.join(', ')}`);
console.log(`Findings: ${findings.length}`);
for (const [id, count] of [...byId.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`- ${id}: ${count}`);
}

const rawLimit = process.env.UI_PATTERN_MAX_FINDINGS;
const limit = rawLimit === undefined || rawLimit.trim() === '' ? null : Number.parseInt(rawLimit, 10);
if (findings.length > 0) {
  console.log('\nTop findings:');
  for (const finding of findings.slice(0, 80)) {
    console.log(`${finding.file}:${finding.line} [${finding.id}] ${finding.message}`);
    console.log(`  ${finding.sample}`);
  }
  if (findings.length > 80) console.log(`... ${findings.length - 80} more`);
}

if (limit !== null && Number.isFinite(limit) && findings.length > limit) {
  console.error(`\nUI pattern audit failed: ${findings.length} findings exceed UI_PATTERN_MAX_FINDINGS=${limit}.`);
  process.exit(1);
}
