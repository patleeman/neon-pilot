import { Button, ChoiceRow, Pill } from '../ui';
import type { ExtensionBackendConfirmState } from '../../extensions/useExtensionBackendConfirmations';

export function ConversationApprovalShelf({
  confirm,
  remainingMs,
  onCancel,
  onConfirm,
}: {
  confirm: ExtensionBackendConfirmState;
  remainingMs: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <div className="border-b border-border-subtle/60 bg-base/20 px-4 py-3" data-testid="conversation-approval-shelf">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="ui-section-label text-[11px] tracking-[0.12em] text-accent">Approval required</span>
        <Pill tone={seconds <= 10 ? 'warning' : 'muted'} className="px-2 py-0.5 text-[11px]">
          {seconds}s
        </Pill>
      </div>

      <div className="mt-2.5">
        <p className="text-[13px] font-medium leading-snug text-primary break-words">{confirm.title}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-secondary break-words">{confirm.message}</p>
      </div>

      {confirm.details?.length ? (
        <div className="mt-2 space-y-0.5" aria-label="Approval details">
          {confirm.details.map((detail) => (
            <ChoiceRow
              key={`${detail.label}:${detail.value}`}
              label={detail.label}
              details={detail.value}
              indicator="?"
              className="cursor-default rounded-md px-2 py-1.5 text-left"
              disabled
            />
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {confirm.cancelLabel ?? 'Cancel'}
        </Button>
        <Button variant="action" tone="accent" onClick={onConfirm}>
          {confirm.confirmLabel ?? 'Approve'}
        </Button>
      </div>
    </div>
  );
}
