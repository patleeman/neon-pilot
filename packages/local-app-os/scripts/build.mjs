import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(packageDir, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(packageDir, 'src/main/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(distDir, 'main.js'),
  external: ['electron'],
});

await esbuild.build({
  entryPoints: [path.join(packageDir, 'src/main/preload.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(distDir, 'preload.cjs'),
  external: ['electron'],
});

await esbuild.build({
  entryPoints: [path.join(packageDir, 'src/renderer/App.tsx')],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  outfile: path.join(distDir, 'renderer.js'),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
});

await cp(path.join(packageDir, 'src/renderer/index.html'), path.join(distDir, 'index.html'));
await cp(path.join(packageDir, 'src/renderer/styles.css'), path.join(distDir, 'styles.css'));
