import { resolve } from 'node:path';

export function hasForbiddenPackagedResourceRead(trace, appPath, allowedRoots = []) {
  if (!trace || !appPath) return false;
  const normalized = String(trace).replace(/\\+\s/gu, ' ').replaceAll('\\/', '/').replaceAll('\\"', '"');
  const escapedAppPath = appPath.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pathPattern = new RegExp(`${escapedAppPath}[^"'\\n\\r]*`, 'gu');
  const canonicalAppPath = resolve(appPath).toLocaleLowerCase();
  const canonicalAllowedRoots = allowedRoots.map((root) => resolve(root).toLocaleLowerCase());
  for (const match of normalized.matchAll(pathPattern)) {
    // Serialized transcript JSON can leave escape backslashes immediately
    // before the closing quote after quote normalization. They are not part of
    // the filesystem path and must not turn an allowed root into a false read.
    const candidate = match[0].trim().replace(/\\+$/u, '');
    const canonicalCandidate = resolve(candidate).toLocaleLowerCase();
    if (canonicalCandidate === canonicalAppPath) continue;
    if (canonicalAllowedRoots.some((root) => canonicalCandidate === root || canonicalCandidate.startsWith(`${root}/`))) continue;
    if (
      canonicalCandidate.includes('/contents/resources/extensions/') ||
      canonicalCandidate.includes('/contents/resources/app.asar') ||
      canonicalCandidate.includes('/contents/resources/server/') ||
      canonicalCandidate.includes('/contents/resources/app/')
    ) {
      return true;
    }
  }
  return false;
}
