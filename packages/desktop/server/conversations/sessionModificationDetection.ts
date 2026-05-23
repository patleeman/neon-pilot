export function detectSessionModification(input: {
  oldSize: number | null;
  newSize: number | null;
  oldContentHash?: string;
  prefixHash?: string | null;
}): boolean {
  if (input.oldSize === null || input.newSize === null) {
    return false;
  }

  if (input.newSize < input.oldSize) {
    return true;
  }

  if (input.newSize === input.oldSize) {
    return true;
  }

  return (
    input.prefixHash !== null &&
    input.prefixHash !== undefined &&
    input.oldContentHash !== undefined &&
    input.prefixHash !== input.oldContentHash
  );
}

export function shouldComputeSessionPrefixHash(input: { oldSize: number | null; newSize: number | null }): boolean {
  return input.oldSize !== null && input.newSize !== null && input.newSize > input.oldSize;
}
