import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, Field, TextInput } from '../ui';

export interface TextPromptDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  allowEmpty?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function TextPromptDialog({
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel = 'Continue',
  allowEmpty = false,
  onCancel,
  onSubmit,
}: TextPromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canSubmit = allowEmpty || value.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(value);
  };

  return (
    <Dialog onClose={onCancel} labelledBy="text-prompt-dialog-title" className="max-w-md">
      <form onSubmit={submit}>
        <DialogHeader title={title} titleId="text-prompt-dialog-title" />
        <DialogBody>
          <Field label={label}>
            <TextInput ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="action" tone="accent" disabled={!canSubmit}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
