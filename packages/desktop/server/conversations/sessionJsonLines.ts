export function parseJsonLine<TLine>(rawLine: string): TLine | null {
  try {
    return JSON.parse(rawLine) as TLine;
  } catch {
    return null;
  }
}

export function isRawDisplayLineType(line: { type?: unknown }): boolean {
  return line.type === 'message' || line.type === 'custom_message' || line.type === 'compaction' || line.type === 'branch_summary';
}
