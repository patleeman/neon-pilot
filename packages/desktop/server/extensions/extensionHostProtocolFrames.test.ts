import { describe, expect, it } from 'vitest';

import { decodeExtensionHostProtocolFrame, encodeExtensionHostProtocolFrame } from './extensionHostProtocolFrames.js';

describe('extensionHostProtocolFrames', () => {
  it('encodes one JSON frame per line and decodes it back', () => {
    const encoded = encodeExtensionHostProtocolFrame({ type: 'stdout', data: 'aGVsbG8=' });

    expect(encoded.endsWith('\n')).toBe(true);
    expect(encoded.split('\n')).toHaveLength(2);
    expect(decodeExtensionHostProtocolFrame(encoded.trimEnd())).toEqual({ type: 'stdout', data: 'aGVsbG8=' });
  });

  it('rejects frames without an object string type', () => {
    expect(() => decodeExtensionHostProtocolFrame('null')).toThrow('Invalid extension host protocol frame.');
    expect(() => decodeExtensionHostProtocolFrame('{}')).toThrow('Invalid extension host protocol frame.');
    expect(() => decodeExtensionHostProtocolFrame('{"type":1}')).toThrow('Invalid extension host protocol frame.');
  });
});
