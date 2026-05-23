import { describe, expect, it } from 'vitest';

import { decodeLocalApiBody, readLocalApiError, renderLocalApiStatusText } from './localApiResponseParsing';

const encoder = new TextEncoder();

describe('localApiResponseParsing', () => {
  it('renders known and fallback status text', () => {
    expect(renderLocalApiStatusText(400)).toBe('Bad Request');
    expect(renderLocalApiStatusText(401)).toBe('Unauthorized');
    expect(renderLocalApiStatusText(403)).toBe('Forbidden');
    expect(renderLocalApiStatusText(404)).toBe('Not Found');
    expect(renderLocalApiStatusText(409)).toBe('Conflict');
    expect(renderLocalApiStatusText(500)).toBe('Internal Server Error');
    expect(renderLocalApiStatusText(418)).toBe('Error');
  });

  it('decodes response bodies as utf-8', () => {
    expect(decodeLocalApiBody(encoder.encode('hello'))).toBe('hello');
  });

  it('prefers JSON error messages from JSON responses', () => {
    expect(
      readLocalApiError({ statusCode: 500, headers: { 'content-type': 'application/json' }, body: encoder.encode('{"error":"boom"}') }),
    ).toBe('boom');
  });

  it('falls back to trimmed body or status text for non-json or malformed responses', () => {
    expect(readLocalApiError({ statusCode: 500, headers: { 'content-type': 'text/plain' }, body: encoder.encode(' plain error ') })).toBe(
      'plain error',
    );
    expect(readLocalApiError({ statusCode: 404, headers: { 'content-type': 'application/json' }, body: encoder.encode('{bad') })).toBe(
      '{bad',
    );
    expect(readLocalApiError({ statusCode: 404, headers: {}, body: encoder.encode('') })).toBe('404 Not Found');
  });
});
