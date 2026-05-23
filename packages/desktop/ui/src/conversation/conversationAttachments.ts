export function appendIfPresent<T>(current: T[], next: T[]): T[] {
  return next.length > 0 ? [...current, ...next] : current;
}

export function shouldAddDroppedFiles(files: File[]): boolean {
  return files.length > 0;
}
