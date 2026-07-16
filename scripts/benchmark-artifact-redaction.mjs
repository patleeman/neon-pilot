import { mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function createArtifactRedactor() {
  const secrets = new Set();

  const add = (value) => {
    const text = typeof value === 'string' ? value : '';
    if (text.length >= 4) secrets.add(text);
  };

  const redactText = (value) => {
    let text = String(value ?? '');
    for (const secret of [...secrets].sort((left, right) => right.length - left.length)) {
      text = text.split(secret).join('[REDACTED]');
    }
    return text;
  };

  const containsSecret = (value) => [...secrets].some((secret) => String(value ?? '').includes(secret));

  const write = (path, value) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, redactText(value), 'utf8');
  };

  const sanitizeTree = (root) => {
    if (!root || !statSafe(root)?.isDirectory()) return;
    const visit = (current) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const originalPath = resolve(current, entry.name);
        const safeName = redactText(entry.name);
        const path = safeName === entry.name ? originalPath : resolve(current, safeName);
        if (entry.isSymbolicLink()) {
          unlinkSync(originalPath);
          writeFileSync(`${path}.removed-symlink`, '[REDACTED SYMLINK]\n', 'utf8');
          continue;
        }
        if (path !== originalPath) renameSync(originalPath, path);
        if (entry.isDirectory()) visit(path);
        else if (entry.isFile()) {
          const buffer = readFileSync(path);
          if ([...secrets].some((secret) => buffer.includes(Buffer.from(secret)))) {
            writeFileSync(path, Buffer.from(redactText(buffer.toString('utf8')), 'utf8'));
          }
        }
      }
    };
    visit(root);
  };

  const assertCleanTree = (root) => {
    if (!root || !statSafe(root)?.isDirectory()) return;
    const leaks = [];
    const visit = (current) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const path = resolve(current, entry.name);
        if (containsSecret(entry.name)) leaks.push(`${path} (sensitive path)`);
        if (entry.isSymbolicLink()) leaks.push(`${path} (symlink)`);
        else if (entry.isDirectory()) visit(path);
        else if (entry.isFile()) {
          const buffer = readFileSync(path);
          if ([...secrets].some((secret) => buffer.includes(Buffer.from(secret)))) leaks.push(path);
        }
      }
    };
    visit(root);
    if (leaks.length > 0) throw new Error(`Sensitive benchmark credential leaked into artifacts: ${leaks.join(', ')}`);
  };

  return { add, redactText, containsSecret, write, sanitizeTree, assertCleanTree };
}

export function registerSensitiveStringLeaves(redactor, value, key = '') {
  if (typeof value === 'string' && key !== 'type') redactor.add(value);
  else if (Array.isArray(value)) value.forEach((entry) => registerSensitiveStringLeaves(redactor, entry, key));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([childKey, entry]) => registerSensitiveStringLeaves(redactor, entry, childKey));
  }
}

function statSafe(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}
