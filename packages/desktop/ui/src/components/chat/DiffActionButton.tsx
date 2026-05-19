import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../ui';

export function GitDiffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cx('h-3.5 w-3.5', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="4" cy="3.5" r="1.6" />
      <circle cx="4" cy="12.5" r="1.6" />
      <circle cx="12" cy="8" r="1.6" />
      <path d="M4 5.2v5.6M4 5.2c0 2.2 1.8 2.8 4 2.8h2.2" />
    </svg>
  );
}

export function DiffActionButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" {...props} className={cx('ui-action-button inline-flex items-center gap-1.5 font-sans', className)}>
      <GitDiffIcon className="shrink-0" />
      <span>{children}</span>
    </button>
  );
}
