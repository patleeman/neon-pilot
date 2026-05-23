export function validateKnowledgeBaseSyncResult(input: { baseFileCount: number; resultFileCount: number; minFileRatio: number }): {
  valid: boolean;
  reason?: string;
} {
  if (input.baseFileCount === 0) {
    return { valid: true };
  }

  if (input.resultFileCount === 0) {
    return {
      valid: false,
      reason: `Sync would produce an empty working tree (${input.resultFileCount} files) from a base with ${input.baseFileCount} files. Aborting sync to prevent data loss.`,
    };
  }

  const ratio = input.resultFileCount / input.baseFileCount;
  if (ratio < input.minFileRatio) {
    return {
      valid: false,
      reason: `Sync would drop ${input.baseFileCount - input.resultFileCount} of ${input.baseFileCount} files (ratio ${ratio.toFixed(3)} < minimum ${input.minFileRatio}). Aborting sync to prevent data loss.`,
    };
  }

  return { valid: true };
}
