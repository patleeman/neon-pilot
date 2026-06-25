import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';

import { buildApiPath } from '../client/apiBase';
import { ConfirmDialog, Dialog, DialogBody, DialogHeader, IconButton } from '../components/ui';
import { setExtensionCommandContext } from './commands';
import { EXTENSION_MODAL_CLOSE_COMMAND_EVENT } from './extensionModalCommands';
import { createNativeExtensionClient } from './nativePaClient';
import { systemExtensionModules } from './systemExtensionModules';

interface ModalState {
  extensionId: string;
  title?: string;
  component: string;
  props: Record<string, unknown>;
  size?: ExtensionModalSize;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

type ExtensionModalSize = 'default' | 'large' | 'fullscreen';

export function resolveExtensionModalSizeClasses(size: ExtensionModalSize | undefined): {
  dialogClassName: string;
  backdropClassName?: string;
  bodyClassName?: string;
} {
  switch (size) {
    case 'fullscreen':
      return {
        backdropClassName: '!items-start !p-3 !pt-[calc(2.75rem+0.5rem)]',
        dialogClassName: 'ui-extension-modal-fullscreen',
        bodyClassName: 'flex min-h-0 flex-1 overflow-hidden p-0',
      };
    case 'large':
      return {
        dialogClassName: 'ui-extension-modal-large',
        bodyClassName: 'min-h-0 flex-1 overflow-auto',
      };
    case 'default':
    default:
      return {
        dialogClassName: 'ui-extension-modal-default',
      };
  }
}

interface ConfirmState {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

export function ExtensionModalHost() {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [Component, setComponent] = useState<ComponentType<{
    pa: ReturnType<typeof createNativeExtensionClient>;
    props: Record<string, unknown>;
    close: (result?: unknown) => void;
  }> | null>(null);
  const resolveRef = useRef<((value: unknown) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    function handleModal(event: CustomEvent) {
      const {
        extensionId,
        title,
        component: componentName,
        props,
        size,
        resolve,
        reject,
      } = event.detail as ModalState & {
        extensionId: string;
      };
      resolveRef.current = resolve;
      rejectRef.current = reject;

      setModal({ extensionId, title, component: componentName, props, size, resolve, reject });
    }

    window.addEventListener('neon-pilot-extension-modal', handleModal as EventListener);
    return () => window.removeEventListener('neon-pilot-extension-modal', handleModal as EventListener);
  }, []);

  useEffect(() => {
    function handleConfirm(event: CustomEvent) {
      const { title, message, confirmLabel, cancelLabel, resolve } = event.detail as ConfirmState;
      confirmResolveRef.current?.(false);
      confirmResolveRef.current = resolve;
      setConfirm({ title, message, confirmLabel, cancelLabel, resolve });
    }

    window.addEventListener('neon-pilot-extension-confirm', handleConfirm as EventListener);
    return () => window.removeEventListener('neon-pilot-extension-confirm', handleConfirm as EventListener);
  }, []);

  // Reject the promise if the host unmounts while a modal is open
  useEffect(() => {
    return () => {
      rejectRef.current?.(new Error('Extension modal host unmounted'));
      confirmResolveRef.current?.(false);
      resolveRef.current = null;
      rejectRef.current = null;
      confirmResolveRef.current = null;
    };
  }, []);

  const handleClose = useCallback((result?: unknown) => {
    if (resolveRef.current) {
      resolveRef.current(result ?? null);
      resolveRef.current = null;
      rejectRef.current = null;
    }
    setModal(null);
    setComponent(null);
  }, []);

  const handleConfirmClose = useCallback((confirmed: boolean) => {
    confirmResolveRef.current?.(confirmed);
    confirmResolveRef.current = null;
    setConfirm(null);
  }, []);

  useEffect(() => {
    if (!modal) {
      return;
    }

    function handleCloseCommand() {
      handleClose();
    }

    setExtensionCommandContext('extensionModal.open', true);
    window.addEventListener(EXTENSION_MODAL_CLOSE_COMMAND_EVENT, handleCloseCommand);
    return () => {
      setExtensionCommandContext('extensionModal.open', null);
      window.removeEventListener(EXTENSION_MODAL_CLOSE_COMMAND_EVENT, handleCloseCommand);
    };
  }, [handleClose, modal]);

  // Load the component when modal state changes
  useEffect(() => {
    if (!modal) {
      setComponent(null);
      return;
    }

    const systemLoader = systemExtensionModules.get(modal.extensionId);

    async function load() {
      try {
        if (systemLoader) {
          // System extension — load from bundled module
          const module = await systemLoader();
          const comp = module[modal.component] as ComponentType | undefined;
          if (typeof comp !== 'function') {
            rejectRef.current?.(new Error(`Component "${modal.component}" not found in extension "${modal.extensionId}"`));
            return;
          }
          setComponent(
            () =>
              comp as ComponentType<{
                pa: ReturnType<typeof createNativeExtensionClient>;
                props: Record<string, unknown>;
                close: (result?: unknown) => void;
              }>,
          );
        } else {
          // User/runtime extension — load from remote Vite module
          const url = buildApiPath(
            `/extensions/${encodeURIComponent(modal.extensionId)}/files/${modal.component.split('/').map(encodeURIComponent).join('/')}`,
          );
          const remoteModule = await import(/* @vite-ignore */ url);
          const comp = remoteModule[modal.component.split('/').pop() ?? modal.component] as ComponentType | undefined;
          if (typeof comp !== 'function') {
            rejectRef.current?.(new Error(`Component "${modal.component}" not found in extension "${modal.extensionId}"`));
            return;
          }
          setComponent(
            () =>
              comp as ComponentType<{
                pa: ReturnType<typeof createNativeExtensionClient>;
                props: Record<string, unknown>;
                close: (result?: unknown) => void;
              }>,
          );
        }
      } catch (err) {
        rejectRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    }

    load();
  }, [modal]);

  const confirmDialog = confirm ? (
    <ConfirmDialog
      title={confirm.title ?? 'Confirm action'}
      message={confirm.message}
      confirmLabel={confirm.confirmLabel}
      cancelLabel={confirm.cancelLabel}
      onCancel={() => handleConfirmClose(false)}
      onConfirm={() => handleConfirmClose(true)}
    />
  ) : null;

  if (!modal || !Component) return <>{confirmDialog}</>;

  const pa = createNativeExtensionClient(modal.extensionId);
  const modalSizeClasses = resolveExtensionModalSizeClasses(modal.size);

  return (
    <>
      {confirmDialog}
      <Dialog
        onClose={() => handleClose()}
        labelledBy={modal.title ? 'extension-modal-title' : undefined}
        aria-label={modal.title ? undefined : 'Extension dialog'}
        backdropClassName={modalSizeClasses.backdropClassName}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleClose();
        }}
        className={modalSizeClasses.dialogClassName}
      >
        {modal.title ? (
          <DialogHeader
            title={modal.title}
            titleId="extension-modal-title"
            actions={
              <IconButton onClick={() => handleClose()} aria-label="Close">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </IconButton>
            }
          />
        ) : null}
        <DialogBody className={modalSizeClasses.bodyClassName}>
          <Component pa={pa} props={modal.props} close={handleClose} />
        </DialogBody>
      </Dialog>
    </>
  );
}
