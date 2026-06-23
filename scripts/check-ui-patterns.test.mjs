import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { auditUiPatterns, exceedsMaxFindings, parseMaxFindings } from './check-ui-patterns.mjs';

const tempRoots = [];

function createRepo() {
  const root = mkdtempSync(join(tmpdir(), 'neon-ui-patterns-'));
  tempRoots.push(root);
  return root;
}

function writeFixture(root, file, contents) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function findingIds(findings) {
  return findings.map((finding) => finding.id);
}

describe('check-ui-patterns', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      rmSync(tempRoots.pop(), { force: true, recursive: true });
    }
  });

  it('flags raw accent action buttons', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return <button className="rounded bg-accent px-3 py-1 text-white hover:bg-accent/90">Run</button>;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('raw-control');
    expect(ids).toContain('custom-button-chrome');
    expect(ids).toContain('raw-semantic-surface');
  });

  it('flags custom pill styling', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return <span className="rounded-full border border-warning bg-warning/10 px-2 text-warning">Blocked</span>;
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('custom-pill');
    expect(ids).toContain('raw-semantic-surface');
  });

  it('flags CSS shadow, blur, and local surface recipes outside design-system source', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.css',
      `
        .panel {
          background: var(--surface);
          box-shadow: 0 12px 32px rgb(0 0 0 / 0.22);
          backdrop-filter: blur(12px);
        }
      `,
    );

    const ids = findingIds(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }));

    expect(ids).toContain('css-surface-bypass');
    expect(ids.filter((id) => id === 'web-shadow-blur')).toHaveLength(2);
  });

  it('flags raw controls in extension frontend code', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return (
            <form>
              <input className="rounded-md border border-border-subtle px-2" />
              <select><option>Automatic</option></select>
              <textarea />
            </form>
          );
        }
      `,
    );

    const rawControls = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'raw-control',
    );

    expect(rawControls).toHaveLength(3);
  });

  it('flags extension imports from UI or desktop internals', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        import { Button } from '@neon-pilot/ui';
        import { Layout } from 'packages/desktop/ui/src/components/Layout';

        export function Demo() {
          return <Button>{Layout.name}</Button>;
        }
      `,
    );

    const forbiddenImports = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] }).filter(
      (finding) => finding.id === 'forbidden-extension-import',
    );

    expect(forbiddenImports).toHaveLength(2);
  });

  it('honors allowlists and max-finding thresholds', () => {
    const root = createRepo();
    writeFixture(
      root,
      'extensions/demo/src/frontend.tsx',
      `
        export function Demo() {
          return <input className="rounded-md border border-border-subtle px-2" />;
        }
      `,
    );

    const findings = auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['extensions'] });
    expect(findings).toHaveLength(1);
    expect(parseMaxFindings('0')).toBe(0);
    expect(exceedsMaxFindings(findings, 0)).toBe(true);

    const allowedFindings = auditUiPatterns({
      allowlist: [{ id: 'raw-control', file: 'extensions/demo/src/frontend.tsx', sampleIncludes: '<input' }],
      repoRoot: root,
      roots: ['extensions'],
    });
    expect(allowedFindings).toHaveLength(0);
    expect(exceedsMaxFindings(allowedFindings, 0)).toBe(false);
  });

  it('allows design-system source files to define the primitives being enforced', () => {
    const root = createRepo();
    writeFixture(
      root,
      'packages/ui/src/primitives.tsx',
      `
        export function Primitive() {
          return <button className="rounded bg-accent px-3 py-1 shadow-lg">Run</button>;
        }
      `,
    );

    expect(auditUiPatterns({ allowlist: [], repoRoot: root, roots: ['packages/ui/src'] })).toEqual([]);
  });
});
