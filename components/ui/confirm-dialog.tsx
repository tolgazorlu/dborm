"use client";

import { useEffect } from "react";

import { useI18n } from "@/components/i18n-provider";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">{body}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-3 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {t.confirm.cancel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors"
            style={
              destructive
                ? { background: "var(--sev-critical)", color: "var(--accent-fg)" }
                : { background: "var(--accent)", color: "var(--accent-fg)" }
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
