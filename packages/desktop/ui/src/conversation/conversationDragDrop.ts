export function shouldHandleDroppedComposerFiles(files: File[]): boolean {
  return files.length > 0;
}

export function nextDragOverStateForDragOver(): boolean {
  return true;
}

export function nextDragOverStateForDragEnd(): boolean {
  return false;
}
