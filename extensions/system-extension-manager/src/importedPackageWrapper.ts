import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

const IMPORTED_PACKAGE_SKIP_DIRS = new Set(['.git', 'dist', 'node_modules', 'target']);

function assertNoImportedPackageSymlink(path: string): void {
  if (lstatSync(path).isSymbolicLink()) {
    throw new Error(`Imported package source cannot contain symlinks: ${path}`);
  }
}

export function createImportedPackageExtension(input: { ecosystem: string; packageType: string; source: string; runtimeDir: string }): {
  id: string;
  packageRoot: string;
  skillCount: number;
  copiedSource: boolean;
} {
  const sourceLabel = labelForPackageSource(input.source);
  const id = importedPackageExtensionId(input.ecosystem, input.packageType, input.source);
  const packageRoot = join(input.runtimeDir, 'extensions', id);
  const packageDir = join(packageRoot, 'package');
  const sourceIsLocalDirectory = existsSync(input.source) && statSync(input.source).isDirectory();

  mkdirSync(packageRoot, { recursive: true });
  if (sourceIsLocalDirectory) {
    assertNoImportedPackageSymlink(input.source);
    cpSync(input.source, packageDir, {
      recursive: true,
      force: true,
      filter: (sourcePath) => {
        if (IMPORTED_PACKAGE_SKIP_DIRS.has(basename(sourcePath))) return false;
        assertNoImportedPackageSymlink(sourcePath);
        return true;
      },
    });
  }

  const skills = sourceIsLocalDirectory
    ? discoverSkillFiles(packageDir).map((path) => {
        const idFromPath = skillIdFromPath(path);
        return {
          id: idFromPath,
          path: toManifestPath(packageRoot, path),
        };
      })
    : [];

  const manifest = {
    schemaVersion: 2,
    id,
    name: `${formatExternalLabel(input.ecosystem)} ${formatExternalLabel(input.packageType)}: ${sourceLabel}`,
    description: `Imported ${input.ecosystem} ${input.packageType} package. Source: ${input.source}`,
    version: '0.1.0',
    defaultEnabled: true,
    contributes: {
      ...(skills.length ? { skills } : {}),
    },
    importedPackage: {
      ecosystem: input.ecosystem,
      packageType: input.packageType,
      source: input.source,
      copiedSource: sourceIsLocalDirectory,
    },
  };
  writeFileSync(join(packageRoot, 'extension.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    join(packageRoot, 'README.md'),
    [
      `# ${manifest.name}`,
      '',
      `Imported from: \`${input.source}\``,
      '',
      'This extension wraps an external agent capability package so Neon Pilot can manage it through the extension registry.',
      sourceIsLocalDirectory
        ? 'The package contents were copied into `package/`; discovered Agent Skills are contributed through `extension.json`.'
        : 'Remote package contents remain registered as a package source; this wrapper records the install in the extension registry.',
      '',
    ].join('\n'),
  );

  return { id, packageRoot, skillCount: skills.length, copiedSource: sourceIsLocalDirectory };
}

function importedPackageExtensionId(ecosystem: string, packageType: string, source: string): string {
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 10);
  return `imported-${slugify(ecosystem)}-${slugify(packageType)}-${slugify(labelForPackageSource(source))}-${hash}`.slice(0, 96);
}

function labelForPackageSource(source: string): string {
  try {
    const url = new URL(source);
    const pathBase = basename(url.pathname.replace(/\/$/, ''));
    return pathBase || url.hostname;
  } catch {
    return basename(source.replace(/\/$/, '')) || 'package';
  }
}

function formatExternalLabel(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'package'
  );
}

function discoverSkillFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (IMPORTED_PACKAGE_SKIP_DIRS.has(entry.name)) return [];
      return discoverSkillFiles(path);
    }
    return entry.isFile() && entry.name === 'SKILL.md' ? [path] : [];
  });
}

function skillIdFromPath(skillPath: string): string {
  const parent = basename(dirname(skillPath));
  return slugify(parent === 'package' ? basename(skillPath, '.md') : parent);
}

function toManifestPath(packageRoot: string, path: string): string {
  return relative(packageRoot, path).split(sep).join('/');
}
