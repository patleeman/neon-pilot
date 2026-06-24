export function shouldHandleDroppedComposerFiles(files: File[]): boolean {
  return files.length > 0;
}

interface ComposerWorkspacePathTransfer {
  files?: { length: number } | null;
  types?: Iterable<string> | null;
  getData(type: string): string;
}

export function readDroppedComposerWorkspacePath(dataTransfer: ComposerWorkspacePathTransfer): string | null {
  if ((dataTransfer.files?.length ?? 0) > 0) {
    return null;
  }

  const types = dataTransfer.types ? Array.from(dataTransfer.types) : [];
  if (!types.includes('text/plain')) {
    return null;
  }

  const value = dataTransfer.getData('text/plain').trim();
  if (!value || value.length > 512 || value.includes('\0') || /\r|\n/.test(value)) {
    return null;
  }

  return value;
}

export function nextDragOverStateForDragOver(): boolean {
  return true;
}

export function nextDragOverStateForDragEnd(): boolean {
  return false;
}
