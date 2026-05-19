#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const packageArg = args.find((arg) => !arg.startsWith('--'));
const packageRoot = resolve(packageArg || process.cwd());
const manifestPath = resolve(packageRoot, 'extension.json');
if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
  console.error(`No extension.json found at ${manifestPath}`);
  process.exit(1);
}

const outIndex = args.indexOf('--out');
const outputPath = resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : `${packageRoot}.zip`);
mkdirSync(dirname(outputPath), { recursive: true });
execFileSync('zip', ['-qry', outputPath, basename(packageRoot)], { cwd: dirname(packageRoot), stdio: 'inherit' });
console.log(outputPath);
