// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setExtensionCommandContext } from '../extensions/commands';
import { WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT } from './workspaceQuickSelectCommands';
import { WorkspaceQuickSelectModal } from './WorkspaceQuickSelectModal';

vi.mock('../extensions/commands', () => ({
  setExtensionCommandContext: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('WorkspaceQuickSelectModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(setExtensionCommandContext).mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('closes from the shared command event', () => {
    const onClose = vi.fn();

    act(() => {
      root.render(
        <WorkspaceQuickSelectModal
          workspacePaths={['/Users/patrick/project']}
          choosingNewFolder={false}
          onClose={onClose}
          onSelectWorkspace={vi.fn()}
          onChooseNewFolder={vi.fn()}
        />,
      );
    });

    expect(setExtensionCommandContext).toHaveBeenCalledWith('workspaceQuickSelect.open', true);

    act(() => {
      window.dispatchEvent(new CustomEvent(WORKSPACE_QUICK_SELECT_CLOSE_COMMAND_EVENT));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
