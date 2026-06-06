import type { ComposerControlContext } from '@neon-pilot/extensions/composer';
import { IconButton } from '@neon-pilot/extensions/ui';

export function AttachFilesComposerControl({
  controlContext,
  buttonContext,
}: {
  controlContext?: ComposerControlContext;
  buttonContext: ComposerControlContext;
}) {
  const context = controlContext ?? buttonContext;
  const handleOpenFilePicker = () => {
    context.openFilePicker();
  };

  return (
    <IconButton
      shape="circle"
      onPointerDown={(event) => {
        event.preventDefault();
        if ((event.pointerType && event.pointerType !== 'mouse') || event.button === 0) {
          handleOpenFilePicker();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpenFilePicker();
        }
      }}
      disabled={context.composerDisabled}
      title="Attach image or file"
      aria-label="Attach image or file"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </IconButton>
  );
}
