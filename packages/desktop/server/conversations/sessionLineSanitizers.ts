export const SESSION_SUMMARY_SANITIZE_PATTERN = /"(content|data|text|thinking|summary|errorMessage)":"((?:\\.|[^"\\])*)"/g;
export const SESSION_SEARCH_SANITIZE_PATTERN = /"(data|thinking)":"((?:\\.|[^"\\])*)"/g;

export function sanitizeSessionLineForSummary(rawLine: string): string {
  return rawLine.replace(SESSION_SUMMARY_SANITIZE_PATTERN, (_match, field: string, value: string) => {
    if (field === 'data') {
      return `"${field}":""`;
    }

    return `"${field}":"${value.length > 0 ? 'x' : ''}"`;
  });
}

export function sanitizeSessionLineForSearch(rawLine: string): string {
  return rawLine.replace(SESSION_SEARCH_SANITIZE_PATTERN, (_match, field: string) => `"${field}":""`);
}
