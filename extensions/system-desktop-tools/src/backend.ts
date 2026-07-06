import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { controlDesktop, readDesktopState } from '@neon-pilot/extensions/backend/desktop';

function toolResult(details: unknown): { content: Array<{ type: 'text'; text: string }>; details: unknown } {
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
