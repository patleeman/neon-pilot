import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { captureDesktopScreenshot, controlDesktop, readDesktopState } from '@neon-pilot/extensions/backend/desktop';

type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data: string; mimeType: string };

function toolResult(details: unknown): { content: TextContent[]; details: unknown } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(details, null, 2),
      },
    ],
    details,
  };
}

function screenshotDetails(result: unknown): unknown {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
  const record = result as Record<string, unknown>;
  const image =
    record.image && typeof record.image === 'object' && !Array.isArray(record.image) ? (record.image as Record<string, unknown>) : null;
  if (!image) return result;
  const imageMetadata = { ...image };
  delete imageMetadata.data;
  return { ...record, image: imageMetadata };
}

function screenshotText(details: unknown): string {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return JSON.stringify(details, null, 2);
  const record = details as Record<string, unknown>;
  if (record.ok === false) {
    const error = typeof record.error === 'string' && record.error.trim() ? record.error.trim() : 'Windowed OS screenshot failed.';
    return `desktop_screenshot failed: ${error}`;
  }
  return JSON.stringify(details, null, 2);
}

export async function desktopControl(
  input: unknown,
  _ctx: ExtensionBackendContext,
): Promise<{ content: Array<{ type: 'text'; text: string }>; details: unknown }> {
  const result = await controlDesktop(input);
  return toolResult(result);
}

export async function desktopState(
  _input: unknown,
  _ctx: ExtensionBackendContext,
): Promise<{ content: Array<{ type: 'text'; text: string }>; details: unknown }> {
  const state = await readDesktopState();
  return toolResult(state);
}

export async function desktopScreenshot(
  input: unknown,
  _ctx: ExtensionBackendContext,
): Promise<{ content: Array<TextContent | ImageContent>; details: unknown }> {
  const result = await captureDesktopScreenshot(input);
  const details = screenshotDetails(result);
  const content: Array<TextContent | ImageContent> = [
    {
      type: 'text',
      text: screenshotText(details),
    },
  ];
  const image =
    result && typeof result === 'object' && !Array.isArray(result) && 'image' in result
      ? ((result as { image?: { data?: unknown; mimeType?: unknown } }).image ?? null)
      : null;
  if (image && typeof image.data === 'string' && typeof image.mimeType === 'string') {
    content.push({ type: 'image', data: image.data, mimeType: image.mimeType });
  }
  return { content, details };
}
