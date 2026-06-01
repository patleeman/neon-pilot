export type ExtensionHostProtocolClientFrame =
  | { type: 'stdin'; data: string }
  | { type: 'stdinEnd' }
  | { type: 'abort' };

export type ExtensionHostProtocolServerFrame =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'result' }
  | { type: 'error'; error: string };

export type ExtensionHostProtocolFrame = ExtensionHostProtocolClientFrame | ExtensionHostProtocolServerFrame;

export function encodeExtensionHostProtocolFrame(frame: ExtensionHostProtocolFrame): string {
  return `${JSON.stringify(frame)}\n`;
}

export function decodeExtensionHostProtocolFrame(line: string): ExtensionHostProtocolFrame {
  const frame = JSON.parse(line) as ExtensionHostProtocolFrame;
  if (!frame || typeof frame !== 'object' || typeof (frame as { type?: unknown }).type !== 'string') {
    throw new Error('Invalid extension host protocol frame.');
  }
  return frame;
}
