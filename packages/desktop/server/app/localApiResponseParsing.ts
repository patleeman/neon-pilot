export interface LocalApiResponseLike {
  statusCode: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

export function renderLocalApiStatusText(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 500:
      return 'Internal Server Error';
    default:
      return 'Error';
  }
}

export function decodeLocalApiBody(body: Uint8Array): string {
  return Buffer.from(body).toString('utf-8');
}

export function readLocalApiError(response: LocalApiResponseLike): string {
  const contentType = response.headers['content-type'] ?? '';
  const bodyText = decodeLocalApiBody(response.body);

  if (contentType.toLowerCase().includes('application/json')) {
    try {
      const payload = JSON.parse(bodyText) as unknown;
      if (typeof payload === 'object' && payload !== null && 'error' in payload) {
        const message = (payload as { error?: unknown }).error;
        if (typeof message === 'string' && message.trim().length > 0) {
          return message;
        }
      }
    } catch {
      // Ignore malformed local JSON error bodies.
    }
  }

  return bodyText.trim() || `${response.statusCode} ${renderLocalApiStatusText(response.statusCode)}`;
}
