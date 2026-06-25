// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationApprovalShelf } from '../components/conversation/ConversationApprovalShelf';
import { useExtensionBackendConfirmations } from './useExtensionBackendConfirmations';

vi.mock('../client/api', () => ({
  api: {
    extensionUiConfirmations: vi.fn(async () => ({ ok: true, confirmations: [] })),
    resolveExtensionUiConfirmation: vi.fn(async () => ({ ok: true, acknowledged: true })),
  },
}));

const { api } = await import('../client/api');

function ApprovalHarness() {
  const { confirm, remainingMs, confirmApproval, declineApproval } = useExtensionBackendConfirmations();
  if (!confirm) return null;
  return <ConversationApprovalShelf confirm={confirm} remainingMs={remainingMs} onCancel={declineApproval} onConfirm={confirmApproval} />;
}

function dispatchBackendConfirm(
  detail?: Partial<{
    requestId: string;
    extensionId: string;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    timeoutMs: number;
    details: Array<{ label: string; value: string }>;
  }>,
) {
  window.dispatchEvent(
    new CustomEvent('neon-pilot-extension-ui-confirm', {
      detail: {
        requestId: 'confirm-1',
        extensionId: 'system-skill-search',
        title: 'Install community skill',
        message: 'Install Reviewer from Community Skills?',
        confirmLabel: 'Install',
        cancelLabel: 'Cancel',
        timeoutMs: 60_000,
        details: [
          { label: 'Skill', value: 'Reviewer' },
          { label: 'Source', value: 'Community Skills' },
        ],
        ...detail,
      },
    }),
  );
}

describe('useExtensionBackendConfirmations', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.mocked(api.extensionUiConfirmations).mockClear();
    vi.mocked(api.extensionUiConfirmations).mockResolvedValue({ ok: true, confirmations: [] });
    vi.mocked(api.resolveExtensionUiConfirmation).mockClear();
    vi.useRealTimers();
  });

  it('renders backend approvals through the composer approval shelf', async () => {
    render(<ApprovalHarness />);

    act(() => {
      dispatchBackendConfirm();
    });

    expect(await screen.findByTestId('conversation-approval-shelf')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Approval required')).not.toBeNull();
    expect(screen.getByText('Install Reviewer from Community Skills?')).not.toBeNull();
    expect(screen.getByText('Community Skills')).not.toBeNull();
    expect(screen.queryByText('system-skill-search')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(api.resolveExtensionUiConfirmation).toHaveBeenCalledWith('confirm-1', 'confirmed'));
    await waitFor(() => expect(screen.queryByTestId('conversation-approval-shelf')).toBeNull());
  });

  it('reports timeout from the composer approval shelf', async () => {
    vi.useFakeTimers();
    render(<ApprovalHarness />);

    act(() => {
      dispatchBackendConfirm({ requestId: 'confirm-timeout', timeoutMs: 5_000 });
    });

    expect(screen.getByTestId('conversation-approval-shelf')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(5_250);
    });

    expect(api.resolveExtensionUiConfirmation).toHaveBeenCalledWith('confirm-timeout', 'timeout');
    expect(screen.queryByTestId('conversation-approval-shelf')).toBeNull();
  });

  it('recovers pending backend approvals when the push event was missed', async () => {
    vi.mocked(api.extensionUiConfirmations).mockResolvedValueOnce({
      ok: true,
      confirmations: [
        {
          type: 'extension_ui_confirm',
          requestId: 'confirm-pending',
          extensionId: 'system-skill-search',
          title: 'Install community skill',
          message: 'Install recovered skill?',
          confirmLabel: 'Install',
          timeoutMs: 60_000,
          details: [{ label: 'Source', value: 'Community Skills' }],
        },
      ],
    });

    render(<ApprovalHarness />);

    expect(await screen.findByText('Install recovered skill?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(api.resolveExtensionUiConfirmation).toHaveBeenCalledWith('confirm-pending', 'confirmed'));
  });
});
