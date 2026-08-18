"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

export const ICON_BUTTON_BASE =
  "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function iconButtonClass(active = false): string {
  return `${ICON_BUTTON_BASE} ${
    active
      ? "border-line-strong bg-surface-2 text-fg"
      : "border-line text-fg-muted hover:bg-surface-2 hover:text-fg"
  }`;
}

export default function IconButton({
  label,
  active = false,
  children,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={className ?? iconButtonClass(active)}
      {...props}
    >
      {children}
    </button>
  );
}
