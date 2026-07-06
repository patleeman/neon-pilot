import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { readDesktopState } from '@neon-pilot/extensions/backend/desktop';

export async function desktopState(
  _input: unknown,
  _ctx: ExtensionBackendContext,
): Promise<{ content: Array<{ type: 'text'; text: string }>; details: unknown }> {
  const state = await readDesktopState();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(state, null, 2),
      },
    ],
    details: state,
  };
}
